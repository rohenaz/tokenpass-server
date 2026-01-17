import { HD, Utils } from "@bsv/sdk";
import { BAP } from "bsv-bap";
import { type NextRequest, NextResponse } from "next/server";
import { Key, Seed, State } from "@/lib/tokenpass/server";

const { toArray } = Utils;

export async function POST(request: NextRequest) {
	const body = await request.json();
	const { password, displayName, paymail, logo } = body;

	if (!password) {
		return NextResponse.json({ error: "Password is required" }, { status: 400 });
	}

	const s = await Seed.create(password);

	const pk = HD.fromSeed(toArray(s.hex, "hex"));
	const bap = new BAP(pk.toString());
	const newId = bap.newId();

	Key.setSeed(s);

	const state = await State.findOrCreate({
		host: process.env.TOKENPASS_HOST || "localhost",
	});

	if (!state.icon) state.icon = "/api/auth/icon";
	await State.update(state);

	let globalState = await State.findOrCreate({ host: "global" });

	if (displayName) newId.setAttribute("displayName", displayName);
	if (paymail) newId.setAttribute("paymail", paymail);
	if (logo) newId.setAttribute("logo", logo);

	globalState = {
		...globalState,
		...Object.keys(newId.identityAttributes).reduce((acc: Record<string, unknown>, key: string) => {
			acc[key] = newId.identityAttributes[key].value;
			return acc;
		}, {}),
		bapID: newId.identityKey,
	};
	await State.update(globalState);

	return NextResponse.json({ success: true });
}
