import { Hash, Mnemonic, Utils } from "@bsv/sdk";
import randomBytes from "randombytes";
import { bip39words } from "./bip39words.js";

const { toArray, toHex } = Utils;

/**
 * Compatibility wrapper to mimic @bsvwasm/mnemonic MnemonicEN behavior
 */
class MnemonicEN {
	phrase: string;
	passphrase: string;

	constructor(phrase: string) {
		if (typeof phrase !== "string") {
			throw new Error("Mnemonic phrase must be a string");
		}
		this.phrase = phrase;
		this.passphrase = "";
	}

	setPassphrase(passphrase: string): void {
		this.passphrase = passphrase || "";
	}

	toHex(): string {
		const mnemonic = Mnemonic.fromString(this.phrase);
		const seed = mnemonic.toSeed(this.passphrase);
		return toHex(seed);
	}

	toBytes(): number[] {
		const hex = this.toHex();
		return toArray(hex, "hex");
	}
}

function generateEntropy(bitLength: number): Uint8Array {
	if (bitLength % 32 !== 0 || bitLength < 128 || bitLength > 256) {
		throw new Error(
			"Invalid bit length. Valid options are: 128, 160, 192, 224, 256",
		);
	}
	return randomBytes(bitLength / 8);
}

function entropyToMnemonic(entropy: Uint8Array): MnemonicEN {
	const entropyBits = uint8ArrayToBinaryString(entropy);
	const checksumHash = Hash.sha256(Array.from(entropy));
	const checksumBits = uint8ArrayToBinaryString(
		new Uint8Array(checksumHash),
	).substring(0, (entropy.length * 8) / 32);

	const bits = entropyBits + checksumBits;
	const mnemonicWords: string[] = [];

	for (let i = 0; i < bits.length; i += 11) {
		const index = parseInt(bits.slice(i, i + 11), 2);
		mnemonicWords.push(bip39words[index]);
	}

	return new MnemonicEN(mnemonicWords.join(" "));
}

function generateMnemonic(bitLength: number): MnemonicEN {
	const entropy = generateEntropy(bitLength);
	return entropyToMnemonic(entropy);
}

function uint8ArrayToBinaryString(arr: Uint8Array): string {
	return Array.from(arr)
		.map((byte) => byte.toString(2).padStart(8, "0"))
		.join("");
}

export { generateEntropy, generateMnemonic, MnemonicEN };
