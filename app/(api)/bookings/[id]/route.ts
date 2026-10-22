import { getBooking } from "@/lib/bookings";
import { errorResponse, handler, json } from "@/lib/http";

export const GET = handler<RouteContext<"/bookings/[id]">>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const booking = await getBooking(id);
  return booking ? json(booking) : errorResponse(404, "booking not found");
});
