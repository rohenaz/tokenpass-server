import { minidenticon } from "minidenticons";
import { NextResponse } from "next/server";
import { Key } from "@/lib/tokenpass/server";

export async function GET() {
	let iconSvg: string;

	if (Key.getSeed()) {
		const k = await Key.findOrCreate({ host: "localhost" });
		iconSvg = minidenticon(k?.pub || "Anon");
	} else {
		iconSvg = minidenticon("Anon");
	}

	return new NextResponse(iconSvg, {
		headers: {
			"Content-Type": "image/svg+xml",
			"Cache-Control": "max-age=31536000",
		},
	});
}
