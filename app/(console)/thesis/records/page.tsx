"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";
import ConsoleShell from "../../_components/ConsoleShell";
import { Badge, Card } from "../../_components/ui";
import { useConsole } from "../../_components/ConsoleContext";
import {
  collection, query, onSnapshot, orderBy, doc, updateDoc, Timestamp, increment,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

type ThesisTxn = {
  id: string;
  thesisId: string;
  thesisTitle: string;
  thesisDocId: string;
  studentName: string;
  studentUniId: string;
  issuedAt: { seconds: number } | null;
  dueDate: { seconds: number } | null;
  returnedAt: { seconds: number } | null;
  status: "open" | "returned" | "overdue";
  fine: number;
};

export default function Page() {
  const { search } = useConsole();
  const [records, setRecords] = React.useState<ThesisTxn[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [returning, setReturning] = React.useState<string | null>(null);

  React.useEffect(() => {
    const q = query(collection(db, "thesis_transactions"), orderBy("issuedAt", "desc"));
    return onSnapshot(q, (snap) => {
      setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ThesisTxn)));
      setLoading(false);
    });
  }, []);

  const filtered = records.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [r.thesisTitle, r.thesisId, r.studentName, r.studentUniId].join(" ").toLowerCase().includes(q);
  });

  async function handleReturn(txn: ThesisTxn) {
    if (!confirm(`Mark thesis "${txn.thesisTitle}" as returned from ${txn.studentName}?`)) return;
    setReturning(txn.id);
    try {
      const now = new Date();
      const dueDate = txn.dueDate ? new Date(txn.dueDate.seconds * 1000) : now;
      let fine = 0;
      if (now > dueDate) {
        const daysLate = Math.ceil((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
        fine = daysLate * 50;
      }
      await updateDoc(doc(db, "thesis_transactions", txn.id), {
        returnedAt: Timestamp.fromDate(now),
        status: "returned",
        fine,
      });
      if (txn.thesisDocId) {
        await updateDoc(doc(db, "theses", txn.thesisDocId), { status: "available" });
      }
    } finally {
      setReturning(null);
    }
  }

  function fmt(ts: { seconds: number } | null) {
    if (!ts) return "—";
    return new Date(ts.seconds * 1000).toLocaleDateString("en-PK");
  }

  const open = filtered.filter((r) => r.status === "open" || r.status === "overdue").length;

  return (
    <ConsoleShell title="Thesis Records" subtitle="All thesis issue and return transactions.">
      <Card title="Thesis Transactions" right={<Badge text={`${open} open`} />}>
        {loading ? (
          <div className="py-8 text-center text-sm text-slate-400">Loading records…</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">No thesis transactions yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-xs text-slate-500">
                  <th className="text-left font-medium py-2">Thesis</th>
                  <th className="text-left font-medium py-2">Member</th>
                  <th className="text-left font-medium py-2">Issued</th>
                  <th className="text-left font-medium py-2">Due</th>
                  <th className="text-left font-medium py-2">Returned</th>
                  <th className="text-left font-medium py-2">Status</th>
                  <th className="text-left font-medium py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((r) => (
                  <tr key={r.id} className="text-slate-700">
                    <td className="py-2">
                      <div className="font-medium text-slate-900">{r.thesisTitle}</div>
                      <div className="text-xs text-slate-500">{r.thesisId}</div>
                    </td>
                    <td className="py-2">
                      <div>{r.studentName}</div>
                      <div className="text-xs text-slate-500">{r.studentUniId}</div>
                    </td>
                    <td className="py-2 text-xs">{fmt(r.issuedAt)}</td>
                    <td className="py-2 text-xs">{fmt(r.dueDate)}</td>
                    <td className="py-2 text-xs">{fmt(r.returnedAt)}</td>
                    <td className="py-2">
                      <span className={[
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        r.status === "open" ? "bg-blue-50 text-blue-700" :
                        r.status === "returned" ? "bg-emerald-50 text-emerald-700" :
                        "bg-rose-50 text-rose-700",
                      ].join(" ")}>
                        {r.status === "returned" && r.fine > 0 ? `PKR ${r.fine}` : r.status}
                      </span>
                    </td>
                    <td className="py-2">
                      {r.status === "open" && (
                        <button
                          onClick={() => handleReturn(r)}
                          disabled={returning === r.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2 py-1 text-xs font-medium disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {returning === r.id ? "…" : "Return"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </ConsoleShell>
  );
}
