"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity, Bell, BookPlus, Boxes, ChevronDown, ClipboardCheck,
  Filter, GraduationCap, LayoutGrid, LogOut, Menu, Search, Settings, Users, X,
  BookMarked, Check, Trash2,
  RefreshCw, Banknote, ShieldCheck, BarChart3, PackageX, History, ScanSearch,
} from "lucide-react";
import { cn } from "./ui";
import { ConsoleProvider, useConsole } from "./ConsoleContext";
import { useAuth } from "../../lib/authContext";
import { collection, query, where, onSnapshot, updateDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

/* ── child components that consume ConsoleContext ── */

function SideLink({ href, icon, label, onClick }: { href: string; icon: React.ReactNode; label: string; onClick?: () => void }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link href={href} onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm border border-transparent transition-colors",
        active ? "bg-white/80 text-sky-900 border-sky-200" : "text-white hover:bg-white/15"
      )}
    >
      <span className={cn(active ? "text-sky-800" : "text-white/90")}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
    </Link>
  );
}

function SideSection({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: "14px 12px 6px",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.55)",
      }}
    >
      {label}
    </div>
  );
}

/* ── Admin notification bell (pre-book requests) ── */

type Booking = {
  id: string;
  studentName: string;
  studentUniId: string;
  bookTitle: string;
  bookIsbn: string;
  requestedAt: { seconds: number } | null;
  status: string;
};

