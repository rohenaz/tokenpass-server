// Client-side API utilities for TokenPass

export interface WalletStatus {
	status: "locked" | "unlocked" | "no_wallet";
	address?: string;
	keys?: KeyInfo[];
	states?: StateInfo[];
}

export interface KeyInfo {
	path: string;
	pub: string;
	address: string;
	host: string;
}

export interface StateInfo {
	host: string;
	accessToken?: string;
	expireTime?: number;
	scopes?: string[];
	icon?: string;
	displayName?: string;
	paymail?: string;
	bapID?: string;
	logo?: string;
}

export interface ProfileData {
	displayName?: string;
	paymail?: string;
	bapID?: string;
	[key: string]: string | undefined;
}

export async function getStatus(): Promise<WalletStatus> {
	const res = await fetch("/api/status");
	const data = await res.json();

	// Convert API response to expected format
	let status: WalletStatus["status"];
	if (!data.seed) {
		status = "no_wallet";
	} else if (!data.unlocked) {
		status = "locked";
	} else {
		status = "unlocked";
	}

	return {
		status,
		keys: data.keys,
		states: data.states,
	};
}

export async function login(password: string): Promise<{ success: boolean; error?: string }> {
	const res = await fetch("/api/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ password }),
	});
	return res.json();
}

export async function logout(): Promise<{ success: boolean }> {
	const res = await fetch("/api/logout", {
		method: "POST",
	});
	return res.json();
}

export async function register(data: {
	password: string;
	displayName?: string;
	paymail?: string;
}): Promise<{ success: boolean; error?: string; bapID?: string }> {
	const res = await fetch("/api/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
	return res.json();
}

export async function importSeed(data: {
	mnemonic: string;
	password: string;
}): Promise<{ success: boolean; error?: string }> {
	const res = await fetch("/api/import", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
	return res.json();
}

export async function exportSeed(
	password: string,
): Promise<{ seed?: string; mnemonic?: string; error?: string }> {
	const res = await fetch("/api/export", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ password }),
	});
	return res.json();
}

export async function authorize(data: {
	password: string;
	host: string;
	icon?: string;
	scopes?: string[];
	expire: string;
}): Promise<{ success: boolean; accessToken?: string; error?: string }> {
	const res = await fetch("/api/auth", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
	return res.json();
}

export async function getProfile(): Promise<ProfileData> {
	const res = await fetch("/api/profile");
	return res.json();
}

export async function saveProfile(data: ProfileData): Promise<{ success: boolean }> {
	const res = await fetch("/api/profile", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
	return res.json();
}

export function getSecurityIconUrl(): string {
	return "/api/auth/icon";
}
