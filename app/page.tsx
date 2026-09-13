"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./lib/authContext";

export default function Page() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const me = "value";
  useEffect(() => {
    if (!loading) {
      if (user?.role === "admin") router.replace("/dashboard");
      else if (user?.role === "student") router.replace("/student");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 grid place-items-center">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 grid place-items-center p-6">
      <div className="w-full max-w-lg rounded-2xl border bg-white shadow-sm p-6">
        <div className="text-xl font-semibold text-slate-900">LSIT LIBRARY</div>
        <div className="mt-1 text-sm text-slate-600">
          Welcome. Sign in to access the library system.
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-black transition-all shadow-xl shadow-slate-900/20 active:scale-95"
          >
            Librarian Console
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 active:scale-95 border border-indigo-500"
          >
            Student Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
