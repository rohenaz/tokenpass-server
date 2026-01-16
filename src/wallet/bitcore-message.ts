import { BigNumber, BSM, type PrivateKey, Signature, Utils } from "@bsv/sdk";

type ValidEncoding =
	| "ascii"
	| "utf8"
	| "utf16le"
	| "ucs2"
	| "base64"
	| "latin1"
	| "binary"
	| "hex";

interface MessageObject {
	message: string;
	encoding: ValidEncoding;
}

/**
 * Constructs a new message to sign and verify.
 * This is a compatibility wrapper around @bsv/sdk's BSM module.
 */
class Message {
	message: string;
	encoding: ValidEncoding;
	error?: string;

	constructor(message: string, encoding: ValidEncoding = "utf8") {
		if (typeof message !== "string") {
			throw new Error(
				"First argument should be a string. You can specify the encoding as the second parameter",
			);
		}

		const validEncodings: ValidEncoding[] = [
			"ascii",
			"utf8",
			"utf16le",
			"ucs2",
			"base64",
			"latin1",
			"binary",
			"hex",
		];

		if (!validEncodings.includes(encoding)) {
			throw new Error(
				"Second argument should be a valid BufferEncoding: 'utf8', 'hex', or 'base64', etc",
			);
		}

		this.message = message;
		this.encoding = encoding;
	}

	/**
	 * Will sign a message with a given bitcoin private key.
	 */
	sign(privateKey: PrivateKey): string {
		const messageArray = Utils.toArray(
			this.message,
			this.encoding as "utf8" | "hex" | "base64",
		);
		const sig = BSM.sign(messageArray, privateKey);
		return sig;
	}

	/**
	 * Will return a boolean of the signature is valid for a given bitcoin address.
	 */
	verify(bitcoinAddress: string, signatureString: string): boolean {
		if (!bitcoinAddress) {
			throw new Error("Bitcoin address is required");
		}
		if (!signatureString || typeof signatureString !== "string") {
			throw new Error("Signature string is required and must be a string");
		}

		const messageArray = Utils.toArray(
			this.message,
			this.encoding as "utf8" | "hex" | "base64",
		);

		try {
			// Parse the compact signature
			const sigBytes = Utils.toArray(signatureString, "base64");

			// Extract recovery flag from first byte
			// 27-30: uncompressed key, 31-34: compressed key
			const recoveryByte = sigBytes[0];
			const recovery =
				recoveryByte >= 31 ? recoveryByte - 31 : recoveryByte - 27;

			const sig = Signature.fromCompact(sigBytes);

			// Get the magic hash
			const msgHashArray = BSM.magicHash(messageArray);
			const msgHash = new BigNumber(msgHashArray);

			// Recover the public key from the signature
			const recoveredPubKey = sig.RecoverPublicKey(recovery, msgHash);
			const recoveredAddress = recoveredPubKey.toAddress();

			// Compare addresses
			const expectedAddress =
				typeof bitcoinAddress === "string"
					? bitcoinAddress
					: bitcoinAddress.toString();

			const isValid = recoveredAddress === expectedAddress;
			if (!isValid) {
				this.error = "The signature did not match the message digest";
			}
			return isValid;
		} catch (err: any) {
			this.error = err.message || "The signature was invalid";
			return false;
		}
	}

	/**
	 * @returns A plain object with the message information
	 */
	toObject(): MessageObject {
		return {
			message: this.message,
			encoding: this.encoding,
		};
	}

	/**
	 * @returns A JSON representation of the message information
	 */
	toJSON(): string {
		return JSON.stringify(this.toObject());
	}

	/**
	 * Will return the string representation of the message
	 */
	toString(): string {
		return this.message;
	}

	/**
	 * Will return a string formatted for the console
	 */
	inspect(): string {
		return `<Message: ${this.toString()}>`;
	}

	/**
	 * Instantiate a message from a message string
	 */
	static fromString(str: string): Message {
		return new Message(str);
	}

	/**
	 * Instantiate a message from JSON
	 */
	static fromJSON(json: string | { message: string }): Message {
		let parsed = json;
		if (typeof json === "string") {
			try {
				parsed = JSON.parse(json);
			} catch (_e) {
				throw new Error("Invalid JSON");
			}
		}
		return new Message((parsed as { message: string }).message);
	}
}

export default Message;
