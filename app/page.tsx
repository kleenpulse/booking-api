import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { connection } from "next/server";
import { SlotBoard } from "@/components/slot-board";
import { SlotBoardSkeleton } from "@/components/skeletons";
import { viewSlot } from "@/lib/format";
import { listSlots } from "@/lib/slots";

export default function Home() {
	return (
		<main className="mx-auto w-full max-w-7xl px-4 pt-10 sm:px-6 sm:pt-16">
			<section className="entrance max-w-2xl">
				<p className="readout">Open appointments</p>
				<h1 className="mt-3 font-display text-[clamp(2.75rem,8vw,4.5rem)] leading-[0.96] tracking-[-0.04em] text-balance">
					Book a visit<span className="text-signal">.</span>
				</h1>
				<p className="mt-4 max-w-xl text-[17px] leading-relaxed text-pretty text-ink-2">
					Pick a time with one of our doctors, leave your name and email, and
					you are booked. No account needed.
				</p>
			</section>
			<Suspense fallback={<SlotBoardSkeleton />}>
				<Slots />
			</Suspense>
		</main>
	);
}

async function Slots() {
	// Availability changes with every booking: always read it at request time.
	await connection();
	const slots = (await listSlots(null, true)).map(viewSlot);
	return <SlotBoard slots={slots} formKey={randomUUID()} />;
}
