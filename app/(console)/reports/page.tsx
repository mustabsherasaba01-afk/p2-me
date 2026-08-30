"use client";

import React from "react";
import { Download, BarChart3, Printer } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import ConsoleShell from "../_components/ConsoleShell";
import { Card, Select, SecondaryButton } from "../_components/ui";
import { StatCard, SkeletonRows, EmptyState } from "../_components/bits";
import {
  useCollection,
  toDate,
  fmtDate,
  calcFine,
  money,
  exportCsv,
  printNode,
} from "../_components/helpers";

type Txn = {
  studentUniId?: string;
  studentName?: string;
  bookTitle?: string;
  bookIsbn?: string;
  issuedAt?: { seconds: number } | null;
  dueDate?: { seconds: number } | null;
  status?: string;
  fine?: number;
  finePaid?: boolean;
};

type Student = { studentId?: string; name?: string; department?: string; status?: string };

const PIE_COLORS = ["#0284c7", "#0891b2", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#ca8a04", "#64748b"];

export default function Page() {
  return (
    <ConsoleShell
      title="Reports & Analytics"
      subtitle="Circulation trends, most-borrowed titles, department usage, and the defaulters register — all exportable."
    >
      <Body />
    </ConsoleShell>
  );
}

function Body() {
  const { rows: txns, loading } = useCollection<Txn>("transactions");
  const { rows: students } = useCollection<Student>("students");
  const [months, setMonths] = React.useState("6");
  const printRef = React.useRef<HTMLDivElement>(null);

  const deptOf = React.useMemo(() => {
    const m = new Map<string, string>();
    students.forEach((s) => s.studentId && m.set(s.studentId, s.department || "Unassigned"));
    return m;
  }, [students]);

  const windowStart = React.useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - Number(months));
    d.setHours(0, 0, 0, 0);
    return d;
  }, [months]);

  const inWindow = React.useMemo(
    () =>
      txns.filter((t) => {
        const at = toDate(t.issuedAt);
        return at ? at >= windowStart : false;
      }),
    [txns, windowStart]
  );

  /* monthly circulation */
  const monthly = React.useMemo(() => {
    const buckets: { key: string; label: string; issued: number; returned: number }[] = [];
    const now = new Date();
    for (let i = Number(months) - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString("en-GB", { month: "short" }),
        issued: 0,
        returned: 0,
      });
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    txns.forEach((t) => {
      const at = toDate(t.issuedAt);
      if (at) {
        const i = idx.get(`${at.getFullYear()}-${at.getMonth()}`);
        if (i !== undefined) buckets[i].issued++;
      }
      if (t.status === "returned") {
        const r = toDate(t.dueDate);
        if (r) {
          const i = idx.get(`${r.getFullYear()}-${r.getMonth()}`);
          if (i !== undefined) buckets[i].returned++;
        }
      }
    });
    return buckets;
  }, [txns, months]);

  /* most issued titles */
  const topBooks = React.useMemo(() => {
    const m = new Map<string, { title: string; isbn: string; count: number }>();
    inWindow.forEach((t) => {
      const k = t.bookIsbn || t.bookTitle || "—";
      const cur = m.get(k) || { title: t.bookTitle || "Untitled", isbn: t.bookIsbn || "—", count: 0 };
      cur.count++;
      m.set(k, cur);
    });
    return [...m.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  }, [inWindow]);

  /* department-wise */
  const byDept = React.useMemo(() => {
    const m = new Map<string, number>();
    inWindow.forEach((t) => {
      const d = deptOf.get(t.studentUniId || "") || "Unassigned";
      m.set(d, (m.get(d) || 0) + 1);
    });
    return [...m.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [inWindow, deptOf]);

  /* defaulters */
  const defaulters = React.useMemo(() => {
    const m = new Map<string, { name: string; id: string; dept: string; books: number; fine: number }>();
    txns.forEach((t) => {
      const due = toDate(t.dueDate);
      const amount = t.status === "active" ? calcFine(due) : t.fine ?? 0;
      if (amount <= 0 || t.finePaid) return;
      const key = t.studentUniId || "—";
      const cur = m.get(key) || {
        name: t.studentName || "—",
        id: key,
        dept: deptOf.get(key) || "—",
        books: 0,
        fine: 0,
      };
      cur.books++;
      cur.fine += amount;
      m.set(key, cur);
    });
    return [...m.values()].sort((a, b) => b.fine - a.fine);
  }, [txns, deptOf]);

  const activeLoans = txns.filter((t) => t.status === "active").length;
  const totalFine = defaulters.reduce((s, d) => s + d.fine, 0);

  if (loading) {
    return (
      <Card title="Building reports…">
        <SkeletonRows n={6} />
      </Card>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={months} onChange={(e) => setMonths(e.target.value)} className="w-48">
          <option value="3">Last 3 months</option>
          <option value="6">Last 6 months</option>
          <option value="12">Last 12 months</option>
        </Select>
        <SecondaryButton onClick={() => printNode(printRef.current, "Library Report")}>
          <Printer size={14} /> Print full report
        </SecondaryButton>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Issues in period" value={inWindow.length} tone="blue" />
        <StatCard label="Active loans" value={activeLoans} tone="sky" />
        <StatCard label="Registered members" value={students.length} tone="emerald" />
        <StatCard label="Recoverable fines" value={money(totalFine)} tone="rose" sub={`${defaulters.length} defaulter(s)`} />
      </div>

      <div ref={printRef} className="flex flex-col gap-6">
        <Card title={`Circulation trend — last ${months} months`}>
          {monthly.every((m) => m.issued === 0) ? (
            <EmptyState
              icon={<BarChart3 size={22} />}
              title="No circulation data yet"
              hint="Issue a few books from the Check-out desk and the trend will populate here."
            />
          ) : (
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "#f1f5f9" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="issued" name="Issued" fill="#0284c7" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="returned" name="Returned" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card
            title="Most-borrowed titles"
            right={
              <SecondaryButton
                onClick={() =>
                  exportCsv("most-borrowed", ["Title", "ISBN", "Times issued"], topBooks.map((b) => [b.title, b.isbn, b.count]))
                }
              >
                <Download size={14} /> CSV
              </SecondaryButton>
            }
          >
            {topBooks.length === 0 ? (
              <EmptyState icon={<BarChart3 size={22} />} title="No issues in this period" hint="Widen the date range or issue some books." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="py-2 text-left font-medium">#</th>
                      <th className="py-2 text-left font-medium">Title</th>
                      <th className="py-2 text-right font-medium">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topBooks.map((b, i) => (
                      <tr key={b.isbn + i} className="border-b last:border-0">
                        <td className="py-2 text-slate-400">{i + 1}</td>
                        <td className="py-2">
                          <div className="text-slate-900">{b.title}</div>
                          <div className="text-xs text-slate-500">{b.isbn}</div>
                        </td>
                        <td className="py-2 text-right font-semibold text-slate-900">{b.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            title="Circulation by department"
            right={
              <SecondaryButton
                onClick={() => exportCsv("by-department", ["Department", "Issues"], byDept.map((d) => [d.name, d.value]))}
              >
                <Download size={14} /> CSV
              </SecondaryButton>
            }
          >
            {byDept.length === 0 ? (
              <EmptyState icon={<BarChart3 size={22} />} title="No department data" hint="Department is taken from each member's profile." />
            ) : (
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byDept} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                      {byDept.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>

        <Card
          title={`Defaulters register (${defaulters.length})`}
          right={
            <SecondaryButton
              onClick={() =>
                exportCsv(
                  "defaulters",
                  ["Student", "Student ID", "Department", "Overdue items", "Fine due"],
                  defaulters.map((d) => [d.name, d.id, d.dept, d.books, d.fine])
                )
              }
            >
              <Download size={14} /> CSV
            </SecondaryButton>
          }
        >
          {defaulters.length === 0 ? (
            <EmptyState icon={<BarChart3 size={22} />} title="No defaulters" hint="Every member is currently within their due date with no unpaid fine." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-2 text-left font-medium">Member</th>
                    <th className="py-2 text-left font-medium">Department</th>
                    <th className="py-2 text-right font-medium">Overdue items</th>
                    <th className="py-2 text-right font-medium">Fine due</th>
                  </tr>
                </thead>
                <tbody>
                  {defaulters.map((d) => (
                    <tr key={d.id} className="border-b last:border-0">
                      <td className="py-2">
                        <div className="font-medium text-slate-900">{d.name}</div>
                        <div className="text-xs text-slate-500">{d.id}</div>
                      </td>
                      <td className="py-2 text-slate-600">{d.dept}</td>
                      <td className="py-2 text-right text-slate-900">{d.books}</td>
                      <td className="py-2 text-right font-semibold text-rose-700">{money(d.fine)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <p className="text-xs text-slate-400">
          Report generated on {fmtDate(new Date())} — LSIT Central Library.
        </p>
      </div>
    </>
  );
}
