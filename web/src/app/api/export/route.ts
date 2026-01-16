import { NextRequest, NextResponse } from "next/server";
import { Seed } from "@/lib/tokenpass/server";

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { password } = body;

		if (!password) {
			return NextResponse.json({ error: "Password is required" }, { status: 400 });
		}

		const result = await Seed.exportKey(password);

		if (result.hex) {
			return NextResponse.json({ seed: result.hex, mnemonic: result.mnemonic });
		}

		return NextResponse.json(
			{ error: "Invalid password", success: false },
			{ status: 401 },
		);
	} catch (e) {
		console.error(e);
		return NextResponse.json({ error: "Invalid password", success: false }, { status: 401 });
	}
}
