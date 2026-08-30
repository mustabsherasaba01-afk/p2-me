"use client";

import React from "react";
import { PackageX, Wrench, Undo2, Download } from "lucide-react";
import ConsoleShell from "../_components/ConsoleShell";
import { Badge, Card, Input, PrimaryButton, SecondaryButton } from "../_components/ui";
import { StatCard, SkeletonRows, EmptyState, Alert } from "../_components/bits";
import { useCollection, fmtDate, exportCsv, money, logActivity } from "../_components/helpers";
import { useAuth } from "../../lib/authContext";
import { doc, updateDoc, Timestamp, increment } from "firebase/firestore";
import { db } from "../../lib/firebase";

type Txn = {
  studentName?: string;
  studentUniId?: string;
  bookTitle?: string;
  bookIsbn?: string;
  bookDocId?: string | null;
  dueDate?: { seconds: number } | null;
  status?: string;
  condition?: string;
  replacementCharge?: number;
  markedAt?: { seconds: number } | null;
  remarks?: string;
};

const DEFAULT_REPLACEMENT = 2000;
const DAMAGE_CHARGE = 500;

export default function Page() {
  return (
    <ConsoleShell
      title="Lost & Damaged Stock"
      subtitle="Write off a copy that was never returned or came back damaged, and record the replacement charge against the member."
    >
      <Body />
    </ConsoleShell>
  );
}

