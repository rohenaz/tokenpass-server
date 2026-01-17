import { ECIES, Hash, type PrivateKey, Utils } from "@bsv/sdk";
import {
	createErrorResponse,
	extractAccessToken,
	validateAccessToken,
} from "@sigma-auth/better-auth-plugin/server/local";
import { type NextRequest, NextResponse } from "next/server";
import { Key, State, Wallet } from "@/lib/tokenpass/server";

const { toArray, toHex, toUTF8 } = Utils;

/**
 * POST /api/decrypt
 *
 * Decrypts ciphertext using Type42 ECIES encryption.
 *
 * Request body:
 * - ciphertext: string - Hex-encoded encrypted data
 * - friendBapId: string - The friend's BAP ID (for key derivation context)
 * - theirPublicKey?: string - Optional friend's public key (hex)
 *
 * The derivation uses either:
 * - Self-derived key (sigma-encrypt-{friendBapId}) when only friendBapId provided
 * - ECDH shared key when theirPublicKey is provided
 *
 * Returns: { data: string, success: true }
 *
 * Requires Authorization header with access token from /api/auth
 */
export async function POST(request: NextRequest) {
	const seedData = Key.getSeed();
	if (!seedData) {
		return NextResponse.json(createErrorResponse("Wallet is locked. Please login first.", 1), {
			status: 401,
		});
	}

	const body = await request.json();
	const { ciphertext, friendBapId, theirPublicKey } = body;

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

	if (!ciphertext) {
		return NextResponse.json(createErrorResponse("ciphertext is required."), { status: 400 });
	}

	if (!friendBapId && !theirPublicKey) {
		return NextResponse.json(
			createErrorResponse("Either friendBapId or theirPublicKey is required."),
			{ status: 400 },
		);
	}

	try {
		const masterKey = Wallet.seedToMasterKey(seedData.hex);

		// Derive the decryption key based on provided parameters
		const purpose = friendBapId || "default";
		let decryptionKey: PrivateKey;

		if (theirPublicKey) {
			// ECDH derivation with counterparty's public key
			const sharedKeyData = Wallet.deriveSharedKey(masterKey, theirPublicKey, purpose);
			decryptionKey = sharedKeyData.privateKey;
		} else {
			// Self-derivation for the friend relationship
			// BRC-43 format: security level 2 with hashed purpose
			const purposeHash = toHex(Hash.sha256(toArray(purpose, "utf8")));
			const invoiceNumber = `2-encrypt-${purposeHash}`;
			decryptionKey = masterKey.deriveChild(masterKey.toPublicKey(), invoiceNumber);
		}

		// Decrypt using ECIES with the derived key
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
