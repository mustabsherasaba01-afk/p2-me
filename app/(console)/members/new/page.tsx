"use client";

import React from "react";
import { Plus } from "lucide-react";
import ConsoleShell from "../../_components/ConsoleShell";
import { Card, Input, PrimaryButton, Select, TextArea } from "../../_components/ui";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";

export default function Page() {
  const [form, setForm] = React.useState({
    studentId: "",
    name: "",
    type: "Student",
    department: "",
    email: "",
    phone: "",
    address: "",
    password: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [success, setSuccess] = React.useState("");
  const [error, setError] = React.useState("");

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.studentId.trim()) {
      setError("Student ID is required — it will be used to log in.");
      return;
    }
    if (!form.name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!form.password.trim()) {
      setError("Password is required for student login.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      // Check if studentId already exists
      const q = query(collection(db, "students"), where("studentId", "==", form.studentId.trim()));
      const existing = await getDocs(q);
      if (!existing.empty) {
        setError(`Student ID "${form.studentId}" is already registered.`);
        setSaving(false);
        return;
      }

      await addDoc(collection(db, "students"), {
        studentId: form.studentId.trim(),
        name: form.name.trim(),
        password: form.password.trim(), // Store password in firestore
        type: form.type,
        department: form.department.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        status: "active",
        createdAt: serverTimestamp(),
      });

      setSuccess(`Member "${form.name}" added. They can now log in with ID and Password.`);
      setForm({ studentId: "", name: "", type: "Student", department: "", email: "", phone: "", address: "", password: "" });
    } catch (err: any) {
      setError(`Failed to create member: ${err?.message || "Please try again."}`);
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ConsoleShell title="Add Member" subtitle="Create a new member profile." rightActions={null}>
      <Card title="Member Details">
        {success && (
          <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Student / Member ID *"
              value={form.studentId}
              onChange={(e) => set("studentId", e.target.value)}
              placeholder="2024-BSIT-042"
            />
            <Input
              label="Full Name *"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ayesha Khalid"
            />
            <Select label="Member Type" value={form.type} onChange={(e) => set("type", e.target.value)}>
              <option>Student</option>
              <option>Faculty</option>
              <option>Staff</option>
              <option>Visitor</option>
            </Select>
            <Input
              label="Department"
              value={form.department}
              onChange={(e) => set("department", e.target.value)}
              placeholder="BSIT / BBA"
            />
            <Input
              label="Email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="name@example.com"
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+92..."
            />
            <Input
              label="Login Password *"
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder="Set a password"
            />
          </div>

          <TextArea
            label="Address"
            rows={3}
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder="Optional"
          />

          <p className="text-xs text-slate-500">
            The Student/Member ID is used to log in to the Student Portal. Make sure it is unique.
          </p>

          <div className="flex items-center gap-2">
            <PrimaryButton type="submit" disabled={saving}>
              <Plus className="h-4 w-4" />
              {saving ? "Saving…" : "Create Member"}
            </PrimaryButton>
          </div>
        </form>
      </Card>
    </ConsoleShell>
  );
}
