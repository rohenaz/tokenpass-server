"use client";

import { useState } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { authorize, getSecurityIconUrl } from "@/lib/api";

interface AuthProps {
	host: string;
	icon?: string;
	scopes: string[];
	returnURL?: string;
}

export function Auth({ host, icon, scopes, returnURL }: AuthProps) {
	const [password, setPassword] = useState("");
	const [expire, setExpire] = useState("once");
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

		const result = await authorize({
			password,
			host,
			icon,
			scopes,
			expire,
		});

		setIsLoading(false);

		if (result.error) {
			setError(result.error);
			setPassword("");
		} else if (result.success && result.accessToken) {
			// Check if opened as popup
			if (window.opener) {
				window.close();
			} else if (returnURL) {
				// Redirect back with token
				const url = new URL(returnURL);
				url.searchParams.set("tokenPass", result.accessToken);
				window.location.href = url.toString();
			}
		}
	};

	const expireOptions = [
		{ value: "once", label: "Ask Every Time" },
		{ value: "1h", label: "Allow for 1 Hour" },
		{ value: "1d", label: "Allow for 1 Day" },
		{ value: "1m", label: "Allow for 1 Month" },
		{ value: "forever", label: "Allow Forever" },
	];

	return (
		<div className="min-h-screen flex flex-col">
			<header className="border-b">
				<div className="container mx-auto px-4 py-4 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Avatar className="h-8 w-8">
							<AvatarImage src={getSecurityIconUrl()} alt="TokenPass" />
							<AvatarFallback>TP</AvatarFallback>
						</Avatar>
						<h1 className="text-lg font-semibold">TokenPass</h1>
					</div>
					<ModeToggle />
				</div>
			</header>

			<main className="flex-1 flex items-center justify-center p-4">
				<Card className="w-full max-w-md">
					<CardHeader className="text-center space-y-4">
						{icon && (
							<div className="flex justify-center">
								<Avatar className="h-20 w-20">
									<AvatarImage src={icon} alt={host} />
									<AvatarFallback>{host.slice(0, 2).toUpperCase()}</AvatarFallback>
								</Avatar>
							</div>
						)}
						<div>
							<CardTitle>Authorize {host}</CardTitle>
							<CardDescription>This site is requesting access to your wallet</CardDescription>
						</div>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-6">
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

							<div className="flex items-center gap-2 p-3 bg-muted rounded-md">
								<Avatar className="h-6 w-6">
									<AvatarImage src={getSecurityIconUrl()} alt="Security" />
									<AvatarFallback>!</AvatarFallback>
								</Avatar>
								<span className="text-xs text-muted-foreground">
									Make sure you recognize this security image
								</span>
							</div>

							<Separator />

							<div className="space-y-2">
								<Label className="text-muted-foreground">This host would like access to:</Label>
								<div className="p-3 bg-muted rounded-md">
									{scopes.length > 0 ? (
										<div className="flex flex-wrap gap-2">
											{scopes.map((scope) => (
												<Badge key={scope} variant="secondary">
													{scope}
												</Badge>
											))}
										</div>
									) : (
										<span className="text-sm text-muted-foreground">Authentication only</span>
									)}
								</div>
							</div>

							<div className="space-y-3">
								<Label>Authorization Duration</Label>
								<RadioGroup value={expire} onValueChange={setExpire}>
									{expireOptions.map((option) => (
										<div key={option.value} className="flex items-center space-x-2">
											<RadioGroupItem value={option.value} id={option.value} />
											<Label htmlFor={option.value} className="font-normal cursor-pointer">
												{option.label}
											</Label>
										</div>
									))}
								</RadioGroup>
							</div>

							{error && <p className="text-sm text-destructive">{error}</p>}

							<Button type="submit" className="w-full" disabled={isLoading}>
								{isLoading ? "Authorizing..." : "Allow"}
							</Button>
						</form>
					</CardContent>
				</Card>
			</main>
		</div>
	);
}
