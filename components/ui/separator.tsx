"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SeparatorProps = React.HTMLAttributes<HTMLDivElement> & {
	orientation?: "horizontal" | "vertical";
};

export const Separator = React.forwardRef<HTMLHRElement, SeparatorProps>(
	({ className, orientation = "horizontal", ...props }, ref) => {
		const isHorizontal = orientation !== "vertical";
		return (
			<hr
				ref={ref}
				className={cn(
					"border-0 bg-zinc-200 dark:bg-zinc-800",
					isHorizontal ? "h-px w-full" : "h-full w-px",
					className,
				)}
				{...props}
			/>
		);
	},
);
Separator.displayName = "Separator";
