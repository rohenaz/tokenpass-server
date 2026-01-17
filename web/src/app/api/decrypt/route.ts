import { NextRequest, NextResponse } from "next/server";
import { Key, State, Wallet } from "@/lib/tokenpass/server";
import { ECIES, PrivateKey, Utils } from "@bsv/sdk";

const { toArray, toUTF8 } = Utils;

/**
 * POST /api/decrypt
 *
 * Decrypts ciphertext using Type42 ECIES with friend's public key.
 *
 * Request body:
 * - ciphertext: string - Hex-encoded encrypted data
 * - friendBapId: string - The friend's BAP ID (for key derivation context)
 * - theirPublicKey?: string - Optional friend's public key (hex)
 *
 * Returns: { data: string, success: true }
 *
 * Requires Authorization header with access token from /api/auth
 */
export async function POST(request: NextRequest) {
	const body = await request.json();
	const { ciphertext, friendBapId, theirPublicKey } = body;

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

	if (!ciphertext) {
		return NextResponse.json(
			{
				error: "ciphertext is required.",
				success: false,
			},
			{ status: 400 },
		);
	}

	if (!friendBapId && !theirPublicKey) {
		return NextResponse.json(
			{
				error: "Either friendBapId or theirPublicKey is required.",
				success: false,
			},
			{ status: 400 },
		);
	}

	try {
		const seedData = Key.getSeed()!;

		// Get master key for Type42 derivation
		const masterKey = Wallet.seedToMasterKey(seedData.hex);

		// Derive shared key using Type42 with friend's context
		const purpose = friendBapId || "default";
		let decryptionKey: PrivateKey;

		if (theirPublicKey) {
			// Use provided public key for ECDH derivation
			const sharedKeyData = Wallet.deriveSharedKey(
				masterKey,
				theirPublicKey,
				purpose,
			);
			decryptionKey = sharedKeyData.privateKey;
		} else {
			// Use self-derived key for the friend relationship
			const invoiceNumber = `sigma-encrypt-${purpose}`;
			decryptionKey = masterKey.deriveChild(
				masterKey.toPublicKey(),
				invoiceNumber,
			);
		}

		// Decrypt using ECIES
		const ciphertextBytes = toArray(ciphertext, "hex");
		const decryptedBytes = ECIES.electrumDecrypt(ciphertextBytes, decryptionKey);
		const decryptedText = toUTF8(decryptedBytes);

		return NextResponse.json({
			data: decryptedText,
			success: true,
		});
	} catch (error) {
		return NextResponse.json(
			{
				error: `Failed to decrypt: ${error instanceof Error ? error.message : String(error)}`,
				success: false,
			},
			{ status: 500 },
		);
	}
}
