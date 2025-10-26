import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "FlowFocus | Pomodoro Tracker",
	description:
		"A focused Pomodoro tracker with customizable timers, local insights, and delightful reminders.",
};

const themeInitializer = `(() => {
  try {
    const stored = localStorage.getItem("pomodoro-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = stored === "light" || stored === "dark" ? stored : prefersDark ? "dark" : "light";
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
    document.documentElement.dataset.theme = theme;
  } catch (error) {
    console.warn("Failed to load theme", error);
  }
})();`;

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				{/** biome-ignore lint/security/noDangerouslySetInnerHtml: theme initialization script prevents flash */}
				<script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
			</head>
			<body
				className={`${geistSans.variable} ${geistMono.variable} bg-zinc-50 text-zinc-900 antialiased transition-colors dark:bg-zinc-950 dark:text-zinc-50 font-sans`}
			>
				{children}
			</body>
		</html>
	);
}
