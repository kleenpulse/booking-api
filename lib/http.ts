import { createHash, timingSafeEqual } from "node:crypto";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public headers?: HeadersInit,
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(body, { status, headers });
}

export function errorResponse(status: number, message: string, headers?: HeadersInit) {
  return json({ error: message }, status, headers);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "request body must be valid JSON");
  }
}

export async function readJson(req: Request): Promise<unknown> {
  return parseJson(await req.text());
}

const digest = (value: string) => createHash("sha256").update(value).digest();

// Hashing first gives equal-length buffers, so the compare leaks neither the key nor its length.
function checkApiKey(req: Request) {
  const expected = process.env.API_KEY;
  if (!expected) throw new Error("API_KEY is not configured");
  const given = req.headers.get("x-api-key");
  if (!given || !timingSafeEqual(digest(given), digest(expected))) {
    throw new HttpError(401, "missing or invalid API key");
  }
}

// Every route goes through this so auth runs first and all failures come back as {"error": ...}.
export function handler<C>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    // API responses are always request-time; never prerender them.
    await connection();
    try {
      checkApiKey(req);
      return await fn(req, ctx);
    } catch (err) {
      unstable_rethrow(err);
      if (err instanceof HttpError) return errorResponse(err.status, err.message, err.headers);
      console.error(err);
      return errorResponse(500, "internal server error");
    }
  };
}
