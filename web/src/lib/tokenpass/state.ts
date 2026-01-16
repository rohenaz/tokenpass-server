import type Datastore from "@seald-io/nedb";

export interface StateRecord {
	host: string;
	accessToken?: string;
	expireTime?: number;
	scopes?: string[];
	icon?: string;
	displayName?: string;
	paymail?: string;
	bapID?: string;
	logo?: string;
	_id?: string;
}

interface StateConfig {
	db: string;
	Datastore: typeof Datastore;
}

class State {
	private db: Datastore;
	private state: StateRecord | null = null;

	constructor(config: StateConfig) {
		const dbpath = config.db;
		this.db = new config.Datastore({
			filename: `${dbpath}/state.db`,
			autoload: true,
		});
	}

	setState(s: StateRecord | null): void {
		this.state = s;
	}

	getState(): StateRecord | null {
		return this.state;
	}

	async findOrCreate(o: { host: string }): Promise<StateRecord> {
		let state = await this.findOne({ host: o.host });
		if (!state) {
			state = await this.insert(o as StateRecord);
		}
		return state;
	}

	findOne(o: Partial<StateRecord>): Promise<StateRecord | null> {
		return new Promise((resolve) => {
			this.db.findOne(o, (_err: Error | null, state: StateRecord | null) => {
				if (state) {
					const { _id: _, ...rest } = state;
					resolve(rest as StateRecord);
				} else {
					resolve(null);
				}
			});
		});
	}

	find(o: Partial<StateRecord>): Promise<StateRecord[]> {
		return new Promise((resolve) => {
			this.db.find(o, (_err: Error | null, states: StateRecord[]) => {
				resolve(states);
			});
		});
	}

	delete(o: Partial<StateRecord>): Promise<number> {
		return new Promise((resolve) => {
			this.db.remove(o, (_err: Error | null, numRemoved: number) => {
				resolve(numRemoved);
			});
		});
	}

	count(o: Partial<StateRecord>): Promise<number> {
		return new Promise((resolve) => {
			this.db.count(o, (_err: Error | null, count: number) => {
				resolve(count);
			});
		});
	}

	insert(state: StateRecord): Promise<StateRecord> {
		return new Promise((resolve) => {
			this.db.insert(state, (_err: Error | null, _doc: StateRecord) => {
				this.setState(state);
				resolve(state);
			});
		});
	}

	update(state: StateRecord): Promise<StateRecord> {
		return new Promise((resolve) => {
			this.db.update(
				{ host: state.host },
				{ $set: state },
				{
					upsert: true,
					returnUpdatedDocs: true,
				},
				(err: Error | null, _numReplaced: number, doc: StateRecord) => {
					console.log("UPDATED", { err, accessToken: doc?.accessToken });
					this.setState(doc);
					resolve(doc);
				},
			);
		});
	}

	all(): Promise<StateRecord[]> {
		return new Promise((resolve) => {
			this.db.find({}, (_err: Error | null, states: StateRecord[]) => {
				resolve(states);
			});
		});
	}
}

export default State;
