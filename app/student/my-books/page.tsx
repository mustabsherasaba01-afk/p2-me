"use client";

import React from "react";
import StudentShell from "../_components/StudentShell";
import { Badge } from "../../(console)/_components/ui";
import { BookOpen, RefreshCcw, Lock } from "lucide-react";
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/authContext";

type Loan = {
  id: string;
  bookIsbn: string;
  bookTitle: string;
  bookAuthor: string;
  issuedAt: { seconds: number } | null;
  dueDate: { seconds: number } | null;
  returnedAt: { seconds: number } | null;
  status: "active" | "returned" | "overdue";
  fine: number;
  renewCount?: number;
};

function fmt(ts: { seconds: number } | null) {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function isLate(dueDate: { seconds: number } | null) {
  if (!dueDate) return false;
  return new Date() > new Date(dueDate.seconds * 1000);
}

export default function StudentMyBooks() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = React.useState("current");
  const [loans, setLoans] = React.useState<Loan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [renewing, setRenewing] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user || user.role !== "student") return;
    const q = query(collection(db, "transactions"), where("studentDocId", "==", user.id));
    return onSnapshot(q, (snap) => {
      setLoans(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Loan)));
      setLoading(false);
    });
  }, [user]);

  async function handleRenew(loan: Loan) {
    if ((loan.renewCount ?? 0) >= 2) {
      alert("Maximum renewals (2) reached for this book.");
      return;
    }
    setRenewing(loan.id);
    try {
      const currentDue = loan.dueDate ? new Date(loan.dueDate.seconds * 1000) : new Date();
      const base = currentDue > new Date() ? currentDue : new Date();
      const newDue = new Date(base.getTime() + 14 * 24 * 60 * 60 * 1000);
      await updateDoc(doc(db, "transactions", loan.id), {
        dueDate: Timestamp.fromDate(newDue),
        renewCount: (loan.renewCount ?? 0) + 1,
      });
    } finally {
      setRenewing(null);
    }
  }

  const current = loans.filter((l) => l.status === "active" || l.status === "overdue");
  const returned = loans.filter((l) => l.status === "returned");
  const displayed = activeTab === "current" ? current : returned;

  return (
    <StudentShell
      title="My Issued Books"
      subtitle="Overview of your current loans and borrowing history."
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap gap-4 items-center bg-white p-2 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/40 w-full max-w-sm sticky top-0 relative z-10">
          <button
            onClick={() => setActiveTab("current")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 ${activeTab === "current" ? "bg-indigo-900 text-white shadow-xl shadow-indigo-500/20" : "text-slate-500 hover:bg-slate-100"}`}
          >
            Active Loans
            {current.length > 0 && (
              <span className="ml-1 bg-indigo-500 text-white rounded-full text-[9px] px-1.5 py-0.5">{current.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("returned")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 ${activeTab === "returned" ? "bg-indigo-900 text-white shadow-xl shadow-indigo-500/20" : "text-slate-500 hover:bg-slate-100"}`}
          >
            Past History
          </button>
        </div>

        {loading ? (
          <div className="py-24 text-center text-sm text-slate-400">Loading your books…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-6">
            {displayed.length > 0 ? (
              displayed.map((book) => {
                const late = isLate(book.dueDate) && book.status !== "returned";
                return (
                  <div
                    key={book.id}
                    className="group flex flex-col lg:flex-row bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-400/5 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1"
                  >
                    <div className={`w-full lg:w-48 p-10 flex flex-col justify-center items-center relative overflow-hidden ${late ? "bg-rose-50" : "bg-slate-50"}`}>
                      <BookOpen className={`h-12 w-12 relative z-10 mb-4 ${late ? "text-rose-300" : "text-slate-300"}`} />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">
                        {late ? "Overdue" : "Department Library"}
                      </span>
                      <div className="absolute top-0 left-0 w-full h-full bg-indigo-500/5 group-hover:bg-indigo-500/10 transition-colors pointer-events-none" />
                    </div>

                    <div className="flex-1 p-8 md:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
                      <div className="max-w-md">
                        <Badge text={book.bookIsbn} className="bg-slate-100 text-slate-600 font-black border-none px-2 py-0.5 mb-4" />
                        <h3 className="text-2xl font-black text-slate-900 leading-tight mb-2 group-hover:text-indigo-700 transition-colors tracking-tight">
                          {book.bookTitle}
                        </h3>
                        <p className="text-sm font-bold text-slate-500">By {book.bookAuthor || "—"}</p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-10">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Issued On</span>
                          <span className="text-[13px] font-black text-slate-900">{fmt(book.issuedAt)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">
                            {book.status === "returned" ? "Returned On" : "Return Due"}
                          </span>
                          {book.status === "returned" ? (
                            <span className="text-[13px] font-black text-slate-900">{fmt(book.returnedAt)}</span>
                          ) : (
                            <span className={`text-[13px] font-black px-3 py-1 rounded-lg border text-center ${late ? "text-rose-700 bg-rose-50 border-rose-100" : "text-emerald-700 bg-emerald-50 border-emerald-100"}`}>
                              {fmt(book.dueDate)}
                            </span>
                          )}
                        </div>
                        <div className="hidden md:flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Status</span>
                          {book.status === "returned" ? (
                            <span className="text-[13px] font-black text-emerald-700 uppercase tracking-tight">
                              {book.fine > 0 ? `Fine: PKR ${book.fine}` : "Returned"}
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${late ? "bg-rose-500" : "bg-indigo-600 animate-pulse"}`} />
                              <span className={`text-[13px] font-black uppercase tracking-tight ${late ? "text-rose-700" : "text-indigo-900"}`}>
                                {late ? "Overdue" : "Active"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {book.status !== "returned" && (
                        <div className="flex gap-4 self-center lg:self-auto">
                          <button
                            onClick={() => handleRenew(book)}
                            disabled={renewing === book.id || (book.renewCount ?? 0) >= 2}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white font-black text-xs rounded-2xl hover:bg-black transition-all shadow-xl shadow-slate-900/20 active:scale-95 disabled:opacity-40 group/btn"
                          >
                            <RefreshCcw className="h-4 w-4 group-hover/btn:rotate-180 transition-transform duration-500" />
                            {renewing === book.id ? "Renewing…" : (book.renewCount ?? 0) >= 2 ? "Max Renewals" : "RENEW LOAN"}
                          </button>
                          <button className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all active:scale-95 shadow-lg shadow-slate-200/20">
                            <Lock className="h-5 w-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-slate-50 py-24 rounded-[60px] border border-slate-200 border-dashed flex flex-col items-center justify-center">
                <div className="h-20 w-20 rounded-full bg-white text-slate-200 grid place-items-center mb-6 shadow-xl shadow-slate-200">
                  <BookOpen className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  {activeTab === "current" ? "No active loans" : "No borrowing history"}
                </h3>
                <p className="text-sm font-bold text-slate-500 mt-2">
                  {activeTab === "current"
                    ? "Visit the library to borrow books."
                    : "Books you return will appear here."}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </StudentShell>
  );
}
