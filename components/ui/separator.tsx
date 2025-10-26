"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SeparatorProps = React.HTMLAttributes<HTMLDivElement>;

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, orientation = "horizontal", ...props }, ref) => {
    const isHorizontal = orientation !== "vertical";
    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation={isHorizontal ? "horizontal" : "vertical"}
        className={cn(
          "bg-zinc-200 dark:bg-zinc-800",
          isHorizontal ? "h-px w-full" : "h-full w-px",
          className,
        )}
        {...props}
      />
    );
  },
);
Separator.displayName = "Separator";
