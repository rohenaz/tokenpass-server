import { NextRequest, NextResponse } from "next/server";
import { Key, State } from "@/lib/tokenpass/server";

export async function POST(request: NextRequest) {
	const body = await request.json();
	const { message } = body;

	if (!Key.getSeed()) {
		return NextResponse.json(
			{
				error: "Wallet is locked. Please login first.",
				code: 1,
				success: false,
			},
			{ status: 401 },
		);
	}

	const accessToken = request.headers.get("authorization");
	if (!accessToken) {
		return NextResponse.json(
			{
				error: "Please provide an access token in the Authorization header.",
				code: 2,
				success: false,
			},
			{ status: 401 },
		);
	}

	const state = await State.findOne({ accessToken });
	if (!state?.accessToken || state.accessToken !== accessToken) {
		return NextResponse.json(
			{
				error: "Invalid access token.",
				code: 3,
				success: false,
			},
			{ status: 401 },
		);
	}

	const expired = state.expireTime && state.expireTime < Date.now();
	if (expired) {
		return NextResponse.json(
			{
				error: "Access token has expired.",
				code: 5,
				success: false,
			},
			{ status: 401 },
		);
	}

	const host = state.host || "localhost";
	const key = await Key.findOrCreate({ host });

	if (key) {
		const encryptedResponse = Key.encrypt({ message, key });
		return NextResponse.json(encryptedResponse);
	}

	return NextResponse.json({ error: "Please create a wallet.", success: false }, { status: 417 });
}
