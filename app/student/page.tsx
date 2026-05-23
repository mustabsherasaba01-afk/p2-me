"use client";

import React from "react";
import StudentShell from "./_components/StudentShell";
import { Card, Badge } from "../(console)/_components/ui";
import { AlertTriangle, BookOpen, Calendar, Clock, GraduationCap, Search as SearchIcon, Star, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/authContext";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";

type Loan = {
    id: string;
    bookTitle: string;
    bookAuthor: string;
    bookIsbn: string;
    dueDate: { seconds: number } | null;
    returnedAt: { seconds: number } | null;
    status: "active" | "returned" | "overdue";
};

function fmt(ts: { seconds: number }) {
    return new Date(ts.seconds * 1000).toLocaleDateString("en-PK", {
        day: "2-digit", month: "long", year: "numeric",
    });
}

export default function StudentDashboard() {
    const [search, setSearch] = React.useState("");
    const { user } = useAuth();
    const router = useRouter();
    const studentUser = user?.role === "student" ? user : null;

    const [loans, setLoans] = React.useState<Loan[]>([]);
    const [loansLoading, setLoansLoading] = React.useState(true);

    React.useEffect(() => {
        if (!studentUser) return;
        const q = query(collection(db, "transactions"), where("studentDocId", "==", studentUser.id));
        return onSnapshot(q, (snap) => {
            setLoans(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Loan)));
            setLoansLoading(false);
        });
    }, [studentUser?.id]);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const activeLoans = loans.filter((l) => l.status === "active" || l.status === "overdue");
    const dueToday = activeLoans.filter((l) => {
        if (!l.dueDate) return false;
        const d = new Date(l.dueDate.seconds * 1000);
        return d >= todayStart && d < todayEnd;
    });
    const overdue = activeLoans.filter((l) => l.dueDate && new Date(l.dueDate.seconds * 1000) < now);
    const returned = loans.filter((l) => l.status === "returned");
    const loyaltyPoints = returned.length * 10;

    const notifs: { title: string; body: string; dot: string }[] = [
        ...overdue.map((l) => {
            const daysLate = l.dueDate ? Math.ceil((now.getTime() - new Date(l.dueDate.seconds * 1000).getTime()) / (24 * 60 * 60 * 1000)) : 0;
            return { title: "Overdue Book", body: `"${l.bookTitle}" is ${daysLate}d overdue — PKR ${daysLate * 50} fine.`, dot: "bg-rose-500" };
        }),
        ...dueToday.map((l) => ({
            title: "Due Today",
            body: `"${l.bookTitle}" must be returned today.`,
            dot: "bg-amber-500",
        })),
    ];

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        if (search.trim()) router.push(`/student/catalog?q=${encodeURIComponent(search.trim())}`);
    }

    const subtitle = studentUser
        ? `Welcome back, ${studentUser.name}${studentUser.department ? ` • ${studentUser.department}` : ""}`
        : "Welcome back";

    return (
        <StudentShell title="Dashboard" subtitle={subtitle}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* KPI Cards */}
                <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="border-indigo-100 bg-white/50 backdrop-blur-sm self-stretch">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-indigo-100 text-indigo-600 grid place-items-center flex-shrink-0">
                                <BookOpen className="h-6 w-6" />
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Books Issued</div>
                                <div className="text-3xl font-black text-slate-900 tracking-tight">
                                    {loansLoading ? "…" : String(activeLoans.length).padStart(2, "0")}
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="border-indigo-100 bg-white/50 backdrop-blur-sm self-stretch">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-600 grid place-items-center flex-shrink-0">
                                <Clock className="h-6 w-6" />
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Due Today</div>
                                <div className="text-3xl font-black text-slate-900 tracking-tight">
                                    {loansLoading ? "…" : String(dueToday.length).padStart(2, "0")}
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="border-indigo-100 bg-white/50 backdrop-blur-sm self-stretch">
                        <div className="flex items-center gap-4">
                            <div className={`h-12 w-12 rounded-2xl grid place-items-center flex-shrink-0 ${overdue.length > 0 ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"}`}>
                                <Calendar className="h-6 w-6" />
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Late Returns</div>
                                <div className={`text-3xl font-black tracking-tight ${overdue.length > 0 ? "text-rose-600" : "text-slate-900"}`}>
                                    {loansLoading ? "…" : String(overdue.length).padStart(2, "0")}
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="border-indigo-100 bg-white/50 backdrop-blur-sm self-stretch">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-violet-100 text-violet-600 grid place-items-center flex-shrink-0">
                                <Star className="h-6 w-6" />
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Loyalty Points</div>
                                <div className="text-3xl font-black text-slate-900 tracking-tight">
                                    {loansLoading ? "…" : loyaltyPoints}
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Current Readings */}
                <div className="lg:col-span-2 space-y-6">
                    <Card
                        title={<span className="text-lg font-black tracking-tight text-slate-900">Current Readings</span>}
                        right={<Link href="/student/my-books" className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800 transition-colors">See All</Link>}
                        className="overflow-hidden border-slate-200 shadow-xl shadow-slate-200/40"
                    >
                        <div className="space-y-4">
                            {loansLoading ? (
                                <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
                            ) : activeLoans.length === 0 ? (
                                <div className="py-8 text-center text-sm text-slate-400">No active loans. Visit the catalog to borrow books.</div>
                            ) : (
                                activeLoans.slice(0, 3).map((loan) => {
                                    const late = loan.dueDate && new Date(loan.dueDate.seconds * 1000) < now;
                                    return (
                                        <div key={loan.id} className="group relative flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 transition-all hover:bg-white hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5">
                                            <div className="flex items-center gap-4">
                                                <div className={`h-12 w-9 rounded-md border overflow-hidden shadow-inner grid place-items-center ${late ? "bg-rose-600/10 border-rose-200" : "bg-indigo-600/10 border-indigo-200"}`}>
                                                    <BookOpen className={`h-4 w-4 ${late ? "text-rose-600" : "text-indigo-600"}`} />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-slate-900 leading-none mb-1 group-hover:text-indigo-700 transition-colors line-clamp-1">{loan.bookTitle}</h4>
                                                    <p className="text-xs font-bold text-slate-500">{loan.bookAuthor || loan.bookIsbn}</p>
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0 ml-4">
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Return Due</div>
                                                <div className={`text-xs font-black px-3 py-1 rounded-lg border shadow-sm ${late ? "text-rose-700 bg-rose-50 border-rose-200" : "text-slate-900 bg-white border-slate-200"}`}>
                                                    {loan.dueDate ? fmt(loan.dueDate) : "—"}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}

                            <div className="mt-4 p-6 rounded-3xl bg-indigo-900 text-white relative overflow-hidden shadow-2xl shadow-indigo-900/20">
                                <div className="relative z-10">
                                    <Badge text="CATALOG" className="bg-indigo-500/30 text-indigo-100 border-none px-2 py-0.5 mb-3" />
                                    <h3 className="text-2xl font-black mb-3 leading-tight tracking-tight">Browse Thousands of Books</h3>
                                    <p className="text-indigo-200 text-sm font-medium mb-6 max-w-sm">Search by title, author or accession number across all departments.</p>
                                    <Link href="/student/catalog" className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-indigo-900 rounded-xl font-black text-sm hover:bg-indigo-50 transition-all active:scale-95 shadow-lg shadow-white/20">
                                        Open Catalog
                                        <TrendingUp className="h-4 w-4" />
                                    </Link>
                                </div>
                                <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 h-64 w-64 bg-indigo-500/20 blur-[80px] rounded-full" />
                                <GraduationCap className="absolute bottom-4 right-4 h-24 w-24 text-white/10 -rotate-12" />
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <Card title={<span className="text-base font-black tracking-tight">Quick Search</span>} className="border-indigo-100 shadow-lg shadow-slate-200/40">
                        <form onSubmit={handleSearch} className="relative mt-2">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Find any book…"
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </form>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {["AI", "React", "Management", "Calculus"].map((tag) => (
                                <button
                                    key={tag}
                                    onClick={() => router.push(`/student/catalog?q=${encodeURIComponent(tag)}`)}
                                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-[10px] font-black text-slate-600 tracking-wider transition-all active:scale-95"
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </Card>

                    <Card title={<span className="text-base font-black tracking-tight text-slate-900">Notifications</span>} className="border-slate-200 shadow-xl shadow-slate-200/30">
                        <div className="space-y-3">
                            {loansLoading ? (
                                <p className="text-xs text-slate-400 py-4 text-center">Loading…</p>
                            ) : notifs.length === 0 ? (
                                <div className="py-6 text-center">
                                    <p className="text-sm font-bold text-slate-500">All caught up!</p>
                                    <p className="text-xs text-slate-400 mt-1">No overdue or due-today books.</p>
                                </div>
                            ) : (
                                notifs.map((n, i) => (
                                    <div key={i} className="flex gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                                        <div className={`w-1.5 h-1.5 mt-1.5 rounded-full flex-shrink-0 ${n.dot}`} />
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 leading-tight mb-1">{n.title}</p>
                                            <p className="text-xs font-medium text-slate-500">{n.body}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </StudentShell>
    );
}
