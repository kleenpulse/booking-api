import { cn } from "@/lib/utils";

/** Keep in sync with app/icon.svg and app/apple-icon.tsx. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-8", className)}>
      <circle cx="12" cy="12" r="12" className="fill-inverse" />
      <g
        fill="none"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-inverse-foreground"
      >
        <rect x="6.5" y="7.5" width="11" height="10" rx="2.2" />
        <path d="M6.5 11h11M9.5 6v3M14.5 6v3" />
      </g>
      <circle cx="14.6" cy="14.4" r="1.45" className="fill-signal" />
    </svg>
  );
}
