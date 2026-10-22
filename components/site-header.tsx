import { Suspense } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { ActiveNav, NavPills } from "@/components/nav-pills";
import { ThemeToggle } from "@/components/theme-toggle";
import { SITE_NAME } from "@/lib/site";

export function SiteHeader() {
	return (
		<header className="px-3 pt-3 sm:px-6">
			<div className="glass mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 rounded-pill pr-2 pl-3">
				<Link
					href="/"
					className="flex items-center gap-2.5 rounded-pill outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<BrandMark />
					<span className="hidden font-display text-[17px] leading-none tracking-[-0.01em] sm:inline">
						{SITE_NAME}
					</span>
				</Link>
				<nav aria-label="Main" className="flex items-center gap-1.5">
					{/* The pathname is unknown while a dynamic route's shell prerenders. */}
					<Suspense fallback={<NavPills current={null} />}>
						<ActiveNav />
					</Suspense>
					<ThemeToggle />
				</nav>
			</div>
		</header>
	);
}
