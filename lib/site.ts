import type { Metadata } from "next";

export const SITE_NAME = "Clinic Booking";

export const SITE_DESCRIPTION =
  "See open appointment times, book one in a few seconds and get a confirmation straight away.";

export const SITE_URL = siteUrl();

/** Spread into every `openGraph`: a segment's object replaces its parent's whole. */
export const OPEN_GRAPH = {
  type: "website",
  siteName: SITE_NAME,
} satisfies Metadata["openGraph"];

function siteUrl(): URL {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL(`http://localhost:${process.env.PORT ?? 3000}`);
}
