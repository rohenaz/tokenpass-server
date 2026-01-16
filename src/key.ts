import type { KeyRecord, SeedData, SignedMessage } from "./types.ts";

interface KeyConfig {
	db: string;
	wallet: {
		sign: (message: string, key: KeyRecord, encoding?: string) => SignedMessage;
		encrypt: (
			message: string,
			key: KeyRecord,
		) => { address: string; data: any; ts: number };
		create: (
			seed: SeedData,
			account: number,
			o: { host: string },
		) => Promise<Omit<KeyRecord, "priv">>;
		derive: (seed: SeedData, path: string) => { privKey: any; pubKey: any };
	};
	Datastore: any;
}

interface DBKeyRecord {
	path: string;
	pub: string;
	address: string;
	host: string;
	_id?: string;
}

class Key {
	private db: any;
	private wallet: KeyConfig["wallet"];
	private config: KeyConfig;
	private seed: SeedData | null = null;

	constructor(config: KeyConfig) {
		const dbpath = config.db;
		this.db = new config.Datastore({
			filename: `${dbpath}/keys.db`,
			autoload: true,
		});
		this.wallet = config.wallet;
		this.config = config;
	}

	setSeed(s: SeedData | null): void {
		this.seed = s;
	}

	getSeed(): SeedData | null {
		return this.seed;
	}

	sign(o: {
		message: string;
		key: KeyRecord;
		encoding?: string;
	}): SignedMessage {
		return this.wallet.sign(o.message, o.key, o.encoding);
	}

	encrypt(o: { message: string; key: KeyRecord }): {
		address: string;
		data: any;
		ts: number;
	} {
		return this.wallet.encrypt(o.message, o.key);
	}

	async findOrCreate(o: { host: string }): Promise<KeyRecord | null> {
		let key = await this.findOne(o);
		if (!key) {
			const count = await this.count({});
			if (this.seed) {
				const newKey = await this.wallet.create(this.seed, count, o);
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
		const derived = this.wallet.derive(this.seed!, key.path);
		return {
			...key,
			priv: derived.privKey.toWif(),
			pub: derived.pubKey.toString(),
			address: derived.privKey.toAddress(),
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
