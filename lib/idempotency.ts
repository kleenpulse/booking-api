import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { HttpError, isObject } from "@/lib/http";

export type StoredResponse = { status: number; body: unknown };

export const MAX_KEY_LENGTH = 255;

export function idempotencyKey(req: Request): string | null {
  const key = req.headers.get("idempotency-key")?.trim();
  if (!key) return null;
  if (key.length > MAX_KEY_LENGTH) {
    throw new HttpError(400, `Idempotency-Key must be at most ${MAX_KEY_LENGTH} characters`);
  }
  return key;
}

// Sorted keys, so {"a":1,"b":2} and {"b":2,"a":1} count as the same request.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (isObject(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map((k) => [k, canonical(value[k])]),
    );
  }
  return value;
}

export function requestHash(text: string): string {
  let normalised: string;
  try {
    normalised = "json:" + JSON.stringify(canonical(JSON.parse(text)));
  } catch {
    normalised = "raw:" + text;
  }
  return createHash("sha256").update(normalised).digest("hex");
}

// Holds a transaction-scoped lock on the key, so concurrent retries with the
// same key run one at a time and later ones see the stored response.
export async function findStoredResponse(
  db: PoolClient,
  key: string,
  hash: string,
): Promise<StoredResponse | null> {
  await db.query("select pg_advisory_xact_lock(hashtext($1))", ["idem:" + key]);
  const { rows } = await db.query<{ request_hash: string; status_code: number; body: unknown }>(
    "select request_hash, status_code, body from idempotency_keys where key = $1",
    [key],
  );
  if (!rows[0]) return null;
  if (rows[0].request_hash !== hash) {
    throw new HttpError(422, "idempotency key reused with a different body");
  }
  return { status: rows[0].status_code, body: rows[0].body };
}

export async function storeResponse(
  db: PoolClient,
  key: string,
  hash: string,
  res: StoredResponse,
): Promise<void> {
  await db.query(
    "insert into idempotency_keys (key, request_hash, status_code, body) values ($1, $2, $3, $4)",
    [key, hash, res.status, JSON.stringify(res.body)],
  );
}
