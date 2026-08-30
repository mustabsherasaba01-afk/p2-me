"use client";

import React from "react";
import { History, Download, ShieldAlert } from "lucide-react";
import ConsoleShell from "../_components/ConsoleShell";
import { Badge, Card, Input, Select, SecondaryButton } from "../_components/ui";
import { StatCard, SkeletonRows, EmptyState } from "../_components/bits";
import { useCollection, fmtDateTime, toDate, exportCsv } from "../_components/helpers";

type Log = {
  action?: string;
  detail?: string;
  actor?: string;
  at?: { seconds: number } | null;
};

function toneFor(action: string) {
  const a = action.toLowerCase();
  if (a.includes("lost") || a.includes("rejected") || a.includes("deleted")) return "border-rose-200 bg-rose-50 text-rose-700";
  if (a.includes("collected") || a.includes("clearance") || a.includes("renewed")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (a.includes("reminder") || a.includes("damaged")) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

export default function Page() {
  return (
    <ConsoleShell
      title="Audit Trail"
      subtitle="Every fine collected, renewal granted, reservation decision, and write-off — with who did it and when."
    >
      <Body />
    </ConsoleShell>
  );
}

function Body() {
  const { rows, loading, error } = useCollection<Log>("auditLogs");
  const [search, setSearch] = React.useState("");
  const [actor, setActor] = React.useState("All");
  const [range, setRange] = React.useState("30");

  const actors = React.useMemo(
    () => ["All", ...[...new Set(rows.map((r) => r.actor || "system"))].sort()],
    [rows]
  );

  const filtered = React.useMemo(() => {
    const cutoff = range === "all" ? null : new Date(Date.now() - Number(range) * 86400000);
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (actor !== "All" && (r.actor || "system") !== actor) return false;
        if (cutoff) {
          const at = toDate(r.at);
          if (!at || at < cutoff) return false;
        }
        if (!q) return true;
        return [r.action, r.detail, r.actor].some((v) => (v || "").toLowerCase().includes(q));
      })
      .sort((a, b) => (b.at?.seconds ?? 0) - (a.at?.seconds ?? 0));
  }, [rows, search, actor, range]);

  const today = rows.filter((r) => {
    const at = toDate(r.at);
    return at && at.toDateString() === new Date().toDateString();
  }).length;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total events logged" value={rows.length} tone="blue" />
        <StatCard label="Events today" value={today} tone="sky" />
        <StatCard label="Operators" value={Math.max(0, actors.length - 1)} tone="slate" />
      </div>

      <Card
        title={`Activity log (${filtered.length})`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search action or detail…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56"
            />
            <Select value={actor} onChange={(e) => setActor(e.target.value)} className="w-48">
              {actors.map((a) => (
                <option key={a} value={a}>{a === "All" ? "All operators" : a}</option>
              ))}
            </Select>
            <Select value={range} onChange={(e) => setRange(e.target.value)} className="w-36">
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All time</option>
            </Select>
            <SecondaryButton
              onClick={() =>
                exportCsv(
                  "audit-trail",
                  ["When", "Action", "Detail", "Operator"],
                  filtered.map((r) => [fmtDateTime(r.at), r.action || "", r.detail || "", r.actor || ""])
                )
              }
            >
              <Download size={14} /> CSV
            </SecondaryButton>
          </div>
        }
      >
        {error && <p className="text-sm text-rose-600">Could not load the audit trail: {error}</p>}
        {loading ? (
          <SkeletonRows n={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<History size={22} />}
            title="No activity recorded in this period"
            hint="Actions taken across Reservations, Renewals, Fines, Clearance, and Lost & Damaged are written here automatically."
          />
        ) : (
          <ol className="relative space-y-0">
            {filtered.map((r, i) => (
              <li key={r.id} className="relative flex gap-4 pb-5 last:pb-0">
                <div className="flex flex-col items-center">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500 ring-4 ring-sky-100" />
                  {i < filtered.length - 1 && <span className="w-px flex-1 bg-slate-200" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge text={r.action || "Event"} className={toneFor(r.action || "")} />
                    <span className="text-xs text-slate-400">{fmtDateTime(r.at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{r.detail}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                    <ShieldAlert size={11} /> {r.actor || "system"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}
