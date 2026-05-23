"use client";

import React from "react";
import { FilePlus2 } from "lucide-react";
import ConsoleShell from "../../_components/ConsoleShell";
import { Card, Input, PrimaryButton, Select, TextArea } from "../../_components/ui";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../lib/authContext";

const EMPTY = {
  thesisId: "",
  title: "",
  student: "",
  department: "CS",
  supervisor: "",
  year: new Date().getFullYear().toString(),
  keywords: "",
  abstract: "",
};

export default function Page() {
  const { user } = useAuth();
  const [form, setForm] = React.useState(EMPTY);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!form.thesisId.trim() || !form.title.trim() || !form.student.trim()) {
      setError("Thesis ID, Title, and Student Name are required.");
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, "theses"), {
        thesisId: form.thesisId.trim(),
        title: form.title.trim(),
        student: form.student.trim(),
        department: form.department,
        supervisor: form.supervisor.trim(),
        year: form.year.trim(),
        keywords: form.keywords.trim(),
        abstract: form.abstract.trim(),
        status: "available",
        addedAt: Timestamp.now(),
        addedBy: user?.role === "admin" ? user.email : "admin",
      });
      setSuccess(`Thesis "${form.title}" added successfully.`);
      setForm(EMPTY);
    } catch {
      setError("Failed to save thesis. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ConsoleShell title="Add Thesis" subtitle="Register a new thesis entry in the library." rightActions={null}>
      <Card title="Thesis Details">
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-700">{error}</div>
          )}
          {success && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-sm text-emerald-700">{success}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Thesis ID"
              value={form.thesisId}
              onChange={(e) => set("thesisId", e.target.value)}
              placeholder="T-2025-091"
              required
            />
            <Input
              label="Year"
              value={form.year}
              onChange={(e) => set("year", e.target.value)}
              placeholder="2025"
            />
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Thesis title"
              required
            />
            <Input
              label="Student Name"
              value={form.student}
              onChange={(e) => set("student", e.target.value)}
              placeholder="Student name"
              required
            />
            <Select label="Department" value={form.department} onChange={(e) => set("department", e.target.value)}>
              <option>CS</option>
              <option>SE</option>
              <option>EE</option>
              <option>Env</option>
              <option>Mgmt</option>
            </Select>
            <Input
              label="Supervisor"
              value={form.supervisor}
              onChange={(e) => set("supervisor", e.target.value)}
              placeholder="Supervisor name"
            />
          </div>
          <Input
            label="Keywords"
            value={form.keywords}
            onChange={(e) => set("keywords", e.target.value)}
            placeholder="AI, NLP, Urdu, …"
          />
          <TextArea
            label="Abstract"
            rows={5}
            value={form.abstract}
            onChange={(e) => set("abstract", e.target.value)}
            placeholder="Brief description (optional)"
          />
          <div className="flex items-center gap-2">
            <PrimaryButton type="submit" disabled={submitting}>
              <FilePlus2 className="h-4 w-4" />
              {submitting ? "Saving…" : "Add Thesis"}
            </PrimaryButton>
          </div>
        </form>
      </Card>
    </ConsoleShell>
  );
}
