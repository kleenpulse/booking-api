import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import { CLINIC_TIME_ZONE_NAME } from "@/lib/format";
import { OPEN_GRAPH, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

const instrumentSans = Instrument_Sans({
	variable: "--font-instrument-sans",
	subsets: ["latin"],
	display: "swap",
});

export const metadata: Metadata = {
	metadataBase: SITE_URL,
	title: {
		default: `Book a visit · ${SITE_NAME}`,
		template: `%s · ${SITE_NAME}`,
	},
	description: SITE_DESCRIPTION,
	applicationName: SITE_NAME,
	openGraph: OPEN_GRAPH,
	twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#f3f3f1" },
		{ media: "(prefers-color-scheme: dark)", color: "#050a0b" },
	],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html
			lang="en"
			suppressHydrationWarning
			className={`${geistSans.variable} ${geistMono.variable} ${instrumentSans.variable} h-full antialiased`}
		>
			<body className="flex min-h-full flex-col">
				<Providers>
					<SiteHeader />
					<div className="flex flex-1 flex-col">{children}</div>
					<footer className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 pt-10 pb-8 sm:px-6">
						<p className="readout">All times in {CLINIC_TIME_ZONE_NAME}</p>
						<p className="readout">
							API: <span className="text-foreground/80">/slots</span> ·{" "}
							<span className="text-foreground/80">/bookings</span> · X-API-Key
						</p>
					</footer>
				</Providers>
			</body>
		</html>
	);
}
