"use client";

import React from "react";
import ConsoleShell from "../_components/ConsoleShell";
import { Card, Input, PrimaryButton, Select } from "../_components/ui";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import {
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
} from "firebase/auth";
import { KeyRound } from "lucide-react";

const SETTINGS_DOC = doc(db, "settings", "config");

const DEFAULTS = {
  libraryName: "LSIT Library",
  timezone: "Asia/Karachi",
  emailReminders: "Enabled",
  defaultLoanDays: "14",
};

export default function Page() {
  return (
    <ConsoleShell title="Settings" subtitle="System configuration for the library." rightActions={null}>
      <div className="max-w-xl space-y-6">
        <GeneralSettings />
        <PasswordSettings />
      </div>
    </ConsoleShell>
  );
}

function GeneralSettings() {
  const [settings, setSettings] = React.useState(DEFAULTS);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  React.useEffect(() => {
    getDoc(SETTINGS_DOC).then((snap) => {
      if (snap.exists()) setSettings({ ...DEFAULTS, ...snap.data() });
      setLoading(false);
    });
  }, []);

  function set<K extends keyof typeof settings>(k: K, v: (typeof settings)[K]) {
    setSettings((p) => ({ ...p, [k]: v }));
    setSuccess(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    try {
      await setDoc(SETTINGS_DOC, settings, { merge: true });
      setSuccess(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="General">
      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">Loading settings…</div>
      ) : (
        <form onSubmit={save} className="space-y-4">
          {success && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-sm text-emerald-700">
              Settings saved successfully.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Library Name"
              value={settings.libraryName}
              onChange={(e) => set("libraryName", e.target.value)}
            />
            <Input
              label="Timezone"
              value={settings.timezone}
              onChange={(e) => set("timezone", e.target.value)}
            />
            <Select
              label="Email Reminders"
              value={settings.emailReminders}
              onChange={(e) => set("emailReminders", e.target.value)}
            >
              <option>Enabled</option>
              <option>Disabled</option>
            </Select>
            <Input
              label="Default Loan Days"
              value={settings.defaultLoanDays}
              onChange={(e) => set("defaultLoanDays", e.target.value)}
              type="number"
              min="1"
            />
          </div>
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Settings"}
          </PrimaryButton>
        </form>
      )}
    </Card>
  );
}

function PasswordSettings() {
  const [form, setForm] = React.useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
    setError("");
    setSuccess(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!form.current || !form.next || !form.confirm) {
      setError("All fields are required.");
      return;
    }
    if (form.next.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (form.next !== form.confirm) {
      setError("New passwords do not match.");
      return;
    }

    const user = auth.currentUser;
    if (!user || !user.email) {
      setError("No authenticated admin found. Please log in again.");
      return;
    }

    setSaving(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, form.current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, form.next);
      setSuccess(true);
      setForm({ current: "", next: "", confirm: "" });
    } catch (err: any) {
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Current password is incorrect.");
      } else if (err.code === "auth/weak-password") {
        setError("New password is too weak. Use at least 6 characters.");
      } else {
        setError(err.message || "Failed to update password.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-slate-500" />
          Change Admin Password
        </span>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-700">{error}</div>
        )}
        {success && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-sm text-emerald-700">
            Password updated successfully.
          </div>
        )}
        <Input
          label="Current Password"
          type="password"
          value={form.current}
          onChange={(e) => set("current", e.target.value)}
          placeholder="Your current password"
          autoComplete="current-password"
        />
        <Input
          label="New Password"
          type="password"
          value={form.next}
          onChange={(e) => set("next", e.target.value)}
          placeholder="At least 6 characters"
          autoComplete="new-password"
        />
        <Input
          label="Confirm New Password"
          type="password"
          value={form.confirm}
          onChange={(e) => set("confirm", e.target.value)}
          placeholder="Repeat new password"
          autoComplete="new-password"
        />
        <PrimaryButton type="submit" disabled={saving}>
          <KeyRound className="h-4 w-4" />
          {saving ? "Updating…" : "Update Password"}
        </PrimaryButton>
      </form>
    </Card>
  );
}
