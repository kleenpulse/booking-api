import { Pool, type PoolClient } from "pg";
import { attachDatabasePool } from "@vercel/functions";

const globalForDb = globalThis as unknown as { pool?: Pool };

export const pool =
  globalForDb.pool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

if (!globalForDb.pool) {
  globalForDb.pool = pool;
  // An idle client dropped by the server must not crash the process.
  pool.on("error", (err) => console.error("pg pool error", err));
  attachDatabasePool(pool);
}

export type Queryable = Pool | PoolClient;

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
