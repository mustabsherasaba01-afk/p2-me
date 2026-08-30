"use client";

import React from "react";
import { BellRing, Mail, Send, Download, CheckCheck } from "lucide-react";
import ConsoleShell from "../_components/ConsoleShell";
import { Badge, Card, Input, Select, PrimaryButton, SecondaryButton } from "../_components/ui";
import { StatCard, SkeletonRows, EmptyState, Alert } from "../_components/bits";
import {
  useCollection,
  fmtDate,
  fmtDateTime,
  toDate,
  daysLate,
  calcFine,
  money,
  exportCsv,
  logActivity,
} from "../_components/helpers";
import { useAuth } from "../../lib/authContext";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

type Txn = {
  studentDocId?: string;
  studentName?: string;
  studentUniId?: string;
  bookTitle?: string;
  bookIsbn?: string;
  dueDate?: { seconds: number } | null;
  status?: string;
};

type Student = { studentId?: string; name?: string; email?: string; phone?: string };

type Notice = {
  studentUniId?: string;
  studentName?: string;
  kind?: string;
  channel?: string;
  subject?: string;
  body?: string;
  sentAt?: { seconds: number } | null;
  sentBy?: string;
};

const DUE_SOON_DAYS = 3;

export default function Page() {
  return (
    <ConsoleShell
      title="Notifications & Reminders"
      subtitle="Send due-date reminders and overdue notices to members, and keep a record of every notice sent."
    >
      <Body />
    </ConsoleShell>
  );
}

