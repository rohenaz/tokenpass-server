import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import Seed from "../seed";
import * as wallet from "../wallet/index";
import Datastore from "@seald-io/nedb";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import type { SeedData } from "../types";

describe("Seed", () => {
	let testDbPath: string;
	let seed: Seed;

	beforeEach(() => {
		// Create unique temp directory for each test
		testDbPath = join(tmpdir(), `tokenpass-test-${Date.now()}-${Math.random()}`);
		mkdirSync(testDbPath, { recursive: true });

		seed = new Seed({
			db: testDbPath,
			wallet: { seed: wallet.seed },
			Datastore,
		});
	});

	afterEach(() => {
		// Clean up test database
		if (existsSync(testDbPath)) {
			rmSync(testDbPath, { recursive: true, force: true });
		}
	});

	describe("create", () => {
		test("should create a new seed with password", async () => {
			const password = "secure-password";
			const seedData = await seed.create(password);

			expect(seedData).toBeDefined();
			expect(seedData.hex).toBeDefined();
			expect(seedData.key).toBeDefined();
			expect(seedData.mnemonic).toBeDefined();
			expect(typeof seedData.hex).toBe("string");
			expect(typeof seedData.mnemonic).toBe("string");
		});

		test("should create deterministic seed from mnemonic", async () => {
			const password = "password";
			const seedData1 = await seed.create(password);
			const mnemonic = seedData1.mnemonic!;

			// Create new seed instance with same mnemonic
			const testDbPath2 = join(tmpdir(), `tokenpass-test-${Date.now()}-${Math.random()}`);
			mkdirSync(testDbPath2, { recursive: true });
			const seed2 = new Seed({
				db: testDbPath2,
				wallet: { seed: wallet.seed },
				Datastore,
			});

			const seedData2 = await seed2.importKey(seedData1.hex, password, mnemonic);

			expect(seedData2.hex).toBe(seedData1.hex);
			expect(seedData2.mnemonic).toBe(mnemonic);

			// Clean up
			rmSync(testDbPath2, { recursive: true, force: true });
		});

		test("should generate 12-word mnemonic by default", async () => {
			const password = "password";
			const seedData = await seed.create(password);

			const words = seedData.mnemonic!.split(" ");
			expect(words.length).toBe(12); // 128-bit entropy = 12 words
		});

		test("should persist seed to database", async () => {
			const password = "password";
			await seed.create(password);

			const count = await seed.count();
			expect(count).toBe(1);
		});

		test("created seed should be retrievable with password", async () => {
			const password = "password";
			const created = await seed.create(password);

			const retrieved = await seed.get(password);
			expect(retrieved).toBeDefined();
			expect(retrieved!.hex).toBe(created.hex);
			expect(retrieved!.mnemonic).toBe(created.mnemonic);
		});
	});

	describe("get", () => {
		test("should retrieve seed with correct password", async () => {
			const password = "password123";
			const created = await seed.create(password);

			const retrieved = await seed.get(password);

			expect(retrieved).toBeDefined();
			expect(retrieved!.hex).toBe(created.hex);
			expect(retrieved!.mnemonic).toBe(created.mnemonic);
		});

		test("should return null with wrong password", async () => {
			const password = "correct-password";
			const wrongPassword = "wrong-password";

			await seed.create(password);
			const retrieved = await seed.get(wrongPassword);

			expect(retrieved).toBeNull();
		});

		test("should return null when no seed exists", async () => {
			const retrieved = await seed.get("any-password");
			expect(retrieved).toBeNull();
		});

		test("should reject empty password", async () => {
			const password = "";
			await expect(seed.create(password)).rejects.toThrow();
		});
	});

	describe("importKey", () => {
		test("should import seed with hex only", async () => {
			const password = "password";
			const testHex = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

			const imported = await seed.importKey(testHex, password);

			expect(imported).toBeDefined();
			expect(imported.hex).toBe(testHex);
		});

		test("should import seed with hex and mnemonic", async () => {
			const password = "password";
			// Create a seed to get valid hex and mnemonic
			const original = await seed.create(password);

			// Create new seed instance for import
			const testDbPath2 = join(tmpdir(), `tokenpass-test-${Date.now()}-${Math.random()}`);
			mkdirSync(testDbPath2, { recursive: true });
			const seed2 = new Seed({
				db: testDbPath2,
				wallet: { seed: wallet.seed },
				Datastore,
			});

			const imported = await seed2.importKey(
				original.hex,
				password,
				original.mnemonic,
			);

			expect(imported.hex).toBe(original.hex);
			expect(imported.mnemonic).toBe(original.mnemonic);

			// Clean up
			rmSync(testDbPath2, { recursive: true, force: true });
		});

		test("imported seed should be retrievable with password", async () => {
			const password = "password";
			const testHex = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

			await seed.importKey(testHex, password);
			const retrieved = await seed.get(password);

			expect(retrieved).toBeDefined();
			expect(retrieved!.hex).toBe(testHex);
		});

		test("should encrypt imported seed", async () => {
			const password = "password";
			const testHex = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

			await seed.importKey(testHex, password);

			// Should not be retrievable with different password
			const retrieved = await seed.get("wrong-password");
			expect(retrieved).toBeNull();
		});

		test("should reject invalid hex", async () => {
			const password = "password";
			const invalidHex = "not-valid-hex";

			await expect(seed.importKey(invalidHex, password)).rejects.toThrow();
		});
	});

	describe("exportKey", () => {
		test("should export seed hex with correct password", async () => {
			const password = "password";
			const created = await seed.create(password);

			const exported = await seed.exportKey(password);

			expect(exported.hex).toBe(created.hex);
			expect(exported.mnemonic).toBe(created.mnemonic);
		});

		test("should return mnemonic if available", async () => {
			const password = "password";
			const created = await seed.create(password);

			const exported = await seed.exportKey(password);

			expect(exported.mnemonic).toBeDefined();
			expect(exported.mnemonic).toBe(created.mnemonic);
		});

		test("should export hex without mnemonic if imported without mnemonic", async () => {
			const password = "password";
			const testHex = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

			await seed.importKey(testHex, password);
			const exported = await seed.exportKey(password);

			expect(exported.hex).toBe(testHex);
			expect(exported.mnemonic).toBeUndefined();
		});

		test("should throw with wrong password", async () => {
			const password = "correct-password";
			const wrongPassword = "wrong-password";

			await seed.create(password);

			await expect(seed.exportKey(wrongPassword)).rejects.toThrow();
		});
	});

	describe("count", () => {
		test("should return 0 for empty database", async () => {
			const count = await seed.count();
			expect(count).toBe(0);
		});

		test("should return 1 after creating seed", async () => {
			await seed.create("password");
			const count = await seed.count();
			expect(count).toBe(1);
		});

		test("should not increment on multiple get operations", async () => {
			const password = "password";
			await seed.create(password);

			await seed.get(password);
			await seed.get(password);
			await seed.get(password);

			const count = await seed.count();
			expect(count).toBe(1);
		});
	});

	describe("encryption security", () => {
		test("seed should be encrypted at rest", async () => {
			const password = "password";
			const created = await seed.create(password);

			// Read raw database file
			const dbFile = join(testDbPath, "seed.db");
			const dbContent = await Bun.file(dbFile).text();

			// Raw hex should not appear in database file
			expect(dbContent).not.toContain(created.hex);
		});

		test("different passwords should produce different encrypted data", async () => {
			const testHex = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

			// Create two seed instances with same hex but different passwords
			const testDbPath1 = join(tmpdir(), `tokenpass-test-${Date.now()}-${Math.random()}`);
			const testDbPath2 = join(tmpdir(), `tokenpass-test-${Date.now()}-${Math.random()}`);
			mkdirSync(testDbPath1, { recursive: true });
			mkdirSync(testDbPath2, { recursive: true });

			const seed1 = new Seed({
				db: testDbPath1,
				wallet: { seed: wallet.seed },
				Datastore,
			});

			const seed2 = new Seed({
				db: testDbPath2,
				wallet: { seed: wallet.seed },
				Datastore,
			});

			await seed1.importKey(testHex, "password1");
			await seed2.importKey(testHex, "password2");

			const db1Content = await Bun.file(join(testDbPath1, "seed.db")).text();
			const db2Content = await Bun.file(join(testDbPath2, "seed.db")).text();

			// Encrypted data should be different
			expect(db1Content).not.toBe(db2Content);

			// But both should decrypt to same hex
			const retrieved1 = await seed1.get("password1");
			const retrieved2 = await seed2.get("password2");
			expect(retrieved1!.hex).toBe(testHex);
			expect(retrieved2!.hex).toBe(testHex);

			// Clean up
			rmSync(testDbPath1, { recursive: true, force: true });
			rmSync(testDbPath2, { recursive: true, force: true });
		});

		test("mnemonic should be encrypted separately", async () => {
			const password = "password";
			const created = await seed.create(password);

			const dbFile = join(testDbPath, "seed.db");
			const dbContent = await Bun.file(dbFile).text();

			// Mnemonic words should not appear in database file
			const words = created.mnemonic!.split(" ");
			for (const word of words) {
				expect(dbContent).not.toContain(word);
			}
		});
	});

	describe("concurrent operations", () => {
		test("should handle multiple get operations concurrently", async () => {
			const password = "password";
			await seed.create(password);

			const results = await Promise.all([
				seed.get(password),
				seed.get(password),
				seed.get(password),
			]);

			for (const result of results) {
				expect(result).toBeDefined();
				expect(result!.hex).toBeDefined();
			}

			// All should return same data
			expect(results[0]!.hex).toBe(results[1]!.hex);
			expect(results[1]!.hex).toBe(results[2]!.hex);
		});
	});

	describe("edge cases", () => {
		test("should handle very long passwords", async () => {
			const password = "a".repeat(1000);
			const created = await seed.create(password);

			const retrieved = await seed.get(password);
			expect(retrieved!.hex).toBe(created.hex);
		});

		test("should handle special characters in password", async () => {
			const password = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~";
			const created = await seed.create(password);

			const retrieved = await seed.get(password);
			expect(retrieved!.hex).toBe(created.hex);
		});

		test("should handle unicode in password", async () => {
			const password = "密码🔒مرحبا";
			const created = await seed.create(password);

			const retrieved = await seed.get(password);
			expect(retrieved!.hex).toBe(created.hex);
		});
	});
});
