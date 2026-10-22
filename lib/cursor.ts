import { HttpError } from "@/lib/http";

// Opaque to clients: base64url of the last booking's seq.
export function encodeCursor(seq: string): string {
  return Buffer.from(seq, "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): string {
  const seq = Buffer.from(cursor, "base64url").toString("utf8");
  // Re-encoding must give the same string back, which rejects junk that
  // Buffer would otherwise decode leniently.
  if (!/^\d{1,18}$/.test(seq) || encodeCursor(seq) !== cursor) {
    throw new HttpError(400, "cursor is invalid");
  }
  return seq;
}
