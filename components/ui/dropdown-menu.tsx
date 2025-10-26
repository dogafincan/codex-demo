"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn, isClient } from "@/lib/utils";

type DropdownContextValue = {
  open: boolean;
  setOpen: (next: boolean) => void;
  triggerRef: React.RefObject<HTMLElement>;
};

const DropdownContext = React.createContext<DropdownContextValue | null>(null);

export interface DropdownMenuProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function setRefValue<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref) {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

export function DropdownMenu({
  open,
  onOpenChange,
  children,
}: DropdownMenuProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLElement>(null);

  const stateOpen = open ?? internalOpen;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (open === undefined) {
        setInternalOpen(next);
      }
      onOpenChange?.(next);
    },
    [open, onOpenChange],
  );

  const value = React.useMemo(
    () => ({ open: stateOpen, setOpen, triggerRef }),
    [stateOpen, setOpen],
  );

  return (
    <DropdownContext.Provider value={value}>
      {children}
    </DropdownContext.Provider>
  );
}

function useDropdown() {
  const context = React.useContext(DropdownContext);
  if (!context) {
    throw new Error("Dropdown menu components must be used within DropdownMenu");
  }
  return context;
}

export interface DropdownMenuTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

export function DropdownMenuTrigger({
  children,
  asChild,
}: DropdownMenuTriggerProps) {
  const { setOpen, triggerRef } = useDropdown();
  const child = React.isValidElement(children) ? children : null;
  const childRef = child?.ref;
  const childOnClick = child?.props?.onClick;

  const toggle = React.useCallback(() => {
    setOpen((prev) => !prev);
  }, [setOpen]);

  const assignTriggerRef = React.useCallback(
    (node: HTMLElement | null) => {
      setRefValue(childRef, node);
      triggerRef.current = node;
    },
    [childRef, triggerRef],
  );

  const handleChildClick = React.useCallback(
    (event: React.MouseEvent) => {
      childOnClick?.(event);
      if (!event.defaultPrevented) toggle();
    },
    [childOnClick, toggle],
  );

  if (asChild && child) {
    // eslint-disable-next-line react-hooks/refs -- ref callback executes after render to bridge consumer ref with internal positioning ref
    return React.cloneElement(child, {
      ref: assignTriggerRef,
      onClick: handleChildClick,
    });
  }

  return (
    <button
      type="button"
      ref={triggerRef as React.RefObject<HTMLButtonElement>}
      onClick={toggle}
    >
      {children}
    </button>
  );
}

const DropdownPortal: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [container, setContainer] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!isClient()) return;
    const el = document.createElement("div");
    el.setAttribute("data-dropdown-portal", "true");
    document.body.appendChild(el);
    setContainer(el);

    return () => {
      document.body.removeChild(el);
    };
  }, []);

  if (!container) return null;
  return createPortal(children, container);
};

export interface DropdownMenuContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end" | "center";
  sideOffset?: number;
}

export function DropdownMenuContent({
  className,
  align = "start",
  sideOffset = 4,
  style,
  ...props
}: DropdownMenuContentProps) {
  const { open, setOpen, triggerRef } = useDropdown();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState<{ top: number; left: number }>();

  React.useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const top = rect.bottom + sideOffset;
    let left = rect.left;
    if (align === "end") {
      left = rect.right;
    } else if (align === "center") {
      left = rect.left + rect.width / 2;
    }
    setPosition({ top, left });
  }, [open, align, sideOffset, triggerRef]);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const content = contentRef.current;
      if (
        content &&
        !content.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, setOpen, triggerRef]);

  if (!open || !isClient()) return null;

  return (
    <DropdownPortal>
      <div
        ref={contentRef}
        style={{
          position: "absolute",
          top: position?.top,
          left:
            align === "end"
              ? position?.left
              : align === "center"
                ? (position?.left ?? 0) - 100
                : position?.left,
          transform:
            align === "end"
              ? "translateX(-100%)"
              : align === "center"
                ? "translateX(0)"
                : "translateX(0)",
          ...style,
        }}
        className={cn(
          "z-50 min-w-[180px] rounded-xl border border-zinc-200 bg-white p-1 shadow-lg transition-all dark:border-zinc-800 dark:bg-zinc-900",
          className,
        )}
        {...props}
      />
    </DropdownPortal>
  );
}

export interface DropdownMenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  inset?: boolean;
}

export const DropdownMenuItem = React.forwardRef<
  HTMLButtonElement,
  DropdownMenuItemProps
>(({ className, inset, onClick, ...props }, ref) => {
  const { setOpen } = useDropdown();
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "flex w-full items-center rounded-lg px-3 py-2 text-sm text-left text-zinc-700 transition hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:text-zinc-200 dark:hover:bg-zinc-800",
        inset && "pl-8",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(false);
      }}
      {...props}
    />
  );
});
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuLabel = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500",
      className,
    )}
    {...props}
  />
);

export const DropdownMenuSeparator = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("my-1 h-px bg-zinc-200 dark:bg-zinc-800", className)}
    {...props}
  />
);
