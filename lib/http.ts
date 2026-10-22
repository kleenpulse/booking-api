import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(body, { status, headers });
}

export function errorResponse(status: number, message: string) {
  return json({ error: message }, status);
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

// Every route goes through this so all failures come back as {"error": ...}.
export function handler<C>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    // API responses are always request-time; never prerender them.
    await connection();
    try {
      return await fn(req, ctx);
    } catch (err) {
      unstable_rethrow(err);
      if (err instanceof HttpError) return errorResponse(err.status, err.message);
      console.error(err);
      return errorResponse(500, "internal server error");
    }
  };
}
