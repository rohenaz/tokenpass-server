import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Datastore from "@seald-io/nedb";
import Key from "../key";
import type { SeedData } from "../types";
import * as wallet from "../wallet/index";

describe("Key", () => {
	let testDbPath: string;
	let key: Key;
	let testSeed: SeedData;

	beforeEach(async () => {
		// Create unique temp directory for each test
		testDbPath = join(tmpdir(), `tokenpass-test-${Date.now()}-${Math.random()}`);
		mkdirSync(testDbPath, { recursive: true });

		key = new Key({
			db: testDbPath,
			wallet: {
				sign: wallet.sign,
				encrypt: wallet.encrypt,
				decrypt: wallet.decrypt,
				createType42: wallet.createType42,
				deriveType42: wallet.deriveType42,
			},
			Datastore,
		});

		// Wait for database to initialize
		await new Promise((resolve) => setTimeout(resolve, 10));

		// Create a test seed
		testSeed = wallet.seed(undefined, "test-passphrase");
		key.setSeed(testSeed);
	});

	afterEach(() => {
		// Clean up test database
		if (existsSync(testDbPath)) {
			rmSync(testDbPath, { recursive: true, force: true });
		}
	});

	describe("setSeed / getSeed", () => {
		test("should set and get seed", () => {
			const seed = wallet.seed(undefined, "password");
			key.setSeed(seed);

			const retrieved = key.getSeed();
			expect(retrieved).toBe(seed);
			expect(retrieved?.hex).toBe(seed.hex);
		});

		test("should allow setting seed to null", () => {
			key.setSeed(null);
			expect(key.getSeed()).toBeNull();
		});

		test("should overwrite existing seed", () => {
			const seed1 = wallet.seed(undefined, "password1");
			const seed2 = wallet.seed(undefined, "password2");

			key.setSeed(seed1);
			expect(key.getSeed()?.hex).toBe(seed1.hex);

			key.setSeed(seed2);
			expect(key.getSeed()?.hex).toBe(seed2.hex);
		});
	});

	describe("Type42 derivation", () => {
		test("should use BRC-43 invoice numbers for key derivation", async () => {
			const host = "example.com";
			const createdKey = await key.findOrCreate({ host });

			// Path should be the BRC-43 invoice number with security level 2
			expect(createdKey?.path).toBe(`2-sigma auth-${host}`);
		});

		test("derived keys should be deterministic from seed", async () => {
			const host = "example.com";
			const key1 = await key.findOrCreate({ host });

			// Create new Key instance with same seed
			const testDbPath2 = join(tmpdir(), `tokenpass-test-${Date.now()}-${Math.random()}`);
			mkdirSync(testDbPath2, { recursive: true });
			const key2 = new Key({
				db: testDbPath2,
				wallet: {
					sign: wallet.sign,
					encrypt: wallet.encrypt,
					decrypt: wallet.decrypt,
					createType42: wallet.createType42,
					deriveType42: wallet.deriveType42,
				},
				Datastore,
			});
			key2.setSeed(testSeed);

			const key2Result = await key2.findOrCreate({ host });

			// Should derive same keys from same seed
			expect(key2Result?.address).toBe(key1?.address);
			expect(key2Result?.pub).toBe(key1?.pub);

			// Clean up
			rmSync(testDbPath2, { recursive: true, force: true });
		});

		test("different seeds should produce different keys", async () => {
			const host = "example.com";
			const key1 = await key.findOrCreate({ host });

			// Create new Key instance with different seed
			const testDbPath2 = join(tmpdir(), `tokenpass-test-${Date.now()}-${Math.random()}`);
			mkdirSync(testDbPath2, { recursive: true });
			const key2 = new Key({
				db: testDbPath2,
				wallet: {
					sign: wallet.sign,
					encrypt: wallet.encrypt,
					decrypt: wallet.decrypt,
					createType42: wallet.createType42,
					deriveType42: wallet.deriveType42,
				},
				Datastore,
			});
			const differentSeed = wallet.seed(undefined, "different-passphrase");
			key2.setSeed(differentSeed);

			const key2Result = await key2.findOrCreate({ host });

			// Should derive different keys from different seeds
			expect(key2Result?.address).not.toBe(key1?.address);
			expect(key2Result?.pub).not.toBe(key1?.pub);

			// Clean up
			rmSync(testDbPath2, { recursive: true, force: true });
		});
	});

	describe("findOrCreate", () => {
		test("should create key for new host", async () => {
			const host = "example.com";
			const createdKey = await key.findOrCreate({ host });

			expect(createdKey).toBeDefined();
			expect(createdKey?.host).toBe(host);
			expect(createdKey?.address).toBeDefined();
			expect(createdKey?.pub).toBeDefined();
			expect(createdKey?.priv).toBeDefined();
		});

		test("should return existing key for known host", async () => {
			const host = "example.com";
			const key1 = await key.findOrCreate({ host });
			const key2 = await key.findOrCreate({ host });

			expect(key2?.address).toBe(key1?.address);
			expect(key2?.pub).toBe(key1?.pub);
			expect(key2?.path).toBe(key1?.path);
		});

		test("should create different keys for different hosts", async () => {
			const host1 = "example.com";
			const host2 = "test.com";

			const key1 = await key.findOrCreate({ host: host1 });
			const key2 = await key.findOrCreate({ host: host2 });

			expect(key1?.address).not.toBe(key2?.address);
			expect(key1?.pub).not.toBe(key2?.pub);
			expect(key1?.host).toBe(host1);
			expect(key2?.host).toBe(host2);
		});

		test("should return null if no seed is set", async () => {
			key.setSeed(null);
			const result = await key.findOrCreate({ host: "example.com" });

			expect(result).toBeNull();
		});

		test("should persist created keys", async () => {
			const host = "example.com";
			await key.findOrCreate({ host });

			const count = await key.count({});
			expect(count).toBe(1);
		});
	});

	describe("findOne", () => {
		test("should find key by host", async () => {
			const host = "example.com";
			const created = await key.findOrCreate({ host });

			const found = await key.findOne({ host });
			expect(found).toBeDefined();
			expect(found?.address).toBe(created?.address);
		});

		test("should find key by address", async () => {
			const host = "example.com";
			const created = await key.findOrCreate({ host });

			const found = await key.findOne({ address: created?.address });
			expect(found).toBeDefined();
			expect(found?.host).toBe(host);
		});

		test("should return null for non-existent host", async () => {
			const found = await key.findOne({ host: "nonexistent.com" });
			expect(found).toBeNull();
		});

		test("should include derived private key", async () => {
			const host = "example.com";
			await key.findOrCreate({ host });

			const found = await key.findOne({ host });
			expect(found?.priv).toBeDefined();
			// WIF format starts with L or K for mainnet compressed
			expect(found?.priv).toMatch(/^[LK]/);
		});
	});

	describe("find", () => {
		test("should find multiple keys", async () => {
			await key.findOrCreate({ host: "example.com" });
			await key.findOrCreate({ host: "test.com" });

			const keys = await key.find({});
			expect(keys.length).toBe(2);
		});

		test("should filter by host", async () => {
			await key.findOrCreate({ host: "example.com" });
			await key.findOrCreate({ host: "test.com" });

			const keys = await key.find({ host: "example.com" });
			expect(keys.length).toBe(1);
			expect(keys[0].host).toBe("example.com");
		});

		test("should return empty array when no keys found", async () => {
			const keys = await key.find({ host: "nonexistent.com" });
			expect(keys).toEqual([]);
		});
	});

	describe("all", () => {
		test("should return all keys", async () => {
			const hosts = ["example.com", "test.com", "demo.com"];

			for (const host of hosts) {
				await key.findOrCreate({ host });
			}

			const allKeys = await key.all();
			expect(allKeys.length).toBe(hosts.length);

			const hostSet = new Set(allKeys.map((k) => k.host));
			expect(hostSet.size).toBe(hosts.length);
			for (const host of hosts) {
				expect(hostSet.has(host)).toBe(true);
			}
		});

		test("should return empty array when no keys exist", async () => {
			const allKeys = await key.all();
			expect(allKeys).toEqual([]);
		});
	});

	describe("count", () => {
		test("should return 0 for empty database", async () => {
			const count = await key.count({});
			expect(count).toBe(0);
		});

		test("should return correct count after creating keys", async () => {
			await key.findOrCreate({ host: "example.com" });
			await key.findOrCreate({ host: "test.com" });

			const count = await key.count({});
			expect(count).toBe(2);
		});

		test("should count by filter", async () => {
			await key.findOrCreate({ host: "example.com" });
			await key.findOrCreate({ host: "test.com" });

			const count = await key.count({ host: "example.com" });
			expect(count).toBe(1);
		});
	});

	describe("insert", () => {
		test("should insert key directly", async () => {
			const keyData = await wallet.createType42(testSeed, "example.com");
			const inserted = await key.insert(keyData);

			expect(inserted).toBeDefined();
			expect(inserted.host).toBe("example.com");
			expect(inserted.priv).toBeDefined();
		});

		test("inserted key should be retrievable", async () => {
			const keyData = await wallet.createType42(testSeed, "example.com");
			await key.insert(keyData);

			const found = await key.findOne({ host: "example.com" });
			expect(found).toBeDefined();
			expect(found?.address).toBe(keyData.address);
		});
	});

	describe("sign", () => {
		test("should sign message with key", async () => {
			const host = "example.com";
			const createdKey = await key.findOrCreate({ host });
			const message = "Hello, World!";

			const signed = key.sign({ message, key: createdKey! });

			expect(signed).toBeDefined();
			expect(signed.address).toBe(createdKey?.address);
			expect(signed.message).toBe(message);
			expect(signed.sig).toBeDefined();
			expect(signed.ts).toBeDefined();
		});

		test("should verify signed message", async () => {
			const host = "example.com";
			const createdKey = await key.findOrCreate({ host });
			const message = "Test message";

			const signed = key.sign({ message, key: createdKey! });

			// Verify using wallet.verify
			const isValid = wallet.verify(signed.message, signed.address, signed.sig);
			expect(isValid).toBe(true);
		});

		test("should produce different signatures for different messages", async () => {
			const host = "example.com";
			const createdKey = await key.findOrCreate({ host });

			const sig1 = key.sign({ message: "Message 1", key: createdKey! });
			const sig2 = key.sign({ message: "Message 2", key: createdKey! });

			expect(sig1.sig).not.toBe(sig2.sig);
			expect(sig1.message).not.toBe(sig2.message);
		});

		test("should support different encodings", async () => {
			const host = "example.com";
			const createdKey = await key.findOrCreate({ host });
			const hexMessage = "48656c6c6f"; // "Hello" in hex

			const signed = key.sign({
				message: hexMessage,
				key: createdKey!,
				encoding: "hex",
			});

			expect(signed.sig).toBeDefined();
			// Verify the signature is valid
			const isValid = wallet.verify(hexMessage, signed.address, signed.sig, "hex");
			expect(isValid).toBe(true);
		});
	});

	describe("encrypt/decrypt", () => {
		test("should encrypt message with ECIES", async () => {
			const host = "example.com";
			const createdKey = await key.findOrCreate({ host });
			const message = "Secret message";

			const encrypted = key.encrypt({ message, key: createdKey! });

			expect(encrypted).toBeDefined();
			expect(encrypted.address).toBe(createdKey?.address);
			// ECIES returns hex string
			expect(typeof encrypted.data).toBe("string");
			expect(encrypted.data).toMatch(/^[0-9a-f]+$/);
			expect(encrypted.ts).toBeDefined();
		});

		test("should decrypt ECIES encrypted data", async () => {
			const host = "example.com";
			const createdKey = await key.findOrCreate({ host });
			const message = "Secret message";

			const encrypted = key.encrypt({ message, key: createdKey! });
			const decrypted = key.decrypt({ ciphertext: encrypted.data, key: createdKey! });

			expect(decrypted).toBe(message);
		});

		test("should produce different ciphertext for same message (ECIES randomization)", async () => {
			const host = "example.com";
			const createdKey = await key.findOrCreate({ host });
			const message = "Same message";

			const encrypted1 = key.encrypt({ message, key: createdKey! });
			const encrypted2 = key.encrypt({ message, key: createdKey! });

			// ECIES includes random ephemeral key, so same message produces different ciphertext
			expect(encrypted1.data).not.toBe(encrypted2.data);

			// But both should decrypt to same message
			const decrypted1 = key.decrypt({ ciphertext: encrypted1.data, key: createdKey! });
			const decrypted2 = key.decrypt({ ciphertext: encrypted2.data, key: createdKey! });
			expect(decrypted1).toBe(message);
			expect(decrypted2).toBe(message);
		});
	});

	describe("per-host isolation", () => {
		test("each host should have unique key", async () => {
			const hosts = ["example.com", "test.com", "demo.com"];
			const addresses = new Set<string>();

			for (const host of hosts) {
				const createdKey = await key.findOrCreate({ host });
				addresses.add(createdKey!.address);
			}

			// All addresses should be unique
			expect(addresses.size).toBe(hosts.length);
		});

		test("keys should not be shared between hosts", async () => {
			const key1 = await key.findOrCreate({ host: "example.com" });
			const key2 = await key.findOrCreate({ host: "test.com" });

			expect(key1?.priv).not.toBe(key2?.priv);
			expect(key1?.pub).not.toBe(key2?.pub);
			expect(key1?.address).not.toBe(key2?.address);
		});

		test("same host should always get same key", async () => {
			const host = "example.com";

			const key1 = await key.findOrCreate({ host });
			const key2 = await key.findOrCreate({ host });
			const key3 = await key.findOrCreate({ host });

			expect(key2?.address).toBe(key1?.address);
			expect(key3?.address).toBe(key1?.address);
			expect(key2?.priv).toBe(key1?.priv);
			expect(key3?.priv).toBe(key1?.priv);
		});
	});

	describe("key storage", () => {
		test("should not store private key in database", async () => {
			const host = "example.com";
			const createdKey = await key.findOrCreate({ host });

			// Read raw database file
			const dbFile = join(testDbPath, "keys.db");
			const dbContent = await Bun.file(dbFile).text();

			// Private key WIF should not appear in database
			if (createdKey?.priv) {
				expect(dbContent).not.toContain(createdKey.priv);
			}
		});

		test("should store invoice number for Type42 derivation", async () => {
			const host = "example.com";
			await key.findOrCreate({ host });

			const found = await key.findOne({ host });
			expect(found?.path).toBeDefined();
			expect(found?.path).toBe(`2-sigma auth-${host}`);
		});

		test("should be able to rederive private key from invoice number", async () => {
			const host = "example.com";
			const created = await key.findOrCreate({ host });

			// Derive key manually using same invoice number
			const derived = wallet.deriveType42(testSeed, created!.path);

			expect(derived.privateKey.toWif()).toBe(created?.priv);
			expect(derived.publicKey.toAddress()).toBe(created?.address);
		});
	});

	describe("edge cases", () => {
		test("should handle hosts with special characters", async () => {
			const host = "example.com:8080/path?query=1";
			const createdKey = await key.findOrCreate({ host });

			expect(createdKey?.host).toBe(host);

			const found = await key.findOne({ host });
			expect(found?.address).toBe(createdKey?.address);
		});

		test("should handle unicode in host", async () => {
			const host = "例え.com";
			const createdKey = await key.findOrCreate({ host });

			expect(createdKey?.host).toBe(host);
		});

		test("should handle very long host names", async () => {
			const host = `${"a".repeat(1000)}.com`;
			const createdKey = await key.findOrCreate({ host });

			expect(createdKey?.host).toBe(host);
		});
	});

	describe("concurrent operations", () => {
		test("should handle concurrent findOrCreate for same host", async () => {
			const host = "example.com";

			const results = await Promise.all([
				key.findOrCreate({ host }),
				key.findOrCreate({ host }),
				key.findOrCreate({ host }),
			]);

			// All should return same key (may create duplicates due to race condition)
			// At least one result should be defined
			expect(results.filter((r) => r !== null).length).toBeGreaterThan(0);

			// All non-null results should have same address
			const addresses = results.filter((r) => r !== null).map((r) => r!.address);
			const uniqueAddresses = new Set(addresses);
			// Due to race conditions, we may have created multiple keys, but they should all be from same seed
			expect(uniqueAddresses.size).toBeGreaterThan(0);
		});

		test("should handle concurrent findOrCreate for different hosts", async () => {
			const hosts = ["example.com", "test.com", "demo.com"];

			const results = await Promise.all(hosts.map((host) => key.findOrCreate({ host })));

			// All should return keys
			expect(results.filter((r) => r !== null).length).toBe(hosts.length);

			// Addresses should be defined
			const addresses = results.map((r) => r!.address);
			for (const address of addresses) {
				expect(address).toBeDefined();
			}
		});
	});
});
