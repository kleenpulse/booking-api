"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { cancelBooking, submitBooking, type Booking } from "@/lib/bookings";
import { HttpError } from "@/lib/http";
import { MAX_KEY_LENGTH } from "@/lib/idempotency";
import { bookingPage, type BookingPageView } from "@/lib/views";

// Same pipeline as POST /bookings, without exposing the API key to the browser.

export type BookState = {
	error: string | null;
	field: "name" | "email" | null;
	key: string;
	slotId: string | null;
	name: string;
	email: string;
};

function text(form: FormData, field: string): string {
	const value = form.get(field);
	return typeof value === "string" ? value : "";
}

export async function bookSlot(
	_prev: BookState,
	form: FormData,
): Promise<BookState> {
	const fields = {
		slot_id: text(form, "slot_id"),
		name: text(form, "name"),
		email: text(form, "email"),
	};
	const key =
		text(form, "idempotency_key").trim().slice(0, MAX_KEY_LENGTH) || null;

	let status: number;
	let body: unknown;
	let retryAfter: string | null = null;
	try {
		({ status, body } = await submitBooking(JSON.stringify(fields), key));
	} catch (err) {
		if (!(err instanceof HttpError)) throw err;
		status = err.status;
		body = { error: err.message };
		retryAfter = new Headers(err.headers).get("retry-after");
	}

	if (status === 201) redirect(`/booking/${(body as Booking).id}`);

	const outcome = describe(
		status,
		(body as { error: string }).error,
		retryAfter,
	);
	// The slot list may be stale (taken, removed or started): show the real one.
	if (outcome.field === null) refresh();
	return {
		...outcome,
		key: randomUUID(),
		slotId: fields.slot_id,
		name: fields.name,
		email: fields.email,
	};
}

function describe(
	status: number,
	message: string,
	retryAfter: string | null,
): Pick<BookState, "error" | "field"> {
	switch (status) {
		case 400:
			if (message.startsWith("name"))
				return { error: "Enter your name.", field: "name" };
			if (message.startsWith("email"))
				return { error: "Enter a valid email address.", field: "email" };
			if (message.startsWith("slot_id"))
				return { error: "Pick a time first.", field: null };
			if (message === "slot has already started") {
				return {
					error: "That time has already started. Pick a later one.",
					field: null,
				};
			}
			break;
		case 404:
			return {
				error: "That time is no longer on the schedule. Pick another one.",
				field: null,
			};
		case 409:
			return {
				error: "Someone just booked that time. Pick another one.",
				field: null,
			};
		case 429: {
			const seconds = Number(retryAfter) || 60;
			return {
				error: `Too many booking attempts for this email. Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`,
				field: null,
			};
		}
	}
	return { error: "Something went wrong. Please try again.", field: null };
}

export async function cancelSlot(id: string): Promise<void> {
	try {
		await cancelBooking(id);
	} catch (err) {
		// Already cancelled (409) or gone (404): the refreshed page shows the real state.
		if (!(err instanceof HttpError)) throw err;
	}
	refresh();
}

export async function loadBookings(
	email: string,
	cursor: string,
): Promise<BookingPageView | null> {
	try {
		return await bookingPage(email, cursor);
	} catch (err) {
		if (err instanceof HttpError) return null;
		throw err;
	}
}
