import {
	createErrorResponse,
	extractAccessToken,
	validateAccessToken,
} from "@sigma-auth/better-auth-plugin/server/local";
import { type NextRequest, NextResponse } from "next/server";
import { Key, State, Wallet } from "@/lib/tokenpass/server";

/**
 * POST /api/sign
 *
 * Signs a message or creates a bitcoin-auth token.
 *
 * Request body options:
 * 1. BSM signing: { message: string, encoding?: string }
 *    Returns: { address, message, sig, ts }
 *
 * 2. Bitcoin-auth token: { path: string, body?: string, signatureType?: 'bsm' | 'brc77' }
 *    Returns: { token: string }
 *
 * Requires Authorization header with access token from /api/auth
 */
export async function POST(request: NextRequest) {
	if (!Key.getSeed()) {
		return NextResponse.json(createErrorResponse("Wallet is locked. Please login first.", 1), {
			status: 401,
		});
	}

	const body = await request.json();

	const accessToken = extractAccessToken(request.headers.get("authorization"));
	const validation = await validateAccessToken({
		accessToken: accessToken || "",
		findState: (token) => State.findOne({ accessToken: token }),
	});

	if (!validation.valid) {
		return NextResponse.json(
			createErrorResponse(validation.error ?? "Invalid token", validation.code),
			{ status: 401 },
		);
	}

	const host = validation.host || "localhost";
	const key = await Key.findOrCreate({ host });

	if (!key) {
		return NextResponse.json(createErrorResponse("Please create a wallet."), { status: 417 });
	}

	// Check if this is a bitcoin-auth token request (has 'path' field)
	if (body.path) {
		const { path, body: requestBody, signatureType = "brc77" } = body;

		try {
			const token = Wallet.createAuthToken(key, path, requestBody, signatureType);

			return NextResponse.json({
				token,
				success: true,
			});
		} catch (error) {
			return NextResponse.json(
				createErrorResponse(
					`Failed to create auth token: ${error instanceof Error ? error.message : String(error)}`,
				),
				{ status: 500 },
			);
		}
	}

	// BSM signing (has 'message' field)
	const { message, encoding = "utf8" } = body;

	if (!message) {
		return NextResponse.json(
			createErrorResponse(
				"Either 'path' (for auth token) or 'message' (for BSM signing) is required.",
			),
			{ status: 400 },
		);
	}

	const signedResponse = Key.sign({
		message,
		key,
		encoding,
	});

	return NextResponse.json(signedResponse);
}
