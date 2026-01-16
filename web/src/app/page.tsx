"use client";

import { useEffect, useState } from "react";
import { Dashboard } from "@/components/Dashboard";
import { Login } from "@/components/Login";
import { Register } from "@/components/Register";
import { getStatus, type WalletStatus } from "@/lib/api";

type ViewState = "loading" | "no_wallet" | "locked" | "unlocked";

export default function Home() {
	const [viewState, setViewState] = useState<ViewState>("loading");
	const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null);

	const loadStatus = async () => {
		setViewState("loading");
		const status = await getStatus();
		setWalletStatus(status);
		setViewState(status.status);
	};

	useEffect(() => {
		loadStatus();
	}, []);

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

	if (viewState === "unlocked" && walletStatus) {
		return (
			<Dashboard
				keys={walletStatus.keys || []}
				states={walletStatus.states || []}
				onLogout={loadStatus}
			/>
		);
	}

	return null;
}
