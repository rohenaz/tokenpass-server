import { NextResponse } from "next/server";
import { Key } from "@/lib/tokenpass/server";

export async function POST() {
	Key.setSeed(null);
	return NextResponse.json({ success: true });
}
