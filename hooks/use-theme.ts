"use client";

import * as React from "react";
import { isClient } from "@/lib/utils";

export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "pomodoro-theme";

function applyTheme(theme: Theme) {
  if (!isClient()) return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.dataset.theme = theme;
}

function getSystemTheme(): Theme {
  if (!isClient()) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readStoredTheme(): Theme | null {
  if (!isClient()) return null;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return null;
}

export function useTheme(): {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
} {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    return readStoredTheme() ?? getSystemTheme();
  });

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    if (isClient()) {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    }
    applyTheme(next);
  }, []);

  const toggleTheme = React.useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  React.useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  React.useEffect(() => {
    if (!isClient()) return;
    const handler = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY && event.newValue) {
        const stored = event.newValue as Theme;
        setThemeState(stored);
        applyTheme(stored);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return { theme, setTheme, toggleTheme };
}
