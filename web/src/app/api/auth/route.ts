import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Key, Seed, State, expireSelectionToTime } from "@/lib/tokenpass/server";

/**
 * POST /api/auth
 *
 * Creates an access token for API access.
 *
 * Two modes:
 * 1. Password auth: { password, host, expire?, scopes?, icon? }
 *    - Unlocks wallet if needed and creates access token
 *
 * 2. Session auth: { host, scopes?, expiry? }
 *    - If wallet is already unlocked, creates access token without password
 *    - Used by LocalServerSigner when user has already logged in via web UI
 *
 * Returns: { success, accessToken, expireTime, host }
 */
export async function POST(request: NextRequest) {
	const body = await request.json();
	const { password, host, expire, expiry, scopes, icon } = body;

	if (!host) {
		return NextResponse.json({ error: "Host is required" }, { status: 400 });
	}

	// Use 'expiry' or 'expire' for expiration time (support both)
	const expireSelection = expiry || expire || "1h";

	try {
		// Check if wallet is already unlocked (session-based auth)
		if (!password) {
			const existingSeed = Key.getSeed();
			if (!existingSeed) {
				return NextResponse.json(
					{
						error: "Wallet is locked. Password required to unlock.",
						code: 1,
						success: false,
					},
					{ status: 401 },
				);
			}

			// Wallet is unlocked, create access token without password
			const expireTime = expireSelectionToTime(expireSelection);
			const accessToken = randomUUID();
			const scopeList = Array.isArray(scopes)
				? scopes
				: scopes?.split(",") || [];

			const newState = {
				host,
				accessToken,
				scopes: scopeList,
				icon,
				expireTime: expireTime === 0 ? 0 : Date.now() + expireTime,
			};
			await State.update(newState);

			return NextResponse.json({
				success: true,
				accessToken,
				expireTime: newState.expireTime,
				host,
			});
		}

		// Password-based auth - unlock wallet and create token
		const s = await Seed.get(password);
		if (s) {
			Key.setSeed(s);

			const expireTime = expireSelectionToTime(expireSelection);
			const accessToken = randomUUID();
			const scopeList = Array.isArray(scopes)
				? scopes
				: scopes?.split(",") || [];

			const newState = {
				host,
				accessToken,
				scopes: scopeList,
				icon,
				expireTime: expireTime === 0 ? 0 : Date.now() + expireTime,
			};
			await State.update(newState);

			return NextResponse.json({
				success: true,
				accessToken,
				expireTime: newState.expireTime,
				host,
			});
		}

		return NextResponse.json(
			{ error: "Invalid password", success: false },
			{ status: 401 },
		);
	} catch (e) {
		return NextResponse.json(
			{ success: false, error: String(e) },
			{ status: 500 },
		);
	}
}
