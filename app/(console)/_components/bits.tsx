"use client";

import React from "react";

export function StatCard({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  tone: "amber" | "sky" | "rose" | "emerald" | "slate" | "blue";
  sub?: string;
}) {
  const tones: Record<string, string> = {
    amber: "bg-amber-50 text-amber-700",
    sky: "bg-sky-50 text-sky-700",
    rose: "bg-rose-50 text-rose-700",
    emerald: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-50 text-blue-700",
  };
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-2 inline-flex items-baseline rounded-xl px-2.5 py-1 text-2xl font-semibold ${tones[tone]}`}>
        {value}
      </div>
      {sub && <div className="mt-1.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function SkeletonRows({ n = 4 }: { n?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <div className="grid place-items-center gap-2 py-12 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-400">{icon}</div>
      <div className="text-sm font-semibold text-slate-800">{title}</div>
      <div className="max-w-sm text-xs text-slate-500">{hint}</div>
    </div>
  );
}

/** Dismissible inline alert used for success / error feedback on the new pages. */
export function Alert({
  tone,
  children,
  onClose,
}: {
  tone: "success" | "error" | "info";
  children: React.ReactNode;
  onClose?: () => void;
}) {
  const tones = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    error: "bg-rose-50 border-rose-200 text-rose-800",
    info: "bg-sky-50 border-sky-200 text-sky-800",
  };
  return (
    <div className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>
      <div>{children}</div>
      {onClose && (
        <button onClick={onClose} className="shrink-0 text-xs opacity-60 hover:opacity-100">
          Dismiss
        </button>
      )}
    </div>
  );
}