function Body() {
  const { rows: txns, loading } = useCollection<Txn>("transactions");
  const { rows: students } = useCollection<Student>("students");
  const { rows: notices } = useCollection<Notice>("notifications");
  const { user } = useAuth();
  const actor = user?.role === "admin" ? user.email : "admin";

  const [tab, setTab] = React.useState<"queue" | "sent">("queue");
  const [kind, setKind] = React.useState("All");
  const [search, setSearch] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ tone: "success" | "error"; text: string } | null>(null);

  const contactOf = React.useMemo(() => {
    const m = new Map<string, Student>();
    students.forEach((s) => s.studentId && m.set(s.studentId, s));
    return m;
  }, [students]);

  const queue = React.useMemo(
    () =>
      txns
        .filter((t) => t.status === "active")
        .map((t) => {
          const due = toDate(t.dueDate);
          const late = daysLate(due);
          const daysToDue = due ? Math.ceil((due.getTime() - Date.now()) / 86400000) : 99;
          const contact = contactOf.get(t.studentUniId || "");
          return {
            ...t,
            due,
            late,
            daysToDue,
            email: contact?.email || "",
            phone: contact?.phone || "",
            kind: late > 0 ? "Overdue" : daysToDue <= DUE_SOON_DAYS ? "Due soon" : "",
            fine: calcFine(due),
          };
        })
        .filter((t) => t.kind !== "")
        .sort((a, b) => b.late - a.late || a.daysToDue - b.daysToDue),
    [txns, contactOf]
  );

  const q = search.trim().toLowerCase();
  const shownQueue = queue.filter((t) => {
    if (kind !== "All" && t.kind !== kind) return false;
    return !q || [t.studentName, t.studentUniId, t.bookTitle].some((v) => (v || "").toLowerCase().includes(q));
  });

  const sent = React.useMemo(
    () =>
      [...notices]
        .filter((n) => !q || [n.studentName, n.studentUniId, n.subject].some((v) => (v || "").toLowerCase().includes(q)))
        .sort((a, b) => (b.sentAt?.seconds ?? 0) - (a.sentAt?.seconds ?? 0)),
    [notices, q]
  );

  function compose(t: (typeof queue)[number]) {
    const overdue = t.late > 0;
    const subject = overdue
      ? `Overdue library book — "${t.bookTitle}"`
      : `Reminder: "${t.bookTitle}" is due on ${fmtDate(t.due)}`;
    const body = overdue
      ? `Dear ${t.studentName},\n\nOur records show that "${t.bookTitle}" (Accession ${t.bookIsbn}) was due on ${fmtDate(
          t.due
        )} and is now ${t.late} day(s) overdue. A fine of ${money(
          t.fine
        )} has accrued and will continue to increase until the book is returned.\n\nPlease return the book to the Central Library at your earliest convenience.\n\nRegards,\nLSIT Central Library`
      : `Dear ${t.studentName},\n\nThis is a reminder that "${t.bookTitle}" (Accession ${t.bookIsbn}) is due for return on ${fmtDate(
          t.due
        )}. Please return or renew it before the due date to avoid a late fee.\n\nRegards,\nLSIT Central Library`;
    return { subject, body };
  }

  async function send(t: (typeof queue)[number]) {
    setBusy(t.id);
    setMsg(null);
    const { subject, body } = compose(t);
    try {
      await addDoc(collection(db, "notifications"), {
        studentUniId: t.studentUniId,
        studentName: t.studentName,
        kind: t.kind,
        channel: t.email ? "Email" : "In-app",
        subject,
        body,
        bookTitle: t.bookTitle,
        sentAt: Timestamp.now(),
        sentBy: actor,
      });
      await logActivity("Reminder sent", `${t.kind} notice to ${t.studentName} (${t.studentUniId})`, actor);

      if (t.email) {
        window.location.href = `mailto:${t.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        setMsg({ tone: "success", text: `Notice logged and your mail client opened for ${t.email}.` });
      } else {
        setMsg({
          tone: "success",
          text: `Notice logged for ${t.studentName}. No email on file — it will show in their student portal.`,
        });
      }
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function sendAll() {
    setBusy("all");
    let ok = 0;
    for (const t of shownQueue) {
      const { subject, body } = compose(t);
      try {
        await addDoc(collection(db, "notifications"), {
          studentUniId: t.studentUniId,
          studentName: t.studentName,
          kind: t.kind,
          channel: t.email ? "Email" : "In-app",
          subject,
          body,
          bookTitle: t.bookTitle,
          sentAt: Timestamp.now(),
          sentBy: actor,
        });
        ok++;
      } catch {
        /* keep going — a partial batch is still useful */
      }
    }
    await logActivity("Bulk reminders sent", `${ok} notice(s) queued`, actor);
    setMsg({ tone: "success", text: `${ok} notice(s) recorded and delivered to the student portals.` });
    setBusy(null);
  }

  const overdueCount = queue.filter((t) => t.late > 0).length;
  const dueSoonCount = queue.filter((t) => t.late === 0).length;
  const noEmail = queue.filter((t) => !t.email).length;

  return (
    <>
      {msg && <Alert tone={msg.tone} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Overdue notices" value={overdueCount} tone="rose" />
        <StatCard label="Due within 3 days" value={dueSoonCount} tone="amber" />
        <StatCard label="No email on file" value={noEmail} tone="slate" sub="Delivered in-app only" />
        <StatCard label="Notices sent" value={notices.length} tone="emerald" />
      </div>

      <Card
        title={
          <div className="flex gap-1">
            {(["queue", "sent"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  tab === t ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {t === "queue" ? `Pending (${shownQueue.length})` : `Sent (${sent.length})`}
              </button>
            ))}
          </div>
        }
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search member or book…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-52"
            />
            {tab === "queue" && (
              <>
                <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-36">
                  {["All", "Overdue", "Due soon"].map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </Select>
                <PrimaryButton disabled={busy === "all" || shownQueue.length === 0} onClick={sendAll}>
                  <CheckCheck size={14} /> {busy === "all" ? "Sending…" : "Send all"}
                </PrimaryButton>
              </>
            )}
            {tab === "sent" && (
              <SecondaryButton
                onClick={() =>
                  exportCsv(
                    "notices-sent",
                    ["Member", "Student ID", "Type", "Channel", "Subject", "Sent at", "Sent by"],
                    sent.map((n) => [
                      n.studentName || "", n.studentUniId || "", n.kind || "", n.channel || "",
                      n.subject || "", fmtDateTime(n.sentAt), n.sentBy || "",
                    ])
                  )
                }
              >
                <Download size={14} /> CSV
              </SecondaryButton>
            )}
          </div>
        }
      >
        {loading ? (
          <SkeletonRows />
        ) : tab === "queue" ? (
          shownQueue.length === 0 ? (
            <EmptyState
              icon={<BellRing size={22} />}
              title="Nothing needs a reminder"
              hint="Members appear here when a loan is overdue or falls due within three days."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-2 text-left font-medium">Member</th>
                    <th className="py-2 text-left font-medium">Book</th>
                    <th className="py-2 text-left font-medium">Due</th>
                    <th className="py-2 text-left font-medium">Type</th>
                    <th className="py-2 text-left font-medium">Contact</th>
                    <th className="py-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {shownQueue.map((t) => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="py-2.5">
                        <div className="font-medium text-slate-900">{t.studentName || "—"}</div>
                        <div className="text-xs text-slate-500">{t.studentUniId}</div>
                      </td>
                      <td className="py-2.5 text-slate-900">{t.bookTitle || "—"}</td>
                      <td className="py-2.5 text-slate-600">{fmtDate(t.due)}</td>
                      <td className="py-2.5">
                        <Badge
                          text={t.late > 0 ? `Overdue ${t.late}d · ${money(t.fine)}` : `Due in ${Math.max(0, t.daysToDue)}d`}
                          className={
                            t.late > 0
                              ? "border-rose-200 bg-rose-50 text-rose-700"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                          }
                        />
                      </td>
                      <td className="py-2.5 text-xs text-slate-500">
                        {t.email ? (
                          <span className="inline-flex items-center gap-1">
                            <Mail size={11} /> {t.email}
                          </span>
                        ) : (
                          <span className="text-slate-400">no email on file</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <PrimaryButton disabled={busy === t.id} onClick={() => send(t)}>
                          <Send size={14} /> {busy === t.id ? "Sending…" : "Send"}
                        </PrimaryButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : sent.length === 0 ? (
          <EmptyState
            icon={<Send size={22} />}
            title="No notices sent yet"
            hint="Every reminder you send is recorded here with its channel and timestamp."
          />
        ) : (
          <div className="divide-y">
            {sent.map((n) => (
              <div key={n.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium text-slate-900">{n.subject}</div>
                  <div className="flex items-center gap-2">
                    <Badge
                      text={n.kind || ""}
                      className={
                        n.kind === "Overdue"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      }
                    />
                    <Badge text={n.channel || "In-app"} />
                  </div>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  To {n.studentName} ({n.studentUniId}) · {fmtDateTime(n.sentAt)} · by {n.sentBy}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
