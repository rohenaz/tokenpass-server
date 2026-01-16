import { decrypt, encrypt, type EncryptedData } from "./crypt";
import type { SeedData } from "./types";

interface SeedConfig {
	db: string;
	wallet: {
		seed: (hex?: string, passphrase?: string, mnemonic?: string) => SeedData;
	};
	Datastore: any;
}

interface SeedRecord {
	hex: EncryptedData;
	mnemonic?: EncryptedData;
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

	async get(password: string): Promise<SeedData | null> {
		await this.ensureLoaded();
		return new Promise((resolve) => {
			this.db.findOne({}, (_err: Error | null, r: SeedRecord | null) => {
				if (r) {
					try {
						const decryptedHex = decrypt(r.hex, password);
						const decryptedMnemonic = r.mnemonic ? decrypt(r.mnemonic, password) : undefined;
						const s = this.wallet.seed(decryptedHex, undefined, decryptedMnemonic);
						resolve(s);
					} catch (_e) {
						resolve(null);
					}
				} else {
					resolve(null);
				}
			});
		});
	}

	importKey(hex: string, password: string, mnemonic?: string): Promise<SeedData> {
		return new Promise((resolve, reject) => {
			try {
				const s = this.wallet.seed(hex, undefined, mnemonic);
				const record: SeedRecord = {
					hex: encrypt(s.hex, password),
				};
				if (mnemonic) {
					record.mnemonic = encrypt(mnemonic, password);
				}
				this.db.insert(record, () => {
					resolve(s);
				});
			} catch (e) {
				reject(e);
			}
		});
	}

	async exportKey(password: string): Promise<{ hex: string; mnemonic?: string }> {
		const s = await this.get(password);
		return { hex: s!.hex, mnemonic: s?.mnemonic };
	}

	async count(): Promise<number> {
		await this.ensureLoaded();
		return new Promise((resolve) => {
			this.db.count({}, (_err: Error | null, count: number) => {
				resolve(count);
			});
		});
	}

	create(password: string): Promise<SeedData> {
		return new Promise((resolve) => {
			const s = this.wallet.seed(undefined, password);
			const record: SeedRecord = {
				hex: encrypt(s.hex, password),
			};
			if (s.mnemonic) {
				record.mnemonic = encrypt(s.mnemonic, password);
			}
			this.db.insert(record, () => {
				resolve(s);
			});
		});
	}
}

export default Seed;
