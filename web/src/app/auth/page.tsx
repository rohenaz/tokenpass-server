"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Auth } from "@/components/Auth";
import { Login } from "@/components/Login";
import { Register } from "@/components/Register";
import { getStatus } from "@/lib/api";

type ViewState = "loading" | "no_wallet" | "locked" | "ready";

function AuthContent() {
	const searchParams = useSearchParams();
	const [viewState, setViewState] = useState<ViewState>("loading");

	const host = searchParams.get("host") || "unknown";
	const icon = searchParams.get("icon") || undefined;
	const scopesParam = searchParams.get("scopes") || "";
	const scopes = scopesParam ? scopesParam.split(",").filter(Boolean) : [];
	const returnURL = searchParams.get("returnURL") || undefined;

	const loadStatus = useCallback(async () => {
		setViewState("loading");
		const status = await getStatus();
		if (status.status === "no_wallet") {
			setViewState("no_wallet");
		} else if (status.status === "locked") {
			setViewState("locked");
		} else {
			setViewState("ready");
		}
	}, []);

	useEffect(() => {
		loadStatus();
	}, [loadStatus]);

	if (viewState === "loading") {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center space-y-4">
					<div className="animate-pulse">
						<div className="h-16 w-16 mx-auto rounded-full bg-muted" />
					</div>
					<p className="text-muted-foreground">Loading TokenPass...</p>
				</div>
			</div>
		);
	}

	if (viewState === "no_wallet") {
		return <Register onSuccess={loadStatus} />;
	}

	if (viewState === "locked") {
		return <Login onSuccess={loadStatus} />;
	}

	return <Auth host={host} icon={icon} scopes={scopes} returnURL={returnURL} />;
}

export default function AuthPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen flex items-center justify-center">
					<div className="text-center space-y-4">
						<div className="animate-pulse">
							<div className="h-16 w-16 mx-auto rounded-full bg-muted" />
						</div>
						<p className="text-muted-foreground">Loading TokenPass...</p>
					</div>
				</div>
			}
		>
			<AuthContent />
		</Suspense>
	);
}
