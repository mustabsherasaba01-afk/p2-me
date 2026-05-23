"use client";

import React from "react";
import StudentShell from "../_components/StudentShell";
import { Card, Badge } from "../../(console)/_components/ui";
import { Search, ArrowUpRight, BookOpen, Layers, Bookmark, Sparkles } from "lucide-react";
import allBooksData from "../../all_library_books.json";
import { collection, onSnapshot, orderBy, query, addDoc, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/authContext";
import { useSearchParams } from "next/navigation";

type Book = {
    isbn: string;
    title: string;
    author: string;
    category: string;
    copies: number;
    available: number;
    publisher: string;
    year: string;
    shelf?: string;
    isNew?: boolean;
};

const STATIC_BOOKS: Book[] = allBooksData.books.map((b: any) => {
    let title = (b.title || "").trim();
    let author = (b.author || "").trim();
    let publisher = (b.publisher || "").trim();
    const year = b.year || "N/A";
    if (!title && b.raw) title = (b.raw || "").trim();
    return {
        isbn: b.accession_no || "N/A",
        title: title || "Untitled",
        author: author || "Unknown",
        category: b.department || "Others",
        copies: b.copies || 1,
        available: b.copies || 1,
        publisher: publisher || "Unknown Publisher",
        year,
    };
});

export default function StudentCatalog() {
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const [q, setQ] = React.useState(searchParams.get("q") ?? "");
    const [category, setCategory] = React.useState("All");
    const [currentPage, setCurrentPage] = React.useState(1);
    const [firestoreBooks, setFirestoreBooks] = React.useState<Book[]>([]);
    const [bookingBook, setBookingBook] = React.useState<string | null>(null);
    const [bookingSuccess, setBookingSuccess] = React.useState("");
    const itemsPerPage = 12;

    React.useEffect(() => {
        const qRef = query(collection(db, "books"), orderBy("addedAt", "desc"));
        const unsub = onSnapshot(qRef, (snap) => {
            setFirestoreBooks(
                snap.docs.map((d) => {
                    const data = d.data();
                    return {
                        isbn: data.isbn || d.id,
                        title: data.title || "Untitled",
                        author: data.author || "Unknown",
                        category: data.category || "Others",
                        copies: data.copies || 1,
                        available: data.available || 0,
                        publisher: data.publisher || "",
                        year: data.year || "",
                        shelf: data.shelf || "",
                        isNew: true,
                    };
                })
            );
        });
        return unsub;
    }, []);

    // Firestore books shown first (new arrivals), then static catalog
    const ALL_BOOKS = [...firestoreBooks, ...STATIC_BOOKS];

    const filtered = ALL_BOOKS.filter((b) => {
        const matchesCategory = category === "All" || category === "All Departments" || b.category === category;
        const matchesQ =
            !q ||
            [b.isbn, b.title, b.author].join(" ").toLowerCase().includes(q.toLowerCase());
        return matchesCategory && matchesQ;
    });

    React.useEffect(() => { setCurrentPage(1); }, [q, category]);

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const [selectedBook, setSelectedBook] = React.useState<any>(null);

    async function handlePreBook(book: Book) {
        if (!user || user.role !== "student") return;
        setBookingBook(book.isbn);
        setBookingSuccess("");
        try {
            await addDoc(collection(db, "bookings"), {
                studentDocId: user.id,
                studentName: user.name,
                studentUniId: user.studentId,
                bookIsbn: book.isbn,
                bookTitle: book.title,
                bookAuthor: book.author,
                requestedAt: Timestamp.now(),
                status: "pending",
            });
            setBookingSuccess(`Pre-book request sent for "${book.title}". The librarian will confirm your request.`);
            setSelectedBook(null);
        } catch {
            setBookingSuccess("Failed to send request. Please try again.");
        } finally {
            setBookingBook(null);
        }
    }

    return (
        <StudentShell
            title="Library Catalog"
            subtitle="Search and explore thousands of free resources."
        >
            {/* Booking toast */}
            {bookingSuccess && (
                <div className="mb-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-sm font-bold text-emerald-700 flex items-center justify-between">
                    <span>{bookingSuccess}</span>
                    <button onClick={() => setBookingSuccess("")} className="ml-4 text-emerald-500 hover:text-emerald-700 text-lg leading-none">&times;</button>
                </div>
            )}

            {/* Search & Filter Header */}
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
                <div className="md:col-span-2 lg:col-span-3 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                        type="text"
                        className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm font-medium shadow-xl shadow-slate-200/40 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all"
                        placeholder="Search by Title, Author or ISBN number..."
                        value={q}
                        onChange={(e) => {
                            setQ(e.target.value);
                            setCurrentPage(1);
                        }}
                    />
                </div>

                <div className="md:col-span-1">
                    <select
                        className="w-full h-full bg-white border border-slate-200 rounded-2xl px-4 py-4 text-sm font-black text-slate-700 shadow-xl shadow-slate-200/40 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer"
                        value={category}
                        onChange={(e) => {
                            setCategory(e.target.value);
                            setCurrentPage(1);
                        }}
                    >
                        <option>All Departments</option>
                        <option>BBA</option>
                        <option>BSIT</option>
                        <option>Others</option>
                    </select>
                </div>

                <div className="md:col-span-1 bg-white border border-slate-200 rounded-2xl px-4 py-4 flex items-center justify-between shadow-xl shadow-slate-200/40">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Results</span>
                    <span className="text-xl font-black text-indigo-600">{filtered.length}</span>
                </div>
            </div>

            {/* Books Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
                {paginated.map((book, i) => (
                    <div
                        key={`${book.isbn}-${i}`}
                        onClick={() => setSelectedBook(book)}
                        className="group bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-400/5 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1.5 cursor-pointer relative"
                    >
                        <div className={`h-3 w-full bg-indigo-500/10 group-hover:bg-indigo-500 transition-colors duration-300`} />
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="h-10 w-10 rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center shadow-inner">
                                    <BookOpen className="h-5 w-5" />
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {book.isNew && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-black border-none">
                                            <Sparkles className="h-3 w-3" /> NEW
                                        </span>
                                    )}
                                    <Badge text={book.category} className="bg-slate-100 text-slate-500 font-black border-none px-2 py-0.5" />
                                </div>
                            </div>

                            <h3 className="text-lg font-black text-slate-900 leading-tight mb-2 group-hover:text-indigo-600 transition-colors line-clamp-2 min-h-[3.5rem] tracking-tight">{book.title}</h3>
                            <p className="text-sm font-bold text-slate-500 mb-6 flex items-center gap-2">
                                <span className="w-4 h-px bg-slate-300" />
                                {book.author}
                            </p>

                            <div className="mt-auto flex items-center justify-between border-t border-slate-50 pt-4">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status</span>
                                    <span className={`text-[11px] font-black uppercase tracking-tight ${book.available > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{book.available > 0 ? 'Available' : 'Issued'}</span>
                                </div>
                                <div className="p-2 rounded-xl bg-slate-50 group-hover:bg-indigo-900 group-hover:text-white transition-all shadow-sm">
                                    <ArrowUpRight className="h-4 w-4" />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 bg-white/50 backdrop-blur-md p-6 rounded-3xl border border-slate-200/50 shadow-2xl shadow-slate-200/20 max-w-lg mx-auto">
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-6 py-2.5 rounded-2xl bg-white border border-slate-200 text-sm font-black text-slate-900 hover:bg-slate-900 hover:text-white disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-900 transition-all shadow-sm"
                    >
                        PREV
                    </button>

                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest px-4 border-x border-slate-200">
                        Page <span className="text-indigo-600 text-lg mx-1">{currentPage}</span> / {totalPages}
                    </div>

                    <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-6 py-2.5 rounded-2xl bg-white border border-slate-200 text-sm font-black text-slate-900 hover:bg-slate-900 hover:text-white disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-900 transition-all shadow-sm"
                    >
                        NEXT
                    </button>
                </div>
            )}

            {/* Book Detail Overlay (Modal) */}
            {selectedBook && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-indigo-950/40 backdrop-blur-md" onClick={() => setSelectedBook(null)}>
                    <div
                        className="bg-white rounded-[40px] shadow-3xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 relative border border-white"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />

                        <div className="grid grid-cols-1 md:grid-cols-5 h-full">
                            {/* Book Decoration / Cover Placeholder */}
                            <div className="md:col-span-2 bg-indigo-900 relative p-12 flex flex-col justify-end">
                                <Bookmark className="absolute top-0 right-12 h-20 w-12 text-indigo-500 fill-indigo-500" />
                                <div className="relative z-10">
                                    <h2 className="text-4xl font-black text-white leading-tight tracking-tighter mb-4">{selectedBook.title}</h2>
                                    <div className="h-1.5 w-16 bg-white/30 rounded-full mb-6" />
                                    <p className="text-indigo-200 text-lg font-bold">By {selectedBook.author}</p>
                                </div>
                                <div className="absolute top-1/2 left-0 w-full h-full bg-indigo-400/10 blur-[60px] rounded-full pointer-events-none" />
                            </div>

                            {/* Details Side */}
                            <div className="md:col-span-3 p-10 bg-white relative">
                                <button
                                    onClick={() => setSelectedBook(null)}
                                    className="absolute top-6 right-6 p-2 rounded-2xl bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-95"
                                >
                                    <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='18' y1='6' x2='6' y2='18'%3E%3C/line%3E%3Cline x1='6' y1='6' x2='18' y2='18'%3E%3C/line%3E%3C/svg%3E" alt="close" className="w-5 h-5" />
                                </button>

                                <div className="mb-10">
                                    <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-black tracking-widest rounded-full uppercase mb-4">Catalog Overview</span>
                                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Technical Specifications</h3>
                                </div>

                                <div className="grid grid-cols-2 gap-x-8 gap-y-8 mb-10">
                                    <div>
                                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Department</span>
                                        <span className="text-sm font-black text-indigo-900 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">{selectedBook.category}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Year</span>
                                        <span className="text-sm font-black text-slate-900">{selectedBook.year}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Accession ID</span>
                                        <span className="text-sm font-mono font-black text-slate-900 break-all">{selectedBook.isbn}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Location</span>
                                        <div className="flex items-center gap-1.5">
                                            <Layers className="h-3.5 w-3.5 text-indigo-500" />
                                            <span className="text-sm font-black text-slate-900">{selectedBook.shelf || "Shelf B-12"}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 border-dashed mb-10">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Library Availability</span>
                                        <Badge text={selectedBook.available > 0 ? "In Stock" : "On Loan"} className={selectedBook.available > 0 ? "bg-emerald-100 text-emerald-700 border-none" : "bg-rose-100 text-rose-700 border-none"} />
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-black text-slate-900">{selectedBook.available}</span>
                                        <span className="text-sm font-bold text-slate-500">of {selectedBook.copies} copies available</span>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        onClick={() => handlePreBook(selectedBook)}
                                        disabled={selectedBook.available <= 0 || bookingBook === selectedBook.isbn}
                                        className="flex-1 bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-black transition-all shadow-xl shadow-slate-900/20 active:scale-95 disabled:opacity-30 disabled:hover:bg-slate-900"
                                    >
                                        {bookingBook === selectedBook.isbn
                                            ? "Sending Request…"
                                            : selectedBook.available > 0
                                            ? "PRE-BOOK THIS COPY"
                                            : "NOT AVAILABLE"}
                                    </button>
                                    <button className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all active:scale-95">
                                        <Bookmark className="h-6 w-6" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </StudentShell>
    );
}
