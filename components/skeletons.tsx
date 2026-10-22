import { cn } from "@/lib/utils";

function Bar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-foreground/8", className)} />;
}

const TILES = [4, 3, 2];

export function SlotBoardSkeleton() {
  return (
    <div aria-hidden className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
      <div className="space-y-4">
        <Bar className="h-10 w-64 rounded-pill" />
        {TILES.map((tiles, i) => (
          <div key={i} className="bento p-5" style={{ opacity: Math.max(0.25, 1 - i * 0.25) }}>
            <Bar className="h-4 w-28" />
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: tiles }, (_, j) => (
                <div key={j} className="space-y-2 rounded-[20px] bg-card-nested px-3.5 py-3">
                  <Bar className="h-4 w-14" />
                  <Bar className="h-3 w-20" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="bento h-64 p-5">
        <Bar className="h-3 w-20" />
      </div>
    </div>
  );
}

const ROW_WIDTHS = ["w-40", "w-32", "w-36"];

export function BookingListSkeleton() {
  return (
    <div aria-hidden className="space-y-2">
      {ROW_WIDTHS.map((w, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-[20px] bg-card p-4 dark:ring-1 dark:ring-glass-border"
          style={{ opacity: Math.max(0.25, 1 - i * 0.2) }}
        >
          <Bar className="h-9 w-14 rounded-[12px]" />
          <div className="flex-1 space-y-2">
            <Bar className={cn("h-3.5", w)} />
            <Bar className="h-3 w-24" />
          </div>
          <Bar className="h-6 w-24 rounded-pill" />
        </div>
      ))}
    </div>
  );
}
