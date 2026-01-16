import { BSM, HD, PrivateKey, Utils } from "@bsv/sdk";
import { encrypt as enc } from "../crypt.ts";
import type { KeyRecord, SeedData, SignedMessage } from "../types.ts";
import { generateMnemonic } from "../utils/mnemonic.ts";

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
		sig: sig,
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

export const seed = (hex?: string, passphrase?: string): SeedData => {
	let bytes: number[];
	if (!hex) {
		if (!passphrase) {
			throw new Error("passphrase required creating initial seed");
		}
		const mnem = generateMnemonic(128);
		mnem.setPassphrase(passphrase);
		bytes = mnem.toBytes();
	} else {
		bytes = toArray(hex, "hex");
	}
	const key = HD.fromSeed(bytes);
	return {
		hex: toHex(bytes),
		key,
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
	return BSM.verify(messageArray, sig, address);
};

// TODO: Implement UTXO store lookup to find key for transaction
export const keyForTx = async (
	_txid: string | undefined,
): Promise<KeyRecord | null> => {
	// Placeholder: This should query a UTXO store to find the key that owns the txid
	return null;
};
