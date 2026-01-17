"use client";

import { useState } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { KeyInfo, ProfileData, StateInfo } from "@/lib/api";
import { exportSeed, getSecurityIconUrl, logout, saveProfile } from "@/lib/api";

interface DashboardProps {
	keys: KeyInfo[];
	states: StateInfo[];
	onLogout: () => void;
}

export function Dashboard({ keys, states, onLogout }: DashboardProps) {
	const [exportPassword, setExportPassword] = useState("");
	const [exportResult, setExportResult] = useState<{ mnemonic?: string; error?: string } | null>(
		null,
	);
	const [isExporting, setIsExporting] = useState(false);
	const [exportDialogOpen, setExportDialogOpen] = useState(false);
	const [profileDialogOpen, setProfileDialogOpen] = useState(false);
	const [profileData, setProfileData] = useState<ProfileData>({});
	const [isSavingProfile, setIsSavingProfile] = useState(false);

	const globalState = states.find((s) => s.host === "global");

	const handleLogout = async () => {
		await logout();
		onLogout();
	};

	const handleExport = async () => {
		setIsExporting(true);
		setExportResult(null);
		const result = await exportSeed(exportPassword);
		setIsExporting(false);
		if (result.error) {
			setExportResult({ error: result.error });
		} else if (result.mnemonic) {
			setExportResult({ mnemonic: result.mnemonic });
		}
	};

	const handleSaveProfile = async () => {
		setIsSavingProfile(true);
		await saveProfile(profileData);
		setIsSavingProfile(false);
		setProfileDialogOpen(false);
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
	};

	const getStateForHost = (host: string) => {
		return states.filter((s) => s.host === host);
	};

	const formatExpireTime = (expireTime: number | undefined) => {
		if (!expireTime) return "Never";
		const now = Date.now();
		if (expireTime < now) return "Expired";
		const diff = expireTime - now;
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);
		if (days > 0) return `${days}d`;
		if (hours > 0) return `${hours}h`;
		if (minutes > 0) return `${minutes}m`;
		return "< 1m";
	};

	return (
		<div className="min-h-screen">
			<header className="border-b">
				<div className="container mx-auto px-4 py-4 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Avatar className="h-8 w-8">
							<AvatarImage src={getSecurityIconUrl()} alt="Security Icon" />
							<AvatarFallback>TP</AvatarFallback>
						</Avatar>
						<div>
							<h1 className="text-lg font-semibold">TokenPass</h1>
							<p className="text-xs text-muted-foreground">Wallet Connected</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<ModeToggle />
						<Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
							<DialogTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										if (globalState) {
											setProfileData({
												displayName: globalState.displayName,
												paymail: globalState.paymail,
												bapID: globalState.bapID,
											});
										}
									}}
								>
									Edit Profile
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Edit Global Profile</DialogTitle>
									<DialogDescription>This is your public profile.</DialogDescription>
								</DialogHeader>
								<div className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="displayName">Display Name</Label>
										<Input
											id="displayName"
											value={profileData.displayName || ""}
											onChange={(e) =>
												setProfileData({ ...profileData, displayName: e.target.value })
											}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="paymail">Paymail</Label>
										<Input
											id="paymail"
											value={profileData.paymail || ""}
											onChange={(e) => setProfileData({ ...profileData, paymail: e.target.value })}
										/>
									</div>
									{profileData.bapID && (
										<div className="space-y-2">
											<Label htmlFor="bapID">BAP ID</Label>
											<Input
												id="bapID"
												value={profileData.bapID || ""}
												disabled
												className="font-mono text-xs"
											/>
										</div>
									)}
									<Button onClick={handleSaveProfile} disabled={isSavingProfile} className="w-full">
										{isSavingProfile ? "Saving..." : "Save Profile"}
									</Button>
								</div>
							</DialogContent>
						</Dialog>
						<Dialog
							open={exportDialogOpen}
							onOpenChange={(open) => {
								setExportDialogOpen(open);
								if (!open) {
									setExportPassword("");
									setExportResult(null);
								}
							}}
						>
							<DialogTrigger asChild>
								<Button variant="outline" size="sm">
									Export
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Export Wallet Seed</DialogTitle>
									<DialogDescription>
										Enter your password to reveal your seed phrase.
									</DialogDescription>
								</DialogHeader>
								{!exportResult?.mnemonic ? (
									<div className="space-y-4">
										<div className="space-y-2">
											<Label htmlFor="exportPassword">Password</Label>
											<Input
												id="exportPassword"
												type="password"
												value={exportPassword}
												onChange={(e) => setExportPassword(e.target.value)}
												onKeyDown={(e) => e.key === "Enter" && handleExport()}
												placeholder="Enter your password"
											/>
										</div>
										{exportResult?.error && (
											<p className="text-sm text-destructive">{exportResult.error}</p>
										)}
										<Button
											onClick={handleExport}
											disabled={isExporting || !exportPassword}
											className="w-full"
										>
											{isExporting ? "Decrypting..." : "Export"}
										</Button>
									</div>
								) : (
									<div className="space-y-4">
										<div className="p-3 bg-muted rounded-md">
											<p className="text-xs text-muted-foreground mb-2">
												The derivation path follows the BIP44 standard with a twist: A new account
												is created per web host, using branch "2".
											</p>
										</div>
										<div className="space-y-2">
											<Label>Seed Phrase</Label>
											<div className="p-3 bg-muted rounded-md font-mono text-sm break-all">
												{exportResult.mnemonic}
											</div>
										</div>
										<Button
											onClick={() => copyToClipboard(exportResult.mnemonic!)}
											variant="outline"
											className="w-full"
										>
											Copy to Clipboard
										</Button>
									</div>
								)}
							</DialogContent>
						</Dialog>
						<Button variant="outline" size="sm" onClick={handleLogout}>
							Logout
						</Button>
					</div>
				</div>
			</header>

			<main className="container mx-auto px-4 py-8 max-w-4xl">
				{keys.length === 0 ? (
					<Card>
						<CardHeader className="text-center">
							<CardTitle>Ready to Connect</CardTitle>
							<CardDescription>Your wallet is set up and ready</CardDescription>
						</CardHeader>
						<CardContent className="text-center space-y-4">
							<p className="text-sm text-muted-foreground">
								Keys are created automatically when websites request authentication.
							</p>
							<p className="text-xs text-muted-foreground">
								Visit a TokenPass-enabled app to create your first key, or use the{" "}
								<strong>Export</strong> button above to back up your seed phrase.
							</p>
						</CardContent>
					</Card>
				) : (
					<div className="space-y-4">
						<h2 className="text-lg font-semibold">Connected Sites</h2>
						{keys.map((key) => {
							const hostStates = getStateForHost(key.host);
							return (
								<Card key={key.path}>
									<CardContent className="pt-6">
										<div className="flex items-start gap-4">
											<Avatar className="h-10 w-10">
												<AvatarImage src={hostStates[0]?.icon} alt={key.host} />
												<AvatarFallback>{key.host.slice(0, 2).toUpperCase()}</AvatarFallback>
											</Avatar>
											<div className="flex-1 space-y-2">
												<div>
													<h3 className="font-medium">{key.host}</h3>
													<p className="text-xs font-mono text-muted-foreground">{key.address}</p>
												</div>
												{hostStates.length > 0 && (
													<>
														<Separator />
														<div className="space-y-1">
															{hostStates.map((state) => (
																<div key={state.accessToken || state.host} className="text-sm">
																	{state.accessToken && (
																		<div className="flex items-center gap-2">
																			<Badge variant="outline" className="text-xs">
																				Token: {state.accessToken.slice(0, 8)}...
																			</Badge>
																			<span className="text-xs text-muted-foreground">
																				expires {formatExpireTime(state.expireTime)}
																			</span>
																		</div>
																	)}
																	{state.scopes && state.scopes.length > 0 && (
																		<div className="flex gap-1 mt-1 flex-wrap">
																			{state.scopes.map((scope) => (
																				<Badge key={scope} variant="secondary" className="text-xs">
																					{scope}
																				</Badge>
																			))}
																		</div>
																	)}
																</div>
															))}
														</div>
													</>
												)}
											</div>
										</div>
									</CardContent>
								</Card>
							);
						})}
					</div>
				)}
			</main>
		</div>
	);
}
