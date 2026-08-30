"use client";

import React from "react";
import { collection, onSnapshot, query, addDoc, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

/* ── fine policy (single source of truth) ─────────────────────────────────── */

export const FINE_PER_DAY = 50;
export const GRACE_DAYS = 0;
export const CURRENCY = "PKR";

export function daysLate(dueDate: Date | null, at: Date = new Date()) {
  if (!dueDate) return 0;
  const ms = at.getTime() - dueDate.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86400000);
}

export function calcFine(dueDate: Date | null, at: Date = new Date()) {
  const late = Math.max(0, daysLate(dueDate, at) - GRACE_DAYS);
  return late * FINE_PER_DAY;
}

export function money(n: number) {
  return `${CURRENCY} ${Math.round(n).toLocaleString()}`;
}

/* ── firestore timestamp helpers ──────────────────────────────────────────── */

export type Stamp = { seconds: number } | null | undefined;

export function toDate(s: Stamp): Date | null {
  if (!s || typeof s.seconds !== "number") return null;
  return new Date(s.seconds * 1000);
}

export function fmtDate(s: Stamp | Date | null) {
  const d = s instanceof Date ? s : toDate(s as Stamp);
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(s: Stamp | Date | null) {
  const d = s instanceof Date ? s : toDate(s as Stamp);
  if (!d) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/* ── live collection subscription ─────────────────────────────────────────── */

export function useCollection<T = Record<string, unknown>>(name: string) {
  const [rows, setRows] = React.useState<Array<T & { id: string }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>("");

  React.useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      query(collection(db, name)),
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T & { id: string }));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [name]);

  return { rows, loading, error };
}

/* ── CSV export ───────────────────────────────────────────────────────────── */

export function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── audit trail ──────────────────────────────────────────────────────────── */

export async function logActivity(
  action: string,
  detail: string,
  actor: string,
  meta: Record<string, unknown> = {}
) {
  try {
    await addDoc(collection(db, "auditLogs"), {
      action,
      detail,
      actor: actor || "system",
      at: Timestamp.now(),
      ...meta,
    });
  } catch (err) {
    console.error("audit log failed:", err);
  }
}

/* ── printing ─────────────────────────────────────────────────────────────── */

export function printNode(node: HTMLElement | null, title = "Document") {
  if (!node) return;
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:ui-sans-serif,system-ui,Segoe UI,Arial,sans-serif;color:#0f172a;padding:40px;margin:0}
      h1,h2,h3{margin:0 0 8px}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #cbd5e1;padding:8px 10px;text-align:left;font-size:12px}
      th{background:#f1f5f9}
      .muted{color:#64748b;font-size:12px}
    </style></head><body>${node.innerHTML}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 300);
}
