import type { PrivateKey, PublicKey } from "@bsv/sdk";
import type Datastore from "@seald-io/nedb";
import type { KeyRecord, SeedData, SignedMessage } from "./types";

interface KeyConfig {
	db: string;
	wallet: {
		sign: (message: string, key: KeyRecord, encoding?: BufferEncoding) => SignedMessage;
		encrypt: (message: string, key: KeyRecord) => { address: string; data: string; ts: number };
		decrypt: (ciphertext: string, key: KeyRecord) => string;
		createType42: (seedData: SeedData, host: string) => Promise<Omit<KeyRecord, "priv">>;
		deriveType42: (
			seedData: SeedData,
			invoiceNumber: string,
		) => { privateKey: PrivateKey; publicKey: PublicKey };
	};
	Datastore: typeof Datastore;
}

interface DBKeyRecord {
	/** Invoice number for Type42 derivation in BRC-43 format (e.g., "2-sigma auth-example.com") */
	path: string;
	pub: string;
	address: string;
	host: string;
	_id?: string;
}

class Key {
	private db: Datastore<DBKeyRecord>;
	private wallet: KeyConfig["wallet"];
	private seed: SeedData | null = null;

	constructor(config: KeyConfig) {
		const dbpath = config.db;
		this.db = new config.Datastore({
			filename: `${dbpath}/keys.db`,
			autoload: true,
		});
		this.wallet = config.wallet;
	}

	setSeed(s: SeedData | null): void {
		this.seed = s;
	}

	getSeed(): SeedData | null {
		return this.seed;
	}

	sign(o: { message: string; key: KeyRecord; encoding?: BufferEncoding }): SignedMessage {
		return this.wallet.sign(o.message, o.key, o.encoding);
	}

	encrypt(o: { message: string; key: KeyRecord }): {
		address: string;
		data: string;
		ts: number;
	} {
		return this.wallet.encrypt(o.message, o.key);
	}

	decrypt(o: { ciphertext: string; key: KeyRecord }): string {
		return this.wallet.decrypt(o.ciphertext, o.key);
	}

	async findOrCreate(o: { host: string }): Promise<KeyRecord | null> {
		let key = await this.findOne(o);
		if (!key) {
			const currentSeed = this.seed;
			if (currentSeed) {
				const newKey = await this.wallet.createType42(currentSeed, o.host);
				key = await this.insert(newKey as DBKeyRecord);
			} else {
				console.log("Please go to http://localhost:21000 and create a wallet");
				return null;
			}
		}
		return key;
	}

	findOne(o: Partial<DBKeyRecord>): Promise<KeyRecord | null> {
		return new Promise((resolve) => {
			this.db.findOne(o, (_err: Error | null, key: DBKeyRecord | null) => {
				if (key) {
					resolve(this.transform(key));
				} else {
					resolve(null);
				}
			});
		});
	}

	find(o: Partial<DBKeyRecord>): Promise<KeyRecord[]> {
		return new Promise((resolve) => {
			this.db.find(o, (_err: Error | null, keys: DBKeyRecord[]) => {
				resolve(keys.map((k) => this.transform(k)));
			});
		});
	}

	count(o: Partial<DBKeyRecord>): Promise<number> {
		return new Promise((resolve) => {
			this.db.count(o, (_err: Error | null, count: number) => {
				resolve(count);
			});
		});
	}

	insert(key: DBKeyRecord): Promise<KeyRecord> {
		return new Promise((resolve) => {
			this.db.insert(key, () => {
				resolve(this.transform(key));
			});
		});
	}

	private transform(key: DBKeyRecord): KeyRecord {
		const currentSeed = this.seed;
		if (!currentSeed) {
			throw new Error("Seed not set - wallet is locked");
		}

		const derived = this.wallet.deriveType42(currentSeed, key.path);
		return {
			...key,
			priv: derived.privateKey.toWif(),
			pub: derived.publicKey.toString(),
			address: derived.publicKey.toAddress(),
		};
	}

	all(): Promise<KeyRecord[]> {
		return new Promise((resolve) => {
			this.db.find({}, (_err: Error | null, keys: DBKeyRecord[]) => {
				resolve(keys.map((k) => this.transform(k)));
			});
		});
	}
}

export default Key;
