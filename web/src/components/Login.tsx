"use client";

import { useState } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSecurityIconUrl, login } from "@/lib/api";

interface LoginProps {
	onSuccess: () => void;
}

export function Login({ onSuccess }: LoginProps) {
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!password) {
			setError("Please enter your password");
			return;
		}

		setIsLoading(true);
		setError(null);

		const result = await login(password);
		setIsLoading(false);

		if (result.error) {
			setError("Incorrect password");
			setPassword("");
		} else if (result.success) {
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
					<CardHeader className="text-center space-y-4">
						<div className="flex justify-center">
							<Avatar className="h-16 w-16">
								<AvatarImage src={getSecurityIconUrl()} alt="Security Icon" />
								<AvatarFallback>TP</AvatarFallback>
							</Avatar>
						</div>
						<div>
							<CardTitle className="text-2xl">TokenPass</CardTitle>
							<CardDescription>Enter your password to unlock your wallet</CardDescription>
						</div>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="password">Password</Label>
								<Input
									id="password"
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="Enter your password"
									autoFocus
								/>
							</div>
							{error && <p className="text-sm text-destructive">{error}</p>}
							<Button type="submit" className="w-full" disabled={isLoading}>
								{isLoading ? "Unlocking..." : "Unlock Wallet"}
							</Button>
						</form>
						<div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
							<Avatar className="h-5 w-5">
								<AvatarImage src={getSecurityIconUrl()} alt="Security" />
								<AvatarFallback>!</AvatarFallback>
							</Avatar>
							<span>Make sure you recognize this security image</span>
						</div>
					</CardContent>
				</Card>
			</main>
		</div>
	);
}
