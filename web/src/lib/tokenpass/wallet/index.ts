import { BigNumber, BSM, HD, PrivateKey, PublicKey, Signature, Utils } from "@bsv/sdk";
import { getAuthToken, parseAuthToken, verifyAuthToken } from "bitcoin-auth";
import { encrypt as enc } from "../crypt";
import type { KeyRecord, SeedData, SignedMessage } from "../types";
import { generateMnemonic } from "../utils/mnemonic";

const { toArray, toHex } = Utils;

export const sign = (
	message: string,
	key: KeyRecord,
	encoding?: BufferEncoding,
): SignedMessage => {
	const privateKey = PrivateKey.fromWif(key.priv!);
	const messageArray = encoding
		? toArray(message, encoding as "utf8" | "hex" | "base64")
		: toArray(message, "utf8");
	const sig = BSM.sign(messageArray, privateKey);
	return {
		address: key.address,
		message: message,
		// BSM.sign returns a base64 string, but TypeScript types it as string | Signature
		sig: sig as string,
		ts: Date.now(),
	};
};

export const encrypt = (
	message: string,
	key: KeyRecord,
): { address: string; data: any; ts: number } => {
	const privateKey = PrivateKey.fromWif(key.priv!);
	const privKeyBytes = privateKey.toArray();
	const data = enc(message, undefined, Buffer.from(privKeyBytes));
	return {
		address: key.address,
		data,
		ts: Date.now(),
	};
};

export const create = async (
	seedData: SeedData,
	account: number,
	o: { host: string },
): Promise<Omit<KeyRecord, "priv">> => {
	/********************************************************************
	 * The derivation path follows the
	 * BIP44 standard with a twist:
	 *
	 * - A new account is created per web host
	 * - It uses a new branch of "2" instead of (0 or 1)
	 *
	 * This way there is no overlap with existing BIP44 wallets but
	 * the wallet scheme can seamlessly integrate with them.
	 *
	 ********************************************************************/
	const StarfishBranch = 2;
	const path = `m/44'/0'/${account}'/${StarfishBranch}/0`;
	const derived = seedData.key.derive(path);
	const address = derived.privKey.toAddress();
	const keys = {
		path,
		pub: derived.pubKey.toString(),
		address,
		host: o.host,
	};

	return keys;
};

export const seed = (hex?: string, passphrase?: string, mnemonicPhrase?: string): SeedData => {
	let bytes: number[];
	let mnemonic: string | undefined;

	if (!hex) {
		if (!passphrase) {
			throw new Error("passphrase required creating initial seed");
		}
		const mnem = generateMnemonic(128);
		mnem.setPassphrase(passphrase);
		bytes = mnem.toBytes();
		mnemonic = mnem.phrase;
	} else {
		bytes = toArray(hex, "hex");
		mnemonic = mnemonicPhrase;
	}
	const key = HD.fromSeed(bytes);
	return {
		hex: toHex(bytes),
		key,
		mnemonic,
	};
};

export const derive = (
	seedData: SeedData,
	path: string,
): ReturnType<HD["derive"]> => {
	return seedData.key.derive(path);
};

export const verify = (
	message: string,
	address: string,
	sig: string,
	encoding?: BufferEncoding,
): boolean => {
	const messageArray = encoding
		? toArray(message, encoding as "utf8" | "hex" | "base64")
		: toArray(message, "utf8");

	try {
		// Parse the compact signature from base64
		const sigBytes = toArray(sig, "base64");

		// Extract recovery flag from first byte (27-30: uncompressed, 31-34: compressed)
		const recoveryByte = sigBytes[0];
		const recovery = recoveryByte >= 31 ? recoveryByte - 31 : recoveryByte - 27;

		const signature = Signature.fromCompact(sigBytes);

		// Get the magic hash
		const msgHashArray = BSM.magicHash(messageArray);
		const msgHash = new BigNumber(msgHashArray);

		// Recover the public key from the signature
		const recoveredPubKey = signature.RecoverPublicKey(recovery, msgHash);
		const recoveredAddress = recoveredPubKey.toAddress();

		return recoveredAddress === address;
	} catch {
		return false;
	}
};

// TODO: Implement UTXO store lookup to find key for transaction
export const keyForTx = async (
	_txid: string | undefined,
): Promise<KeyRecord | null> => {
	// Placeholder: This should query a UTXO store to find the key that owns the txid
	return null;
};

/**
 * Create a bitcoin-auth token for API authentication
 * Format: Base64 encoded JSON with pubkey, scheme, timestamp, path, signature
 *
 * @param key - KeyRecord containing the private key (WIF)
 * @param requestPath - The API path being authenticated
 * @param body - Optional request body to include in signature
 * @param scheme - Signature scheme ('bsm' or 'brc77', default: 'brc77')
 * @returns Base64 encoded auth token string
 */
