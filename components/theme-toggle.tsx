"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

/** The new skin grows out of the toggle as a circle (see ::view-transition in globals.css). */
function revealTheme(next: "light" | "dark", setTheme: (theme: string) => void, x: number, y: number) {
  const root = document.documentElement;
  const apply = () => {
    // next-themes applies the class in an effect; the transition needs it now.
    root.classList.toggle("dark", next === "dark");
    root.classList.toggle("light", next === "light");
    root.style.colorScheme = next;
    setTheme(next);
  };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || typeof document.startViewTransition !== "function") {
    apply();
    return;
  }
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.style.setProperty("--reveal-x", `${x}px`);
  root.style.setProperty("--reveal-y", `${y}px`);
  root.style.setProperty("--reveal-r", `${r}px`);
  document.startViewTransition(apply);
}

export function ThemeToggle() {
  const { setTheme } = useTheme();
  return (
    <button
      type="button"
      aria-label="Switch light or dark theme"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
        revealTheme(next, setTheme, rect.left + rect.width / 2, rect.top + rect.height / 2);
      }}
      className="inline-flex size-9 items-center justify-center rounded-full text-ink-2 outline-none transition-[color,background-color,transform] duration-200 hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-95 dark:hover:bg-accent"
    >
      {/* Icons by CSS, not resolvedTheme, so SSR and the first client render agree. */}
      <Moon className="size-[18px] dark:hidden" />
      <Sun className="hidden size-[18px] dark:block" />
    </button>
  );
}
