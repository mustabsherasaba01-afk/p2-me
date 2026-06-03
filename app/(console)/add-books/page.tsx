"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, Plus, Upload, X } from "lucide-react";
import ConsoleShell from "../_components/ConsoleShell";
import { Card, Input, PrimaryButton, SecondaryButton, Select, TextArea } from "../_components/ui";
import { collection, addDoc, serverTimestamp, writeBatch, doc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/authContext";

// ── CSV parsing ──────────────────────────────────────────────────────────────

type CsvRow = {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  year: string;
  category: string;
  copies: number;
  shelf: string;
};

function parseCsv(text: string): { rows: CsvRow[]; errors: string[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], errors: ["File is empty or has no data rows."] };

  const header = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/"/g, ""));
  const col = (name: string) => header.indexOf(name);

  const REQUIRED = ["title"];
  const missing = REQUIRED.filter((r) => col(r) === -1);
  if (missing.length) {
    return { rows: [], errors: [`CSV is missing required column(s): ${missing.join(", ")}`] };
  }

  const rows: CsvRow[] = [];
  const errors: string[] = [];

  lines.slice(1).forEach((line, idx) => {
    if (!line.trim()) return;
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const get = (name: string) => (col(name) !== -1 ? cells[col(name)] ?? "" : "");

    const title = get("title");
    if (!title) {
      errors.push(`Row ${idx + 2}: missing title — skipped.`);
      return;
    }
    rows.push({
      isbn: get("isbn") || get("accession_no") || get("accession no") || "",
      title,
      author: get("author") || "",
      publisher: get("publisher") || "",
      year: get("year") || "",
      category: get("category") || get("department") || "Others",
      copies: parseInt(get("copies") || "1") || 1,
      shelf: get("shelf") || "",
    });
  });

  return { rows, errors };
}

// ── Bulk Import Modal ────────────────────────────────────────────────────────

