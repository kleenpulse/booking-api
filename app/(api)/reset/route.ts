import { handler, json, readJson } from "@/lib/http";
import { parseSlots, resetSlots } from "@/lib/slots";

export const POST = handler(async (req) => {
  const slots = parseSlots(await readJson(req));
  await resetSlots(slots);
  return json({ ok: true, slots: slots.length });
});
