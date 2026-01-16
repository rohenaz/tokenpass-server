import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import State from "../state";
import type { StateRecord } from "../state";
import Datastore from "@seald-io/nedb";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync, existsSync } from "node:fs";

describe("State", () => {
	let testDbPath: string;
	let state: State;

	beforeEach(async () => {
		// Create unique temp directory for each test
		testDbPath = join(tmpdir(), `tokenpass-test-${Date.now()}-${Math.random()}`);
		mkdirSync(testDbPath, { recursive: true });

		state = new State({
			db: testDbPath,
			Datastore,
		});

		// Wait for database to initialize
		await new Promise((resolve) => setTimeout(resolve, 10));
	});

	afterEach(() => {
		// Clean up test database
		if (existsSync(testDbPath)) {
			rmSync(testDbPath, { recursive: true, force: true });
		}
	});

	describe("setState / getState", () => {
		test("should set and get state", () => {
			const stateData: StateRecord = {
				host: "example.com",
				accessToken: "token123",
				scopes: ["read", "write"],
			};

			state.setState(stateData);
			const retrieved = state.getState();

			expect(retrieved).toBe(stateData);
			expect(retrieved!.host).toBe("example.com");
		});

		test("should allow setting state to null", () => {
			state.setState(null);
			expect(state.getState()).toBeNull();
		});

		test("should overwrite existing state", () => {
			const state1: StateRecord = { host: "example.com", accessToken: "token1" };
			const state2: StateRecord = { host: "test.com", accessToken: "token2" };

			state.setState(state1);
			expect(state.getState()!.host).toBe("example.com");

			state.setState(state2);
			expect(state.getState()!.host).toBe("test.com");
		});
	});

	describe("findOrCreate", () => {
		test("should create state for new host", async () => {
			const host = "example.com";
			const created = await state.findOrCreate({ host });

			expect(created).toBeDefined();
			expect(created.host).toBe(host);
		});

		test("should return existing state for known host", async () => {
			const host = "example.com";
			const state1 = await state.findOrCreate({ host });
			const state2 = await state.findOrCreate({ host });

			expect(state2.host).toBe(state1.host);
		});

		test("should persist created state", async () => {
			const host = "example.com";
			await state.findOrCreate({ host });

			const count = await state.count({});
			expect(count).toBe(1);
		});

		test("should create separate states for different hosts", async () => {
			const host1 = "example.com";
			const host2 = "test.com";

			const state1 = await state.findOrCreate({ host: host1 });
			const state2 = await state.findOrCreate({ host: host2 });

			expect(state1.host).toBe(host1);
			expect(state2.host).toBe(host2);

			const count = await state.count({});
			expect(count).toBe(2);
		});
	});

	describe("findOne", () => {
		test("should find state by host", async () => {
			const host = "example.com";
			await state.findOrCreate({ host });

			const found = await state.findOne({ host });
			expect(found).toBeDefined();
			expect(found!.host).toBe(host);
		});

		test("should return null for non-existent host", async () => {
			const found = await state.findOne({ host: "nonexistent.com" });
			expect(found).toBeNull();
		});

		test("should find state by accessToken", async () => {
			const host = "example.com";
			const accessToken = "unique-token-123";

			await state.insert({ host, accessToken });

			const found = await state.findOne({ accessToken });
			expect(found).toBeDefined();
			expect(found!.host).toBe(host);
			expect(found!.accessToken).toBe(accessToken);
		});

		test("should find state by multiple fields", async () => {
			const host = "example.com";
			const accessToken = "token123";
			const bapID = "bap-id-123";

			await state.insert({ host, accessToken, bapID });

			const found = await state.findOne({ host, accessToken });
			expect(found).toBeDefined();
			expect(found!.bapID).toBe(bapID);
		});

		test("should not include _id in returned state", async () => {
			const host = "example.com";
			await state.insert({ host });

			const found = await state.findOne({ host });
			expect(found).toBeDefined();
			expect(found!._id).toBeUndefined();
		});
	});

	describe("find", () => {
		test("should find multiple states", async () => {
			await state.insert({ host: "example.com" });
			await state.insert({ host: "test.com" });

			const states = await state.find({});
			expect(states.length).toBe(2);
		});

		test("should filter by host", async () => {
			await state.insert({ host: "example.com", accessToken: "token1" });
			await state.insert({ host: "test.com", accessToken: "token2" });

			const states = await state.find({ host: "example.com" });
			expect(states.length).toBe(1);
			expect(states[0].host).toBe("example.com");
		});

		test("should filter by scopes", async () => {
			await state.insert({ host: "example.com", scopes: ["read"] });
			await state.insert({ host: "test.com", scopes: ["write"] });

			const states = await state.find({ scopes: ["read"] });
			expect(states.length).toBe(1);
			expect(states[0].host).toBe("example.com");
		});

		test("should return empty array when no states found", async () => {
			const states = await state.find({ host: "nonexistent.com" });
			expect(states).toEqual([]);
		});
	});

	describe("insert", () => {
		test("should insert state with host only", async () => {
			const host = "example.com";
			const inserted = await state.insert({ host });

			expect(inserted.host).toBe(host);
		});

		test("should insert state with full data", async () => {
			const stateData: StateRecord = {
				host: "example.com",
				accessToken: "token123",
				expireTime: Date.now() + 3600000,
				scopes: ["read", "write"],
				icon: "https://example.com/icon.png",
				displayName: "Example App",
				paymail: "user@example.com",
				bapID: "bap-id-123",
				logo: "https://example.com/logo.png",
			};

			const inserted = await state.insert(stateData);

			expect(inserted.host).toBe(stateData.host);
			expect(inserted.accessToken).toBe(stateData.accessToken);
			expect(inserted.expireTime).toBe(stateData.expireTime);
			expect(inserted.scopes).toEqual(stateData.scopes);
			expect(inserted.displayName).toBe(stateData.displayName);
		});

		test("should set internal state on insert", async () => {
			const host = "example.com";
			await state.insert({ host });

			const internalState = state.getState();
			expect(internalState).toBeDefined();
			expect(internalState!.host).toBe(host);
		});

		test("inserted state should be retrievable", async () => {
			const host = "example.com";
			const accessToken = "token123";

			await state.insert({ host, accessToken });

			const found = await state.findOne({ host });
			expect(found!.accessToken).toBe(accessToken);
		});
	});

	describe("update", () => {
		test("should update existing state", async () => {
			const host = "example.com";
			await state.insert({ host, accessToken: "old-token" });

			await state.update({ host, accessToken: "new-token" });

			const found = await state.findOne({ host });
			expect(found!.accessToken).toBe("new-token");
		});

		test("should create state if it doesn't exist (upsert)", async () => {
			const host = "example.com";
			await state.update({ host, accessToken: "token123" });

			const found = await state.findOne({ host });
			expect(found).toBeDefined();
			expect(found!.accessToken).toBe("token123");
		});

		test("should update internal state", async () => {
			const host = "example.com";
			await state.insert({ host, accessToken: "old-token" });

			await state.update({ host, accessToken: "new-token" });

			const internalState = state.getState();
			expect(internalState!.accessToken).toBe("new-token");
		});

		test("should merge updates with existing data", async () => {
			const host = "example.com";
			await state.insert({
				host,
				accessToken: "token123",
				displayName: "Old Name",
			});

			await state.update({
				host,
				displayName: "New Name",
			});

			const found = await state.findOne({ host });
			expect(found!.accessToken).toBe("token123");
			expect(found!.displayName).toBe("New Name");
		});

		test("should update scopes", async () => {
			const host = "example.com";
			await state.insert({ host, scopes: ["read"] });

			await state.update({ host, scopes: ["read", "write"] });

			const found = await state.findOne({ host });
			expect(found!.scopes).toEqual(["read", "write"]);
		});
	});

	describe("delete", () => {
		test("should delete state by host", async () => {
			const host = "example.com";
			await state.insert({ host });

			const numRemoved = await state.delete({ host });
			expect(numRemoved).toBe(1);

			const found = await state.findOne({ host });
			expect(found).toBeNull();
		});

		test("should delete state by accessToken", async () => {
			const host = "example.com";
			const accessToken = "token123";
			await state.insert({ host, accessToken });

			const numRemoved = await state.delete({ accessToken });
			expect(numRemoved).toBe(1);

			const found = await state.findOne({ host });
			expect(found).toBeNull();
		});

		test("should return 0 when no states match", async () => {
			const numRemoved = await state.delete({ host: "nonexistent.com" });
			expect(numRemoved).toBe(0);
		});

		test("should delete by specific field", async () => {
			const displayName = "Same App";
			await state.insert({ host: "example.com", displayName });
			await state.insert({ host: "test.com", displayName: "Different App" });

			const numRemoved = await state.delete({ displayName });
			expect(numRemoved).toBeGreaterThan(0);

			// Verify the correct state was deleted
			const found = await state.findOne({ displayName });
			expect(found).toBeNull();
		});
	});

	describe("count", () => {
		test("should return 0 for empty database", async () => {
			const count = await state.count({});
			expect(count).toBe(0);
		});

		test("should return correct count after inserting states", async () => {
			await state.insert({ host: "example.com" });
			await state.insert({ host: "test.com" });

			const count = await state.count({});
			expect(count).toBe(2);
		});

		test("should count by filter", async () => {
			await state.insert({ host: "example.com", scopes: ["read"] });
			await state.insert({ host: "test.com", scopes: ["write"] });

			const count = await state.count({ scopes: ["read"] });
			expect(count).toBe(1);
		});

		test("should decrement after delete", async () => {
			const host = "example.com";
			await state.insert({ host });

			let count = await state.count({});
			expect(count).toBe(1);

			await state.delete({ host });

			count = await state.count({});
			expect(count).toBe(0);
		});
	});

	describe("all", () => {
		test("should return all states", async () => {
			const hosts = ["example.com", "test.com", "demo.com"];

			for (const host of hosts) {
				await state.insert({ host });
			}

			const allStates = await state.all();
			expect(allStates.length).toBe(hosts.length);

			const hostSet = new Set(allStates.map((s) => s.host));
			expect(hostSet.size).toBe(hosts.length);
			for (const host of hosts) {
				expect(hostSet.has(host)).toBe(true);
			}
		});

		test("should return empty array when no states exist", async () => {
			const allStates = await state.all();
			expect(allStates).toEqual([]);
		});
	});

	describe("access token management", () => {
		test("should store and retrieve access tokens", async () => {
			const host = "example.com";
			const accessToken = "abc123xyz";

			await state.insert({ host, accessToken });

			const found = await state.findOne({ host });
			expect(found!.accessToken).toBe(accessToken);
		});

		test("should handle token expiration time", async () => {
			const host = "example.com";
			const expireTime = Date.now() + 3600000; // 1 hour

			await state.insert({ host, expireTime });

			const found = await state.findOne({ host });
			expect(found!.expireTime).toBe(expireTime);
		});

		test("should handle undefined access token", async () => {
			const host = "example.com";
			await state.insert({ host });

			const found = await state.findOne({ host });
			expect(found!.accessToken).toBeUndefined();
		});

		test("should update access token", async () => {
			const host = "example.com";
			await state.insert({ host, accessToken: "old-token" });

			await state.update({
				host,
				accessToken: "new-token",
				expireTime: Date.now() + 3600000,
			});

			const found = await state.findOne({ host });
			expect(found!.accessToken).toBe("new-token");
			expect(found!.expireTime).toBeDefined();
		});
	});

	describe("scopes", () => {
		test("should store scopes array", async () => {
			const host = "example.com";
			const scopes = ["read_profile", "write_profile", "encrypt"];

			await state.insert({ host, scopes });

			const found = await state.findOne({ host });
			expect(found!.scopes).toEqual(scopes);
		});

		test("should handle empty scopes", async () => {
			const host = "example.com";
			await state.insert({ host, scopes: [] });

			const found = await state.findOne({ host });
			expect(found!.scopes).toEqual([]);
		});

		test("should update scopes", async () => {
			const host = "example.com";
			await state.insert({ host, scopes: ["read"] });

			await state.update({ host, scopes: ["read", "write", "fund"] });

			const found = await state.findOne({ host });
			expect(found!.scopes).toEqual(["read", "write", "fund"]);
		});
	});

	describe("app metadata", () => {
		test("should store app icon", async () => {
			const host = "example.com";
			const icon = "https://example.com/icon.png";

			await state.insert({ host, icon });

			const found = await state.findOne({ host });
			expect(found!.icon).toBe(icon);
		});

		test("should store display name", async () => {
			const host = "example.com";
			const displayName = "Example Application";

			await state.insert({ host, displayName });

			const found = await state.findOne({ host });
			expect(found!.displayName).toBe(displayName);
		});

		test("should store logo", async () => {
			const host = "example.com";
			const logo = "https://example.com/logo.png";

			await state.insert({ host, logo });

			const found = await state.findOne({ host });
			expect(found!.logo).toBe(logo);
		});

		test("should store all metadata together", async () => {
			const host = "example.com";
			const metadata = {
				icon: "https://example.com/icon.png",
				logo: "https://example.com/logo.png",
				displayName: "Example App",
			};

			await state.insert({ host, ...metadata });

			const found = await state.findOne({ host });
			expect(found!.icon).toBe(metadata.icon);
			expect(found!.logo).toBe(metadata.logo);
			expect(found!.displayName).toBe(metadata.displayName);
		});
	});

	describe("identity data", () => {
		test("should store paymail", async () => {
			const host = "example.com";
			const paymail = "user@example.com";

			await state.insert({ host, paymail });

			const found = await state.findOne({ host });
			expect(found!.paymail).toBe(paymail);
		});

		test("should store BAP ID", async () => {
			const host = "example.com";
			const bapID = "1234567890abcdef";

			await state.insert({ host, bapID });

			const found = await state.findOne({ host });
			expect(found!.bapID).toBe(bapID);
		});
	});

	describe("per-host isolation", () => {
		test("states should be isolated by host", async () => {
			await state.insert({ host: "example.com", accessToken: "token1" });
			await state.insert({ host: "test.com", accessToken: "token2" });

			const state1 = await state.findOne({ host: "example.com" });
			const state2 = await state.findOne({ host: "test.com" });

			expect(state1!.accessToken).toBe("token1");
			expect(state2!.accessToken).toBe("token2");
		});

		test("updates should only affect target host", async () => {
			await state.insert({ host: "example.com", displayName: "App 1" });
			await state.insert({ host: "test.com", displayName: "App 2" });

			await state.update({ host: "example.com", displayName: "Updated App 1" });

			const state1 = await state.findOne({ host: "example.com" });
			const state2 = await state.findOne({ host: "test.com" });

			expect(state1!.displayName).toBe("Updated App 1");
			expect(state2!.displayName).toBe("App 2");
		});

		test("deletes should only affect target host", async () => {
			await state.insert({ host: "example.com" });
			await state.insert({ host: "test.com" });

			await state.delete({ host: "example.com" });

			const state1 = await state.findOne({ host: "example.com" });
			const state2 = await state.findOne({ host: "test.com" });

			expect(state1).toBeNull();
			expect(state2).toBeDefined();
		});
	});

	describe("edge cases", () => {
		test("should handle hosts with special characters", async () => {
			const host = "example.com:8080/path?query=1";
			await state.insert({ host });

			const found = await state.findOne({ host });
			expect(found!.host).toBe(host);
		});

		test("should handle unicode in host", async () => {
			const host = "例え.com";
			await state.insert({ host });

			const found = await state.findOne({ host });
			expect(found!.host).toBe(host);
		});

		test("should handle very long access tokens", async () => {
			const host = "example.com";
			const accessToken = "a".repeat(1000);

			await state.insert({ host, accessToken });

			const found = await state.findOne({ host });
			expect(found!.accessToken).toBe(accessToken);
		});

		test("should handle many scopes", async () => {
			const host = "example.com";
			const scopes = Array.from({ length: 100 }, (_, i) => `scope_${i}`);

			await state.insert({ host, scopes });

			const found = await state.findOne({ host });
			expect(found!.scopes).toEqual(scopes);
		});
	});

	describe("concurrent operations", () => {
		test("should handle concurrent inserts for different hosts", async () => {
			const hosts = ["example.com", "test.com", "demo.com"];

			await Promise.all(hosts.map((host) => state.insert({ host })));

			const count = await state.count({});
			expect(count).toBe(hosts.length);
		});

		test("should handle concurrent updates", async () => {
			const host = "example.com";
			await state.insert({ host });

			await Promise.all([
				state.update({ host, displayName: "Name 1" }),
				state.update({ host, icon: "icon.png" }),
				state.update({ host, logo: "logo.png" }),
			]);

			const found = await state.findOne({ host });
			// At least one of the updates should be present
			expect(
				found!.displayName || found!.icon || found!.logo,
			).toBeDefined();
		});
	});
});
