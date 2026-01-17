import { NextRequest, NextResponse } from "next/server";
import { Key, State, Wallet } from "@/lib/tokenpass/server";
import { ECIES, PrivateKey, Utils } from "@bsv/sdk";
import {
	validateAccessToken,
	extractAccessToken,
	createErrorResponse,
} from "@sigma-auth/better-auth-plugin/server/local";

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

	if (!ciphertext) {
		return NextResponse.json(
			createErrorResponse("ciphertext is required."),
			{ status: 400 },
		);
	}

	if (!friendBapId && !theirPublicKey) {
		return NextResponse.json(
			createErrorResponse("Either friendBapId or theirPublicKey is required."),
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
			createErrorResponse(
				`Failed to decrypt: ${error instanceof Error ? error.message : String(error)}`,
			),
			{ status: 500 },
		);
	}
}