function AdminNotificationBell() {
  const [open, setOpen] = React.useState(false);
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Single-field query to avoid needing a composite index
    const q = query(collection(db, "bookings"), where("status", "==", "pending"));
    return onSnapshot(q, (snap) => {
      setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Booking)));
    }, (err) => {
      console.error("Admin notification query failed:", err);
    });
  }, []);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function approve(b: Booking) {
    await updateDoc(doc(db, "bookings", b.id), {
      status: "approved",
      respondedAt: Timestamp.now(),
    });
  }

  async function dismiss(b: Booking) {
    await updateDoc(doc(db, "bookings", b.id), {
      status: "rejected",
      respondedAt: Timestamp.now(),
    });
  }

  function fmt(ts: { seconds: number } | null) {
    if (!ts) return "";
    return new Date(ts.seconds * 1000).toLocaleDateString("en-PK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((p) => !p)}
        style={{ position: "relative", border: "1px solid #e2e8f0", borderRadius: 20, padding: 8, background: "white", cursor: "pointer" }}
      >
        <Bell size={15} color="#475569" />
        {bookings.length > 0 && (
          <span style={{
            position: "absolute", top: 2, right: 2,
            minWidth: 16, height: 16, borderRadius: "50%",
            background: "#ef4444", color: "white",
            fontSize: 9, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid white", padding: "0 2px",
          }}>
            {bookings.length}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)",
          width: 320, background: "white", borderRadius: 16,
          border: "1px solid #e2e8f0", boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          zIndex: 100, overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Pre-Book Requests</span>
            {bookings.length > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "#dc2626", background: "#fef2f2", padding: "2px 8px", borderRadius: 999 }}>
                {bookings.length} pending
              </span>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            {bookings.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                <BookMarked size={28} style={{ margin: "0 auto 8px", color: "#cbd5e1" }} />
                <p style={{ margin: 0, fontWeight: 600 }}>No pending requests</p>
                <p style={{ margin: "4px 0 0", fontSize: 11 }}>Students' pre-book requests appear here.</p>
              </div>
            ) : (
              bookings.map((b) => (
                <div key={b.id} style={{ padding: "12px 16px", borderBottom: "1px solid #f8fafc", background: "#fffbeb" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: "#fef3c7", display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <BookMarked size={15} color="#d97706" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.bookTitle}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>
                        <span style={{ fontWeight: 600 }}>{b.studentName}</span> · {b.studentUniId}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 10, color: "#94a3b8" }}>{fmt(b.requestedAt)}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <button
                      onClick={() => approve(b)}
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "5px 0", borderRadius: 8, border: "none", background: "#dcfce7", color: "#16a34a", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >
                      <Check size={12} /> Approve
                    </button>
                    <button
                      onClick={() => dismiss(b)}
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "5px 0", borderRadius: 8, border: "none", background: "#fee2e2", color: "#dc2626", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >
                      <Trash2 size={12} /> Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TopBar({ title, subtitle, rightActions, onHamburger, isDesktop, adminEmail }: {
  title: string; subtitle?: string; rightActions?: React.ReactNode;
  onHamburger: () => void; isDesktop: boolean; adminEmail: string;
}) {
  const { search, setSearch, range, setRange, showFilters, setShowFilters } = useConsole();
  const { logout } = useAuth();
  return (
    <div style={{ background: "white", borderBottom: "1px solid #e2e8f0", padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {!isDesktop && (
            <button onClick={onHamburger}
              style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 12px", cursor: "pointer" }}>
              <Menu size={18} color="#334155" />
            </button>
          )}
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: "#0f172a", margin: 0 }}>{title}</h1>
            {subtitle && <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>{subtitle}</p>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setShowFilters(!showFilters)}
            style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 12px", background: "white", cursor: "pointer", fontSize: 13, color: "#475569" }}>
            <Filter size={15} color="#94a3b8" /> Filters
          </button>
          {rightActions}
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 640 }}>
          <Search size={15} color="#94a3b8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search: ISBN, Title, Author, Member…"
            style={{ width: "100%", paddingLeft: 38, paddingRight: 16, paddingTop: 10, paddingBottom: 10, border: "1px solid #e2e8f0", borderRadius: 20, fontSize: 13, outline: "none", color: "#0f172a", background: "white", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          <button onClick={() => setRange(range === "Last 6 months" ? "Last 30 days" : "Last 6 months")}
            style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #e2e8f0", borderRadius: 20, padding: "8px 12px", background: "white", cursor: "pointer", fontSize: 13, color: "#475569" }}>
            <Activity size={15} color="#94a3b8" /> {range} <ChevronDown size={14} color="#94a3b8" />
          </button>
          <AdminNotificationBell />
          <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #e2e8f0", borderRadius: 20, padding: "6px 12px" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#0369a1", color: "white", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>
              {adminEmail[0].toUpperCase()}
            </div>
            <div style={{ lineHeight: 1.3 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>{adminEmail.split("@")[0]}</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Librarian</div>
            </div>
          </div>
          <button 
            onClick={() => { if(confirm("Are you sure you want to logout?")) logout(); }}
            style={{ border: "1px solid #fee2e2", borderRadius: 20, padding: "8px 12px", background: "#fef2f2", cursor: "pointer", fontSize: 12, color: "#ef4444", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterDropdown() {
  const { showFilters, setShowFilters, availability, setAvailability } = useConsole();
  if (!showFilters) return null;
  return (
    <div style={{ position: "absolute", right: 24, top: 8, zIndex: 50, width: 240, background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontWeight: 500, fontSize: 13 }}>Filters</span>
        <button onClick={() => setShowFilters(false)} style={{ fontSize: 12, color: "#94a3b8", background: "none", border: "none", cursor: "pointer" }}>Close</button>
      </div>
      <div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Availability</div>
        <select value={availability} onChange={(e) => setAvailability(e.target.value as "All" | "Available" | "Unavailable")}
          style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 20, padding: "8px 12px", fontSize: 13, outline: "none" }}>
          <option>All</option>
          <option>Available</option>
          <option>Unavailable</option>
        </select>
      </div>
    </div>
  );
}

/* ── main shell ── */

export default function ConsoleShell({ title, subtitle, children, rightActions }: {
  title: string; subtitle?: string; rightActions?: React.ReactNode; children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [isDesktop, setIsDesktop] = React.useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  // Reliable breakpoint via JS — no Tailwind responsive classes
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const h = (e: MediaQueryListEvent) => { setIsDesktop(e.matches); if (e.matches) setSidebarOpen(false); };
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // Close drawer on navigation
  React.useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // Auth guard — must be above any return
  React.useEffect(() => {
    if (!loading && user?.role !== "admin") router.push("/login");
  }, [user, loading, router]);

  if (loading || user?.role !== "admin") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        <span style={{ color: "#94a3b8", fontSize: 14 }}>Loading…</span>
      </div>
    );
  }

  const closeDrawer = () => setSidebarOpen(false);

  const sidebarContent = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Logo */}
      <div style={{ padding: "24px 24px 8px", display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.15)", color: "white", display: "grid", placeItems: "center", fontWeight: 600, fontSize: 14, border: "1px solid rgba(255,255,255,0.2)" }}>L</div>
          <div>
            <div style={{ color: "white", fontWeight: 600, fontSize: 14 }}>LSIT LIBRARY</div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>Operations Console</div>
          </div>
        </div>
        {!isDesktop && (
          <button onClick={() => setSidebarOpen(false)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, color: "white" }}>
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ padding: 12, flex: 1, overflowY: "auto" }}>
        <SideLink href="/dashboard" icon={<LayoutGrid size={16} />} label="Dashboard" onClick={closeDrawer} />

        <SideSection label="Circulation" />
        <SideLink href="/checkout" icon={<ClipboardCheck size={16} />} label="Issue / Return" onClick={closeDrawer} />
        <SideLink href="/reservations" icon={<BookMarked size={16} />} label="Reservations" onClick={closeDrawer} />
        <SideLink href="/renewals" icon={<RefreshCw size={16} />} label="Renewals" onClick={closeDrawer} />
        <SideLink href="/notifications" icon={<Bell size={16} />} label="Reminders" onClick={closeDrawer} />

        <SideSection label="Catalogue" />
        <SideLink href="/search" icon={<ScanSearch size={16} />} label="Advanced Search" onClick={closeDrawer} />
        <SideLink href="/inventory" icon={<Boxes size={16} />} label="Inventory" onClick={closeDrawer} />
        <SideLink href="/add-books" icon={<BookPlus size={16} />} label="Add Books" onClick={closeDrawer} />
        <SideLink href="/lost-damaged" icon={<PackageX size={16} />} label="Lost & Damaged" onClick={closeDrawer} />
        <SideLink href="/thesis" icon={<GraduationCap size={16} />} label="Thesis Repository" onClick={closeDrawer} />

        <SideSection label="Members & Finance" />
        <SideLink href="/members" icon={<Users size={16} />} label="Members" onClick={closeDrawer} />
        <SideLink href="/fines" icon={<Banknote size={16} />} label="Fines & Payments" onClick={closeDrawer} />
        <SideLink href="/clearance" icon={<ShieldCheck size={16} />} label="Clearance (No-Dues)" onClick={closeDrawer} />

        <SideSection label="Insights" />
        <SideLink href="/reports" icon={<BarChart3 size={16} />} label="Reports & Analytics" onClick={closeDrawer} />
        <SideLink href="/audit" icon={<History size={16} />} label="Audit Trail" onClick={closeDrawer} />

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", margin: "12px 0" }} />
        <SideLink href="/settings" icon={<Settings size={16} />} label="Settings" onClick={closeDrawer} />
      </nav>

      {/* Logout */}
      <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(255,255,255,0.2)" }}>
        <button onClick={logout}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", color: "white", fontSize: 14, padding: "8px 12px", borderRadius: 12 }}>
          <LogOut size={16} /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <ConsoleProvider>
      <div style={{ minHeight: "100vh", display: "flex", background: "#f8fafc" }}>

        {/* DESKTOP sidebar — always in DOM, static */}
        {isDesktop && (
          <aside
            style={{
              width: 280,
              minWidth: 280,
              background: "#0369a1",
              flexShrink: 0,
              position: "sticky",
              top: 0,
              height: "100vh",
              overflow: "hidden",
            }}
          >
            {sidebarContent}
          </aside>
        )}

        {/* MOBILE sidebar drawer — only in DOM when open, no backdrop */}
        {!isDesktop && sidebarOpen && (
          <aside style={{ position: "fixed", top: 0, bottom: 0, left: 0, width: 280, background: "#0369a1", zIndex: 999, boxShadow: "4px 0 32px rgba(0,0,0,0.2)", overflowY: "auto" }}>
            {sidebarContent}
          </aside>
        )}

        {/* Main area — always full width on mobile, 1fr on desktop */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          <TopBar
            title={title}
            subtitle={subtitle}
            rightActions={rightActions}
            onHamburger={() => setSidebarOpen(true)}
            isDesktop={isDesktop}
            adminEmail={user.email}
          />
          <div style={{ position: "relative", flex: 1 }}>
            <FilterDropdown />
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
              {children}
            </div>
          </div>
        </div>

      </div>
    </ConsoleProvider>
  );
}