function BulkImportModal({
  onClose,
  addedBy,
}: {
  onClose: () => void;
  addedBy: string;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [rows, setRows] = React.useState<CsvRow[]>([]);
  const [parseErrors, setParseErrors] = React.useState<string[]>([]);
  const [fileName, setFileName] = React.useState("");
  const [uploadingState, setUploadingState] = React.useState(false);
  const [doneCount, setDoneCount] = React.useState(0);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setDoneCount(0);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows: parsed, errors } = parseCsv(text);
      setRows(parsed);
      setParseErrors(errors);
    };
    reader.readAsText(file);
  }

  async function uploadAll() {
    if (!rows.length) return;
    setUploadingState(true);
    setDoneCount(0);
    try {
      // Firestore writeBatch max 500 ops — chunk if needed
      const CHUNK = 400;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const batch = writeBatch(db);
        rows.slice(i, i + CHUNK).forEach((r) => {
          const ref = doc(collection(db, "books"));
          batch.set(ref, {
            isbn: r.isbn,
            title: r.title,
            author: r.author,
            publisher: r.publisher,
            year: r.year,
            category: r.category,
            copies: r.copies,
            available: r.copies,
            shelf: r.shelf,
            notes: "",
            addedAt: serverTimestamp(),
            addedBy,
          });
        });
        await batch.commit();
        setDoneCount((p) => p + Math.min(CHUNK, rows.length - i));
      }
    } finally {
      setUploadingState(false);
    }
  }

  const uploaded = doneCount === rows.length && rows.length > 0 && !uploadingState;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Batch Import Books</h2>
            <p className="text-xs text-slate-500 mt-0.5">Upload a CSV file to add multiple books at once.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Format hint */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
            <p className="font-semibold mb-1">Expected CSV columns (first row = header):</p>
            <code className="text-slate-500 break-all">isbn, title, author, publisher, year, category, copies, shelf</code>
            <p className="mt-1 text-slate-400">Only <strong className="text-slate-600">title</strong> is required. All other columns are optional.</p>
          </div>

          {/* File input */}
          {!uploaded && (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFile}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-2xl py-8 hover:border-blue-300 hover:bg-blue-50/30 transition-all text-slate-500 hover:text-blue-600"
              >
                <Upload className="h-8 w-8" />
                <span className="text-sm font-semibold">{fileName || "Click to select a CSV file"}</span>
                {fileName && <span className="text-xs text-slate-400">Click to change file</span>}
              </button>
            </div>
          )}

          {/* Parse errors */}
          {parseErrors.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 space-y-1">
              {parseErrors.map((e, i) => (
                <p key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{e}
                </p>
              ))}
            </div>
          )}

          {/* Preview table */}
          {rows.length > 0 && !uploaded && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">{rows.length} books ready to import (showing first 5)</p>
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      {["ISBN", "Title", "Author", "Category", "Copies"].map((h) => (
                        <th key={h} className="text-left font-semibold py-2 px-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="text-slate-700">
                        <td className="py-2 px-3 font-mono">{r.isbn || "—"}</td>
                        <td className="py-2 px-3 font-medium max-w-[140px] truncate">{r.title}</td>
                        <td className="py-2 px-3">{r.author || "—"}</td>
                        <td className="py-2 px-3">{r.category}</td>
                        <td className="py-2 px-3">{r.copies}</td>
                      </tr>
                    ))}
                    {rows.length > 5 && (
                      <tr>
                        <td colSpan={5} className="py-2 px-3 text-slate-400 italic">…and {rows.length - 5} more</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Upload progress */}
          {uploadingState && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Uploading…</span>
                <span>{doneCount} / {rows.length}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${(doneCount / rows.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Success */}
          {uploaded && (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <p className="text-base font-semibold text-slate-900">{doneCount} books imported successfully!</p>
              <p className="text-sm text-slate-500">They are now visible in Inventory and the student catalog.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <SecondaryButton type="button" onClick={onClose}>
            {uploaded ? "Close" : "Cancel"}
          </SecondaryButton>
          {!uploaded && (
            <PrimaryButton
              type="button"
              onClick={uploadAll}
              disabled={rows.length === 0 || uploadingState}
            >
              <Upload className="h-4 w-4" />
              {uploadingState ? `Importing… (${doneCount}/${rows.length})` : `Import ${rows.length} Book${rows.length !== 1 ? "s" : ""}`}
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function Page() {
  const { user } = useAuth();
  const [showImport, setShowImport] = React.useState(false);
  const [form, setForm] = React.useState({
    isbn: "", title: "", author: "", publisher: "",
    year: "", category: "Fiction", copies: "1", shelf: "", notes: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [success, setSuccess] = React.useState("");
  const [error, setError] = React.useState("");

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await addDoc(collection(db, "books"), {
        isbn: form.isbn.trim(),
        title: form.title.trim(),
        author: form.author.trim(),
        publisher: form.publisher.trim(),
        year: form.year.trim(),
        category: form.category,
        copies: parseInt(form.copies) || 1,
        available: parseInt(form.copies) || 1,
        shelf: form.shelf.trim(),
        notes: form.notes.trim(),
        addedAt: serverTimestamp(),
        addedBy: user?.role === "admin" ? user.email : "admin",
      });
      setSuccess(`"${form.title}" added to the library.`);
      setForm({ isbn: "", title: "", author: "", publisher: "", year: "", category: "Fiction", copies: "1", shelf: "", notes: "" });
    } catch {
      setError("Failed to save book. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const addedBy = user?.role === "admin" ? user.email : "admin";

  return (
    <>
      <ConsoleShell
        title="Add Books"
        subtitle="Add books to the library database."
        rightActions={
          <SecondaryButton type="button" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4" />
            Batch Import
          </SecondaryButton>
        }
      >
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
          <Card title="Add Book Form">
            {success && (
              <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">{success}</div>
            )}
            {error && (
              <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>
            )}
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="ISBN / Accession No." value={form.isbn} onChange={(e) => set("isbn", e.target.value)} placeholder="978... or ACC-001" />
                <Input label="Copies" value={form.copies} onChange={(e) => set("copies", e.target.value)} placeholder="1" type="number" />
                <Input label="Title *" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Book title" />
                <Input label="Author" value={form.author} onChange={(e) => set("author", e.target.value)} placeholder="Author name" />
                <Input label="Publisher" value={form.publisher} onChange={(e) => set("publisher", e.target.value)} placeholder="Publisher name" />
                <Input label="Year" value={form.year} onChange={(e) => set("year", e.target.value)} placeholder="2024" />
                <Select label="Category / Department" value={form.category} onChange={(e) => set("category", e.target.value)}>
                  <option>BBA</option>
                  <option>BSIT</option>
                  <option>Fiction</option>
                  <option>Non-Fiction</option>
                  <option>Children</option>
                  <option>History</option>
                  <option>Science</option>
                  <option>Others</option>
                </Select>
                <Input label="Shelf / Rack" value={form.shelf} onChange={(e) => set("shelf", e.target.value)} placeholder="A-12" />
              </div>
              <TextArea label="Notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional notes" />
              <div className="flex flex-wrap items-center gap-2">
                <PrimaryButton type="submit" disabled={saving}>
                  <Plus className="h-4 w-4" />
                  {saving ? "Saving…" : "Add Book"}
                </PrimaryButton>
                <SecondaryButton
                  type="button"
                  onClick={() => setForm({ isbn: "", title: "", author: "", publisher: "", year: "", category: "Fiction", copies: "1", shelf: "", notes: "" })}
                >
                  Reset
                </SecondaryButton>
              </div>
            </form>
          </Card>

          <Card title="Tips">
            <ul className="list-disc pl-5 text-sm text-slate-700 space-y-2">
              <li>Books saved here appear instantly in Inventory.</li>
              <li>Use shelf codes so books can be located quickly.</li>
              <li>ISBN is optional but helps identify books uniquely.</li>
              <li>Copies count sets the initial available count.</li>
              <li>Use <strong>Batch Import</strong> to upload many books via CSV.</li>
            </ul>
          </Card>
        </div>
      </ConsoleShell>

      {showImport && (
        <BulkImportModal onClose={() => setShowImport(false)} addedBy={addedBy} />
      )}
    </>
  );
}
