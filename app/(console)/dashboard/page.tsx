"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, BookPlus, Plus, ShieldCheck, Clock, Activity, Users } from "lucide-react";
import ConsoleShell from "../_components/ConsoleShell";
import { Badge, Card, MiniBar, Pill } from "../_components/ui";
import { useConsole } from "../_components/ConsoleContext";
import { collection, onSnapshot, query, where, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

type Stat = {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down";
  sub?: string;
};

type TxnRow = {
  id: string;
  studentName: string;
  studentUniId: string;
  bookIsbn: string;
  bookTitle: string;
  dueDate: { seconds: number } | null;
  status: "active" | "returned" | "overdue";
  fine: number;
};

export default function Page() {
  return (
    <ConsoleShell
      title="Dashboard"
      subtitle="Track circulation, overdue risk, member growth, and fee collections."
      rightActions={
        <>
          <Link
            href="/add-books"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Book
          </Link>
        </>
      }
    >
      <DashboardContent />
    </ConsoleShell>
  );
}

function FirestoreSummary() {
  const [bookCount, setBookCount] = React.useState<number | null>(null);
  const [memberCount, setMemberCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    const unsubBooks = onSnapshot(collection(db, "books"), (s) => setBookCount(s.size));
    const unsubMembers = onSnapshot(collection(db, "students"), (s) => setMemberCount(s.size));
    return () => { unsubBooks(); unsubMembers(); };
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Link
        href="/inventory"
        className="rounded-2xl border bg-white shadow-sm p-4 flex items-center gap-4 hover:border-sky-200 hover:shadow-md transition-all group"
      >
        <div className="h-11 w-11 rounded-xl bg-sky-100 text-sky-700 grid place-items-center flex-shrink-0 group-hover:bg-sky-200 transition-colors">
          <BookPlus className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Books in Library</div>
          <div className="text-2xl font-bold text-slate-900 mt-0.5">
            {bookCount === null ? "…" : bookCount}
          </div>
          <div className="text-[11px] text-slate-400">added via admin console</div>
        </div>
      </Link>

      <Link
        href="/members"
        className="rounded-2xl border bg-white shadow-sm p-4 flex items-center gap-4 hover:border-emerald-200 hover:shadow-md transition-all group"
      >
        <div className="h-11 w-11 rounded-xl bg-emerald-100 text-emerald-700 grid place-items-center flex-shrink-0 group-hover:bg-emerald-200 transition-colors">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Registered Members</div>
          <div className="text-2xl font-bold text-slate-900 mt-0.5">
            {memberCount === null ? "…" : memberCount}
          </div>
          <div className="text-[11px] text-slate-400">students &amp; staff</div>
        </div>
      </Link>
    </div>
  );
}

function DashboardContent() {
  const { search } = useConsole();
  const [allTxns, setAllTxns] = React.useState<TxnRow[]>([]);
  const [txnsLoading, setTxnsLoading] = React.useState(true);

  React.useEffect(() => {
    const q = query(collection(db, "transactions"));
    return onSnapshot(q, (snap) => {
      setAllTxns(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TxnRow)));
      setTxnsLoading(false);
    });
  }, []);

  const now = new Date();

  const borrowed = allTxns.filter((t) => t.status === "active" || t.status === "overdue");
  const returned = allTxns.filter((t) => t.status === "returned");
  const overdue = allTxns.filter(
    (t) => t.status === "active" && t.dueDate && new Date(t.dueDate.seconds * 1000) < now
  );

  const STATS: Stat[] = [
    { label: "Borrowed Books", value: String(borrowed.length), delta: `${borrowed.length}`, trend: "up", sub: "currently on loan" },
    { label: "Returned Books", value: String(returned.length), delta: `${returned.length}`, trend: "up", sub: "all time" },
    { label: "Overdue Books", value: String(overdue.length), delta: `${overdue.length}`, trend: overdue.length > 0 ? "up" : "down", sub: "needs follow-up" },
    { label: "Total Transactions", value: String(allTxns.length), delta: `${allTxns.length}`, trend: "up", sub: "all time" },
  ];

  function daysOverdue(ts: { seconds: number }) {
    const d = Math.ceil((now.getTime() - new Date(ts.seconds * 1000).getTime()) / (24 * 60 * 60 * 1000));
    return `${d}d`;
  }

  const filteredOverdue = overdue.filter((r) => {
    if (!search) return true;
    return [r.studentName, r.bookTitle, r.bookIsbn, r.studentUniId].join(" ").toLowerCase().includes(search.toLowerCase());
  });

  return (
    <>
      <FirestoreSummary />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border bg-slate-50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-slate-700" />
            <div>
              <div className="text-sm font-semibold text-slate-900">System Health</div>
              <div className="text-xs text-slate-600">DB connected</div>
            </div>
          </div>
          <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded-full">Healthy</span>
        </div>

        <div className="rounded-2xl border bg-slate-50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-slate-700" />
            <div>
              <div className="text-sm font-semibold text-slate-900">Today</div>
              <div className="text-xs text-slate-600">{new Date().toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "short" })}</div>
            </div>
          </div>
          <span className="text-xs font-medium text-slate-700 bg-white border px-2 py-1 rounded-full">{allTxns.length} txns</span>
        </div>

        <div className="rounded-2xl border bg-slate-50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-slate-700" />
            <div>
              <div className="text-sm font-semibold text-slate-900">Circulation</div>
              <div className="text-xs text-slate-600">{borrowed.length} active loans</div>
            </div>
          </div>
          <span className="text-xs font-medium text-slate-900 bg-white border px-2 py-1 rounded-full">
            {allTxns.length > 0 ? Math.round((returned.length / allTxns.length) * 100) : 0}% returned
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATS.map((s, idx) => (
          <div key={s.label} className="rounded-2xl border bg-white shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-slate-500">{s.label}</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">
                  {txnsLoading ? "…" : s.value}
                </div>
                <div className="mt-1 text-xs text-slate-500">{s.sub}</div>
              </div>
              <Pill trend={s.trend} text={s.delta} />
            </div>
            <div className="mt-3">
              <MiniBar value={idx % 2 === 0 ? 74 - idx * 4 : 58 + idx * 5} />
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                <span>Target</span>
                <span>{idx % 2 === 0 ? "On track" : "Needs attention"}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Card
        title="Overdue Books"
        right={<span className="text-xs text-slate-500">{filteredOverdue.length} overdue</span>}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-xs text-slate-500">
                <th className="text-left font-medium py-2">Member</th>
                <th className="text-left font-medium py-2">Title</th>
                <th className="text-left font-medium py-2">Accession</th>
                <th className="text-left font-medium py-2">Days Late</th>
                <th className="text-left font-medium py-2">Fine</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {txnsLoading ? (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-400">Loading…</td></tr>
              ) : filteredOverdue.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-400">No overdue books.</td></tr>
              ) : (
                filteredOverdue.map((r) => {
                  const daysLate = r.dueDate ? Math.ceil((now.getTime() - new Date(r.dueDate.seconds * 1000).getTime()) / (24 * 60 * 60 * 1000)) : 0;
                  const fine = daysLate * 50;
                  return (
                    <tr key={r.id} className="text-slate-700">
                      <td className="py-2">
                        <div className="font-medium text-slate-900">{r.studentName}</div>
                        <div className="text-xs text-slate-500">{r.studentUniId}</div>
                      </td>
                      <td className="py-2">{r.bookTitle}</td>
                      <td className="py-2">{r.bookIsbn}</td>
                      <td className="py-2">
                        <Badge text={`${daysLate}d`} />
                      </td>
                      <td className="py-2 text-rose-700 font-medium">PKR {fine}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <Link href="/checkout" className="text-xs text-blue-700 hover:text-blue-800 inline-flex items-center gap-1">
            Go to Check-out / Returns <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Card>
    </>
  );
}
