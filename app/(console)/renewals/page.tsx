"use client";

import React from "react";
import { RefreshCw, Download, CalendarClock } from "lucide-react";
import ConsoleShell from "../_components/ConsoleShell";
import { Badge, Card, Input, Select, PrimaryButton, SecondaryButton } from "../_components/ui";
import { StatCard, SkeletonRows, EmptyState, Alert } from "../_components/bits";
import {
  useCollection,
  fmtDate,
  toDate,
  daysLate,
  calcFine,
  money,
  exportCsv,
  logActivity,
} from "../_components/helpers";
import { useAuth } from "../../lib/authContext";
import { doc, updateDoc, Timestamp, increment } from "firebase/firestore";
import { db } from "../../lib/firebase";

type Txn = {
  studentName?: string;
  studentUniId?: string;
  bookTitle?: string;
  bookIsbn?: string;
  issuedAt?: { seconds: number } | null;
  dueDate?: { seconds: number } | null;
  status?: string;
  renewals?: number;
};

const MAX_RENEWALS = 2;
const EXTEND_DAYS = 7;

export default function Page() {
  return (
    <ConsoleShell
      title="Renewals & Due Dates"
      subtitle={`Extend an active loan by ${EXTEND_DAYS} days. A loan may be renewed up to ${MAX_RENEWALS} times and never while overdue.`}
    >
      <Body />
    </ConsoleShell>
  );
}

function Body() {
  const { rows, loading, error } = useCollection<Txn>("transactions");
  const { user } = useAuth();
  const actor = user?.role === "admin" ? user.email : "admin";

  const [search, setSearch] = React.useState("");
  const [view, setView] = React.useState("All");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ tone: "success" | "error"; text: string } | null>(null);

  const active = React.useMemo(
    () =>
      rows
        .filter((r) => r.status === "active")
        .map((r) => {
          const due = toDate(r.dueDate);
          const late = daysLate(due);
          const daysToDue = due ? Math.ceil((due.getTime() - Date.now()) / 86400000) : 0;
          return {
            ...r,
            due,
            late,
            daysToDue,
            renewals: r.renewals ?? 0,
            canRenew: late === 0 && (r.renewals ?? 0) < MAX_RENEWALS,
          };
        })
        .sort((a, b) => (a.due?.getTime() ?? 0) - (b.due?.getTime() ?? 0)),
    [rows]
  );

  const filtered = active.filter((r) => {
    if (view === "Due soon" && !(r.late === 0 && r.daysToDue <= 3)) return false;
    if (view === "Overdue" && r.late === 0) return false;
    if (view === "Renewable" && !r.canRenew) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [r.studentName, r.studentUniId, r.bookTitle, r.bookIsbn].some((v) =>
      (v || "").toLowerCase().includes(q)
    );
  });

  async function renew(r: (typeof active)[number]) {
    if (!r.due) return;
    setBusy(r.id);
    setMsg(null);
    try {
      const newDue = new Date(r.due.getTime() + EXTEND_DAYS * 86400000);
      await updateDoc(doc(db, "transactions", r.id), {
        dueDate: Timestamp.fromDate(newDue),
        renewals: increment(1),
        lastRenewedAt: Timestamp.now(),
      });
      await logActivity(
        "Loan renewed",
        `"${r.bookTitle}" for ${r.studentName} (${r.studentUniId}) — new due date ${fmtDate(newDue)}`,
        actor
      );
      setMsg({
        tone: "success",
        text: `Renewed "${r.bookTitle}" for ${r.studentName}. New due date: ${fmtDate(newDue)}.`,
      });
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const dueSoon = active.filter((r) => r.late === 0 && r.daysToDue <= 3).length;
  const overdue = active.filter((r) => r.late > 0).length;
  const renewable = active.filter((r) => r.canRenew).length;

  return (
    <>
      {msg && <Alert tone={msg.tone} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Active loans" value={active.length} tone="blue" />
        <StatCard label="Due within 3 days" value={dueSoon} tone="amber" />
        <StatCard label="Overdue" value={overdue} tone="rose" sub="Cannot be renewed" />
        <StatCard label="Renewable now" value={renewable} tone="emerald" />
      </div>

      <Card
        title={`Active loans (${filtered.length})`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search student or book…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56"
            />
            <Select value={view} onChange={(e) => setView(e.target.value)} className="w-40">
              {["All", "Due soon", "Overdue", "Renewable"].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </Select>
            <SecondaryButton
              onClick={() =>
                exportCsv(
                  "active-loans",
                  ["Student", "Student ID", "Book", "ISBN", "Issued", "Due", "Days late", "Renewals"],
                  filtered.map((r) => [
                    r.studentName || "",
                    r.studentUniId || "",
                    r.bookTitle || "",
                    r.bookIsbn || "",
                    fmtDate(r.issuedAt),
                    fmtDate(r.due),
                    r.late,
                    r.renewals,
                  ])
                )
              }
            >
              <Download size={14} /> CSV
            </SecondaryButton>
          </div>
        }
      >
        {error && <p className="text-sm text-rose-600">Could not load loans: {error}</p>}
        {loading ? (
          <SkeletonRows />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<CalendarClock size={22} />}
            title="Nothing to show"
            hint="Active loans appear here once books are issued from the Check-out desk."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2 text-left font-medium">Student</th>
                  <th className="py-2 text-left font-medium">Book</th>
                  <th className="py-2 text-left font-medium">Issued</th>
                  <th className="py-2 text-left font-medium">Due</th>
                  <th className="py-2 text-left font-medium">Standing</th>
                  <th className="py-2 text-left font-medium">Renewals</th>
                  <th className="py-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2.5">
                      <div className="font-medium text-slate-900">{r.studentName || "—"}</div>
                      <div className="text-xs text-slate-500">{r.studentUniId}</div>
                    </td>
                    <td className="py-2.5">
                      <div className="text-slate-900">{r.bookTitle || "—"}</div>
                      <div className="text-xs text-slate-500">{r.bookIsbn}</div>
                    </td>
                    <td className="py-2.5 text-slate-600">{fmtDate(r.issuedAt)}</td>
                    <td className="py-2.5 text-slate-600">{fmtDate(r.due)}</td>
                    <td className="py-2.5">
                      {r.late > 0 ? (
                        <Badge
                          text={`${r.late}d late · ${money(calcFine(r.due))}`}
                          className="border-rose-200 bg-rose-50 text-rose-700"
                        />
                      ) : r.daysToDue <= 3 ? (
                        <Badge text={`due in ${Math.max(0, r.daysToDue)}d`} className="border-amber-200 bg-amber-50 text-amber-700" />
                      ) : (
                        <Badge text="on time" className="border-emerald-200 bg-emerald-50 text-emerald-700" />
                      )}
                    </td>
                    <td className="py-2.5 text-slate-600">
                      {r.renewals} / {MAX_RENEWALS}
                    </td>
                    <td className="py-2.5 text-right">
                      <PrimaryButton disabled={!r.canRenew || busy === r.id} onClick={() => renew(r)}>
                        <RefreshCw size={14} />
                        {busy === r.id ? "Renewing…" : `+${EXTEND_DAYS} days`}
                      </PrimaryButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
