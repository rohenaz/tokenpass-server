import { describe, test, expect } from "bun:test";
import { encrypt, decrypt, type EncryptedData } from "../crypt";
import crypto from "node:crypto";

describe("crypt", () => {
	describe("encrypt/decrypt roundtrip", () => {
		test("should encrypt and decrypt a simple string", () => {
			const plaintext = "Hello, World!";
			const password = "secure-password";

			const encrypted = encrypt(plaintext, password);
			const decrypted = decrypt(encrypted, password);

			expect(decrypted).toBe(plaintext);
		});

		test("should handle empty string", () => {
			const plaintext = "";
			const password = "secure-password";

			const encrypted = encrypt(plaintext, password);
			const decrypted = decrypt(encrypted, password);

			expect(decrypted).toBe(plaintext);
		});

		test("should handle long text", () => {
			const plaintext = "a".repeat(10000);
			const password = "secure-password";

			const encrypted = encrypt(plaintext, password);
			const decrypted = decrypt(encrypted, password);

			expect(decrypted).toBe(plaintext);
		});

		test("should handle unicode characters", () => {
			const plaintext = "Hello 世界 🌍 مرحبا";
			const password = "secure-password";

			const encrypted = encrypt(plaintext, password);
			const decrypted = decrypt(encrypted, password);

			expect(decrypted).toBe(plaintext);
		});

		test("should handle JSON data", () => {
			const data = { user: "john", age: 30, verified: true };
			const plaintext = JSON.stringify(data);
			const password = "secure-password";

			const encrypted = encrypt(plaintext, password);
			const decrypted = decrypt(encrypted, password);

			expect(JSON.parse(decrypted)).toEqual(data);
		});
	});

	describe("encryption properties", () => {
		test("should produce different ciphertext for same plaintext (unique IV)", () => {
			const plaintext = "Hello, World!";
			const password = "secure-password";

			const encrypted1 = encrypt(plaintext, password);
			const encrypted2 = encrypt(plaintext, password);

			expect(encrypted1.iv).not.toBe(encrypted2.iv);
			expect(encrypted1.encryptedData).not.toBe(encrypted2.encryptedData);

			// But both should decrypt to same plaintext
			expect(decrypt(encrypted1, password)).toBe(plaintext);
			expect(decrypt(encrypted2, password)).toBe(plaintext);
		});

		test("should return hex-encoded IV and data", () => {
			const plaintext = "test";
			const password = "password";

			const encrypted = encrypt(plaintext, password);

			// IV should be 32 hex characters (16 bytes)
			expect(encrypted.iv).toMatch(/^[0-9a-f]{32}$/);
			// Encrypted data should be hex
			expect(encrypted.encryptedData).toMatch(/^[0-9a-f]+$/);
		});

		test("should produce different output with different passwords", () => {
			const plaintext = "Hello, World!";
			const password1 = "password1";
			const password2 = "password2";

			const encrypted1 = encrypt(plaintext, password1);
			const encrypted2 = encrypt(plaintext, password2);

			expect(encrypted1.encryptedData).not.toBe(encrypted2.encryptedData);

			// Each should decrypt with correct password
			expect(decrypt(encrypted1, password1)).toBe(plaintext);
			expect(decrypt(encrypted2, password2)).toBe(plaintext);
		});
	});

	describe("key handling", () => {
		test("should work with keyBuffer instead of keystr", () => {
			const plaintext = "Hello, World!";
			const keyBuffer = crypto.randomBytes(32);

			const encrypted = encrypt(plaintext, undefined, keyBuffer);
			const decrypted = decrypt(encrypted, undefined, keyBuffer);

			expect(decrypted).toBe(plaintext);
		});

		test("should prioritize keyBuffer over keystr", () => {
			const plaintext = "Hello, World!";
			const keyBuffer = crypto.randomBytes(32);
			const keystr = "password";

			const encrypted = encrypt(plaintext, keystr, keyBuffer);
			// Should use keyBuffer, not keystr
			const decrypted = decrypt(encrypted, undefined, keyBuffer);

			expect(decrypted).toBe(plaintext);
		});

		test("should hash keystr to create 256-bit key", () => {
			const plaintext = "test";
			const shortPassword = "abc";
			const longPassword = "this is a very long password that exceeds 32 bytes";

			// Both should work because they're hashed to 256 bits
			const encrypted1 = encrypt(plaintext, shortPassword);
			const encrypted2 = encrypt(plaintext, longPassword);

			expect(decrypt(encrypted1, shortPassword)).toBe(plaintext);
			expect(decrypt(encrypted2, longPassword)).toBe(plaintext);
		});
	});

	describe("invalid inputs", () => {
		test("should throw on decryption with wrong password", () => {
			const plaintext = "Hello, World!";
			const password = "correct-password";
			const wrongPassword = "wrong-password";

			const encrypted = encrypt(plaintext, password);

			expect(() => decrypt(encrypted, wrongPassword)).toThrow();
		});

		test("should throw on decryption with corrupted IV", () => {
			const plaintext = "Hello, World!";
			const password = "password";

			const encrypted = encrypt(plaintext, password);
			const corrupted: EncryptedData = {
				...encrypted,
				iv: "0".repeat(32), // Invalid IV
			};

			expect(() => decrypt(corrupted, password)).toThrow();
		});

		test("should throw on decryption with corrupted data", () => {
			const plaintext = "Hello, World!";
			const password = "password";

			const encrypted = encrypt(plaintext, password);
			const corrupted: EncryptedData = {
				...encrypted,
				encryptedData: encrypted.encryptedData.slice(0, -4), // Truncate data
			};

			expect(() => decrypt(corrupted, password)).toThrow();
		});

		test("should throw on invalid hex in IV", () => {
			const password = "password";
			const invalid: EncryptedData = {
				iv: "not-hex-data",
				encryptedData: "1234567890abcdef",
			};

			expect(() => decrypt(invalid, password)).toThrow();
		});

		test("should throw on invalid hex in encryptedData", () => {
			const password = "password";
			const invalid: EncryptedData = {
				iv: "1234567890abcdef1234567890abcdef",
				encryptedData: "not-hex-data",
			};

			expect(() => decrypt(invalid, password)).toThrow();
		});
	});

	describe("edge cases", () => {
		test("should handle special characters", () => {
			const plaintext = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~";
			const password = "password";

			const encrypted = encrypt(plaintext, password);
			const decrypted = decrypt(encrypted, password);

			expect(decrypted).toBe(plaintext);
		});

		test("should handle newlines and whitespace", () => {
			const plaintext = "Line 1\nLine 2\r\nLine 3\t\tTabbed";
			const password = "password";

			const encrypted = encrypt(plaintext, password);
			const decrypted = decrypt(encrypted, password);

			expect(decrypted).toBe(plaintext);
		});

		test("should handle empty password", () => {
			const plaintext = "test";
			const password = "";

			const encrypted = encrypt(plaintext, password);
			const decrypted = decrypt(encrypted, password);

			expect(decrypted).toBe(plaintext);
		});

		test("should handle different data sizes", () => {
			const sizes = [1, 16, 32, 64, 128, 256, 512, 1024, 4096];
			const password = "password";

			for (const size of sizes) {
				const plaintext = "x".repeat(size);
				const encrypted = encrypt(plaintext, password);
				const decrypted = decrypt(encrypted, password);

				expect(decrypted).toBe(plaintext);
			}
		});
	});

	describe("security properties", () => {
		test("IV should be 16 bytes (128 bits)", () => {
			const plaintext = "test";
			const password = "password";

			const encrypted = encrypt(plaintext, password);
			const ivBuffer = Buffer.from(encrypted.iv, "hex");

			expect(ivBuffer.length).toBe(16);
		});

		test("should use AES-256-CBC (key derived from SHA-256)", () => {
			const plaintext = "test";
			const password = "password";

			const encrypted = encrypt(plaintext, password);

			// Verify we can decrypt with manually derived key
			const keyBuffer = crypto.createHash("sha256").update(password).digest();
			expect(keyBuffer.length).toBe(32); // 256 bits

			const decrypted = decrypt(encrypted, undefined, keyBuffer);
			expect(decrypted).toBe(plaintext);
		});

		test("different messages should have different IVs", () => {
			const password = "password";
			const ivs = new Set<string>();

			for (let i = 0; i < 100; i++) {
				const encrypted = encrypt(`message ${i}`, password);
				ivs.add(encrypted.iv);
			}

			// All IVs should be unique
			expect(ivs.size).toBe(100);
		});
	});
});
