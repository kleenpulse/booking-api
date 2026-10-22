import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Only the booking page is public content; the API answers 401 without a key. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/slots", "/bookings", "/reset", "/booking/", "/my-bookings"],
    },
    sitemap: new URL("/sitemap.xml", SITE_URL).href,
  };
}
