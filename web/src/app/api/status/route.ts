import { NextResponse } from "next/server";
import { Key, Seed, State } from "@/lib/tokenpass/server";

export async function GET() {
	if (Key.getSeed()) {
		const keys = (await Key.all()) || [];
		const states = (await State.all()) || [];
		return NextResponse.json({ seed: true, unlocked: true, keys, states });
	}
	const seedCount = await Seed.count();
	console.log("Seed count:", seedCount);
	if (seedCount > 0) {
		return NextResponse.json({ seed: true, unlocked: false, keys: [], states: [] });
	}
	return NextResponse.json({ seed: false, unlocked: false, keys: [], states: [] });
}
