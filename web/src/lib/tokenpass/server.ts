import os from "node:os";
import path from "node:path";
import Datastore from "@seald-io/nedb";
import KeyClass from "./key";
import SeedClass from "./seed";
import StateClass from "./state";
import * as WalletModule from "./wallet";

const homedir = os.homedir();
const dbPath = path.join(homedir, ".tokenpass");

// Use globalThis to persist modules across hot reloads in development
const globalForTokenPass = globalThis as unknown as {
	_tokenpassSeed: InstanceType<typeof SeedClass> | undefined;
	_tokenpassKey: InstanceType<typeof KeyClass> | undefined;
	_tokenpassState: InstanceType<typeof StateClass> | undefined;
};

function getSeedModule() {
	if (!globalForTokenPass._tokenpassSeed) {
		globalForTokenPass._tokenpassSeed = new SeedClass({
			db: dbPath,
			wallet: WalletModule,
			Datastore,
		});
	}
	return globalForTokenPass._tokenpassSeed;
}

function getKeyModule() {
	if (!globalForTokenPass._tokenpassKey) {
		globalForTokenPass._tokenpassKey = new KeyClass({
			db: dbPath,
			wallet: WalletModule,
			Datastore,
		});
	}
	return globalForTokenPass._tokenpassKey;
}

function getStateModule() {
	if (!globalForTokenPass._tokenpassState) {
		globalForTokenPass._tokenpassState = new StateClass({
			db: dbPath,
			Datastore,
		});
	}
	return globalForTokenPass._tokenpassState;
}

// Export singleton instances
export const Seed = getSeedModule();
export const Key = getKeyModule();
export const State = getStateModule();
export const Wallet = WalletModule;

// Helper function to convert expire selection to time
export function expireSelectionToTime(expireSelection: string): number {
	switch (expireSelection) {
		case "forever":
			return 0;
		case "once":
			return 10000;
		case "1h":
			return 3600000;
		case "1d":
			return 86400000;
		case "1w":
			return 604800000;
		case "1m":
			return 2592000000;
		default:
			return 10000;
	}
}
