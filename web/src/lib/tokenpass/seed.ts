import {
	decryptBackup,
	encryptBackup,
	type VaultBackup,
} from "bitcoin-backup";
import type { SeedData } from "./types";

interface SeedConfig {
	db: string;
	wallet: {
		seed: (hex?: string, passphrase?: string, mnemonic?: string) => SeedData;
	};
	Datastore: any;
}

interface SeedRecord {
	/** Encrypted backup string (bitcoin-backup format) */
	encrypted: string;
	/** Legacy format hex field (for migration) */
	hex?: { iv: string; encryptedData: string };
	/** Legacy format mnemonic field (for migration) */
	mnemonic?: { iv: string; encryptedData: string };
}

/** Scheme identifier for TokenPass seed backups */
const TOKENPASS_SEED_SCHEME = "tokenpass-seed-v1";

/** Payload structure stored in the VaultBackup */
interface SeedPayload {
	hex: string;
	mnemonic?: string;
}

class Seed {
	private db: any;
	private wallet: SeedConfig["wallet"];
	private loadPromise: Promise<void>;

	constructor(config: SeedConfig) {
		const dbpath = config.db;
		const filename = `${dbpath}/seed.db`;
		this.db = new config.Datastore({ filename });
		this.wallet = config.wallet;

		// Manually load database and wait for completion
		this.loadPromise = new Promise((resolve) => {
			this.db.loadDatabase((err: Error | null) => {
				if (err) console.error("Failed to load seed.db:", err);
				resolve();
			});
		});
	}

	private async ensureLoaded(): Promise<void> {
		await this.loadPromise;
	}

	/**
	 * Migrate legacy encrypted data to new bitcoin-backup format
	 */
	private async migrateLegacyRecord(
		record: SeedRecord,
		password: string,
	): Promise<SeedData | null> {
		// Import legacy crypt module for decryption
		const { decrypt: legacyDecrypt } = await import("./crypt");

		try {
			if (!record.hex) return null;

			const decryptedHex = legacyDecrypt(record.hex, password);
			const decryptedMnemonic = record.mnemonic
				? legacyDecrypt(record.mnemonic, password)
				: undefined;

			// Create seed from decrypted data
			const seedData = this.wallet.seed(
				decryptedHex,
				undefined,
				decryptedMnemonic,
			);

			// Re-encrypt with bitcoin-backup format
			const payload: SeedPayload = {
				hex: seedData.hex,
				mnemonic: seedData.mnemonic,
			};

			const vaultBackup: VaultBackup = {
				encryptedVault: JSON.stringify(payload),
				scheme: TOKENPASS_SEED_SCHEME,
				createdAt: new Date().toISOString(),
			};

			const encrypted = await encryptBackup(vaultBackup, password);

			// Update record in database with new format
			await new Promise<void>((resolve, reject) => {
				this.db.update(
					{},
					{ $set: { encrypted }, $unset: { hex: true, mnemonic: true } },
					{},
					(err: Error | null) => {
						if (err) reject(err);
						else resolve();
					},
				);
			});

			return seedData;
		} catch (e) {
			console.error("Migration failed:", e);
			return null;
		}
	}

	async get(password: string): Promise<SeedData | null> {
		await this.ensureLoaded();
		return new Promise((resolve) => {
			this.db.findOne({}, async (_err: Error | null, r: SeedRecord | null) => {
				if (!r) {
					resolve(null);
					return;
				}

				try {
					// Check for new format first
					if (r.encrypted) {
						const decrypted = await decryptBackup(r.encrypted, password);

						// Verify it's our format
						if (
							"encryptedVault" in decrypted &&
							decrypted.scheme === TOKENPASS_SEED_SCHEME
						) {
							const payload: SeedPayload = JSON.parse(decrypted.encryptedVault);
							const seedData = this.wallet.seed(
								payload.hex,
								undefined,
								payload.mnemonic,
							);
							resolve(seedData);
							return;
						}
					}

					// Try legacy format migration
					if (r.hex) {
						const migrated = await this.migrateLegacyRecord(r, password);
						resolve(migrated);
						return;
					}

					resolve(null);
				} catch (_e) {
					resolve(null);
				}
			});
		});
	}

	async importKey(
		hex: string,
		password: string,
		mnemonic?: string,
	): Promise<SeedData> {
		const seedData = this.wallet.seed(hex, undefined, mnemonic);

		const payload: SeedPayload = {
			hex: seedData.hex,
			mnemonic: mnemonic,
		};

		const vaultBackup: VaultBackup = {
			encryptedVault: JSON.stringify(payload),
			scheme: TOKENPASS_SEED_SCHEME,
			createdAt: new Date().toISOString(),
		};

		const encrypted = await encryptBackup(vaultBackup, password);

		return new Promise((resolve, reject) => {
			this.db.insert({ encrypted }, (err: Error | null) => {
				if (err) reject(err);
				else resolve(seedData);
			});
		});
	}

	async exportKey(password: string): Promise<{ hex: string; mnemonic?: string }> {
		const s = await this.get(password);
		if (!s) {
			throw new Error("Failed to decrypt seed");
		}
		return { hex: s.hex, mnemonic: s.mnemonic };
	}

	async count(): Promise<number> {
		await this.ensureLoaded();
		return new Promise((resolve) => {
			this.db.count({}, (_err: Error | null, count: number) => {
				resolve(count);
			});
		});
	}

	async create(password: string): Promise<SeedData> {
		const seedData = this.wallet.seed(undefined, password);

		const payload: SeedPayload = {
			hex: seedData.hex,
			mnemonic: seedData.mnemonic,
		};

		const vaultBackup: VaultBackup = {
			encryptedVault: JSON.stringify(payload),
			scheme: TOKENPASS_SEED_SCHEME,
			createdAt: new Date().toISOString(),
		};

		const encrypted = await encryptBackup(vaultBackup, password);

		return new Promise((resolve, reject) => {
			this.db.insert({ encrypted }, (err: Error | null) => {
				if (err) reject(err);
				else resolve(seedData);
			});
		});
	}
}

export default Seed;
