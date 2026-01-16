import { NextRequest, NextResponse } from "next/server";
import { Key, Seed } from "@/lib/tokenpass/server";

export async function POST(request: NextRequest) {
	const body = await request.json();
	const { password } = body;

	if (!password) {
		return NextResponse.json({ error: "Password is required" }, { status: 400 });
	}

	const seedData = await Seed.get(password);
	if (!seedData) {
		return NextResponse.json({ error: "Invalid password" }, { status: 401 });
	}

	Key.setSeed(seedData);
	return NextResponse.json({ success: true });
}
