"use client";

import React from "react";
import { BookMarked, Check, X, Clock, Download } from "lucide-react";
import ConsoleShell from "../_components/ConsoleShell";
import { Badge, Card, Input, Select, PrimaryButton, SecondaryButton } from "../_components/ui";
import { StatCard, SkeletonRows, EmptyState } from "../_components/bits";
import { useCollection, fmtDateTime, toDate, exportCsv, logActivity } from "../_components/helpers";
import { useAuth } from "../../lib/authContext";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

type Booking = {
  studentName?: string;
  studentUniId?: string;
  bookTitle?: string;
  bookIsbn?: string;
  bookAuthor?: string;
  requestedAt?: { seconds: number } | null;
  readyAt?: { seconds: number } | null;
  status?: string;
};

const HOLD_DAYS = 3;

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ready: "bg-sky-50 text-sky-700 border-sky-200",
  collected: "bg-slate-100 text-slate-600 border-slate-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  expired: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function Page() {
  return (
    <ConsoleShell
      title="Reservations & Hold Queue"
      subtitle="Approve pre-book requests, track queue position, and release expired holds."
    >
      <Body />
    </ConsoleShell>
  );
}

function Body() {
  const { rows, loading, error } = useCollection<Booking>("bookings");
  const { user } = useAuth();
  const actor = user?.role === "admin" ? user.email : "admin";

  const [status, setStatus] = React.useState("All");
  const [search, setSearch] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  // Queue position = rank among open requests for the same ISBN, oldest first.
  const withQueue = React.useMemo(() => {
    const byIsbn = new Map<string, Array<Booking & { id: string }>>();
    rows
      .filter((r) => r.status === "pending" || r.status === "approved" || r.status === "ready")
      .forEach((r) => {
        const k = r.bookIsbn || "—";
        if (!byIsbn.has(k)) byIsbn.set(k, []);
        byIsbn.get(k)!.push(r);
      });
    byIsbn.forEach((list) =>
      list.sort((a, b) => (a.requestedAt?.seconds ?? 0) - (b.requestedAt?.seconds ?? 0))
    );
    const pos = new Map<string, number>();
    byIsbn.forEach((list) => list.forEach((r, i) => pos.set(r.id, i + 1)));

    return rows
      .map((r) => {
        const ready = toDate(r.readyAt);
        const expiresAt = ready ? new Date(ready.getTime() + HOLD_DAYS * 86400000) : null;
        return {
          ...r,
          queue: pos.get(r.id) ?? 0,
          expiresAt,
          expired: !!expiresAt && expiresAt < new Date() && r.status === "ready",
        };
      })
      .sort((a, b) => (b.requestedAt?.seconds ?? 0) - (a.requestedAt?.seconds ?? 0));
  }, [rows]);

  const filtered = withQueue.filter((r) => {
    if (status !== "All" && (r.status || "pending") !== status) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [r.studentName, r.studentUniId, r.bookTitle, r.bookIsbn].some((v) =>
      (v || "").toLowerCase().includes(q)
    );
  });

  const counts = {
    pending: withQueue.filter((r) => r.status === "pending").length,
    ready: withQueue.filter((r) => r.status === "ready").length,
    expired: withQueue.filter((r) => r.expired).length,
  };

  async function setStatusOf(b: Booking & { id: string }, next: string) {
    setBusy(b.id);
    try {
      const patch: Record<string, unknown> = { status: next };
      if (next === "ready") patch.readyAt = Timestamp.now();
      await updateDoc(doc(db, "bookings", b.id), patch);
      await logActivity(
        `Reservation ${next}`,
        `"${b.bookTitle}" for ${b.studentName} (${b.studentUniId})`,
        actor
      );
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending approval" value={counts.pending} tone="amber" sub="Awaiting librarian action" />
        <StatCard label="Ready for pickup" value={counts.ready} tone="sky" sub={`Held for ${HOLD_DAYS} days`} />
        <StatCard label="Expired holds" value={counts.expired} tone="rose" sub="Copy can be released" />
      </div>

      <Card
        title={`Hold queue (${filtered.length})`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search student or book…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56"
            />
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
              {["All", "pending", "approved", "ready", "collected", "rejected"].map((s) => (
                <option key={s} value={s}>
                  {s === "All" ? "All statuses" : s}
                </option>
              ))}
            </Select>
            <SecondaryButton
              onClick={() =>
                exportCsv(
                  "reservations",
                  ["Student", "Student ID", "Book", "ISBN", "Requested", "Queue", "Status"],
                  filtered.map((r) => [
                    r.studentName || "",
                    r.studentUniId || "",
                    r.bookTitle || "",
                    r.bookIsbn || "",
                    fmtDateTime(r.requestedAt),
                    r.queue || "",
                    r.status || "",
                  ])
                )
              }
            >
              <Download size={14} /> CSV
            </SecondaryButton>
          </div>
        }
      >
        {error && <p className="text-sm text-rose-600">Could not load reservations: {error}</p>}
        {loading ? (
          <SkeletonRows />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<BookMarked size={22} />}
            title="No reservations here"
            hint="Pre-book requests raised by students from the catalogue land in this queue."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2 text-left font-medium">Student</th>
                  <th className="py-2 text-left font-medium">Book</th>
                  <th className="py-2 text-left font-medium">Requested</th>
                  <th className="py-2 text-left font-medium">Queue</th>
                  <th className="py-2 text-left font-medium">Hold expires</th>
                  <th className="py-2 text-left font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b align-top last:border-0">
                    <td className="py-2.5">
                      <div className="font-medium text-slate-900">{r.studentName || "—"}</div>
                      <div className="text-xs text-slate-500">{r.studentUniId}</div>
                    </td>
                    <td className="py-2.5">
                      <div className="text-slate-900">{r.bookTitle || "—"}</div>
                      <div className="text-xs text-slate-500">{r.bookIsbn}</div>
                    </td>
                    <td className="py-2.5 text-slate-600">{fmtDateTime(r.requestedAt)}</td>
                    <td className="py-2.5">
                      {r.queue ? (
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-700">
                          #{r.queue}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 text-slate-600">
                      {r.expiresAt ? (
                        <span className={r.expired ? "font-medium text-rose-600" : ""}>
                          {fmtDateTime(r.expiresAt)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5">
                      <Badge
                        text={r.expired ? "expired" : r.status || "pending"}
                        className={STATUS_STYLE[r.expired ? "expired" : r.status || "pending"]}
                      />
                    </td>
                    <td className="py-2.5">
                      <div className="flex justify-end gap-1.5">
                        {r.status === "pending" && (
                          <>
                            <PrimaryButton disabled={busy === r.id} onClick={() => setStatusOf(r, "ready")}>
                              <Check size={14} /> Mark ready
                            </PrimaryButton>
                            <SecondaryButton
                              disabled={busy === r.id}
                              onClick={() => setStatusOf(r, "rejected")}
                              className="border-rose-200 text-rose-700 hover:bg-rose-50"
                            >
                              <X size={14} />
                            </SecondaryButton>
                          </>
                        )}
                        {r.status === "approved" && (
                          <PrimaryButton disabled={busy === r.id} onClick={() => setStatusOf(r, "ready")}>
                            <Clock size={14} /> Mark ready
                          </PrimaryButton>
                        )}
                        {r.status === "ready" && (
                          <PrimaryButton disabled={busy === r.id} onClick={() => setStatusOf(r, "collected")}>
                            <Check size={14} /> Collected
                          </PrimaryButton>
                        )}
                      </div>
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
