"use client";

import { useState } from "react";
import { ModeToggle } from "@/components/mode-toggle";
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
import { importSeed, register } from "@/lib/api";

interface RegisterProps {
	onSuccess: () => void;
}

export function Register({ onSuccess }: RegisterProps) {
	const [displayName, setDisplayName] = useState("");
	const [paymail, setPaymail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	const [importDialogOpen, setImportDialogOpen] = useState(false);
	const [importMnemonic, setImportMnemonic] = useState("");
	const [importPassword, setImportPassword] = useState("");
	const [importError, setImportError] = useState<string | null>(null);
	const [isImporting, setIsImporting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!password) {
			setError("Password is required");
			return;
		}

		if (password !== confirmPassword) {
			setError("Passwords do not match");
			return;
		}

		if (password.length < 4) {
			setError("Password must be at least 4 characters");
			return;
		}

		setIsLoading(true);
		const result = await register({
			password,
			displayName: displayName || undefined,
			paymail: paymail || undefined,
		});
		setIsLoading(false);

		if (result.error) {
			setError(result.error);
		} else if (result.success) {
			onSuccess();
		}
	};

	const handleImport = async () => {
		setImportError(null);

		if (!importMnemonic.trim()) {
			setImportError("Seed phrase is required");
			return;
		}

		if (!importPassword) {
			setImportError("Password is required");
			return;
		}

		setIsImporting(true);
		const result = await importSeed({
			mnemonic: importMnemonic.trim(),
			password: importPassword,
		});
		setIsImporting(false);

		if (result.error) {
			setImportError(result.error);
		} else if (result.success) {
			setImportDialogOpen(false);
			onSuccess();
		}
	};

	return (
		<div className="min-h-screen flex flex-col">
			<header className="fixed top-0 right-0 p-4">
				<ModeToggle />
			</header>

			<main className="flex-1 flex items-center justify-center p-4">
				<Card className="w-full max-w-md">
					<CardHeader className="text-center">
						<CardTitle className="text-2xl">Create Your Wallet</CardTitle>
						<CardDescription>Set up your Bitcoin identity wallet with TokenPass</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="displayName">Display Name</Label>
								<Input
									id="displayName"
									type="text"
									value={displayName}
									onChange={(e) => setDisplayName(e.target.value)}
									placeholder="Satoshi Nakamoto"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="paymail">Paymail</Label>
								<Input
									id="paymail"
									type="text"
									value={paymail}
									onChange={(e) => setPaymail(e.target.value)}
									placeholder="your@paymailaddress.com"
								/>
							</div>
							<Separator />
							<div className="space-y-2">
								<Label htmlFor="password">Password</Label>
								<Input
									id="password"
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="Choose a password"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="confirmPassword">Confirm Password</Label>
								<Input
									id="confirmPassword"
									type="password"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									placeholder="Confirm your password"
								/>
							</div>
							{error && <p className="text-sm text-destructive">{error}</p>}
							<Button type="submit" className="w-full" disabled={isLoading}>
								{isLoading ? "Creating Wallet..." : "Create Wallet"}
							</Button>
						</form>

						<div className="mt-6">
							<div className="relative">
								<div className="absolute inset-0 flex items-center">
									<Separator className="w-full" />
								</div>
								<div className="relative flex justify-center text-xs uppercase">
									<span className="bg-card px-2 text-muted-foreground">Or</span>
								</div>
							</div>

							<Dialog
								open={importDialogOpen}
								onOpenChange={(open) => {
									setImportDialogOpen(open);
									if (!open) {
										setImportMnemonic("");
										setImportPassword("");
										setImportError(null);
									}
								}}
							>
								<DialogTrigger asChild>
									<Button variant="outline" className="w-full mt-4">
										Import Existing Seed
									</Button>
								</DialogTrigger>
								<DialogContent>
									<DialogHeader>
										<DialogTitle>Import Seed</DialogTitle>
										<DialogDescription>
											Enter your seed phrase and a password to encrypt your wallet.
										</DialogDescription>
									</DialogHeader>
									<div className="space-y-4">
										<div className="space-y-2">
											<Label htmlFor="importMnemonic">Seed Phrase</Label>
											<textarea
												id="importMnemonic"
												value={importMnemonic}
												onChange={(e) => setImportMnemonic(e.target.value)}
												placeholder="Enter your 12 or 24 word seed phrase"
												className="w-full h-24 p-3 rounded-md border border-input bg-background text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="importPassword">Password</Label>
											<Input
												id="importPassword"
												type="password"
												value={importPassword}
												onChange={(e) => setImportPassword(e.target.value)}
												placeholder="Choose a password"
											/>
										</div>
										{importError && <p className="text-sm text-destructive">{importError}</p>}
										<Button onClick={handleImport} disabled={isImporting} className="w-full">
											{isImporting ? "Importing..." : "Import"}
										</Button>
									</div>
								</DialogContent>
							</Dialog>
						</div>
					</CardContent>
				</Card>
			</main>
		</div>
	);
}
