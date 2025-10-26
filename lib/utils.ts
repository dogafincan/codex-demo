"use client";

type ClassDictionary = Record<string, boolean | string | number | null | undefined>;
type ClassValue = string | ClassValue[] | ClassDictionary | null | undefined;

/**
 * Lightweight className concatenation helper inspired by clsx/tailwind-merge.
 */
export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];

  const process = (value: ClassValue) => {
    if (!value) return;
    if (typeof value === "string") {
      classes.push(
        ...value
          .split(" ")
          .map((token) => token.trim())
          .filter(Boolean),
      );
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(process);
      return;
    }
    if (typeof value === "object") {
      Object.entries(value).forEach(([key, condition]) => {
        if (condition) classes.push(key);
      });
    }
  };

  inputs.forEach(process);
  return classes.join(" ");
}

export function secondsToClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function minutesToSeconds(minutes: number): number {
  return Math.max(0, Math.round(minutes * 60));
}

export function isClient(): boolean {
  return typeof window !== "undefined";
}

export function todayKey(date = new Date()): string {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().split("T")[0]!;
}

export function getWeekSeries(
  stats: Record<string, number>,
  endDate = new Date(),
): { key: string; label: string; value: number }[] {
  const data: { key: string; label: string; value: number }[] = [];
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i--) {
    const date = new Date(end);
    date.setDate(end.getDate() - i);
    const key = todayKey(date);
    const label = date.toLocaleDateString(undefined, {
      weekday: "short",
    });
    data.push({
      key,
      label,
      value: stats[key] ?? 0,
    });
  }
  return data;
}

export function calculateStreak(
  stats: Record<string, number>,
  reference = new Date(),
): number {
  let streak = 0;
  const end = new Date(reference);
  end.setHours(0, 0, 0, 0);

  while (true) {
    const key = todayKey(end);
    if (!stats[key]) break;
    streak += 1;
    end.setDate(end.getDate() - 1);
  }
  return streak;
}