function Body() {
  const { rows, loading, error } = useCollection<Txn>("transactions");
  const { user } = useAuth();
  const actor = user?.role === "admin" ? user.email : "admin";

  const [search, setSearch] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = React.useState<{ txn: Txn & { id: string }; kind: "lost" | "damaged" } | null>(null);
  const [charge, setCharge] = React.useState("");
  const [remarks, setRemarks] = React.useState("");

  const q = search.trim().toLowerCase();
  const match = (t: Txn) =>
    !q || [t.studentName, t.studentUniId, t.bookTitle, t.bookIsbn].some((v) => (v || "").toLowerCase().includes(q));

  const active = rows.filter((t) => t.status === "active" && match(t));
  const writtenOff = rows
    .filter((t) => t.status === "lost" || t.status === "damaged")
    .filter(match)
    .sort((a, b) => (b.markedAt?.seconds ?? 0) - (a.markedAt?.seconds ?? 0));

  const lostCount = rows.filter((t) => t.status === "lost").length;
  const damagedCount = rows.filter((t) => t.status === "damaged").length;
  const recoverable = rows
    .filter((t) => t.status === "lost" || t.status === "damaged")
    .reduce((s, t) => s + (t.replacementCharge ?? 0), 0);

  function openDialog(txn: Txn & { id: string }, kind: "lost" | "damaged") {
    setPending({ txn, kind });
    setCharge(String(kind === "lost" ? DEFAULT_REPLACEMENT : DAMAGE_CHARGE));
    setRemarks("");
    setMsg(null);
  }

  async function confirmWriteOff() {
    if (!pending) return;
    const amount = Number(charge);
    if (!Number.isFinite(amount) || amount < 0) {
      setMsg({ tone: "error", text: "Enter a valid replacement charge." });
      return;
    }
    setBusy(pending.txn.id);
    try {
      await updateDoc(doc(db, "transactions", pending.txn.id), {
        status: pending.kind,
        condition: pending.kind,
        replacementCharge: amount,
        remarks: remarks.trim(),
        markedAt: Timestamp.now(),
        markedBy: actor,
      });
      // A lost copy leaves the shelf permanently; a damaged one is taken out of circulation too.
      if (pending.txn.bookDocId) {
        await updateDoc(doc(db, "books", pending.txn.bookDocId), { copies: increment(-1) });
      }
      await logActivity(
        `Copy marked ${pending.kind}`,
        `"${pending.txn.bookTitle}" held by ${pending.txn.studentName} (${pending.txn.studentUniId}) — charge ${money(amount)}`,
        actor
      );
      setMsg({
        tone: "success",
        text: `"${pending.txn.bookTitle}" marked ${pending.kind}. ${money(amount)} charged to ${pending.txn.studentName}.`,
      });
      setPending(null);
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function restore(t: Txn & { id: string }) {
    setBusy(t.id);
    try {
      await updateDoc(doc(db, "transactions", t.id), {
        status: "active",
        condition: null,
        replacementCharge: 0,
        markedAt: null,
      });
      if (t.bookDocId) await updateDoc(doc(db, "books", t.bookDocId), { copies: increment(1) });
      await logActivity("Write-off reversed", `"${t.bookTitle}" restored to active loan`, actor);
      setMsg({ tone: "success", text: `Write-off reversed for "${t.bookTitle}".` });
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {msg && <Alert tone={msg.tone} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Copies lost" value={lostCount} tone="rose" sub="Removed from stock" />
        <StatCard label="Copies damaged" value={damagedCount} tone="amber" sub="Out of circulation" />
        <StatCard label="Charges raised" value={money(recoverable)} tone="slate" />
      </div>

      {pending && (
        <Card title={`Mark as ${pending.kind} — ${pending.txn.bookTitle}`}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label={`Replacement charge (${pending.kind === "lost" ? "full cost" : "repair cost"})`}
              type="number"
              value={charge}
              onChange={(e) => setCharge(e.target.value)}
            />
            <div className="sm:col-span-2">
              <Input
                label="Remarks (optional)"
                placeholder="e.g. water damage to first 40 pages"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            This removes one copy from stock and records {money(Number(charge) || 0)} against{" "}
            {pending.txn.studentName} ({pending.txn.studentUniId}). The action is logged in the audit trail
            and can be reversed below.
          </p>
          <div className="mt-3 flex gap-2">
            <PrimaryButton disabled={busy === pending.txn.id} onClick={confirmWriteOff}>
              Confirm write-off
            </PrimaryButton>
            <SecondaryButton onClick={() => setPending(null)}>Cancel</SecondaryButton>
          </div>
        </Card>
      )}

      <Card
        title={`Active loans — mark a copy (${active.length})`}
        right={
          <Input
            placeholder="Search member or book…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
        }
      >
        {error && <p className="text-sm text-rose-600">Could not load loans: {error}</p>}
        {loading ? (
          <SkeletonRows />
        ) : active.length === 0 ? (
          <EmptyState
            icon={<PackageX size={22} />}
            title="No active loans"
            hint="Only books currently issued to a member can be marked lost or damaged."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2 text-left font-medium">Member</th>
                  <th className="py-2 text-left font-medium">Book</th>
                  <th className="py-2 text-left font-medium">Due</th>
                  <th className="py-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {active.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-2.5">
                      <div className="font-medium text-slate-900">{t.studentName || "—"}</div>
                      <div className="text-xs text-slate-500">{t.studentUniId}</div>
                    </td>
                    <td className="py-2.5">
                      <div className="text-slate-900">{t.bookTitle || "—"}</div>
                      <div className="text-xs text-slate-500">{t.bookIsbn}</div>
                    </td>
                    <td className="py-2.5 text-slate-600">{fmtDate(t.dueDate)}</td>
                    <td className="py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <SecondaryButton
                          className="border-rose-200 text-rose-700 hover:bg-rose-50"
                          onClick={() => openDialog(t, "lost")}
                        >
                          <PackageX size={14} /> Lost
                        </SecondaryButton>
                        <SecondaryButton
                          className="border-amber-200 text-amber-700 hover:bg-amber-50"
                          onClick={() => openDialog(t, "damaged")}
                        >
                          <Wrench size={14} /> Damaged
                        </SecondaryButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title={`Write-off register (${writtenOff.length})`}
        right={
          <SecondaryButton
            onClick={() =>
              exportCsv(
                "write-offs",
                ["Member", "Student ID", "Book", "ISBN", "Condition", "Charge", "Marked on", "Remarks"],
                writtenOff.map((t) => [
                  t.studentName || "", t.studentUniId || "", t.bookTitle || "", t.bookIsbn || "",
                  t.status || "", t.replacementCharge ?? 0, fmtDate(t.markedAt), t.remarks || "",
                ])
              )
            }
          >
            <Download size={14} /> CSV
          </SecondaryButton>
        }
      >
        {writtenOff.length === 0 ? (
          <EmptyState
            icon={<Wrench size={22} />}
            title="Nothing written off"
            hint="Lost and damaged copies are recorded here with the charge raised against the member."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2 text-left font-medium">Member</th>
                  <th className="py-2 text-left font-medium">Book</th>
                  <th className="py-2 text-left font-medium">Condition</th>
                  <th className="py-2 text-left font-medium">Charge</th>
                  <th className="py-2 text-left font-medium">Marked on</th>
                  <th className="py-2 text-left font-medium">Remarks</th>
                  <th className="py-2 text-right font-medium">Reverse</th>
                </tr>
              </thead>
              <tbody>
                {writtenOff.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-2.5">
                      <div className="font-medium text-slate-900">{t.studentName || "—"}</div>
                      <div className="text-xs text-slate-500">{t.studentUniId}</div>
                    </td>
                    <td className="py-2.5 text-slate-900">{t.bookTitle || "—"}</td>
                    <td className="py-2.5">
                      <Badge
                        text={t.status || ""}
                        className={
                          t.status === "lost"
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        }
                      />
                    </td>
                    <td className="py-2.5 font-semibold text-slate-900">{money(t.replacementCharge ?? 0)}</td>
                    <td className="py-2.5 text-slate-600">{fmtDate(t.markedAt)}</td>
                    <td className="py-2.5 text-xs text-slate-500">{t.remarks || "—"}</td>
                    <td className="py-2.5 text-right">
                      <SecondaryButton disabled={busy === t.id} onClick={() => restore(t)}>
                        <Undo2 size={14} /> Undo
                      </SecondaryButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
