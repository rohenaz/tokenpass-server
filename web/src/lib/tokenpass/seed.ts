import type Datastore from "@seald-io/nedb";
import { decryptBackup, encryptBackup, type VaultBackup } from "bitcoin-backup";
import type { SeedData } from "./types";

interface SeedConfig {
	db: string;
	wallet: {
		seed: (hex?: string, passphrase?: string, mnemonic?: string) => SeedData;
	};
	Datastore: typeof Datastore;
}

interface SeedRecord {
	encrypted: string;
	_id?: string;
}

const TOKENPASS_SEED_SCHEME = "tokenpass-seed-v1";

interface SeedPayload {
	hex: string;
	mnemonic?: string;
}

class Seed {
	private db: Datastore<SeedRecord>;
	private wallet: SeedConfig["wallet"];
	private loadPromise: Promise<void>;

	constructor(config: SeedConfig) {
		const dbpath = config.db;
		const filename = `${dbpath}/seed.db`;
		this.db = new config.Datastore({ filename });
		this.wallet = config.wallet;

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

	async get(password: string): Promise<SeedData | null> {
		await this.ensureLoaded();
		return new Promise((resolve) => {
			this.db.findOne({}, async (_err: Error | null, record: SeedRecord | null) => {
				if (!record?.encrypted) {
					resolve(null);
					return;
				}

				try {
					const decrypted = await decryptBackup(record.encrypted, password);

					if ("encryptedVault" in decrypted && decrypted.scheme === TOKENPASS_SEED_SCHEME) {
						const payload: SeedPayload = JSON.parse(decrypted.encryptedVault);
						const seedData = this.wallet.seed(payload.hex, undefined, payload.mnemonic);
						resolve(seedData);
						return;
					}

					resolve(null);
				} catch {
					resolve(null);
				}
			});
		});
	}

	async importKey(hex: string, password: string, mnemonic?: string): Promise<SeedData> {
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
		const seedData = await this.get(password);
		if (!seedData) {
			throw new Error("Failed to decrypt seed");
		}
		return { hex: seedData.hex, mnemonic: seedData.mnemonic };
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
