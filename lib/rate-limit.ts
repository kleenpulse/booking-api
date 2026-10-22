import type { PoolClient } from "pg";
import { HttpError } from "@/lib/http";

const LIMIT = 5;
const WINDOW = "60 seconds";

// Sliding window: at most LIMIT booking attempts per email in any WINDOW.
// The lock serialises attempts for one email, so concurrent requests can't all
// slip under the limit together. clock_timestamp(), not now(): now() is frozen
// at transaction start, which may be well before the lock was granted.
export async function recordAttempt(db: PoolClient, email: string): Promise<void> {
  await db.query("select pg_advisory_xact_lock(hashtext($1))", ["rl:" + email]);
  // The LIMIT-th most recent attempt in the window; once it ages out, one more
  // attempt fits.
  const { rows } = await db.query<{ retry_after: number }>(
    `select ceil(extract(epoch from at + interval '${WINDOW}' - clock_timestamp()))::int as retry_after
     from booking_attempts
     where email = $1 and at > clock_timestamp() - interval '${WINDOW}'
     order by at desc
     offset ${LIMIT - 1} limit 1`,
    [email],
  );
  if (rows[0]) {
    throw new HttpError(429, "too many booking attempts", {
      "Retry-After": String(Math.max(1, rows[0].retry_after)),
    });
  }
  await db.query("insert into booking_attempts (email, at) values ($1, clock_timestamp())", [email]);
}
