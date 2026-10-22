import { ImageResponse } from "next/og";
import { displayFont } from "@/lib/og-font";
import { SITE_NAME } from "@/lib/site";

export const alt = "Book a visit: pick an open time with a doctor and get a confirmation straight away.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Ember skin, fixed: an image can't follow the viewer's theme.
const PAPER = "#f3f3f1";
const CARD = "#f6f6f4";
const TILE = "#ffffff";
const INK = "#111111";
const INK_2 = "#6b6b6b";
const INK_3 = "#a3a3a3";
const CORAL = "#e8603c";
const CORAL_SOFT = "#fbe3da";
const BORDER = "#e6e6e1";

const TILES = [
  { time: "09:00", who: "Dr Ade", state: "open" },
  { time: "10:30", who: "Dr Bello", state: "picked" },
  { time: "11:00", who: "Dr Ade", state: "booked" },
  { time: "14:00", who: "Dr Bello", state: "open" },
] as const;

const DAY = "Thu 23 Oct";
const LEDE = "Pick a time, leave your name and email, and you are booked.";
// Google Fonts subsets to these characters, so every drawn string goes in.
const TEXT = ["Book a visit.", SITE_NAME, DAY, LEDE, "3 OPEN", "Booked", ...TILES.flatMap((t) => [t.time, t.who])].join("");

export default async function Image() {
  const [regular, medium] = await Promise.all([displayFont(400, TEXT), displayFont(500, TEXT)]);
  const fonts = [
    regular && { name: "Instrument Sans", data: regular, weight: 400 as const },
    medium && { name: "Instrument Sans", data: medium, weight: 500 as const },
  ].filter((f) => !!f);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: PAPER,
          padding: 72,
          fontFamily: fonts.length ? "Instrument Sans" : undefined,
          color: INK,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Mark size={52} />
            <span style={{ fontSize: 30, letterSpacing: "-0.01em" }}>{SITE_NAME}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 128, fontWeight: 500, letterSpacing: "-0.045em", lineHeight: 0.94 }}>
              Book a visit<span style={{ color: CORAL }}>.</span>
            </div>
            <div style={{ marginTop: 28, fontSize: 30, color: INK_2, maxWidth: 520, lineHeight: 1.35 }}>
              {LEDE}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 400,
            alignSelf: "center",
            background: CARD,
            borderRadius: 36,
            padding: 28,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 26, letterSpacing: "-0.01em" }}>{DAY}</span>
            <span style={{ fontSize: 16, color: INK_2, letterSpacing: "0.06em" }}>3 OPEN</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 22 }}>
            {TILES.map((tile) => (
              <div
                key={tile.time}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: 166,
                  padding: "18px 20px",
                  borderRadius: 24,
                  background: tile.state === "picked" ? CORAL_SOFT : tile.state === "open" ? TILE : "transparent",
                  border: tile.state === "booked" ? `2px dashed ${BORDER}` : "2px solid transparent",
                }}
              >
                <span
                  style={{
                    fontSize: 32,
                    letterSpacing: "-0.01em",
                    color: tile.state === "booked" ? INK_3 : INK,
                    textDecoration: tile.state === "booked" ? "line-through" : "none",
                  }}
                >
                  {tile.time}
                </span>
                <span style={{ marginTop: 6, fontSize: 18, color: tile.state === "booked" ? INK_3 : INK_2 }}>
                  {tile.state === "booked" ? "Booked" : tile.who}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}

function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="12" fill={INK} />
      <g fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6.5" y="7.5" width="11" height="10" rx="2.2" />
        <path d="M6.5 11h11M9.5 6v3M14.5 6v3" />
      </g>
      <circle cx="14.6" cy="14.4" r="1.45" fill={CORAL} />
    </svg>
  );
}
