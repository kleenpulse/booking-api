import type { Booking } from "@/lib/bookings";
import type { Slot } from "@/lib/slots";

// Appointments are shown in the clinic's time zone: that's when the patient has
// to turn up, and the server and the browser render the same text.
export const CLINIC_TIME_ZONE = "Africa/Lagos";
export const CLINIC_TIME_ZONE_NAME = "West Africa Time";

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: CLINIC_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});
const longDayFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: CLINIC_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: CLINIC_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});
// en-CA formats as YYYY-MM-DD, which sorts and groups cleanly.
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: CLINIC_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type SlotView = {
  id: string;
  provider: string;
  available: boolean;
  /** YYYY-MM-DD in the clinic's time zone. */
  dayKey: string;
  day: string;
  longDay: string;
  time: string;
  endTime: string;
};

export function viewSlot(slot: Slot & { available?: boolean }): SlotView {
  const start = new Date(slot.start);
  return {
    id: slot.id,
    provider: slot.provider,
    available: slot.available ?? true,
    dayKey: dayKeyFormat.format(start),
    day: dayFormat.format(start),
    longDay: longDayFormat.format(start),
    time: timeFormat.format(start),
    endTime: timeFormat.format(new Date(slot.end)),
  };
}

export type BookingView = Booking & { slot: SlotView | null; booked: string };

export function viewBooking(booking: Booking, slot: Slot | undefined): BookingView {
  const created = new Date(booking.created_at);
  return {
    ...booking,
    slot: slot ? viewSlot(slot) : null,
    booked: `${dayFormat.format(created)}, ${timeFormat.format(created)}`,
  };
}
