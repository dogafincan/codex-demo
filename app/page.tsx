"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { CircularProgress } from "@/components/ui/circular-progress";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  calculateStreak,
  cn,
  getWeekSeries,
  isClient,
  minutesToSeconds,
  secondsToClock,
  todayKey,
} from "@/lib/utils";

type SessionType = "work" | "short_break" | "long_break";

interface PomodoroSettings {
  workDuration: number; // minutes
  shortBreakDuration: number; // minutes
  longBreakDuration: number; // minutes
  longBreakInterval: number;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  autoStartNext: boolean;
}

interface SessionLog {
  id: string;
  type: SessionType;
  completedAt: string;
  durationMinutes: number;
}

interface PomodoroStats {
  byDay: Record<string, number>;
  history: SessionLog[];
}

interface PomodoroState {
  sessionType: SessionType;
  timeLeft: number; // seconds
  isRunning: boolean;
  pomodorosSinceLongBreak: number;
}

const SETTINGS_STORAGE_KEY = "pomodoro-settings-v1";
const STATS_STORAGE_KEY = "pomodoro-stats-v1";

const SESSION_LABELS: Record<SessionType, string> = {
  work: "Focus",
  short_break: "Short Break",
  long_break: "Long Break",
};

const SESSION_DESCRIPTIONS: Record<SessionType, string> = {
  work: "Deep focus session. Minimise distractions and dive in!",
  short_break: "Quick recharge. Stand up, hydrate, stretch.",
  long_break: "Take a longer breather before your next deep work cycle.",
};

const defaultSettings: PomodoroSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
  soundEnabled: true,
  notificationsEnabled: false,
  autoStartNext: true,
};

const defaultStats: PomodoroStats = {
  byDay: {},
  history: [],
};

const DURATION_LIMITS = {
  min: 1,
  max: 180,
};

const SESSION_FLOW_ORDER: SessionType[] = [
  "work",
  "short_break",
  "work",
  "short_break",
  "work",
  "short_break",
  "work",
  "long_break",
];

