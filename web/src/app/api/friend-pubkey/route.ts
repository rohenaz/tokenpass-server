import { NextRequest, NextResponse } from "next/server";
import { Key, State, Wallet } from "@/lib/tokenpass/server";

/**
 * POST /api/friend-pubkey
 *
 * Gets the public key to share with a friend for Type42 ECIES encryption.
 * The returned public key is derived specifically for the friend relationship,
 * providing privacy through key separation.
 *
 * Request body:
 * - friendBapId: string - The friend's BAP ID
 *
 * Returns: { publicKey: string, success: true }
 *
 * Requires Authorization header with access token from /api/auth
 */
export async function POST(request: NextRequest) {
	const body = await request.json();
	const { friendBapId } = body;

	if (!Key.getSeed()) {
		return NextResponse.json(
			{
				error: "Wallet is locked. Please login first.",
				code: 1,
				success: false,
			},
			{ status: 401 },
		);
	}

	const authHeader = request.headers.get("authorization");
	const accessToken = authHeader?.replace(/^Bearer\s+/i, "");

	if (!accessToken) {
		return NextResponse.json(
			{
				error: "Please provide an access token in the Authorization header.",
				code: 2,
				success: false,
			},
			{ status: 401 },
		);
	}

	const state = await State.findOne({ accessToken });
	if (!state?.accessToken || state.accessToken !== accessToken) {
		return NextResponse.json(
			{
				error: "Invalid access token.",
				code: 3,
				success: false,
			},
			{ status: 401 },
		);
	}

	const expired = state.expireTime && state.expireTime < Date.now();
	if (expired) {
		return NextResponse.json(
			{
				error: "Access token has expired.",
				code: 5,
				success: false,
			},
			{ status: 401 },
		);
	}

	if (!friendBapId) {
		return NextResponse.json(
			{
				error: "friendBapId is required.",
				success: false,
			},
			{ status: 400 },
		);
	}

	try {
		const seedData = Key.getSeed()!;

		// Get master key for Type42 derivation
		const masterKey = Wallet.seedToMasterKey(seedData.hex);

		// Get the public key for this friend relationship
		const publicKey = Wallet.getFriendPublicKey(masterKey, friendBapId);

		return NextResponse.json({
			publicKey,
			success: true,
		});
	} catch (error) {
		return NextResponse.json(
			{
				error: `Failed to get friend public key: ${error instanceof Error ? error.message : String(error)}`,
				success: false,
			},
			{ status: 500 },
		);
	}
}
