"use client";

import React from "react";
import { CheckCircle2, ClipboardCheck, RotateCcw } from "lucide-react";
import ConsoleShell from "../_components/ConsoleShell";
import { Badge, Card, Input, PrimaryButton, SecondaryButton, Select } from "../_components/ui";
import { useConsole } from "../_components/ConsoleContext";
import {
  collection, query, where, getDocs, addDoc, updateDoc, doc,
  onSnapshot, orderBy, limit, Timestamp, increment,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

type TxnRow = {
  id: string;
  studentName: string;
  studentUniId: string;
  bookIsbn: string;
  bookTitle: string;
  issuedAt: { seconds: number } | null;
  returnedAt: { seconds: number } | null;
  status: "active" | "returned" | "overdue";
  fine: number;
};

async function issueBook(studentUniId: string, isbn: string, dueDays: number) {
  const studentSnap = await getDocs(
    query(collection(db, "students"), where("studentId", "==", studentUniId))
  );
  if (studentSnap.empty) throw new Error(`Student ID "${studentUniId}" not found.`);
  const studentDoc = studentSnap.docs[0];
  const studentData = studentDoc.data();
  if (studentData.status === "inactive") throw new Error("This student's account is inactive.");

  const dupSnap = await getDocs(
    query(
      collection(db, "transactions"),
      where("studentDocId", "==", studentDoc.id),
      where("bookIsbn", "==", isbn),
      where("status", "==", "active")
    )
  );
  if (!dupSnap.empty) throw new Error("This book is already issued to this student.");

  let bookDocId: string | null = null;
  let bookTitle = isbn;
  let bookAuthor = "";
  const bookSnap = await getDocs(
    query(collection(db, "books"), where("isbn", "==", isbn))
  );
  if (!bookSnap.empty) {
    const bookDoc = bookSnap.docs[0];
    const bookData = bookDoc.data();
    bookDocId = bookDoc.id;
    bookTitle = bookData.title || isbn;
    bookAuthor = bookData.author || "";
    if ((bookData.available ?? 0) <= 0) throw new Error("No copies available for this book.");
    await updateDoc(doc(db, "books", bookDocId), { available: increment(-1) });
  }

  const now = new Date();
  const due = new Date(now.getTime() + dueDays * 24 * 60 * 60 * 1000);
  await addDoc(collection(db, "transactions"), {
    studentDocId: studentDoc.id,
    studentName: studentData.name || "",
    studentUniId,
    bookIsbn: isbn,
    bookTitle,
    bookAuthor,
    bookDocId,
    issuedAt: Timestamp.fromDate(now),
    dueDate: Timestamp.fromDate(due),
    returnedAt: null,
    dueDays,
    status: "active",
    fine: 0,
    method: "Desk",
  });
}

async function returnBook(studentUniId: string, isbn: string): Promise<number> {
  const studentSnap = await getDocs(
    query(collection(db, "students"), where("studentId", "==", studentUniId))
  );
  if (studentSnap.empty) throw new Error(`Student ID "${studentUniId}" not found.`);
  const studentDoc = studentSnap.docs[0];

  const txnSnap = await getDocs(
    query(
      collection(db, "transactions"),
      where("studentDocId", "==", studentDoc.id),
      where("bookIsbn", "==", isbn),
      where("status", "==", "active")
    )
  );
  if (txnSnap.empty) throw new Error("No active loan found for this student and book.");

  const txnDoc = txnSnap.docs[0];
  const txnData = txnDoc.data();
  const now = new Date();
  const dueDate = txnData.dueDate.toDate();
  let fine = 0;
  if (now > dueDate) {
    const daysLate = Math.ceil((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
    fine = daysLate * 50;
  }

  await updateDoc(doc(db, "transactions", txnDoc.id), {
    returnedAt: Timestamp.fromDate(now),
    status: "returned",
    fine,
  });

  if (txnData.bookDocId) {
    await updateDoc(doc(db, "books", txnData.bookDocId), { available: increment(1) });
  }

  return fine;
}

export default function Page() {
  const [mode, setMode] = React.useState<"Issue" | "Return">("Issue");
  const [form, setForm] = React.useState({ memberId: "", isbn: "", dueDays: "14" });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function reset() {
    setForm({ memberId: "", isbn: "", dueDays: "14" });
    setError("");
    setSuccess("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!form.memberId.trim() || !form.isbn.trim()) {
      setError("Please fill in both Student ID and Book Accession No.");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "Issue") {
        await issueBook(form.memberId.trim(), form.isbn.trim(), parseInt(form.dueDays));
        setSuccess(`Book issued to student ${form.memberId.trim()}.`);
        setForm({ memberId: "", isbn: "", dueDays: "14" });
      } else {
        const fine = await returnBook(form.memberId.trim(), form.isbn.trim());
        const fineMsg = fine > 0 ? ` Fine applied: PKR ${fine}.` : " No fine.";
        setSuccess(`Book returned successfully.${fineMsg}`);
        setForm({ memberId: "", isbn: "", dueDays: "14" });
      }
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ConsoleShell
      title="Check-out Books"
      subtitle="Issue and return books to library members."
      rightActions={
        <div className="inline-flex rounded-2xl border bg-slate-50 p-1">
          <button
            className={mode === "Issue" ? "px-3 py-1 text-xs rounded-2xl bg-white shadow-sm text-slate-900" : "px-3 py-1 text-xs rounded-2xl text-slate-600"}
            onClick={() => { setMode("Issue"); reset(); }}
          >
            Issue
          </button>
          <button
            className={mode === "Return" ? "px-3 py-1 text-xs rounded-2xl bg-white shadow-sm text-slate-900" : "px-3 py-1 text-xs rounded-2xl text-slate-600"}
            onClick={() => { setMode("Return"); reset(); }}
          >
            Return
          </button>
        </div>
      }
    >
      <CheckoutContent mode={mode} form={form} set={set} submit={submit} submitting={submitting} error={error} success={success} reset={reset} />
    </ConsoleShell>
  );
}

function CheckoutContent({
  mode, form, set, submit, submitting, error, success, reset,
}: {
  mode: "Issue" | "Return";
  form: { memberId: string; isbn: string; dueDays: string };
  set: (k: any, v: any) => void;
  submit: (e: React.FormEvent) => void;
  submitting: boolean;
  error: string;
  success: string;
  reset: () => void;
}) {
  const { search } = useConsole();
  const [transactions, setTransactions] = React.useState<TxnRow[]>([]);

  React.useEffect(() => {
    const q = query(collection(db, "transactions"), orderBy("issuedAt", "desc"), limit(30));
    return onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TxnRow)));
    });
  }, []);

  const filtered = transactions.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [r.bookTitle, r.studentName, r.studentUniId, r.bookIsbn].join(" ").toLowerCase().includes(q);
  });

  function fmt(ts: { seconds: number } | null) {
    if (!ts) return "—";
    return new Date(ts.seconds * 1000).toLocaleDateString("en-PK");
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
      <Card title={`${mode} Book`}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-700">{error}</div>
          )}
          {success && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-sm text-emerald-700">{success}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Student ID"
              placeholder="e.g. BSIT-2020-01"
              value={form.memberId}
              onChange={(e) => set("memberId", e.target.value)}
            />
            <Input
              label="Book Accession No."
              placeholder="e.g. ACC-2020-01"
              value={form.isbn}
              onChange={(e) => set("isbn", e.target.value)}
            />
          </div>

          {mode === "Issue" && (
            <Select label="Loan Duration" value={form.dueDays} onChange={(e) => set("dueDays", e.target.value)}>
              <option value="7">7 Days</option>
              <option value="14">14 Days</option>
              <option value="30">30 Days</option>
            </Select>
          )}

          {mode === "Return" && (
            <div className="p-3 rounded-xl bg-orange-50 border border-orange-100 text-sm text-orange-800 flex items-start gap-2">
              <RotateCcw className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Return Policy</p>
                <p className="opacity-80 text-xs">Late returns incur a fine of PKR 50 per day.</p>
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center gap-2">
            <PrimaryButton type="submit" disabled={submitting}>
              {mode === "Issue" ? <ClipboardCheck className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? "Processing…" : `Confirm ${mode}`}
            </PrimaryButton>
            <SecondaryButton type="button" onClick={reset} disabled={submitting}>
              Reset
            </SecondaryButton>
          </div>
        </form>
      </Card>

      <Card title="Recent Transactions" right={<Badge text={String(filtered.length)} />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500">
                <th className="text-left font-medium py-2">Book</th>
                <th className="text-left font-medium py-2">Member</th>
                <th className="text-left font-medium py-2">Issued</th>
                <th className="text-left font-medium py-2">Returned</th>
                <th className="text-left font-medium py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-slate-400">No transactions yet.</td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="text-slate-700">
                  <td className="py-2">
                    <div className="font-medium text-slate-900 max-w-[120px] truncate">{r.bookTitle}</div>
                    <div className="text-xs text-slate-500">{r.bookIsbn}</div>
                  </td>
                  <td className="py-2">
                    <div>{r.studentName}</div>
                    <div className="text-xs text-slate-500">{r.studentUniId}</div>
                  </td>
                  <td className="py-2 text-xs">{fmt(r.issuedAt)}</td>
                  <td className="py-2 text-xs">{fmt(r.returnedAt)}</td>
                  <td className="py-2">
                    <span className={[
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      r.status === "active" ? "bg-blue-50 text-blue-700" :
                      r.status === "returned" ? "bg-emerald-50 text-emerald-700" :
                      "bg-rose-50 text-rose-700",
                    ].join(" ")}>
                      {r.status === "returned" && r.fine > 0 ? `PKR ${r.fine}` : r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
