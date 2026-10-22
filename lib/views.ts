import { getBooking, listBookings } from "@/lib/bookings";
import { viewBooking, type BookingView } from "@/lib/format";
import { getSlots } from "@/lib/slots";

export const PAGE_SIZE = 5;

export type BookingPageView = { bookings: BookingView[]; next_cursor: string | null };

export async function bookingPage(email: string, cursor: string | null): Promise<BookingPageView> {
  const page = await listBookings({ email: email.trim().toLowerCase(), limit: PAGE_SIZE, cursor });
  const slots = await getSlots([...new Set(page.bookings.map((b) => b.slot_id))]);
  return {
    bookings: page.bookings.map((b) => viewBooking(b, slots.get(b.slot_id))),
    next_cursor: page.next_cursor,
  };
}

export async function bookingView(id: string): Promise<BookingView | null> {
  const booking = await getBooking(id);
  if (!booking) return null;
  const slots = await getSlots([booking.slot_id]);
  return viewBooking(booking, slots.get(booking.slot_id));
}
