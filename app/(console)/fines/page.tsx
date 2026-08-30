"use client";

import React from "react";
import { Banknote, Download, Printer, Wallet } from "lucide-react";
import ConsoleShell from "../_components/ConsoleShell";
import { Badge, Card, Input, PrimaryButton, SecondaryButton } from "../_components/ui";
import { StatCard, SkeletonRows, EmptyState, Alert } from "../_components/bits";
import {
  useCollection,
  fmtDate,
  fmtDateTime,
  toDate,
  daysLate,
  calcFine,
  money,
  exportCsv,
  logActivity,
  printNode,
  FINE_PER_DAY,
} from "../_components/helpers";
import { useAuth } from "../../lib/authContext";
import { doc, updateDoc, addDoc, collection, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

type Txn = {
  studentDocId?: string;
  studentName?: string;
  studentUniId?: string;
  bookTitle?: string;
  bookIsbn?: string;
  dueDate?: { seconds: number } | null;
  returnedAt?: { seconds: number } | null;
  status?: string;
  fine?: number;
  finePaid?: boolean;
};

type Payment = {
  studentUniId?: string;
  studentName?: string;
  amount?: number;
  method?: string;
  receiptNo?: string;
  paidAt?: { seconds: number } | null;
  collectedBy?: string;
  txnId?: string;
  bookTitle?: string;
};

export default function Page() {
  return (
    <ConsoleShell
      title="Fines & Payments"
      subtitle={`Overdue fines accrue at ${money(FINE_PER_DAY)} per day. Collect payment here to clear a member's dues.`}
    >
      <Body />
    </ConsoleShell>
  );
}

function Body() {
  const { rows: txns, loading, error } = useCollection<Txn>("transactions");
  const { rows: payments } = useCollection<Payment>("payments");
  const { user } = useAuth();
  const actor = user?.role === "admin" ? user.email : "admin";

  const [tab, setTab] = React.useState<"outstanding" | "collected">("outstanding");
  const [search, setSearch] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [receipt, setReceipt] = React.useState<Payment | null>(null);
  const receiptRef = React.useRef<HTMLDivElement>(null);

  /* A fine is outstanding when the loan is overdue (still out) or was returned
     late and has not been marked paid. */
  const outstanding = React.useMemo(
    () =>
      txns
        .map((t) => {
          const due = toDate(t.dueDate);
          const live = t.status === "active" ? calcFine(due) : t.fine ?? 0;
          const late = t.status === "active" ? daysLate(due) : 0;
          return { ...t, due, amount: live, late };
        })
        .filter((t) => t.amount > 0 && !t.finePaid)
        .sort((a, b) => b.amount - a.amount),
    [txns]
  );

  const collected = React.useMemo(
    () => [...payments].sort((a, b) => (b.paidAt?.seconds ?? 0) - (a.paidAt?.seconds ?? 0)),
    [payments]
  );

  const q = search.trim().toLowerCase();
  const match = (...vals: Array<string | undefined>) =>
    !q || vals.some((v) => (v || "").toLowerCase().includes(q));

  const shownOutstanding = outstanding.filter((t) =>
    match(t.studentName, t.studentUniId, t.bookTitle, t.bookIsbn)
  );
  const shownCollected = collected.filter((p) =>
    match(p.studentName, p.studentUniId, p.receiptNo, p.bookTitle)
  );

  const totalDue = outstanding.reduce((s, t) => s + t.amount, 0);
  const totalCollected = collected.reduce((s, p) => s + (p.amount ?? 0), 0);
  const defaulters = new Set(outstanding.map((t) => t.studentUniId)).size;

  async function collect(t: (typeof outstanding)[number], method: string) {
    setBusy(t.id);
    setMsg(null);
    try {
      const receiptNo = `RCPT-${Date.now().toString().slice(-8)}`;
      const record: Payment = {
        studentUniId: t.studentUniId,
        studentName: t.studentName,
        amount: t.amount,
        method,
        receiptNo,
        paidAt: Timestamp.now() as unknown as { seconds: number },
        collectedBy: actor,
        txnId: t.id,
        bookTitle: t.bookTitle,
      };
      await addDoc(collection(db, "payments"), record);
      await updateDoc(doc(db, "transactions", t.id), { finePaid: true, fine: t.amount });
      await logActivity(
        "Fine collected",
        `${money(t.amount)} from ${t.studentName} (${t.studentUniId}) — receipt ${receiptNo}`,
        actor
      );
      setReceipt({ ...record, paidAt: { seconds: Math.floor(Date.now() / 1000) } });
      setMsg({ tone: "success", text: `Collected ${money(t.amount)}. Receipt ${receiptNo} generated.` });
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {msg && <Alert tone={msg.tone} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Outstanding dues" value={money(totalDue)} tone="rose" sub={`${outstanding.length} unpaid item(s)`} />
        <StatCard label="Members with dues" value={defaulters} tone="amber" sub="Blocked from clearance" />
        <StatCard label="Collected to date" value={money(totalCollected)} tone="emerald" sub={`${collected.length} receipt(s)`} />
      </div>

      {receipt && (
        <Card
          title="Payment receipt"
          right={
            <div className="flex gap-2">
              <PrimaryButton onClick={() => printNode(receiptRef.current, `Receipt ${receipt.receiptNo}`)}>
                <Printer size={14} /> Print
              </PrimaryButton>
              <SecondaryButton onClick={() => setReceipt(null)}>Close</SecondaryButton>
            </div>
          }
        >
          <div ref={receiptRef}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>LSIT LIBRARY — Fine Receipt</h2>
            <p className="muted" style={{ color: "#64748b", fontSize: 12 }}>
              Lahore School of Innovation and Technology
            </p>
            <table>
              <tbody>
                <tr><th style={{ width: 180 }}>Receipt No.</th><td>{receipt.receiptNo}</td></tr>
                <tr><th>Member</th><td>{receipt.studentName} ({receipt.studentUniId})</td></tr>
                <tr><th>Against</th><td>{receipt.bookTitle || "—"}</td></tr>
                <tr><th>Amount paid</th><td><strong>{money(receipt.amount ?? 0)}</strong></td></tr>
                <tr><th>Method</th><td>{receipt.method}</td></tr>
                <tr><th>Date</th><td>{fmtDateTime(receipt.paidAt)}</td></tr>
                <tr><th>Collected by</th><td>{receipt.collectedBy}</td></tr>
              </tbody>
            </table>
            <p className="muted" style={{ color: "#64748b", fontSize: 12, marginTop: 16 }}>
              This is a computer-generated receipt and is valid without a signature.
            </p>
          </div>
        </Card>
      )}

      <Card
        title={
          <div className="flex gap-1">
            {(["outstanding", "collected"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  tab === t ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {t} ({t === "outstanding" ? shownOutstanding.length : shownCollected.length})
              </button>
            ))}
          </div>
        }
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search member or book…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56"
            />
            <SecondaryButton
              onClick={() =>
                tab === "outstanding"
                  ? exportCsv(
                      "outstanding-fines",
                      ["Student", "Student ID", "Book", "Due date", "Days late", "Amount"],
                      shownOutstanding.map((t) => [
                        t.studentName || "", t.studentUniId || "", t.bookTitle || "",
                        fmtDate(t.due), t.late, t.amount,
                      ])
                    )
                  : exportCsv(
                      "fine-collections",
                      ["Receipt", "Student", "Student ID", "Book", "Amount", "Method", "Date", "Collected by"],
                      shownCollected.map((p) => [
                        p.receiptNo || "", p.studentName || "", p.studentUniId || "", p.bookTitle || "",
                        p.amount ?? 0, p.method || "", fmtDateTime(p.paidAt), p.collectedBy || "",
                      ])
                    )
              }
            >
              <Download size={14} /> CSV
            </SecondaryButton>
          </div>
        }
      >
        {error && <p className="text-sm text-rose-600">Could not load fines: {error}</p>}

        {loading ? (
          <SkeletonRows />
        ) : tab === "outstanding" ? (
          shownOutstanding.length === 0 ? (
            <EmptyState
              icon={<Wallet size={22} />}
              title="No outstanding fines"
              hint="Fines appear here as soon as a loan passes its due date."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-2 text-left font-medium">Member</th>
                    <th className="py-2 text-left font-medium">Book</th>
                    <th className="py-2 text-left font-medium">Due date</th>
                    <th className="py-2 text-left font-medium">Status</th>
                    <th className="py-2 text-left font-medium">Amount</th>
                    <th className="py-2 text-right font-medium">Collect</th>
                  </tr>
                </thead>
                <tbody>
                  {shownOutstanding.map((t) => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="py-2.5">
                        <div className="font-medium text-slate-900">{t.studentName || "—"}</div>
                        <div className="text-xs text-slate-500">{t.studentUniId}</div>
                      </td>
                      <td className="py-2.5">
                        <div className="text-slate-900">{t.bookTitle || "—"}</div>
                        <div className="text-xs text-slate-500">{t.bookIsbn}</div>
                      </td>
                      <td className="py-2.5 text-slate-600">{fmtDate(t.due)}</td>
                      <td className="py-2.5">
                        <Badge
                          text={t.status === "active" ? `still out · ${t.late}d late` : "returned late"}
                          className={
                            t.status === "active"
                              ? "border-rose-200 bg-rose-50 text-rose-700"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                          }
                        />
                      </td>
                      <td className="py-2.5 font-semibold text-rose-700">{money(t.amount)}</td>
                      <td className="py-2.5">
                        <div className="flex justify-end gap-1.5">
                          <PrimaryButton disabled={busy === t.id} onClick={() => collect(t, "Cash")}>
                            <Banknote size={14} /> Cash
                          </PrimaryButton>
                          <SecondaryButton disabled={busy === t.id} onClick={() => collect(t, "Bank transfer")}>
                            Bank
                          </SecondaryButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : shownCollected.length === 0 ? (
          <EmptyState
            icon={<Banknote size={22} />}
            title="No payments recorded yet"
            hint="Every fine you collect is receipted and listed here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2 text-left font-medium">Receipt</th>
                  <th className="py-2 text-left font-medium">Member</th>
                  <th className="py-2 text-left font-medium">Against</th>
                  <th className="py-2 text-left font-medium">Amount</th>
                  <th className="py-2 text-left font-medium">Method</th>
                  <th className="py-2 text-left font-medium">Date</th>
                  <th className="py-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {shownCollected.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2.5 font-mono text-xs text-slate-700">{p.receiptNo}</td>
                    <td className="py-2.5">
                      <div className="font-medium text-slate-900">{p.studentName}</div>
                      <div className="text-xs text-slate-500">{p.studentUniId}</div>
                    </td>
                    <td className="py-2.5 text-slate-600">{p.bookTitle || "—"}</td>
                    <td className="py-2.5 font-semibold text-emerald-700">{money(p.amount ?? 0)}</td>
                    <td className="py-2.5 text-slate-600">{p.method}</td>
                    <td className="py-2.5 text-slate-600">{fmtDateTime(p.paidAt)}</td>
                    <td className="py-2.5 text-right">
                      <SecondaryButton onClick={() => setReceipt(p)}>
                        <Printer size={14} /> Receipt
                      </SecondaryButton>
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