export const createAuthToken = (
	key: KeyRecord,
	requestPath: string,
	body?: string,
	scheme: "bsm" | "brc77" = "brc77",
): string => {
	if (!key.priv) {
		throw new Error("Private key is required to create auth token");
	}

	return getAuthToken({
		privateKeyWif: key.priv,
		requestPath,
		body,
		scheme,
	});
};

/**
 * Verify a bitcoin-auth token
 *
 * @param token - The auth token to verify
 * @param requestPath - The expected request path
 * @param body - The expected request body (if any)
 * @param timePad - Maximum age of token in seconds (default: 300 = 5 minutes)
 * @returns True if token is valid
 */
export const verifyToken = (
	token: string,
	requestPath: string,
	body?: string,
	timePad = 300,
): boolean => {
	return verifyAuthToken(
		token,
		{
			requestPath,
			timestamp: "", // verifyAuthToken will check the timestamp from the token
			body,
		},
		timePad,
	);
};

/**
 * Parse a bitcoin-auth token to extract its components
 *
 * @param token - The auth token to parse
 * @returns Parsed token object or null if invalid
 */
export const parseToken = (token: string) => {
	return parseAuthToken(token);
};

// Re-export bitcoin-auth functions for convenience
export { getAuthToken, parseAuthToken, verifyAuthToken };

/**
 * Type42 (BRC-42) Key Derivation
 *
 * Type42 uses ECDH-based key derivation instead of BIP32 paths.
 * This provides better privacy since derived keys are not linkable
 * without knowing both the master key and the counterparty's public key.
 *
 * For self-derivation (no counterparty), we use the master key's own
 * public key as the counterparty, with an invoice number as identifier.
 */

/**
 * Convert seed hex to a master PrivateKey for Type42 derivation
 * Uses SHA256 of the seed bytes to get a 256-bit key
 *
 * @param seedHex - The seed hex string
 * @returns PrivateKey for Type42 derivation
 */
export const seedToMasterKey = (seedHex: string): PrivateKey => {
	const seedBytes = toArray(seedHex, "hex");
	// Use the first 32 bytes of the seed as the key
	// (Standard HD wallets use 64-byte seeds, first 32 for key, rest for chaincode)
	const keyBytes = seedBytes.slice(0, 32);
	return new PrivateKey(keyBytes);
};

/**
 * Derive a child key for a specific host using Type42
 * Uses self-derivation (own public key as counterparty)
 *
 * @param masterKey - The master PrivateKey
 * @param host - The host name to derive key for
 * @returns Object with privateKey, address, and invoiceNumber
 */
export const deriveKeyForHost = (
	masterKey: PrivateKey,
	host: string,
): {
	privateKey: PrivateKey;
	address: string;
	invoiceNumber: string;
} => {
	const invoiceNumber = `sigma-auth-${host}`;

	// Type42: self-derivation using own public key
	const childKey = masterKey.deriveChild(
		masterKey.toPublicKey(),
		invoiceNumber,
	);

	return {
		privateKey: childKey,
		address: childKey.toPublicKey().toAddress(),
		invoiceNumber,
	};
};

/**
 * Derive a shared key for friend-based encryption using Type42
 * Uses ECDH with the friend's public key
 *
 * @param masterKey - The master PrivateKey
 * @param friendPubKeyHex - The friend's public key in hex
 * @param purpose - Purpose string for the derivation (e.g., 'encryption', 'signing')
 * @returns Object with privateKey and invoiceNumber
 */
export const deriveSharedKey = (
	masterKey: PrivateKey,
	friendPubKeyHex: string,
	purpose: string,
): {
	privateKey: PrivateKey;
	invoiceNumber: string;
} => {
	const friendPubKey = PublicKey.fromString(friendPubKeyHex);
	const invoiceNumber = `sigma-encrypt-${purpose}`;

	// Type42: ECDH derivation with friend's public key
	const childKey = masterKey.deriveChild(friendPubKey, invoiceNumber);

	return {
		privateKey: childKey,
		invoiceNumber,
	};
};

/**
 * Get the public key that should be shared with a friend for Type42 derivation
 * This is derived from our master key using the friend's BAP ID as context
 *
 * @param masterKey - The master PrivateKey
 * @param friendBapId - The friend's BAP ID
 * @returns Hex-encoded public key to share with the friend
 */
export const getFriendPublicKey = (
	masterKey: PrivateKey,
	friendBapId: string,
): string => {
	const invoiceNumber = `sigma-friend-${friendBapId}`;

	// Derive a key specifically for this friend relationship
	const childKey = masterKey.deriveChild(
		masterKey.toPublicKey(),
		invoiceNumber,
	);

	return childKey.toPublicKey().toString();
};
