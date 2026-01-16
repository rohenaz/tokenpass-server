import { decrypt, encrypt } from "./crypt.ts";
import type { SeedData } from "./types.ts";

interface SeedConfig {
	db: string;
	wallet: {
		seed: (hex?: string, passphrase?: string) => SeedData;
	};
	Datastore: any;
}

interface SeedRecord {
	hex: string;
}

class Seed {
	private db: any;
	private wallet: SeedConfig["wallet"];

	constructor(config: SeedConfig) {
		const dbpath = config.db;
		this.db = new config.Datastore({
			filename: `${dbpath}/seed.db`,
			autoload: true,
		});
		this.wallet = config.wallet;
	}

	get(password: string): Promise<SeedData | null> {
		return new Promise((resolve) => {
			this.db.findOne({}, (_err: Error | null, r: SeedRecord | null) => {
				if (r) {
					try {
						const decrypted = decrypt(r.hex, password);
						const s = this.wallet.seed(decrypted);
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

	importKey(hex: string, password: string): Promise<SeedData> {
		return new Promise((resolve, reject) => {
			try {
				const s = this.wallet.seed(hex);
				this.db.insert(
					{
						hex: encrypt(s.hex, password),
					},
					() => {
						resolve(s);
					},
				);
			} catch (e) {
				reject(e);
			}
		});
	}

	async exportKey(password: string): Promise<string> {
		const s = await this.get(password);
		return s!.hex;
	}

	count(): Promise<number> {
		return new Promise((resolve) => {
			this.db.count({}, (_err: Error | null, count: number) => {
				resolve(count);
			});
		});
	}

	create(password: string): Promise<SeedData> {
		return new Promise((resolve) => {
			const s = this.wallet.seed(undefined, password);
			this.db.insert(
				{
					hex: encrypt(s.hex, password),
				},
				() => {
					resolve(s);
				},
			);
		});
	}
}

export default Seed;
