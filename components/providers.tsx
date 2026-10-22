"use client";

import type * as React from "react";
import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </ThemeProvider>
    </NuqsAdapter>
  );
}