function useNotificationPermission(enabled: boolean) {
  React.useEffect(() => {
    if (!enabled) return;
    if (!isClient() || typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, [enabled]);
}

function sessionDurationMinutes(type: SessionType, settings: PomodoroSettings) {
  switch (type) {
    case "work":
      return settings.workDuration;
    case "short_break":
      return settings.shortBreakDuration;
    case "long_break":
      return settings.longBreakDuration;
    default:
      return settings.workDuration;
  }
}

function createCsv(stats: PomodoroStats) {
  const headers = ["Date", "Pomodoros Completed"];
  const rows = Object.entries(stats.byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => `${date},${count}`);
  return [headers.join(","), ...rows].join("\n");
}

const AudioContextClass: typeof AudioContext | undefined =
  typeof window !== "undefined"
    ? window.AudioContext ||
      (window as Window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext
    : undefined;

export default function HomePage() {
  const [settings, setSettings] = useLocalStorage<PomodoroSettings>(
    SETTINGS_STORAGE_KEY,
    defaultSettings,
  );
  const [stats, setStats] = useLocalStorage<PomodoroStats>(
    STATS_STORAGE_KEY,
    defaultStats,
  );
  const [state, setState] = React.useState<PomodoroState>(() => ({
    sessionType: "work",
    timeLeft: minutesToSeconds(defaultSettings.workDuration),
    isRunning: false,
    pomodorosSinceLongBreak: 0,
  }));
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const previousTime = React.useRef(state.timeLeft);
  const audioContextRef = React.useRef<AudioContext | null>(null);

  const focusTitleRef = React.useRef("FlowFocus | Pomodoro Tracker");

  useNotificationPermission(settings.notificationsEnabled);

  const currentDurationSeconds = React.useMemo(
    () => minutesToSeconds(sessionDurationMinutes(state.sessionType, settings)),
    [state.sessionType, settings],
  );

  const progress = Math.min(
    1,
    Math.max(0, 1 - state.timeLeft / currentDurationSeconds || 0),
  );

  const ensureAudioContext = React.useCallback(async () => {
    if (!settings.soundEnabled || !isClient()) return;
    if (!audioContextRef.current && AudioContextClass) {
      audioContextRef.current = new AudioContextClass();
    }
    if (audioContextRef.current?.state === "suspended") {
      await audioContextRef.current.resume();
    }
  }, [settings.soundEnabled]);

  const playAlertSound = React.useCallback(async () => {
    if (!settings.soundEnabled || !isClient()) return;
    await ensureAudioContext();
    const context = audioContextRef.current;
    if (!context) return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.2);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 1.2);
  }, [ensureAudioContext, settings.soundEnabled]);

  const sendNotification = React.useCallback(
    (nextSession: SessionType) => {
      if (!settings.notificationsEnabled || !isClient()) return;
      if (typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;
      const title =
        nextSession === "work" ? "Break complete" : "Pomodoro complete";
      const body =
        nextSession === "work"
          ? "Back to focus – your next Pomodoro starts now."
          : nextSession === "short_break"
            ? "Time for a short break. Nice work!"
            : "Deep focus cycle done. Enjoy a long break.";
      try {
        new Notification(title, {
          body,
          tag: "pomodoro-tracker",
        });
      } catch (error) {
        console.warn("Notification error", error);
      }
    },
    [settings.notificationsEnabled],
  );

  const handleSessionComplete = React.useCallback(() => {
    let completedWorkSession = false;
    let nextSession: SessionType = "work";
    setState((prev) => {
      let pomodorosSinceLongBreak = prev.pomodorosSinceLongBreak;
      let sessionType: SessionType = prev.sessionType;
      if (prev.sessionType === "work") {
        completedWorkSession = true;
        pomodorosSinceLongBreak += 1;
        if (pomodorosSinceLongBreak >= settings.longBreakInterval) {
          sessionType = "long_break";
          pomodorosSinceLongBreak = 0;
        } else {
          sessionType = "short_break";
        }
      } else {
        sessionType = "work";
      }
      nextSession = sessionType;
      return {
        sessionType,
        timeLeft: minutesToSeconds(sessionDurationMinutes(sessionType, settings)),
        isRunning: settings.autoStartNext,
        pomodorosSinceLongBreak,
      };
    });

    if (completedWorkSession) {
      setStats((prev) => {
        const key = todayKey();
        const result = (prev.byDay[key] ?? 0) + 1;
        const id = isClient()
          ? (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)
          : `${Date.now()}-${Math.random()}`;
        const newHistory: SessionLog[] = [
          {
            id,
            type: "work",
            completedAt: new Date().toISOString(),
            durationMinutes: sessionDurationMinutes("work", settings),
          },
          ...prev.history,
        ].slice(0, 50);

        return {
          byDay: {
            ...prev.byDay,
            [key]: result,
          },
          history: newHistory,
        };
      });
    }

    void playAlertSound();
    sendNotification(nextSession);
  }, [playAlertSound, sendNotification, setStats, settings]);

  React.useEffect(() => {
    if (!state.isRunning) return;
    const interval = window.setInterval(() => {
      setState((prev) => {
        if (!prev.isRunning) return prev;
        if (prev.timeLeft <= 1) {
          return {
            ...prev,
            timeLeft: 0,
            isRunning: false,
          };
        }
        return {
          ...prev,
          timeLeft: prev.timeLeft - 1,
        };
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [state.isRunning]);

  React.useEffect(() => {
    if (previousTime.current !== 0 && state.timeLeft === 0) {
      handleSessionComplete();
    }
    previousTime.current = state.timeLeft;
  }, [state.timeLeft, handleSessionComplete]);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const baseTitle = focusTitleRef.current;
    if (state.isRunning) {
      document.title = `${secondsToClock(state.timeLeft)} • ${SESSION_LABELS[state.sessionType]}`;
    } else {
      document.title = baseTitle;
    }
    return () => {
      document.title = baseTitle;
    };
  }, [state.isRunning, state.sessionType, state.timeLeft]);

  React.useEffect(() => {
    setState((prev) => {
      if (prev.isRunning) return prev;
      const recalculated = minutesToSeconds(
        sessionDurationMinutes(prev.sessionType, settings),
      );
      return {
        ...prev,
        timeLeft: recalculated,
      };
    });
  }, [settings.workDuration, settings.shortBreakDuration, settings.longBreakDuration]);

  const toggleRunning = React.useCallback(() => {
    setState((prev) => {
      const nextRunning = !prev.isRunning;
      if (nextRunning) {
        void ensureAudioContext();
      }
      if (prev.timeLeft === 0 && nextRunning) {
        return {
          ...prev,
          timeLeft: minutesToSeconds(
            sessionDurationMinutes(prev.sessionType, settings),
          ),
          isRunning: nextRunning,
        };
      }
      return {
        ...prev,
        isRunning: nextRunning,
      };
    });
  }, [ensureAudioContext, settings]);

  const resetTimer = React.useCallback(() => {
    setState({
      sessionType: "work",
      timeLeft: minutesToSeconds(settings.workDuration),
      isRunning: false,
      pomodorosSinceLongBreak: 0,
    });
  }, [settings.workDuration]);

  React.useEffect(() => {
    if (!isClient()) return;
    const handler = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isTyping =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute("contenteditable") === "true";
      if (isTyping) return;
      if (event.code === "Space") {
        event.preventDefault();
        toggleRunning();
      }
      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        resetTimer();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [resetTimer, toggleRunning]);

  const todayCount = stats.byDay[todayKey()] ?? 0;
  const upcomingFlow = React.useMemo(() => {
    const index = SESSION_FLOW_ORDER.findIndex((phase) => phase === state.sessionType);
    const cycle = SESSION_FLOW_ORDER.slice(index === -1 ? 0 : index);
    return [...cycle, ...SESSION_FLOW_ORDER].slice(0, 4);
  }, [state.sessionType]);

  const [pendingSettings, setPendingSettings] = React.useState(settings);
  React.useEffect(() => {
    if (!settingsOpen) return;
    setPendingSettings(settings);
  }, [settings, settingsOpen]);

  const handleSettingsSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSettings(pendingSettings);
    setSettingsOpen(false);
  };

  const handleExport = () => {
    if (!isClient()) return;
    const csv = createCsv(stats);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pomodoro-stats-${todayKey()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const weeklySeries = React.useMemo(
    () => getWeekSeries(stats.byDay),
    [stats.byDay],
  );
  const weeklyTotal = React.useMemo(
    () => weeklySeries.reduce((sum, item) => sum + item.value, 0),
    [weeklySeries],
  );
  const lifetimeTotal = React.useMemo(
    () => Object.values(stats.byDay).reduce((sum, value) => sum + value, 0),
    [stats.byDay],
  );
  const streak = React.useMemo(() => calculateStreak(stats.byDay), [stats.byDay]);
  const weeklyAverage = React.useMemo(
    () => Math.round(weeklyTotal / (weeklySeries.length || 1)),
    [weeklyTotal, weeklySeries.length],
  );

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 transition-colors dark:bg-zinc-950 dark:text-zinc-50">
      <header className="border-b border-zinc-200/80 bg-white/70 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
              FlowFocus
            </p>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Pomodoro Command Center
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <KeyboardLegend />
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">Settings</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Session Settings</DialogTitle>
                  <DialogDescription>
                    Customise your focus and recovery cycles. Changes persist to this device.
                  </DialogDescription>
                </DialogHeader>
                <form className="space-y-6 py-2" onSubmit={handleSettingsSubmit}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SettingField
                      id="work-duration"
                      label="Work duration"
                      description="Minutes per Pomodoro"
                      value={pendingSettings.workDuration}
                      onChange={(value) =>
                        setPendingSettings((prev) => ({ ...prev, workDuration: value }))
                      }
                    />
                    <SettingField
                      id="short-break"
                      label="Short break"
                      description="Recharge between sessions"
                      value={pendingSettings.shortBreakDuration}
                      onChange={(value) =>
                        setPendingSettings((prev) => ({ ...prev, shortBreakDuration: value }))
                      }
                    />
                    <SettingField
                      id="long-break"
                      label="Long break"
                      description="Recovery after a full cycle"
                      value={pendingSettings.longBreakDuration}
                      onChange={(value) =>
                        setPendingSettings((prev) => ({ ...prev, longBreakDuration: value }))
                      }
                    />
                    <SettingField
                      id="interval"
                      label="Pomodoros before long break"
                      description="Usually 4 sessions"
                      value={pendingSettings.longBreakInterval}
                      onChange={(value) =>
                        setPendingSettings((prev) => ({ ...prev, longBreakInterval: Math.max(1, value) }))
                      }
                    />
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <ToggleRow
                      label="Auto-start next session"
                      description="Keep your momentum without manual tapping"
                      checked={pendingSettings.autoStartNext}
                      onChange={(checked) =>
                        setPendingSettings((prev) => ({ ...prev, autoStartNext: checked }))
                      }
                    />
                    <ToggleRow
                      label="Sound alerts"
                      description="Subtle chime at the end of each phase"
                      checked={pendingSettings.soundEnabled}
                      onChange={(checked) =>
                        setPendingSettings((prev) => ({ ...prev, soundEnabled: checked }))
                      }
                    />
                    <ToggleRow
                      label="Browser notifications"
                      description="Desktop notifications for focus transitions"
                      checked={pendingSettings.notificationsEnabled}
                      onChange={(checked) =>
                        setPendingSettings((prev) => ({ ...prev, notificationsEnabled: checked }))
                      }
                    />
                  </div>

                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="ghost" type="button">
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button type="submit">Save changes</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
        <Tabs defaultValue="timer">
          <TabsList className="justify-start gap-2 bg-zinc-100/80 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800/60 dark:ring-zinc-700">
            <TabsTrigger value="timer">Timer</TabsTrigger>
            <TabsTrigger value="stats">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="timer" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
            <Card className="relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-emerald-500">
                    {SESSION_LABELS[state.sessionType]}
                  </p>
                  <CardTitle className="text-3xl sm:text-4xl">
                    {secondsToClock(state.timeLeft)}
                  </CardTitle>
                  <CardDescription>{SESSION_DESCRIPTIONS[state.sessionType]}</CardDescription>
                </div>
                <div className="text-right text-sm text-zinc-400 dark:text-zinc-500">
                  <p>Today: {todayCount} pomodoros</p>
                  <p>Cycle: {state.pomodorosSinceLongBreak}/{settings.longBreakInterval}</p>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center gap-8 py-12">
                <CircularProgress progress={progress}>
                  <div className="flex flex-col items-center">
                    <span className="text-sm uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500">
                      Remaining
                    </span>
                    <span className="text-4xl font-semibold text-zinc-900 dark:text-zinc-50">
                      {secondsToClock(state.timeLeft)}
                    </span>
                  </div>
                </CircularProgress>

                <div className="flex flex-wrap items-center justify-center gap-4">
                  <Button size="lg" onClick={toggleRunning}>
                    {state.isRunning ? "Pause" : "Start"}
                  </Button>
                  <Button variant="outline" onClick={resetTimer}>
                    Reset
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
                    Upcoming
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {upcomingFlow.map((phase, index) => (
                      <span
                        key={`${phase}-${index}`}
                        className={cn(
                          "inline-flex items-center rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400",
                          index === 0 && "border-emerald-500 text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {SESSION_LABELS[phase]}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  Space → start/pause • R → reset
                </p>
              </CardFooter>
            </Card>

            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Daily pulse</CardTitle>
                  <CardDescription>Momentum snapshot for today</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex items-baseline justify-between">
                    <p className="text-4xl font-semibold text-emerald-500">
                      {todayCount}
                    </p>
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
                      Pomodoros
                    </p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <p className="font-medium">Cycle Planner</p>
                    <ul className="space-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                      <li>• Long break after {settings.longBreakInterval} focus blocks</li>
                      <li>• {settings.workDuration}′ focus | {settings.shortBreakDuration}′ short breaks</li>
                      <li>• {settings.longBreakDuration}′ long recovery</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent sessions</CardTitle>
                  <CardDescription>Last focus blocks you've completed</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    {stats.history.length === 0 ? (
                      <p className="text-zinc-500 dark:text-zinc-400">
                        No sessions logged yet. Your wins will appear here.
                      </p>
                    ) : (
                      stats.history.slice(0, 4).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900"
                        >
                          <div className="flex flex-col">
                            <span className="font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                              {SESSION_LABELS[item.type]}
                            </span>
                            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                              {new Date(item.completedAt).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <span className="text-zinc-500 dark:text-zinc-400">
                            {item.durationMinutes} min
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="stats">
            <InsightsPanel
              todayCount={todayCount}
              streak={streak}
              weeklySeries={weeklySeries}
              weeklyTotal={weeklyTotal}
              lifetimeTotal={lifetimeTotal}
              averagePerDay={weeklyAverage}
              onExport={handleExport}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function KeyboardLegend() {
  return (
    <div className="hidden items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-500 shadow-sm md:flex dark:border-zinc-800 dark:bg-zinc-950">
      <span className="font-mono text-[11px]">␣</span>
      <span>start / pause</span>
      <span className="ml-2 font-mono text-[11px]">R</span>
      <span>reset</span>
    </div>
  );
}

interface SettingFieldProps {
  id: string;
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
}

function SettingField({ id, label, description, value, onChange }: SettingFieldProps) {
  return (
    <div className="space-y-2">
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
      <Input
        id={id}
        type="number"
        min={DURATION_LIMITS.min}
        max={DURATION_LIMITS.max}
        value={value}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (Number.isNaN(parsed)) return;
          const clamped = Math.min(
            DURATION_LIMITS.max,
            Math.max(DURATION_LIMITS.min, parsed),
          );
          onChange(Math.round(clamped));
        }}
      />
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <p className="font-medium text-zinc-800 dark:text-zinc-100">{label}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

interface WeeklySeriesPoint {
  key: string;
  label: string;
  value: number;
}

interface InsightsPanelProps {
  todayCount: number;
  streak: number;
  weeklySeries: WeeklySeriesPoint[];
  weeklyTotal: number;
  lifetimeTotal: number;
  averagePerDay: number;
  onExport: () => void;
}

function InsightsPanel({
  todayCount,
  streak,
  weeklySeries,
  weeklyTotal,
  lifetimeTotal,
  averagePerDay,
  onExport,
}: InsightsPanelProps) {
  const maxValue = Math.max(1, ...weeklySeries.map((item) => item.value));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Weekly rhythm</CardTitle>
          <CardDescription>Your last seven days of focused effort</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-7 gap-2">
            {weeklySeries.map((point) => {
              const height = `${(point.value / maxValue) * 100}%`;
              return (
                <div key={point.key} className="flex flex-col items-center gap-2">
                  <div className="flex h-40 w-full items-end justify-center rounded-full bg-zinc-100 dark:bg-zinc-900">
                    <div
                      className="w-full rounded-full bg-emerald-500 transition-all"
                      style={{ height }}
                    />
                  </div>
                  <span className="text-xs uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
                    {point.label}
                  </span>
                  <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                    {point.value}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Focus stats</CardTitle>
            <CardDescription>Quick metrics for accountability</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <StatTile label="Today" value={todayCount} description="Pomodoros" />
            <StatTile label="Weekly" value={weeklyTotal} description="Completed cycles" />
            <StatTile label="Streak" value={streak} description="Days in a row" />
            <StatTile label="Lifetime" value={lifetimeTotal} description="All-time" />
          </CardContent>
          <CardFooter className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
            <Button variant="outline" onClick={onExport}>
              Export CSV
            </Button>
            <span>Avg/day (7d): {averagePerDay}</span>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

interface StatTileProps {
  label: string;
  value: number;
  description: string;
}

function StatTile({ label, value, description }: StatTileProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-emerald-500">{value}</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
    </div>
  );
}
