import { listBookings, parseBookingQuery, submitBooking } from "@/lib/bookings";
import { handler, json } from "@/lib/http";
import { idempotencyKey } from "@/lib/idempotency";

export const POST = handler(async (req) => {
  const key = idempotencyKey(req);
  const { status, body } = await submitBooking(await req.text(), key);
  return json(body, status);
});

export const GET = handler(async (req) => {
  const query = parseBookingQuery(new URL(req.url).searchParams);
  return json(await listBookings(query));
});
