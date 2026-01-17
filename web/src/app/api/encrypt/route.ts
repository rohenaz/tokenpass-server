import { NextRequest, NextResponse } from "next/server";
import { Key, State, Wallet } from "@/lib/tokenpass/server";
import { ECIES, PublicKey, Utils } from "@bsv/sdk";
import {
	validateAccessToken,
	extractAccessToken,
	createErrorResponse,
} from "@sigma-auth/better-auth-plugin/server/local";

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
 * 2. Legacy self-encryption: { message }
 *    - Uses the host's derived key for self-encryption
 *
 * Returns: { ciphertext: string, success: true } or legacy { address, data, ts }
 *
 * Requires Authorization header with access token from /api/auth
 */
export async function POST(request: NextRequest) {
	const body = await request.json();
	const { data, message, friendBapId, theirPublicKey } = body;

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

	// Friend-based Type42 encryption (new mode)
	if (data && (friendBapId || theirPublicKey)) {
		try {
			const seedData = Key.getSeed()!;
			const masterKey = Wallet.seedToMasterKey(seedData.hex);

			// Derive encryption key
			const purpose = friendBapId || "default";
			let encryptionPubKey: PublicKey;

			if (theirPublicKey) {
				// Use provided public key for ECIES
				encryptionPubKey = PublicKey.fromString(theirPublicKey);
			} else {
				// Derive a key for the friend relationship
				const invoiceNumber = `sigma-encrypt-${purpose}`;
				const derivedKey = masterKey.deriveChild(
					masterKey.toPublicKey(),
					invoiceNumber,
				);
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

	// Legacy self-encryption mode (backward compatible)
	const encryptMessage = data || message;
	if (!encryptMessage) {
		return NextResponse.json(
			createErrorResponse(
				"Either 'data' with 'friendBapId'/'theirPublicKey', or 'message' for legacy mode is required.",
			),
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

	const encryptedResponse = Key.encrypt({ message: encryptMessage, key });
	return NextResponse.json(encryptedResponse);
}
