import crypto from "node:crypto";

const ALGORITHM = "aes-256-cbc";

export interface EncryptedData {
	iv: string;
	encryptedData: string;
}

export function encrypt(
	text: string,
	keystr?: string,
	keyBuffer?: Buffer,
): EncryptedData {
	const iv = crypto.randomBytes(16);
	const key =
		keyBuffer ??
		crypto
			.createHash("sha256")
			.update(keystr ?? "")
			.digest();
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
	let encrypted = cipher.update(text);
	encrypted = Buffer.concat([encrypted, cipher.final()]);
	return { iv: iv.toString("hex"), encryptedData: encrypted.toString("hex") };
}

export function decrypt(
	text: EncryptedData,
	keystr?: string,
	keyBuffer?: Buffer,
): string {
	const iv = Buffer.from(text.iv, "hex");
	const key =
		keyBuffer ??
		crypto
			.createHash("sha256")
			.update(keystr ?? "")
			.digest();
	const encryptedText = Buffer.from(text.encryptedData, "hex");
	const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
	let decrypted = decipher.update(encryptedText);
	decrypted = Buffer.concat([decrypted, decipher.final()]);
	return decrypted.toString();
}
