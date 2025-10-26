"use client";

import * as React from "react";
import { isClient } from "@/lib/utils";

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = React.useState<T>(() => {
    if (!isClient()) return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.warn("Failed to read from localStorage", error);
      return initialValue;
    }
  });

  const setValue = React.useCallback(
    (value: React.SetStateAction<T>) => {
      setStoredValue((prev) => {
        const next =
          typeof value === "function" ? (value as (val: T) => T)(prev) : value;
        if (isClient()) {
          try {
            window.localStorage.setItem(key, JSON.stringify(next));
          } catch (error) {
            console.warn("Failed to write to localStorage", error);
          }
        }
        return next;
      });
    },
    [key],
  );

  React.useEffect(() => {
    if (!isClient()) return;
    function handleStorage(event: StorageEvent) {
      if (event.key !== key) return;
      setStoredValue(
        event.newValue ? (JSON.parse(event.newValue) as T) : initialValue,
      );
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [initialValue, key]);

  return [storedValue, setValue];
}
