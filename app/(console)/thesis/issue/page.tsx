"use client";

import React from "react";
import { ClipboardCheck } from "lucide-react";
import ConsoleShell from "../../_components/ConsoleShell";
import { Card, Input, PrimaryButton, SecondaryButton, Select } from "../../_components/ui";
import {
  collection, query, where, getDocs, addDoc, updateDoc, doc, Timestamp,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

async function issueThesis(studentUniId: string, thesisId: string, dueDays: number) {
  const studentSnap = await getDocs(
    query(collection(db, "students"), where("studentId", "==", studentUniId))
  );
  if (studentSnap.empty) throw new Error(`Student ID "${studentUniId}" not found.`);
  const studentDoc = studentSnap.docs[0];
  const studentData = studentDoc.data();
  if (studentData.status === "inactive") throw new Error("This student's account is inactive.");

  const thesisSnap = await getDocs(
    query(collection(db, "theses"), where("thesisId", "==", thesisId))
  );
  if (thesisSnap.empty) throw new Error(`Thesis ID "${thesisId}" not found.`);
  const thesisDoc = thesisSnap.docs[0];
  const thesisData = thesisDoc.data();
  if (thesisData.status === "issued") throw new Error("This thesis is already issued to someone.");

  const dupSnap = await getDocs(
    query(
      collection(db, "thesis_transactions"),
      where("studentDocId", "==", studentDoc.id),
      where("thesisDocId", "==", thesisDoc.id),
      where("status", "==", "open")
    )
  );
  if (!dupSnap.empty) throw new Error("This thesis is already issued to this student.");

  const now = new Date();
  const due = new Date(now.getTime() + dueDays * 24 * 60 * 60 * 1000);

  await addDoc(collection(db, "thesis_transactions"), {
    thesisDocId: thesisDoc.id,
    thesisId: thesisData.thesisId,
    thesisTitle: thesisData.title,
    studentDocId: studentDoc.id,
    studentName: studentData.name || "",
    studentUniId,
    issuedAt: Timestamp.fromDate(now),
    dueDate: Timestamp.fromDate(due),
    returnedAt: null,
    status: "open",
    fine: 0,
  });

  await updateDoc(doc(db, "theses", thesisDoc.id), { status: "issued" });
}

export default function Page() {
  const [form, setForm] = React.useState({ studentId: "", thesisId: "", dueDays: "30" });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function reset() {
    setForm({ studentId: "", thesisId: "", dueDays: "30" });
    setError("");
    setSuccess("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!form.studentId.trim() || !form.thesisId.trim()) {
      setError("Please fill in both Student ID and Thesis ID.");
      return;
    }
    setSubmitting(true);
    try {
      await issueThesis(form.studentId.trim(), form.thesisId.trim(), parseInt(form.dueDays));
      setSuccess(`Thesis "${form.thesisId.trim()}" issued to student ${form.studentId.trim()}.`);
      setForm({ studentId: "", thesisId: "", dueDays: "30" });
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ConsoleShell title="Issue Thesis" subtitle="Issue a thesis to a library member." rightActions={null}>
      <div className="max-w-xl">
        <Card title="Issue Details">
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-700">{error}</div>
            )}
            {success && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-sm text-emerald-700">{success}</div>
            )}
            <Input
              label="Student ID"
              placeholder="e.g. BSIT-2020-01"
              value={form.studentId}
              onChange={(e) => set("studentId", e.target.value)}
              required
            />
            <Input
              label="Thesis ID"
              placeholder="e.g. T-2025-091"
              value={form.thesisId}
              onChange={(e) => set("thesisId", e.target.value)}
              required
            />
            <Select
              label="Loan Duration"
              value={form.dueDays}
              onChange={(e) => set("dueDays", e.target.value)}
            >
              <option value="14">14 Days</option>
              <option value="30">30 Days</option>
              <option value="60">60 Days</option>
            </Select>
            <div className="flex gap-2 pt-2">
              <PrimaryButton type="submit" disabled={submitting}>
                <ClipboardCheck className="h-4 w-4" />
                {submitting ? "Issuing…" : "Issue Thesis"}
              </PrimaryButton>
              <SecondaryButton type="button" onClick={reset} disabled={submitting}>
                Reset
              </SecondaryButton>
            </div>
          </form>
        </Card>
      </div>
    </ConsoleShell>
  );
}
