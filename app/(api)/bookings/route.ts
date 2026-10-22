import { createBooking, parseNewBooking } from "@/lib/bookings";
import { handler, json, readJson } from "@/lib/http";

export const POST = handler(async (req) => {
  const booking = await createBooking(parseNewBooking(await readJson(req)));
  return json(booking, 201);
});
