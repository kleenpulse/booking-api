import { handler, json } from "@/lib/http";
import { listSlots } from "@/lib/slots";

export const GET = handler(async (req) => {
  const provider = new URL(req.url).searchParams.get("provider") || null;
  return json({ slots: await listSlots(provider) });
});
