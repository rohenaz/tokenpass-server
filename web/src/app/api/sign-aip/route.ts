import { NextRequest, NextResponse } from "next/server";
import { Key, State } from "@/lib/tokenpass/server";
import { PrivateKey, BSM, Utils } from "@bsv/sdk";
import {
	validateAccessToken,
	extractAccessToken,
	createErrorResponse,
} from "@sigma-auth/better-auth-plugin/server/local";

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
			createErrorResponse("Wallet is locked. Please login first.", 1),
			{ status: 401 },
		);
	}

	const accessToken = extractAccessToken(request.headers.get("authorization"));
	const validation = await validateAccessToken({
		accessToken: accessToken || "",
		findState: (token) => State.findOne({ accessToken: token }),
	});

	if (!validation.valid) {
		return NextResponse.json(
			createErrorResponse(validation.error!, validation.code),
			{ status: 401 },
		);
	}

	if (!Array.isArray(data) || data.length === 0) {
		return NextResponse.json(
			createErrorResponse("data must be a non-empty array of hex strings."),
			{ status: 400 },
		);
	}

	const host = validation.host || "localhost";
	const key = await Key.findOrCreate({ host });

	if (!key) {
		return NextResponse.json(
			createErrorResponse("Please create a wallet."),
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
			createErrorResponse(
				`Failed to sign AIP data: ${error instanceof Error ? error.message : String(error)}`,
			),
			{ status: 500 },
		);
	}
}
