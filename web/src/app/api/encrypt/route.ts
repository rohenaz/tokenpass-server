import { ECIES, Hash, PublicKey, Utils } from "@bsv/sdk";
import {
	createErrorResponse,
	extractAccessToken,
	validateAccessToken,
} from "@sigma-auth/better-auth-plugin/server/local";
import { type NextRequest, NextResponse } from "next/server";
import { Key, State, Wallet } from "@/lib/tokenpass/server";

const { toArray, toHex } = Utils;

/**
 * POST /api/encrypt
 *
 * Encrypts data using Type42 ECIES encryption.
 *
 * Two modes:
 * 1. Friend-based encryption: { data, friendBapId, theirPublicKey? }
 *    - Uses Type42 to derive a shared key for the friend
 *    - If theirPublicKey is provided, uses ECDH with their key
 *
 * 2. Host-key self-encryption: { message }
 *    - Uses the host's derived key for self-encryption
 *
 * Returns: { ciphertext: string, success: true } or { address, data, ts }
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
	const { data, message, friendBapId, theirPublicKey } = body;

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

	// Friend-based Type42 encryption (with friendBapId or theirPublicKey)
	if (data && (friendBapId || theirPublicKey)) {
		try {
			const masterKey = Wallet.seedToMasterKey(seedData.hex);

			// Derive encryption key
			const purpose = friendBapId || "default";
			let encryptionPubKey: PublicKey;

			if (theirPublicKey) {
				// Use provided public key for ECIES
				encryptionPubKey = PublicKey.fromString(theirPublicKey);
			} else {
				// Derive a key for the friend relationship
				// BRC-43 format: security level 2 with hashed purpose
				const purposeHash = toHex(Hash.sha256(toArray(purpose, "utf8")));
				const invoiceNumber = `2-encrypt-${purposeHash}`;
				const derivedKey = masterKey.deriveChild(masterKey.toPublicKey(), invoiceNumber);
				encryptionPubKey = derivedKey.toPublicKey();
			}

			// Encrypt using ECIES with the target public key
			const dataBytes = toArray(data, "utf8");
			const encryptedBytes = ECIES.electrumEncrypt(dataBytes, encryptionPubKey);
			const ciphertext = toHex(encryptedBytes);

			return NextResponse.json({
				ciphertext,
				success: true,
			});
		} catch (error) {
			return NextResponse.json(
				createErrorResponse(
					`Failed to encrypt: ${error instanceof Error ? error.message : String(error)}`,
				),
				{ status: 500 },
			);
		}
	}

	// Host-key self-encryption mode
	const encryptMessage = data || message;
	if (!encryptMessage) {
		return NextResponse.json(
			createErrorResponse(
				"Either 'data' with 'friendBapId'/'theirPublicKey', or 'message' for self-encryption is required.",
			),
			{ status: 400 },
		);
	}

	const host = validation.host || "localhost";
	const key = await Key.findOrCreate({ host });

	if (!key) {
		return NextResponse.json(createErrorResponse("Please create a wallet."), { status: 417 });
	}

	const encryptedResponse = Key.encrypt({ message: encryptMessage, key });
	return NextResponse.json(encryptedResponse);
}
