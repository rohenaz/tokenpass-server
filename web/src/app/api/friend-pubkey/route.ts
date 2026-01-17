import {
	createErrorResponse,
	extractAccessToken,
	validateAccessToken,
} from "@sigma-auth/better-auth-plugin/server/local";
import { type NextRequest, NextResponse } from "next/server";
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
		return NextResponse.json(createErrorResponse("Wallet is locked. Please login first.", 1), {
			status: 401,
		});
	}

	const accessToken = extractAccessToken(request.headers.get("authorization"));
	const validation = await validateAccessToken({
		accessToken: accessToken || "",
		findState: (token) => State.findOne({ accessToken: token }),
	});

	if (!validation.valid) {
		return NextResponse.json(
			createErrorResponse(validation.error ?? "Invalid token", validation.code),
			{ status: 401 },
		);
	}

	if (!friendBapId) {
		return NextResponse.json(createErrorResponse("friendBapId is required."), { status: 400 });
	}

	try {
		const seedData = Key.getSeed();
		if (!seedData) {
			return NextResponse.json(createErrorResponse("Wallet is locked. Please login first.", 1), {
				status: 401,
			});
		}

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
			createErrorResponse(
				`Failed to get friend public key: ${error instanceof Error ? error.message : String(error)}`,
			),
			{ status: 500 },
		);
	}
}
