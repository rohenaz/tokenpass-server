import { NextRequest, NextResponse } from "next/server";
import { Key, State } from "@/lib/tokenpass/server";
import { PrivateKey, BSM, Utils } from "@bsv/sdk";

const { toArray } = Utils;

/**
 * POST /api/sign-aip
 *
 * Signs an array of hex strings using AIP (Author Identity Protocol).
 * Used for signing on-chain data with the identity key.
 *
 * Request body: { data: string[] } - Array of hex strings to sign
 * Returns: { signedOps: string[], success: true }
 *
 * Requires Authorization header with access token from /api/auth
 */
export async function POST(request: NextRequest) {
	const body = await request.json();
	const { data } = body;

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

	if (!Array.isArray(data) || data.length === 0) {
		return NextResponse.json(
			{
				error: "data must be a non-empty array of hex strings.",
				success: false,
			},
			{ status: 400 },
		);
	}

	const host = state.host || "localhost";
	const key = await Key.findOrCreate({ host });

	if (!key) {
		return NextResponse.json(
			{ error: "Please create a wallet.", success: false },
			{ status: 417 },
		);
	}

	try {
		const privateKey = PrivateKey.fromWif(key.priv!);

		// AIP signing: concatenate all hex buffers, then sign with BSM
		const combinedBytes: number[] = [];
		for (const hexStr of data) {
			const bytes = toArray(hexStr, "hex");
			combinedBytes.push(...bytes);
		}

		// Sign the combined data with BSM
		const sig = BSM.sign(combinedBytes, privateKey) as string;
		const address = privateKey.toPublicKey().toAddress();

		// Return the AIP fields as signed operations
		// AIP format: ["BITCOIN_ECDSA", address, signature]
		const signedOps = ["BITCOIN_ECDSA", address, sig];

		return NextResponse.json({
			signedOps,
			success: true,
		});
	} catch (error) {
		return NextResponse.json(
			{
				error: `Failed to sign AIP data: ${error instanceof Error ? error.message : String(error)}`,
				success: false,
			},
			{ status: 500 },
		);
	}
}
