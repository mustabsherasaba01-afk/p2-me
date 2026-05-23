"use client";

import React from "react";
import ConsoleShell from "../_components/ConsoleShell";
import { Card, Input, PrimaryButton, Select } from "../_components/ui";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

const SETTINGS_DOC = doc(db, "settings", "config");

const DEFAULTS = {
  libraryName: "LSIT Library",
  timezone: "Asia/Karachi",
  emailReminders: "Enabled",
  defaultLoanDays: "14",
};

export default function Page() {
  const [settings, setSettings] = React.useState(DEFAULTS);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  React.useEffect(() => {
    getDoc(SETTINGS_DOC).then((snap) => {
      if (snap.exists()) {
        setSettings({ ...DEFAULTS, ...snap.data() });
      }
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
    <ConsoleShell title="Settings" subtitle="System configuration for the library." rightActions={null}>
      <div className="max-w-xl">
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
      </div>
    </ConsoleShell>
  );
}
