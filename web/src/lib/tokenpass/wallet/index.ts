import { BigNumber, BSM, ECIES, Hash, HD, PrivateKey, PublicKey, Signature, Utils } from "@bsv/sdk";
import { getAuthToken, parseAuthToken, verifyAuthToken } from "bitcoin-auth";
import type { KeyRecord, SeedData, SignedMessage } from "../types";
import { generateMnemonic } from "../utils/mnemonic";

const { toArray, toHex, toUTF8 } = Utils;

/**
 * Sign a message using BSM (Bitcoin Signed Message)
 */
export const sign = (message: string, key: KeyRecord, encoding?: BufferEncoding): SignedMessage => {
	if (!key.priv) {
		throw new Error("Private key is required to sign");
	}
	const privateKey = PrivateKey.fromWif(key.priv);
	const messageArray = encoding
		? toArray(message, encoding as "utf8" | "hex" | "base64")
		: toArray(message, "utf8");
	const sig = BSM.sign(messageArray, privateKey);
	return {
		address: key.address,
		message: message,
		sig: sig as string,
		ts: Date.now(),
	};
};

/**
 * Encrypt data using ECIES with the key's corresponding public key
 * This is self-encryption - only the holder of this private key can decrypt
 */
export const encrypt = (
	message: string,
	key: KeyRecord,
): { address: string; data: string; ts: number } => {
	if (!key.priv) {
		throw new Error("Private key is required to encrypt");
	}
	const privateKey = PrivateKey.fromWif(key.priv);
	const publicKey = privateKey.toPublicKey();

	const messageBytes = toArray(message, "utf8");
	const encryptedBytes = ECIES.electrumEncrypt(messageBytes, publicKey);

	return {
		address: key.address,
		data: toHex(encryptedBytes),
		ts: Date.now(),
	};
};

/**
 * Decrypt ECIES-encrypted data
 */
export const decrypt = (ciphertext: string, key: KeyRecord): string => {
	if (!key.priv) {
		throw new Error("Private key is required to decrypt");
	}
	const privateKey = PrivateKey.fromWif(key.priv);
	const ciphertextBytes = toArray(ciphertext, "hex");
	const decryptedBytes = ECIES.electrumDecrypt(ciphertextBytes, privateKey);
	return toUTF8(decryptedBytes);
};

/**
 * Convert seed hex to a master PrivateKey for Type42 derivation
 * Uses SHA256 of the seed bytes to get a 256-bit key
 */
export const seedToMasterKey = (seedHex: string): PrivateKey => {
	const seedBytes = toArray(seedHex, "hex");
	// SHA256 of seed produces 256-bit private key
	const keyBytes = Hash.sha256(seedBytes);
	return PrivateKey.fromString(toHex(keyBytes), "hex");
};

/**
 * Create a new Type42-derived key for a host
 * Uses self-derivation (own public key as counterparty)
 * Invoice number follows BRC-43 format: {securityLevel}-{protocol}-{keyID}
 */
export const createType42 = async (
	seedData: SeedData,
	host: string,
): Promise<Omit<KeyRecord, "priv">> => {
	// BRC-43 format: security level 2 (user-approved per app)
	const invoiceNumber = `2-sigma auth-${host}`;
	const masterKey = seedToMasterKey(seedData.hex);

	const childKey = masterKey.deriveChild(masterKey.toPublicKey(), invoiceNumber);

	return {
		path: invoiceNumber,
		pub: childKey.toPublicKey().toString(),
		address: childKey.toPublicKey().toAddress(),
		host,
	};
};

/**
 * Derive a key using Type42 from an invoice number
 */
export const deriveType42 = (
	seedData: SeedData,
	invoiceNumber: string,
): { privateKey: PrivateKey; publicKey: PublicKey } => {
	const masterKey = seedToMasterKey(seedData.hex);

	const childKey = masterKey.deriveChild(masterKey.toPublicKey(), invoiceNumber);

	return {
		privateKey: childKey,
		publicKey: childKey.toPublicKey(),
	};
};

/**
 * Create seed data from hex or generate new from passphrase
 */
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

/**
 * Verify a BSM signature
 */
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
		const sigBytes = toArray(sig, "base64");
		const recoveryByte = sigBytes[0];
		const recovery = recoveryByte >= 31 ? recoveryByte - 31 : recoveryByte - 27;

		const signature = Signature.fromCompact(sigBytes);
		const msgHashArray = BSM.magicHash(messageArray);
		const msgHash = new BigNumber(msgHashArray);

		const recoveredPubKey = signature.RecoverPublicKey(recovery, msgHash);
		const recoveredAddress = recoveredPubKey.toAddress();

		return recoveredAddress === address;
	} catch {
		return false;
	}
};

/**
 * Create a bitcoin-auth token for API authentication
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
			timestamp: "",
			body,
		},
		timePad,
	);
};

/**
 * Parse a bitcoin-auth token to extract its components
 */
export const parseToken = (token: string) => {
	return parseAuthToken(token);
};

export { getAuthToken, parseAuthToken, verifyAuthToken };

/**
 * Derive a child key for a specific host using Type42
 * Invoice number follows BRC-43 format: {securityLevel}-{protocol}-{keyID}
 */
export const deriveKeyForHost = (
	masterKey: PrivateKey,
	host: string,
): {
	privateKey: PrivateKey;
	address: string;
	invoiceNumber: string;
} => {
	// BRC-43 format: security level 2 (user-approved per app)
	const invoiceNumber = `2-sigma auth-${host}`;

	const childKey = masterKey.deriveChild(masterKey.toPublicKey(), invoiceNumber);

	return {
		privateKey: childKey,
		address: childKey.toPublicKey().toAddress(),
		invoiceNumber,
	};
};

/**
 * Derive a shared key for friend-based encryption using Type42
 * Invoice number follows BRC-43 format: {securityLevel}-{protocol}-{keyID}
 * Uses SHA256 hash of purpose for consistent key ID format
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
	// BRC-43 format: security level 2 with hashed purpose
	const purposeHash = toHex(Hash.sha256(toArray(purpose, "utf8")));
	const invoiceNumber = `2-encrypt-${purposeHash}`;

	const childKey = masterKey.deriveChild(friendPubKey, invoiceNumber);

	return {
		privateKey: childKey,
		invoiceNumber,
	};
};

/**
 * Get the public key that should be shared with a friend for Type42 derivation
 * Used for BSocial friend protocol - Alice derives a key for Bob, then shares
 * the public key in a friend request TX so Bob can encrypt messages TO Alice
 * Invoice number follows BRC-43 format: {securityLevel}-{protocol}-{keyID}
 * Uses SHA256 hash of friendBapId for consistent key ID format
 */
export const getFriendPublicKey = (masterKey: PrivateKey, friendBapId: string): string => {
	// BRC-43 format: security level 2 with hashed friend BAP ID
	const seedHash = toHex(Hash.sha256(toArray(friendBapId, "utf8")));
	const invoiceNumber = `2-friend-${seedHash}`;

	const childKey = masterKey.deriveChild(masterKey.toPublicKey(), invoiceNumber);

	return childKey.toPublicKey().toString();
};
