"use client";

import React from "react";
import { Search as SearchIcon, Download, MapPin, RotateCcw } from "lucide-react";
import ConsoleShell from "../_components/ConsoleShell";
import { Badge, Card, Input, Select, PrimaryButton, SecondaryButton } from "../_components/ui";
import { StatCard, EmptyState } from "../_components/bits";
import { useCollection, exportCsv, money } from "../_components/helpers";
import allBooksData from "../../all_library_books.json";

type RawBook = {
  department?: string;
  accession_no?: string;
  author?: string;
  title?: string;
  publisher?: string;
  year?: number | string;
  source?: string;
  cost?: number;
  copies?: number;
  raw?: string;
  pages?: string | number;
};

type Book = {
  accession: string;
  title: string;
  author: string;
  publisher: string;
  department: string;
  year: string;
  copies: number;
  cost: number;
  shelf: string;
};

/* Shelf location is derived deterministically from department + accession so the
   same book always maps to the same physical rack. */
function shelfFor(dept: string, accession: string) {
  const code = (dept || "GEN").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "GEN";
  const digits = (accession.match(/\d+/g) || ["0"]).join("");
  const rack = (parseInt(digits.slice(-3) || "0", 10) % 12) + 1;
  const shelf = (parseInt(digits.slice(-1) || "0", 10) % 6) + 1;
  return `${code}-R${String(rack).padStart(2, "0")}-S${shelf}`;
}

const CATALOG: Book[] = (allBooksData.books as RawBook[]).map((b) => {
  const title = (b.title || b.raw || "").trim() || "Untitled";
  const accession = b.accession_no || "—";
  const department = (b.department || "Others").trim();
  return {
    accession,
    title,
    author: (b.author || "").trim() || "Unknown",
    publisher: (b.publisher || "").trim() || "Unknown",
    department,
    year: String(b.year ?? "N/A"),
    copies: Number(b.copies ?? 1),
    cost: Number(b.cost ?? 0),
    shelf: shelfFor(department, accession),
  };
});

const DEPARTMENTS = ["All", ...[...new Set(CATALOG.map((b) => b.department))].sort()];
const PAGE_SIZE = 25;

type Txn = { bookIsbn?: string; status?: string };

export default function Page() {
  return (
    <ConsoleShell
      title="Advanced Catalogue Search"
      subtitle="Search across title, author, publisher, accession number, department, and year — with the physical shelf location for every result."
    >
      <Body />
    </ConsoleShell>
  );
}

