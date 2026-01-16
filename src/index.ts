import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { HD, Mnemonic, Utils } from "@bsv/sdk";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { BAP } from "bsv-bap";
import type { Context } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { html, raw } from "hono/html";
import Datastore from "nedb";
import Key from "./key.ts";
import Seed from "./seed.ts";
import State from "./state.ts";
import { MnemonicEN } from "./utils/mnemonic.ts";
import * as Wallet from "./wallet/index.ts";

const { toArray } = Utils;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = new Hono();
const defaultPort = 21000;
const defaultExpireTime = "once";

const allowedOrigins = [
	`http://${process.env.TOKENPASS_HOST || "localhost"}:${
		process.env.TOKENPASS_PORT || "21000"
	}`,
];
const whitelist = process.env.TOKENPASS_ORIGIN_WHITELIST;
if (whitelist) {
	allowedOrigins.push(...whitelist.split(","));
}

const hostFromOrigin = (origin: string | undefined): string | null => {
	return origin ? new URL(origin).host : null;
};

const expireSelectionToTime = (expireSelection: string): number => {
	switch (expireSelection) {
		case "forever":
			return 0;
		case "once":
			return 10000;
		case "1h":
			return 3600000;
		case "1d":
			return 86400000;
		case "1w":
			return 604800000;
		case "1m":
			return 2592000000;
		default:
			return 10000; // default to "once"
	}
};

// Helper functions to build HTML fragments
const renderProfileFields = (states: any[] | undefined) => {
	const globalState = states?.find((s) => s.host === "global");
	if (!globalState) return "";
	return raw(
		Object.keys(globalState)
			.filter((k) => k !== "host" && k !== "_id")
			.map(
				(stateKey) => `
				<div class="form-control">
					<label class="label" for="profile-${stateKey}">${stateKey}</label>
					<input class="input input-bordered" type="text" ${stateKey === "bapID" ? "disabled" : ""} name="${stateKey}" value="${globalState[stateKey]}" />
				</div><br />
			`,
			)
			.join(""),
	);
};

// Returns plain string (not raw) - meant to be used inside renderKeys
const renderStateItems = (states: any[] | undefined, host: string): string => {
	const hostStates = states?.filter((s) => s.host === host) || [];
	if (hostStates.length === 0) return "";
	return hostStates
		.flatMap((state) =>
			Object.keys(state)
				.filter(
					(k) =>
						k !== "host" && k !== "_id" && k !== "icon" && k !== "expireTime",
				)
				.map((stateKey) =>
					stateKey === "accessToken"
						? `
					<div class="state-item text-left ml-12">
						<div>
							<strong>${stateKey}:</strong> ${state[stateKey]}
							<div class="text-gray-800 text-xs">expires in <span class="expireTime" data-time="${state.expireTime}">${state.expireTime}</span></div>
						</div>
					</div>
				`
						: `
					<div class="state-item text-left ml-12">
						<div>
							<strong>${stateKey}:</strong> ${state[stateKey]}
						</div>
					</div>
				`,
				),
		)
		.join("");
};

const renderKeys = (keys: any[] | undefined, states: any[] | undefined) => {
	if (!keys || keys.length === 0) return "";
	return raw(
		keys
			.map(
				(key) => `
			<div class="flex flex-col">
				<div class="item flex items-center gap-x-2" data-path="${key.path}" data-address="${key.address}">
					<div><img src="${states?.[0]?.icon || ""}" alt="" class="w-8 h-8" /></div>
					<div>
						<h2>${key.host}</h2>
						<div class="font-mono text-xs">${key.address}</div>
					</div>
				</div>
				<div>
					${renderStateItems(states, key.host)}
				</div>
			</div>
		`,
			)
			.join(""),
	);
};

// HTML Templates
const baseHead = (extraScripts = "") => html`
	<head>
		<link href="/daisy.4.4.2.full.min.css" rel="stylesheet" type="text/css" />
		<script src="/tailwind_3.3.5.js"></script>
		<link rel="stylesheet" href="/style.css" />
		<link href="/swal.css" rel="stylesheet" />
		<script src="/swal.min.js"></script>
		${extraScripts}
	</head>
`;

