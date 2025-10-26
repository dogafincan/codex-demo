"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn, isClient } from "@/lib/utils";

type DialogContextType = {
	open: boolean;
	setOpen: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextType | null>(null);

export interface DialogProps {
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	children: React.ReactNode;
}

export function Dialog({
	open,
	defaultOpen,
	children,
	onOpenChange,
}: DialogProps) {
	const [uncontrolledOpen, setUncontrolledOpen] = React.useState(
		defaultOpen ?? false,
	);

	const stateOpen = open ?? uncontrolledOpen;

	const setOpen = React.useCallback(
		(next: boolean) => {
			if (open === undefined) {
				setUncontrolledOpen(next);
			}
			onOpenChange?.(next);
		},
		[open, onOpenChange],
	);

	return (
		<DialogContext.Provider value={{ open: stateOpen, setOpen }}>
			{children}
		</DialogContext.Provider>
	);
}

function useDialog() {
	const context = React.useContext(DialogContext);
	if (!context)
		throw new Error("Dialog components must be used within <Dialog>");
	return context;
}

export interface DialogTriggerProps {
	children: React.ReactNode;
	asChild?: boolean;
}

export function DialogTrigger({ children, asChild }: DialogTriggerProps) {
	const { setOpen } = useDialog();
	const child = React.isValidElement(children) ? children : null;

	if (asChild && child) {
		const triggerChild = child as React.ReactElement<{
			onClick?: React.MouseEventHandler<HTMLElement>;
		}>;
		return React.cloneElement(triggerChild, {
			onClick: (event: React.MouseEvent<HTMLElement>) => {
				triggerChild.props?.onClick?.(event);
				if (!event.defaultPrevented) {
					setOpen(true);
				}
			},
		});
	}

	return (
		<button type="button" onClick={() => setOpen(true)}>
			{children}
		</button>
	);
}

const DialogPortal: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const [mounted, setMounted] = React.useState(false);
	const [container, setContainer] = React.useState<HTMLElement | null>(null);

	React.useEffect(() => {
		if (!isClient()) return;
		const el = document.createElement("div");
		el.setAttribute("data-dialog-portal", "true");
		document.body.appendChild(el);
		setContainer(el);
		setMounted(true);
		return () => {
			document.body.removeChild(el);
		};
	}, []);

	if (!mounted || !container) return null;
	return createPortal(children, container);
};

export interface DialogContentProps
	extends React.HTMLAttributes<HTMLDivElement> {
	children: React.ReactNode;
}

export function DialogContent({
	className,
	children,
	...props
}: DialogContentProps) {
	const { open, setOpen } = useDialog();
	React.useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				setOpen(false);
			}
		}
		if (open) {
			document.addEventListener("keydown", handleKeyDown);
			document.body.style.overflow = "hidden";
		}
		return () => {
			document.body.style.overflow = "";
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [open, setOpen]);

	if (!open) return null;

	const content = (
		<div className="fixed inset-0 z-50 flex items-center justify-center px-4">
			{/** biome-ignore lint/a11y/noStaticElementInteractions: backdrop click to close dialog */}
			{/** biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click to close dialog */}
			<div
				className="absolute inset-0 bg-black/40 backdrop-blur-sm"
				onClick={() => setOpen(false)}
			/>
			<div
				role="dialog"
				aria-modal="true"
				className={cn(
					"relative z-10 w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl transition-all dark:border-zinc-800 dark:bg-zinc-950",
					className,
				)}
				{...props}
			>
				{children}
			</div>
		</div>
	);

	return <DialogPortal>{content}</DialogPortal>;
}

export const DialogHeader = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div className={cn("mb-4 space-y-1 text-left", className)} {...props} />
);

export const DialogTitle = ({
	className,
	...props
}: React.HTMLAttributes<HTMLHeadingElement>) => (
	<h2
		className={cn(
			"text-lg font-semibold text-zinc-900 dark:text-zinc-50",
			className,
		)}
		{...props}
	/>
);

export const DialogDescription = ({
	className,
	...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
	<p
		className={cn("text-sm text-zinc-500 dark:text-zinc-400", className)}
		{...props}
	/>
);

export const DialogFooter = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			"mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end",
			className,
		)}
		{...props}
	/>
);

export const DialogClose = ({
	asChild,
	children,
}: {
	asChild?: boolean;
	children: React.ReactNode;
}) => {
	const { setOpen } = useDialog();
	const child = React.isValidElement(children) ? children : null;

	if (asChild && child) {
		const closeChild = child as React.ReactElement<{
			onClick?: React.MouseEventHandler<HTMLElement>;
		}>;
		return React.cloneElement(closeChild, {
			onClick: (event: React.MouseEvent<HTMLElement>) => {
				closeChild.props?.onClick?.(event);
				if (!event.defaultPrevented) {
					setOpen(false);
				}
			},
		});
	}

	return (
		<button type="button" onClick={() => setOpen(false)}>
			{children}
		</button>
	);
};
