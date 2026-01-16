import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Key, Seed, State, expireSelectionToTime } from "@/lib/tokenpass/server";

export async function POST(request: NextRequest) {
	const body = await request.json();
	const { password, host, expire, scopes, icon } = body;

	if (!password) {
		return NextResponse.json({ error: "Password is required" }, { status: 400 });
	}

	if (!host) {
		return NextResponse.json({ error: "Host is required" }, { status: 400 });
	}

	try {
		const s = await Seed.get(password);
		if (s) {
			Key.setSeed(s);

			const expireTime = expireSelectionToTime(expire || "once");
			const accessToken = randomUUID();
			const scopeList = scopes?.split(",") || [];

			const newState = {
				host,
				accessToken,
				scopes: scopeList,
				icon,
				expireTime: Date.now() + expireTime,
			};
			await State.update(newState);

			return NextResponse.json({
				success: true,
				accessToken,
				expireTime: newState.expireTime,
				host,
			});
		}
		return NextResponse.json({ error: "Invalid password", success: false }, { status: 401 });
	} catch (e) {
		return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
	}
}
