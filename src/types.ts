import type { HD } from "@bsv/sdk";
import type Datastore from "nedb";

export interface KeyRecord {
	path: string;
	pub: string;
	address: string;
	host: string;
	priv?: string;
	_id?: string;
}

export interface SeedRecord {
	hex: string;
	key: HD;
}

export interface SeedData {
	hex: string;
	key: HD;
}

export interface EncryptedSeedRecord {
	hex: {
		iv: string;
		encryptedData: string;
	};
	_id?: string;
}

export interface SignedMessage {
	address: string;
	message: string;
	sig: string;
	ts: number;
}

export interface EncryptedMessage {
	address: string;
	data: {
		iv: string;
		encryptedData: string;
	};
	ts: number;
}

export interface WalletConfig {
	db: string;
	wallet: typeof import("./wallet/index.js");
	Datastore: typeof Datastore;
}

export interface KeyConfig extends WalletConfig {}

export interface SeedConfig extends WalletConfig {}

export interface StateConfig {
	db: string;
	Datastore: typeof Datastore;
}

export interface CreateKeyOptions {
	host: string;
}

export interface SignOptions {
	message: string;
	key: KeyRecord;
	encoding?: BufferEncoding;
	ts?: number;
}

export interface EncryptOptions {
	message: string;
	key: KeyRecord;
}

export type ExpireSelection = "once" | "1h" | "1d" | "1w" | "1m" | "forever";
