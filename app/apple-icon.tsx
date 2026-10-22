import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// The brand mark on a full square: iOS rounds the corners itself.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#111111" }}>
        <svg width="180" height="180" viewBox="0 0 24 24">
          <g fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6.5" y="7.5" width="11" height="10" rx="2.2" />
            <path d="M6.5 11h11M9.5 6v3M14.5 6v3" />
          </g>
          <circle cx="14.6" cy="14.4" r="1.45" fill="#e8603c" />
        </svg>
      </div>
    ),
    size,
  );
}