function Body() {
  const { rows: txns } = useCollection<Txn>("transactions");

  const [f, setF] = React.useState({
    q: "",
    title: "",
    author: "",
    publisher: "",
    accession: "",
    department: "All",
    yearFrom: "",
    yearTo: "",
    availability: "All",
    sort: "title",
  });
  const [page, setPage] = React.useState(1);

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((p) => ({ ...p, [k]: v }));
    setPage(1);
  }

  function reset() {
    setF({
      q: "", title: "", author: "", publisher: "", accession: "",
      department: "All", yearFrom: "", yearTo: "", availability: "All", sort: "title",
    });
    setPage(1);
  }

  /* how many copies of each accession are currently on loan */
  const onLoan = React.useMemo(() => {
    const m = new Map<string, number>();
    txns.filter((t) => t.status === "active").forEach((t) => {
      const k = t.bookIsbn || "";
      m.set(k, (m.get(k) || 0) + 1);
    });
    return m;
  }, [txns]);

  const results = React.useMemo(() => {
    const has = (hay: string, needle: string) =>
      !needle.trim() || hay.toLowerCase().includes(needle.trim().toLowerCase());

    const out = CATALOG.filter((b) => {
      if (f.q.trim()) {
        const q = f.q.trim().toLowerCase();
        const blob = `${b.title} ${b.author} ${b.publisher} ${b.accession} ${b.department}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (!has(b.title, f.title)) return false;
      if (!has(b.author, f.author)) return false;
      if (!has(b.publisher, f.publisher)) return false;
      if (!has(b.accession, f.accession)) return false;
      if (f.department !== "All" && b.department !== f.department) return false;

      const y = parseInt(b.year, 10);
      if (f.yearFrom && (!Number.isFinite(y) || y < parseInt(f.yearFrom, 10))) return false;
      if (f.yearTo && (!Number.isFinite(y) || y > parseInt(f.yearTo, 10))) return false;

      if (f.availability !== "All") {
        const available = b.copies - (onLoan.get(b.accession) || 0);
        if (f.availability === "Available" && available <= 0) return false;
        if (f.availability === "On loan" && available > 0) return false;
      }
      return true;
    });

    out.sort((a, b) => {
      if (f.sort === "year") return (parseInt(b.year, 10) || 0) - (parseInt(a.year, 10) || 0);
      if (f.sort === "author") return a.author.localeCompare(b.author);
      if (f.sort === "accession") return a.accession.localeCompare(b.accession);
      return a.title.localeCompare(b.title);
    });
    return out;
  }, [f, onLoan]);

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const shown = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const stockValue = results.reduce((s, b) => s + b.cost * b.copies, 0);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Titles in catalogue" value={CATALOG.length.toLocaleString()} tone="blue" />
        <StatCard label="Matching this search" value={results.length.toLocaleString()} tone="sky" />
        <StatCard label="Stock value of results" value={money(stockValue)} tone="emerald" />
      </div>

      <Card
        title="Search filters"
        right={
          <SecondaryButton onClick={reset}>
            <RotateCcw size={14} /> Reset
          </SecondaryButton>
        }
      >
        <div className="grid gap-3">
          <Input
            label="Search everything"
            placeholder="Type anything — title, author, publisher, accession number…"
            value={f.q}
            onChange={(e) => set("q", e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input label="Title contains" value={f.title} onChange={(e) => set("title", e.target.value)} />
            <Input label="Author contains" value={f.author} onChange={(e) => set("author", e.target.value)} />
            <Input label="Publisher contains" value={f.publisher} onChange={(e) => set("publisher", e.target.value)} />
            <Input label="Accession no." value={f.accession} onChange={(e) => set("accession", e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Select label="Department" value={f.department} onChange={(e) => set("department", e.target.value)}>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </Select>
            <Input label="Year from" type="number" placeholder="1990" value={f.yearFrom} onChange={(e) => set("yearFrom", e.target.value)} />
            <Input label="Year to" type="number" placeholder="2026" value={f.yearTo} onChange={(e) => set("yearTo", e.target.value)} />
            <Select label="Availability" value={f.availability} onChange={(e) => set("availability", e.target.value)}>
              {["All", "Available", "On loan"].map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>
            <Select label="Sort by" value={f.sort} onChange={(e) => set("sort", e.target.value)}>
              <option value="title">Title (A–Z)</option>
              <option value="author">Author (A–Z)</option>
              <option value="year">Year (newest)</option>
              <option value="accession">Accession no.</option>
            </Select>
          </div>
        </div>
      </Card>

      <Card
        title={`Results (${results.length.toLocaleString()})`}
        right={
          <SecondaryButton
            onClick={() =>
              exportCsv(
                "catalogue-search",
                ["Accession", "Title", "Author", "Publisher", "Department", "Year", "Copies", "Shelf"],
                results.map((b) => [b.accession, b.title, b.author, b.publisher, b.department, b.year, b.copies, b.shelf])
              )
            }
          >
            <Download size={14} /> Export results
          </SecondaryButton>
        }
      >
        {results.length === 0 ? (
          <EmptyState
            icon={<SearchIcon size={22} />}
            title="No books match these filters"
            hint="Try clearing a filter or widening the year range."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-2 text-left font-medium">Accession</th>
                    <th className="py-2 text-left font-medium">Title / Author</th>
                    <th className="py-2 text-left font-medium">Publisher</th>
                    <th className="py-2 text-left font-medium">Dept</th>
                    <th className="py-2 text-left font-medium">Year</th>
                    <th className="py-2 text-left font-medium">Shelf</th>
                    <th className="py-2 text-right font-medium">Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((b, i) => {
                    const out = onLoan.get(b.accession) || 0;
                    const available = b.copies - out;
                    return (
                      <tr key={b.accession + i} className="border-b last:border-0">
                        <td className="py-2.5 font-mono text-xs text-slate-600">{b.accession}</td>
                        <td className="py-2.5">
                          <div className="font-medium text-slate-900">{b.title}</div>
                          <div className="text-xs text-slate-500">{b.author}</div>
                        </td>
                        <td className="py-2.5 text-slate-600">{b.publisher}</td>
                        <td className="py-2.5 text-slate-600">{b.department}</td>
                        <td className="py-2.5 text-slate-600">{b.year}</td>
                        <td className="py-2.5">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">
                            <MapPin size={11} /> {b.shelf}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          {available > 0 ? (
                            <Badge text={`${available} of ${b.copies} available`} className="border-emerald-200 bg-emerald-50 text-emerald-700" />
                          ) : (
                            <Badge text="all copies on loan" className="border-rose-200 bg-rose-50 text-rose-700" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-500">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, results.length)} of{" "}
                {results.length.toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <SecondaryButton disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </SecondaryButton>
                <span className="text-xs text-slate-600">
                  Page {page} of {totalPages}
                </span>
                <PrimaryButton disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </PrimaryButton>
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
