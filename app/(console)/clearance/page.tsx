"use client";

import React from "react";
import { ShieldCheck, Printer, Search, AlertTriangle } from "lucide-react";
import ConsoleShell from "../_components/ConsoleShell";
import { Badge, Card, Input, PrimaryButton, SecondaryButton } from "../_components/ui";
import { EmptyState, Alert } from "../_components/bits";
import {
  useCollection,
  fmtDate,
  toDate,
  calcFine,
  money,
  logActivity,
  printNode,
} from "../_components/helpers";
import { useAuth } from "../../lib/authContext";

type Student = {
  studentId?: string;
  name?: string;
  department?: string;
  type?: string;
  email?: string;
  status?: string;
};

type Txn = {
  studentUniId?: string;
  bookTitle?: string;
  bookIsbn?: string;
  dueDate?: { seconds: number } | null;
  status?: string;
  fine?: number;
  finePaid?: boolean;
};

export default function Page() {
  return (
    <ConsoleShell
      title="Library Clearance (No-Dues)"
      subtitle="Verify a member has no books outstanding and no unpaid fines, then issue a printable no-dues certificate."
    >
      <Body />
    </ConsoleShell>
  );
}

function Body() {
  const { rows: students } = useCollection<Student>("students");
  const { rows: txns } = useCollection<Txn>("transactions");
  const { user } = useAuth();
  const actor = user?.role === "admin" ? user.email : "admin";

  const [term, setTerm] = React.useState("");
  const [selected, setSelected] = React.useState<(Student & { id: string }) | null>(null);
  const [issued, setIssued] = React.useState<string | null>(null);
  const certRef = React.useRef<HTMLDivElement>(null);

  const q = term.trim().toLowerCase();
  const matches = q
    ? students
        .filter((s) =>
          [s.name, s.studentId, s.department].some((v) => (v || "").toLowerCase().includes(q))
        )
        .slice(0, 8)
    : [];

  const dues = React.useMemo(() => {
    if (!selected) return { books: [], unpaid: [], totalFine: 0, clear: false };
    const mine = txns.filter((t) => t.studentUniId === selected.studentId);
    const books = mine.filter((t) => t.status === "active");
    const unpaid = mine
      .map((t) => {
        const due = toDate(t.dueDate);
        const amount = t.status === "active" ? calcFine(due) : t.fine ?? 0;
        return { ...t, due, amount };
      })
      .filter((t) => t.amount > 0 && !t.finePaid);
    const totalFine = unpaid.reduce((s, t) => s + t.amount, 0);
    return { books, unpaid, totalFine, clear: books.length === 0 && totalFine === 0 };
  }, [selected, txns]);

  async function issueCertificate() {
    if (!selected) return;
    const certNo = `NDC-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    setIssued(certNo);
    await logActivity(
      "Clearance issued",
      `No-dues certificate ${certNo} for ${selected.name} (${selected.studentId})`,
      actor
    );
  }

  return (
    <>
      <Card title="Find a member">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-64 flex-1">
            <Input
              label="Search by name, student ID, or department"
              placeholder="e.g. 2021-CS-101 or Ayesha"
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setSelected(null);
                setIssued(null);
              }}
            />
          </div>
          <SecondaryButton onClick={() => { setTerm(""); setSelected(null); setIssued(null); }}>
            Clear
          </SecondaryButton>
        </div>

        {q && matches.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">No member matches “{term}”.</p>
        )}

        {matches.length > 0 && !selected && (
          <div className="mt-3 divide-y rounded-xl border">
            {matches.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-slate-50"
              >
                <span>
                  <span className="font-medium text-slate-900">{s.name}</span>
                  <span className="ml-2 text-xs text-slate-500">{s.studentId}</span>
                </span>
                <span className="text-xs text-slate-500">{s.department || "—"}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {!selected ? (
        <Card>
          <EmptyState
            icon={<Search size={22} />}
            title="Select a member to run a clearance check"
            hint="The system checks for books still on loan and any unpaid fine before allowing a certificate to be issued."
          />
        </Card>
      ) : (
        <>
          <Card
            title={`Clearance check — ${selected.name} (${selected.studentId})`}
            right={
              dues.clear ? (
                <Badge text="CLEAR" className="border-emerald-200 bg-emerald-50 font-semibold text-emerald-700" />
              ) : (
                <Badge text="NOT CLEAR" className="border-rose-200 bg-rose-50 font-semibold text-rose-700" />
              )
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Books still on loan
                </div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">{dues.books.length}</div>
                {dues.books.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    {dues.books.map((b) => (
                      <li key={b.id}>• {b.bookTitle} <span className="text-slate-400">({b.bookIsbn})</span></li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-xl border p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Unpaid fines
                </div>
                <div className={`mt-1 text-2xl font-semibold ${dues.totalFine > 0 ? "text-rose-700" : "text-slate-900"}`}>
                  {money(dues.totalFine)}
                </div>
                {dues.unpaid.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    {dues.unpaid.map((b) => (
                      <li key={b.id}>• {b.bookTitle} — {money(b.amount)} (due {fmtDate(b.due)})</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-4">
              {dues.clear ? (
                <PrimaryButton onClick={issueCertificate}>
                  <ShieldCheck size={14} /> Issue no-dues certificate
                </PrimaryButton>
              ) : (
                <Alert tone="error">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <span>
                      Clearance blocked. The member must return {dues.books.length} book(s) and settle{" "}
                      {money(dues.totalFine)} in fines. Collect payment from the{" "}
                      <strong>Fines &amp; Payments</strong> page first.
                    </span>
                  </div>
                </Alert>
              )}
            </div>
          </Card>

          {issued && (
            <Card
              title="No-dues certificate"
              right={
                <PrimaryButton onClick={() => printNode(certRef.current, `No-Dues ${issued}`)}>
                  <Printer size={14} /> Print / Save as PDF
                </PrimaryButton>
              }
            >
              <div ref={certRef}>
                <h2 style={{ fontSize: 20, fontWeight: 700, textAlign: "center" }}>
                  LAHORE SCHOOL OF INNOVATION AND TECHNOLOGY
                </h2>
                <h3 style={{ fontSize: 15, fontWeight: 600, textAlign: "center", marginTop: 4 }}>
                  Central Library — No-Dues Certificate
                </h3>
                <p style={{ textAlign: "center", color: "#64748b", fontSize: 12, marginTop: 6 }}>
                  Certificate No. {issued}
                </p>
                <p style={{ marginTop: 24, lineHeight: 1.8, fontSize: 14 }}>
                  This is to certify that <strong>{selected.name}</strong>, bearing student
                  registration number <strong>{selected.studentId}</strong>
                  {selected.department ? <> of the Department of <strong>{selected.department}</strong></> : null},
                  has returned all library material issued in their name and has no outstanding
                  fine or dues payable to the Central Library as on{" "}
                  <strong>{fmtDate(new Date())}</strong>.
                </p>
                <p style={{ marginTop: 12, lineHeight: 1.8, fontSize: 14 }}>
                  This certificate is issued on the member’s request for the purpose of degree
                  clearance / semester completion.
                </p>
                <table style={{ marginTop: 28 }}>
                  <tbody>
                    <tr><th style={{ width: 200 }}>Books on loan</th><td>Nil</td></tr>
                    <tr><th>Outstanding fine</th><td>Nil</td></tr>
                    <tr><th>Issued by</th><td>{actor}</td></tr>
                    <tr><th>Date of issue</th><td>{fmtDate(new Date())}</td></tr>
                  </tbody>
                </table>
                <p style={{ color: "#64748b", fontSize: 12, marginTop: 40 }}>
                  ____________________________<br />
                  Librarian, LSIT Central Library
                </p>
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}
