import { NextRequest, NextResponse } from "next/server";
import { State } from "@/lib/tokenpass/server";

export async function GET() {
	const profile = await State.findOne({ host: "global" });
	return NextResponse.json(profile || {});
}

export async function POST(request: NextRequest) {
	const body = await request.json();

	let profile = await State.findOne({ host: "global" });
	if (!profile) {
		profile = { host: "global" };
	}

	const updated = { ...profile, ...body, host: "global" };
	await State.update(updated);

	return NextResponse.json({ success: true });
}