const authTemplate = (locals: {
	icon: string;
	host: string;
	scopes: string[];
}) => html`
<!DOCTYPE html>
<html>
	${baseHead(html`
		<script>
			const swal = Swal.mixin({
				buttonsStyling: false,
				confirmButtonText: "Allow",
				customClass: { confirmButton: "w-full bg-gray-600 rounded" },
			});
			const modal = async () => {
				let { value: formValues } = await swal.fire({
					allowEnterKey: true,
					imageUrl: "${locals.icon}",
					imageHeight: 150,
					imageAlt: "${locals.host}",
					title: "Authorize Host: ${locals.host}",
					html: \`<input type='password' placeholder='Enter your password' id='password'>
					<div class="flex items-center mt-2 h-7 text-sm text-slate-800 font-mono bg-slate-200 rounded-sm"><img src="http://localhost:21000/auth/icon" alt="Security Image" class="border w-6 h-6 ml-1 mr-2 bg-white rounded-full"></img>Make Sure You Recognize This Security Image</div>
					<hr class="my-4" />
					<div class="p-2 text-lg">
						<div class="text-slate-600">This host would like access to:</div>
						<ul class="p-2 rounded-sm text-sm bg-[#f2f2f2] font-mono w-full">
							${locals.scopes.length > 0 ? locals.scopes.map((s) => `<li>${s}</li>`).join("") : "<li>Authentication only</li>"}
						</ul>
					</div>
					<div class="p-2">
						<label class='timeframe' for='once'>Ask Every Time<input type='radio' name='expire' id='once'></label>
						<label class='timeframe' for='1h'>Allow for 1 Hour<input type='radio' name='expire' id='1h'></label>
						<label class='timeframe' for='1d'>Allow for 1 Day<input type='radio' name='expire' id='1d'></label>
						<label class='timeframe' for='1m'>Allow for 1 Month<input type='radio' name='expire' id='1m'></label>
						<label class='timeframe' for='forever'>Allow Forever<input type='radio' name='expire' id='forever'></label>
					</div>\`,
					preConfirm: () => {
						return [
							document.querySelector("#password").value,
							document.querySelector("input[name='expire']:checked").id,
						];
					},
					focusConfirm: true,
					didOpen: () => {
						document.querySelector("#password").focus();
					},
				});
				if (formValues && formValues[0]) {
					const scopes = "${locals.scopes.join(",")}";
					fetch("/auth", {
						method: "post",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							password: formValues[0],
							expire: document.querySelector("input[name='expire']:checked").id,
							host: "${locals.host}",
							icon: "${locals.icon}",
							scopes,
						}),
					})
						.then((res) => res.json())
						.then((data) => {
							const { error, accessToken, success } = data;
							if (error) {
								alert("Failed to authenticate " + error);
								modal();
							} else if (success) {
								if (window.opener) {
									window.close();
								} else {
									const returnURL = new URL(location.href).searchParams.get("returnURL");
									if (accessToken) {
										location.href = returnURL + "?tokenPass=" + accessToken;
									}
								}
							}
						});
				} else {
					modal();
				}
			};
			document.addEventListener("DOMContentLoaded", () => modal());
		</script>
	`)}
	<body>
		<nav>
			<img class="mr-2 w-7" src="http://localhost:21000/auth/icon" />
			<h1>TokenPass</h1>
		</nav>
	</body>
</html>
`;

const loginTemplate = () => html`
<!DOCTYPE html>
<html>
	${baseHead(html`
		<script>
			const modal = async () => {
				let { value: formValues } = await Swal.fire({
					title: "Login",
					html: "<input class='input input-bordered' type='password' placeholder='enter password' id='password'>",
					preConfirm: () => [document.querySelector("#password").value],
					focusConfirm: false,
					didOpen: () => {
						const passwordInput = document.querySelector("#password");
						passwordInput.focus();
						passwordInput.addEventListener("keydown", (e) => {
							if (e.key === "Enter") Swal.clickConfirm();
						});
					},
				});
				if (formValues && formValues[0]) {
					fetch("/login", {
						method: "post",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ password: formValues[0] }),
					})
						.then((res) => res.json())
						.then((data) => {
							if (data.error) {
								alert("incorrect password");
								modal();
							} else if (data.success) {
								if (window.opener) window.close();
								else location.href = location.href;
							}
						});
				} else {
					modal();
				}
			};
			document.addEventListener("DOMContentLoaded", () => modal());
		</script>
	`)}
	<body>
		<nav>
			<img class="mr-2 w-7" src="http://localhost:21000/auth/icon" />
			<h1>tokenpass</h1>
		</nav>
	</body>
</html>
`;

const homeTemplate = (locals: {
	seed: boolean;
	keys?: any[];
	states?: any[];
}) => html`
<!DOCTYPE html>
<html>
	${baseHead(html`
		<script src="/htmx.min.js"></script>
		<script src="/remove-me.js"></script>
		<script src="/moment.min.js"></script>
		<script>
			htmx.on("htmx:afterRequest", function (evt) {
				if (evt.detail.target.id === "save-profile-status" && !evt.detail.failed) {
					document.getElementById("editProfileModal").close();
				}
			});
			const swal = Swal.mixin({
				buttonsStyling: false,
				customClass: { confirmButton: "w-full rounded-sm" },
			});
			const modal = async () => {
				let { value: formValues } = await Swal.fire({
					title: "Create a profile",
					html: \`<div>Enter a password to encrypt your data, and some basic profile info.</div><br>
					<label class="label" for="displayName">Display Name</label>
					<input name="displayName" type='text' placeholder='Satoshi Nakamoto' id='profile-displayName' class='input input-bordered w-full mb-2' /><br>
					<label class="label" for="avatar">Avatar</label>
					<input name="avatar" type='file' id='profile-avatar' class='file file-bordered w-full mb-2' /><br>
					<label class="label" for="paymail">Paymail</label>
					<input name="paymail" type='text' placeholder='your@paymailaddress.com' id='profile-paymail' class='input input-bordered w-full mb-2' /><br>
					<div class="divider"></div>
					<label class="label" for="password"> Choose a password</label>
					<input name="password" type='password' placeholder='enter a password' id='profile-password' class='input input-bordered w-full mb-2' />
					<input name="confirm" type='password' placeholder='confirm password' id='profile-confirm' class='input input-bordered w-full' /><br>
					<div class="divider">OR</div>
					<button class="btn" onclick="importSeedModal.showModal()">import seed</button>\`,
					allowOutsideClick: false,
					preConfirm: () => [
						document.querySelector("#profile-password").value,
						document.querySelector("#profile-confirm").value,
						document.querySelector("#profile-displayName").value,
						document.querySelector("#profile-paymail").value,
						document.querySelector("#profile-avatar").value,
					],
					focusConfirm: true,
				});
				if (formValues && formValues[0] === formValues[1]) {
					fetch("/register", {
						method: "post",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							password: formValues[0],
							displayName: formValues[2],
							paymail: formValues[3],
							avatar: formValues[4],
						}),
					})
						.then((res) => res.json())
						.then((data) => {
							if (data.success !== false) location.href = location.href;
						});
				} else {
					alert("Passwords must match.");
					modal();
				}
			};
			const exportKey = async () => {
				let { value: formValues } = await swal.fire({
					title: "Export Wallet Seed",
					html: "<div class='text-secondary'>Please enter the decryption password.</div><br><input class='input w-full max-w-xs' type='password' placeholder='enter your password' id='password'>",
					preConfirm: () => [document.querySelector("#password").value],
					focusConfirm: false,
					didOpen: () => {
						const passwordInput = document.querySelector("#password");
						passwordInput.focus();
						passwordInput.addEventListener("keydown", (e) => {
							if (e.key === "Enter") Swal.clickConfirm();
						});
					},
				});
				if (formValues && formValues[0]) {
					fetch("/export", {
						method: "post",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ password: formValues[0] }),
					})
						.then((res) => res.json())
						.then((data) => {
							if (data.error) {
								alert("Invalid password");
								exportKey();
							} else if (data.mnemonic) {
								Swal.fire({
									title: "Seed Phrase",
									html: \`<pre class='text-sm mb-2 text-left p-2'>
The derivation path follows the
BIP44 standard with a twist:

- A new account is created per web host
- It uses a new branch of "2" instead of (0 or 1)

So no overlap with existing BIP44 wallets but the
wallet scheme can seamlessly integrate with them.
</pre>
									<textarea class='textarea textarea-bordered text-lg font-mono w-full'>\${data.mnemonic}</textarea>\`,
									confirmButtonText: "Copy",
									didOpen: () => {
										document.querySelector(".swal2-confirm").addEventListener("click", () => {
											navigator.clipboard.writeText(data.mnemonic);
											swal.fire({
												title: "Copied!",
												text: "Seed phrase copied to clipboard",
												icon: "success",
												timer: 3000,
												timerProgressBar: true,
												toast: true,
												position: "top-end",
												showConfirmButton: false,
											});
										});
									},
								});
							}
						});
				} else {
					alert("Enter password");
					exportKey();
				}
			};
			document.addEventListener("DOMContentLoaded", () => {
				const timeElements = document.getElementsByClassName("expireTime");
				for (let i = 0; i < timeElements.length; i++) {
					const time = parseInt(timeElements[i].getAttribute("data-time"));
					timeElements[i].innerHTML = moment(time).fromNow();
				}
				document.querySelector("#export")?.addEventListener("click", () => exportKey());
				document.querySelector("#logout")?.addEventListener("click", () => {
					fetch("/logout", { method: "post" })
						.then((res) => res.json())
						.then((res) => {
							if (res.success) location.href = location.href;
						});
				});
				if (document.body.dataset.seed === "false") modal();
			});
		</script>
	`)}
	<body class="mx-auto" data-seed="${locals.seed}">
		<nav class="flex flex-col w-full mx-auto items-start">
			<div class="flex items-center justify-between w-full">
				<img class="mr-2 w-7" src="http://localhost:21000/auth/icon" />
				<h1 class="text-lg">TokenPass</h1>
				<div class="flexible"></div>
				<div class="menu-item btn mr-2" id="edit-profile" onclick="editProfileModal.showModal()">edit profile</div>
				<div class="menu-item btn mr-2" id="export">export</div>
				<div class="menu-item btn" id="logout">logout</div>
			</div>
			<div class="text-left">
				<h2 class="text-secondary text-xs font-mono tracking-wide">Wallet Connected</h2>
			</div>
		</nav>
		<dialog id="editProfileModal" class="modal">
			<div class="modal-box">
				<h3 class="font-bold text-lg">Edit Global Profile</h3>
				<p class="py-4">This is your public profile.</p>
				<form>
					${renderProfileFields(locals.states)}
					<div id="save-profile-status" class="flex mb-2"><div>&nbsp;</div></div>
					<button type="submit" class="btn btn-primary bg-primary text-primary-content" hx-post="/profile" hx-target="#save-profile-status" hx-swap="afterbegin">Save</button>
				</form>
			</div>
			<form method="dialog" class="modal-backdrop"><button>close</button></form>
		</dialog>
		<div class="container mx-auto">
			${renderKeys(locals.keys, locals.states)}
			${
				locals.keys?.length === 0
					? html`
				<div class="flex items-center justify-center h-64">
					<div class="text-center max-w-md">
						<h2 class="text-2xl mb-4">Ready to Connect</h2>
						<div class="text-sm text-gray-600 space-y-2">
							<p>Your wallet is set up and ready. Keys are created automatically when websites request authentication.</p>
							<p class="text-xs mt-4">Visit a TokenPass-enabled app to create your first key, or use the <strong>export</strong> button above to back up your seed phrase.</p>
						</div>
					</div>
				</div>
			`
					: ""
			}
		</div>
		<dialog id="importSeedModal" class="modal">
			<div class="modal-box">
				<h3 class="font-bold text-lg mb-2">Import Seed</h3>
				<form>
					<textarea id="import-mnemonic" class="textarea textarea-bordered py-4 w-full mb-2 font-mono">Enter your seed phrase</textarea>
					<label class="label" for="password">Choose a password to encrypt your data</label>
					<input type='password' placeholder='select password' id='import-password' class="input input-bordered w-full">
					<div class="modal-action"><button class="btn" hx-post="/import">Import</button></div>
				</form>
			</div>
		</dialog>
	</body>
</html>
`;

// Global state
let K: InstanceType<typeof Key>;
let S: InstanceType<typeof State>;
let seed: InstanceType<typeof Seed>;

const init = (config: { db: string }) => {
	const dbpath = config.db;
	if (!fs.existsSync(dbpath)) fs.mkdirSync(dbpath, { recursive: true });

	seed = new Seed({ db: dbpath, wallet: Wallet, Datastore: Datastore });
	K = new Key({ db: dbpath, wallet: Wallet, Datastore: Datastore });
	S = new State({ db: dbpath, Datastore: Datastore });

	// CORS middleware
	app.use(
		"*",
		cors({
			origin: (origin) => {
				if (!origin || allowedOrigins.includes(origin)) return origin;
				return allowedOrigins[0];
			},
		}),
	);

	// Static files
	app.use(
		"/public/*",
		serveStatic({ root: path.join(__dirname, "../public") }),
	);
	app.use("/*", serveStatic({ root: path.join(__dirname, "../public") }));

	// Sign a message
	app.post("/sign", async (c: Context) => {
		console.log("SIGN ATTEMPTED FROM", c.req.header("origin"), {
			message: (await c.req.json()).message,
			authToken: c.req.header("authorization"),
		});

		const body = await c.req.json();
		const message = body.message;
		const encoding = body.encoding || "utf8";

		if (K.getSeed()) {
			const accessToken = c.req.header("authorization");
			if (!accessToken) {
				return c.json(
					{
						error:
							"Please provide an access token in the Authorization header.",
						code: 2,
						success: false,
						errorURL: `http://${process.env.TOKENPASS_HOST || "localhost"}:${process.env.TOKENPASS_PORT || "21000"}/auth`,
					},
					401,
				);
			}

			const state = await S.findOne({ accessToken });
			if (!state?.accessToken || state.accessToken !== accessToken) {
				return c.json(
					{
						error: "Invalid access token.",
						errorURL: `http://${process.env.TOKENPASS_HOST || "localhost"}:${process.env.TOKENPASS_PORT || "21000"}/auth`,
						code: 3,
						success: false,
					},
					401,
				);
			}

			let host = accessToken
				? state.host
				: hostFromOrigin(c.req.header("origin"));
			if (!host) {
				host = process.env.TOKENPASS_HOST || "localhost";
				console.log("no origin, using", host);
			}

			const expired = state.expireTime && state.expireTime < Date.now();
			console.log("SIGN:", {
				expireTime: state.expireTime,
				now: Date.now(),
				host,
			});

			if (expired) {
				return c.json(
					{
						error: "Access token has expired.",
						errorURL: `http://${process.env.TOKENPASS_HOST || "localhost"}:${process.env.TOKENPASS_PORT || "21000"}/auth`,
						code: 5,
					},
					401,
				);
			}

			const key = await K.findOrCreate({ host });
			if (key) {
				const signedResponse = await K.sign({
					message,
					key,
					encoding,
					ts: Date.now(),
				});
				return c.json(signedResponse);
			}
			return c.json({ error: "please create a wallet.", success: false }, 417);
		}
		return c.json(
			{
				errorURL: `http://${process.env.TOKENPASS_HOST || "localhost"}:${process.env.TOKENPASS_PORT || "21000"}/auth`,
				error: "Check that TokenPass is running and you're signed in.",
				code: 1,
			},
			401,
		);
	});

	// Encrypt a message
	app.post("/encrypt", async (c: Context) => {
		const body = await c.req.json();
		const message = body.message;

		if (K.getSeed()) {
			const accessToken = c.req.header("authorization");
			if (!accessToken) {
				return c.json(
					{
						error:
							"Please provide an access token in the Authorization header.",
						code: 2,
						success: false,
						errorURL: `http://${process.env.TOKENPASS_HOST || "localhost"}:${process.env.TOKENPASS_PORT || "21000"}/auth`,
					},
					401,
				);
			}

			const state = await S.findOne({ accessToken });
			if (!state) {
				return c.json(
					{
						error: "Invalid access token.",
						errorURL: `http://${process.env.TOKENPASS_HOST || "localhost"}:${process.env.TOKENPASS_PORT || "21000"}/auth`,
						code: 3,
						success: false,
					},
					401,
				);
			}

			const key = await K.findOrCreate({ host: state.host });
			if (!key) {
				return c.json({ error: "please create a wallet." }, 417);
			}

			const { address, data, sig, ts } = K.encrypt({ message, key });
			console.log({ address, data, sig, ts });
			return c.json({ data, address, sig, ts });
		}
		return c.json(
			{
				errorURL: `http://${process.env.TOKENPASS_HOST || "localhost"}:${process.env.TOKENPASS_PORT || "21000"}/auth`,
				error: "Check that TokenPass is running and you're signed in.",
				code: 1,
			},
			401,
		);
	});

	// First time seed creation
	app.post("/register", async (c: Context) => {
		const body = await c.req.json();
		const s = await seed.create(body.password);

		const pk = HD.fromSeed(toArray(s.hex, "hex"));
		const bap = new BAP(pk.toString());
		const newId = bap.newId();

		K.setSeed(s);

		const state = await S.findOrCreate({
			host: process.env.TOKENPASS_HOST || "localhost",
		});

		if (!state.icon) state.icon = "/auth/icon";
		await S.update(state);

		let globalState = await S.findOrCreate({ host: "global" });

		newId.setAttribute("displayName", body.displayName);
		newId.setAttribute("paymail", body.paymail);
		newId.setAttribute("logo", body.logo);

		globalState = {
			...globalState,
			...Object.keys(newId.identityAttributes).reduce(
				(acc: Record<string, any>, key: string) => {
					acc[key] = newId.identityAttributes[key].value;
					return acc;
				},
				{},
			),
			bapID: newId.identityKey,
		};
		await S.update(globalState);

		return c.json({});
	});

	// Import seed
	app.post("/import", async (c: Context) => {
		try {
			const body = await c.req.json();
			const mnemonic = new MnemonicEN(body.mnemonic);
			const s = await seed.importKey(mnemonic.toHex(), body.password);
			K.setSeed(s);
			return c.json({});
		} catch (_e) {
			return c.json({ error: "invalid seed", success: false });
		}
	});

	// Export seed
	app.post("/export", async (c: Context) => {
		try {
			const body = await c.req.json();
			const hex = await seed.exportKey(body.password);

			const pk = HD.fromSeed(toArray(hex, "hex"));
			const _bap = new BAP(pk.toString());

			const mnemonic = Mnemonic.fromSeed(
				toArray(hex, "hex"),
				Mnemonic.Words.ENGLISH,
			);
			if (mnemonic) {
				return c.json({ seed: hex, mnemonic: mnemonic.phrase });
			}
			return c.json(
				{
					error: "invalid",
					success: false,
					errorURL: `http://${process.env.TOKENPASS_HOST || "localhost"}:${process.env.TOKENPASS_PORT || "21000"}/auth`,
				},
				401,
			);
		} catch (e) {
			console.error(e);
			return c.json({ error: "unknown error", success: false }, 500);
		}
	});

	// Update state object
	app.post("/state", async (c: Context) => {
		const referer = c.req.header("origin");
		if (!referer) return c.json({ success: false, error: "No origin" }, 400);
		const host = new URL(referer).host;
		const body = await c.req.json();

		const s = await S.findOne({ host });
		const query = c.req.query();
		if (s) {
			if (query.mode === "clear") {
				await S.delete({ host });
				await S.update({ ...body, host });
			} else {
				S.update({ ...body, host });
			}
		} else {
			S.insert({ ...body, host });
		}

		return c.json({ success: true });
	});

	// Update profile object
	app.post("/profile", async (c: Context) => {
		if (K.getSeed()) {
			const host = "global";
			try {
				const body = await c.req.json();
				const s = await S.findOne({ host });
				const finalState = { ...body, host };
				const query = c.req.query();
				if (s) {
					if (query.mode === "clear") await S.delete({ host });
					S.update(finalState);
				} else {
					S.insert(finalState);
				}
				return c.json({ success: true });
			} catch (error) {
				console.error(error);
				return c.json({ success: false, error: String(error) }, 500);
			}
		}
		return c.json(
			{
				error:
					"please check that TokenPass is running and you're signed in. check TokenPass dashboard at http://localhost:21000",
				code: 1,
				errorURL: `http://${process.env.TOKENPASS_HOST || "localhost"}:${process.env.TOKENPASS_PORT || "21000"}`,
			},
			401,
		);
	});

	// Delete state object
	app.delete("/state", async (c: Context) => {
		const referer = c.req.header("origin");
		if (!referer) return c.json({ success: false, error: "No origin" }, 400);
		const host = new URL(referer).host;
		const body = await c.req.json();

		S.delete({ ...body, host });
		return c.json({ success: true });
	});

	// Get the global profile
	app.get("/profile", async (c: Context) => {
		const state = await S.findOne({ host: "global" });
		return c.json(state);
	});

	// Get the state object
	app.get("/state", async (c: Context) => {
		const referer = c.req.header("origin");
		if (!referer) return c.json(null);
		const host = new URL(referer).host;
		const state = await S.findOne({ host });
		return c.json(state);
	});

	// Decrypt wallet with password at startup
	app.post("/login", async (c: Context) => {
		try {
			const body = await c.req.json();
			const s = await seed.get(body.password);
			if (s) {
				K.setSeed(s);
				return c.json({ success: true });
			}
			return c.json({ error: "invalid", success: false });
		} catch (_e) {
			return c.json({ error: "invalid", success: false });
		}
	});

	// Clear seed so the server stops signing requests
	app.post("/logout", (c: Context) => {
		K.setSeed(null);
		return c.json({ success: true });
	});

	// Ask a connected wallet to fund a raw tx
	app.post("/fund", async (c: Context) => {
		const key = K.getSeed();
		if (key) {
			const url = `http://${process.env.TOKENPASS_HOST || "localhost"}:${process.env.TOKENPASS_PORT || "21000"}/fund`;
			const referer = c.req.header("origin");
			const host = referer ? new URL(referer).host : "localhost";

			const state = await S.findOne({ host });
			if (!state?.scopes?.includes("fund")) {
				return c.json({ error: "Insufficient permission", code: 7 }, 403);
			}

			const authToken = state.accessToken;
			const body = await c.req.json();
			const rawtx = body.rawtx;

			try {
				const response = await fetch(url, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						rawtx,
						broadcast: true,
						sigma: true,
						host,
						authToken,
					}),
				});
				const json = await response.json();
				return c.json(json);
			} catch (e) {
				console.error(e);
				return c.json({ success: false, error: String(e) }, 500);
			}
		}
		return c.json(
			{
				error:
					"please check that TokenPass is running and you're signed in. check TokenPass dashboard at http://localhost:21000",
				code: 1,
				errorURL: `http://${process.env.TOKENPASS_HOST || "localhost"}:${process.env.TOKENPASS_PORT || "21000"}/auth`,
			},
			401,
		);
	});

	// Create an auth token for some amount of time
	app.post("/auth", async (c: Context) => {
		const body = await c.req.json();
		console.log("AUTH ATTEMPTED FROM", c.req.header("origin"), {
			host: body.host,
		});
		const pw = body.password;

		try {
			const s = await seed.get(pw);
			if (s) {
				K.setSeed(s);

				if (
					c.req.header("origin") &&
					!allowedOrigins.includes(c.req.header("origin")!)
				) {
					return c.json(
						{ error: "The origin is not authorized", code: 6 },
						403,
					);
				}

				const host = body.host;
				console.log({ hosts: host, origin: c.req.header("origin") });

				const expireSelection = body.expire;
				const expireTime = expireSelectionToTime(expireSelection);

				const accessToken = randomUUID();
				const scopes = body.scopes?.split(",") || [];
				const newState = {
					host,
					accessToken,
					scopes,
					icon: body.icon,
					expireTime: Date.now() + expireTime,
				};
				await S.update(newState);
				return c.json({ success: true, accessToken, expireTime, host });
			}
			return c.json({ error: "invalid", success: false });
		} catch (e) {
			return c.json({ success: false, error: String(e) }, 500);
		}
	});

	// Ask wallet to prove ownership of a txid
	app.get("/prove", async (c: Context) => {
		const txid = c.req.query("txid");
		const challengeStr = c.req.query("message");

		const key = await Wallet.keyForTx(txid);
		if (!key) {
			return c.json({ error: "txid not found", code: 4 }, 404);
		}
		const { address, message, sig, ts } = Wallet.sign(challengeStr, key);
		return c.json({ message, key, address, sig, ts });
	});

	// OAuth style login page for apps
	app.get("/auth", async (c: Context) => {
		const returnURL = c.req.query("returnURL");
		if (!returnURL) return c.json({ error: "returnURL required" }, 400);

		const returnHost = new URL(returnURL).host;
		const originHost = hostFromOrigin(c.req.header("origin"));
		const host = originHost || process.env.TOKENPASS_HOST || "localhost";

		if (originHost && host !== returnHost) {
			return c.json(
				{
					error: `The origin is not authorized ${host} ${returnHost}`,
					code: 6,
				},
				403,
			);
		}

		const icon = c.req.query("icon") || "";
		const scopes = c.req.query("scopes")?.split(",") || [];

		console.log("AUTH GET:", { returnURL, icon });
		return c.html(
			authTemplate({ returnURL, icon, scopes, host: host || "localhost" }),
		);
	});

	// Icon intended to be rendered in the auth page only
	app.get("/auth/icon", async (c: Context) => {
		if (
			c.req.header("origin") &&
			!allowedOrigins.includes(c.req.header("origin")!)
		) {
			return c.json({ error: "The origin is not authorized", code: 6 }, 403);
		}

		const minidenticon = async (str: string) => {
			const module = await import("minidenticons");
			return module.minidenticon(str);
		};

		c.header("Content-Type", "image/svg+xml");
		c.header("Cache-Control", "max-age=31536000");

		if (K.getSeed()) {
			const k = await K.findOrCreate({ host: "localhost" });
			return c.body(await minidenticon(k.pub));
		}
		return c.body(await minidenticon("Anon"));
	});

	// JSON API for dashboard data
	app.get("/status", async (c: Context) => {
		if (K.getSeed()) {
			const keys = (await K.all()) || [];
			const states = (await S.all()) || [];
			return c.json({ seed: true, unlocked: true, keys, states });
		}
		const seedCount = await seed.count();
		if (seedCount) {
			return c.json({ seed: true, unlocked: false, keys: [], states: [] });
		}
		return c.json({ seed: false, unlocked: false, keys: [], states: [] });
	});

	// Dashboard web page
	app.get("/", async (c: Context) => {
		if (K.getSeed()) {
			const keys = (await K.all()) || [];
			const states = (await S.all()) || [];
			console.log(states);
			return c.html(homeTemplate({ keys, states, seed: true }));
		}
		const seedCount = await seed.count();
		if (seedCount) {
			return c.html(loginTemplate());
		}
		return c.html(homeTemplate({ seed: false }));
	});

	const port = Number(process.env.TOKENPASS_PORT) || defaultPort;
	console.log(
		`TokenPass listening at http://${process.env.TOKENPASS_HOST || "localhost"}:${port}`,
	);
	serve({ fetch: app.fetch, port });
};

export { init };
