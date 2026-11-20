import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  Building2,
  CalendarClock,
  ChevronDown,
  CreditCard,
  Eye,
  FileSearch,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Library,
  LogOut,
  MapPin,
  Menu,
  MonitorSmartphone,
  PanelLeftClose,
  PanelLeftOpen,
  QrCode,
  Repeat,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  Compass,
  TrendingUp,
  User,
  Users,
  X,
} from 'lucide-react';
import { useAuth, getDefaultRouteForRole } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { SmartLibApi } from '../services/api';
import { Button } from '../components/ui/Primitives';

export function PublicLayout() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--sl-bg)] text-[var(--sl-text)]">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-[#F7F5EF]/95 border-b border-[var(--sl-border)]">
        <div className="max-w-7xl mx-auto px-6 h-15 flex items-center justify-between gap-8">
          <Link
            to="/"
            className="font-display text-lg font-semibold tracking-tight text-[#252720] whitespace-nowrap shrink-0"
          >
            SmartLib
          </Link>

          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[#666860]"
          >
            <Link to="/#capabilities" className="hover:text-[#252720] transition-colors whitespace-nowrap shrink-0">
              Capabilities
            </Link>
            <Link to="/#catalog" className="hover:text-[#252720] transition-colors whitespace-nowrap shrink-0">
              Holdings
            </Link>
            <Link to="/about" className="hover:text-[#252720] transition-colors whitespace-nowrap shrink-0">
              About
            </Link>
            <Link to="/register" className="hover:text-[#252720] transition-colors whitespace-nowrap shrink-0">
              Register
            </Link>
          </nav>

          <div className="shrink-0">
            <Link
              to={user ? getDefaultRouteForRole(user.role) : '/login'}
              className="inline-flex items-center justify-center h-9 px-4 text-[13px] font-medium text-white bg-[#526B50] hover:bg-[#425840] rounded transition-colors whitespace-nowrap shrink-0"
            >
              {user ? 'Open Workspace' : 'Sign In'}
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-[var(--sl-border)] bg-white">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 pb-6 border-b border-[var(--sl-border)]">
            <div>
              <p className="font-display text-base font-semibold tracking-tight text-[#252720]">
                SmartLib.
              </p>
              <p className="mt-1.5 text-sm text-[var(--sl-muted)]">
                A smarter way to discover, manage and experience knowledge.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-xs text-[var(--sl-muted)]">
              <Link to="/about" className="hover:text-[#252720] transition-colors">
                About
              </Link>
              <Link to="/login" className="hover:text-[#252720] transition-colors">
                Member Sign In
              </Link>
              <Link to="/register" className="hover:text-[#252720] transition-colors">
                Registration
              </Link>
            </div>
          </div>

          <div className="pt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-[var(--sl-subtle)]">
            <p>© 2026 SmartLib. All rights reserved.</p>
            <p className="text-[var(--sl-muted)]">
              Designed &amp; Developed by <span className="font-medium text-[#252720]">Subhadeep Sen</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

const ROLE_NAV_GROUPS = {
  STUDENT: [
    {
      section: 'Library',
      items: [
        { to: '/student', label: 'Overview', icon: LayoutDashboard, end: true },
        { to: '/student/explore', label: 'Book Catalogue', icon: BookOpen },
        { to: '/student/borrowings', label: 'My Borrowings', icon: BookMarked },
        { to: '/student/reservations', label: 'Reservations', icon: CalendarClock },
      ],
    },
    {
      section: 'Academic & Study',
      items: [
        { to: '/student/seats', label: 'Study Seats', icon: Layers },
        { to: '/student/shelf-locator', label: 'Shelf Locator', icon: MapPin },
        { to: '/student/research', label: 'Research Notes', icon: FileSearch },
        { to: '/student/courses', label: 'Course Lists', icon: GraduationCap },
      ],
    },
    {
      section: 'Reading & Campus',
      items: [
        { to: '/student/reading-dna', label: 'Reading DNA', icon: Activity },
        { to: '/student/recommendations', label: 'Recommendations', icon: Compass },
        { to: '/student/challenges', label: 'Challenges', icon: Award },
        { to: '/student/exchange', label: 'Book Exchange', icon: Repeat },
      ],
    },
    {
      section: 'Account',
      items: [
        { to: '/student/card', label: 'Digital Card & Fines', icon: QrCode },
        { to: '/kiosk', label: 'Self-Service Kiosk', icon: MonitorSmartphone },
        { to: '/student/profile', label: 'Preferences', icon: User },
      ],
    },
  ],
  FACULTY: [
    {
      section: 'Library',
      items: [
        { to: '/student', label: 'Overview', icon: LayoutDashboard, end: true },
        { to: '/student/explore', label: 'Book Catalogue', icon: BookOpen },
        { to: '/student/borrowings', label: 'My Borrowings', icon: BookMarked },
        { to: '/student/reservations', label: 'Reservations', icon: CalendarClock },
      ],
    },
    {
      section: 'Teaching & Research',
      items: [
        { to: '/student/courses', label: 'Course Reading Lists', icon: GraduationCap },
        { to: '/student/research', label: 'Research Companion', icon: FileSearch },
        { to: '/student/shelf-locator', label: 'Shelf Locator', icon: MapPin },
        { to: '/student/seats', label: 'Study Seats', icon: Layers },
      ],
    },
    {
      section: 'Discovery & Account',
      items: [
        { to: '/student/reading-dna', label: 'Reading DNA', icon: Activity },
        { to: '/student/recommendations', label: 'Recommendations', icon: Compass },
        { to: '/student/exchange', label: 'Book Exchange', icon: Repeat },
        { to: '/student/card', label: 'Digital Card', icon: QrCode },
        { to: '/kiosk', label: 'Self-Service Kiosk', icon: MonitorSmartphone },
      ],
    },
  ],
  LIBRARIAN: [
    {
      section: 'Circulation',
      items: [
        { to: '/librarian', label: 'Operations Overview', icon: LayoutDashboard, end: true },
        { to: '/librarian/circulation', label: 'Issue & Return Desk', icon: BookMarked },
        { to: '/librarian/reservations', label: 'Reservation Queue', icon: CalendarClock },
        { to: '/librarian/fines', label: 'Fine Ledger', icon: CreditCard },
      ],
    },
    {
      section: 'Catalogue & Floor',
      items: [
        { to: '/librarian/books', label: 'Book Catalogue', icon: BookOpen },
        { to: '/librarian/inventory', label: 'Physical Copies', icon: Library },
        { to: '/librarian/shelf', label: 'Shelf & Lost/Found', icon: MapPin },
        { to: '/librarian/seats', label: 'Study Seats', icon: Layers },
      ],
    },
    {
      section: 'Members & Analytics',
      items: [
        { to: '/librarian/members', label: 'Member Directory', icon: Users },
        { to: '/librarian/demand', label: 'Demand Analytics', icon: TrendingUp },
        { to: '/librarian/acquisitions', label: 'Acquisitions', icon: BarChart3 },
        { to: '/kiosk', label: 'Self-Service Kiosk', icon: MonitorSmartphone },
      ],
    },
  ],
  BRANCH_ADMIN: [
    {
      section: 'Branch Overview',
      items: [
        { to: '/branch-admin', label: 'Branch Dashboard', icon: LayoutDashboard, end: true },
        { to: '/branch-admin/librarians', label: 'Branch Staff', icon: Users },
        { to: '/branch-admin/policies', label: 'Branch Policies', icon: Scale },
      ],
    },
    {
      section: 'Inventory & Transfers',
      items: [
        { to: '/librarian/inventory', label: 'Branch Inventory', icon: Library },
        { to: '/branch-admin/transfers', label: 'Inter-Branch Transfers', icon: Repeat },
        { to: '/librarian/seats', label: 'Seat Utilization', icon: Layers },
      ],
    },
    {
      section: 'Intelligence & Audit',
      items: [
        { to: '/librarian/demand', label: 'Demand & Forecasts', icon: TrendingUp },
        { to: '/branch-admin/audit', label: 'Branch Audit Log', icon: ShieldCheck },
      ],
    },
  ],
  SUPER_ADMIN: [
    {
      section: 'Governance',
      items: [
        { to: '/super-admin', label: 'Organization Overview', icon: LayoutDashboard, end: true },
        { to: '/super-admin/branches', label: 'Library Branches', icon: Building2 },
        { to: '/super-admin/users', label: 'Institutional Users', icon: Users },
        { to: '/super-admin/policies', label: 'Global Policies', icon: Scale },
      ],
    },
    {
      section: 'Operations & Compliance',
      items: [
        { to: '/branch-admin/transfers', label: 'Inter-Branch Transfers', icon: Repeat },
        { to: '/librarian/demand', label: 'Demand Forecasts', icon: TrendingUp },
        { to: '/super-admin/audit', label: 'System Audit Trail', icon: ShieldCheck },
        { to: '/super-admin/settings', label: 'System Settings', icon: Settings },
      ],
    },
  ],
};

function getInitials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || 'SL';
}

export function AppShellLayout() {
  const { user, logout } = useAuth();
  const { fontScale, setFontScale, highContrast, setHighContrast } = useAccessibility();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openMenu, setOpenMenu] = useState(null); // 'notif' | 'profile' | 'search' | null
  const [notifications, setNotifications] = useState([]);
  const [quickQuery, setQuickQuery] = useState('');
  const [quickBooks, setQuickBooks] = useState([]);
  const searchRef = useRef(null);

  const navGroups = ROLE_NAV_GROUPS[user?.role] || ROLE_NAV_GROUPS.STUDENT;
  const flatNavItems = useMemo(() => navGroups.flatMap((g) => g.items.map((item) => ({ ...item, section: g.section }))), [navGroups]);

  const activeBreadcrumb = useMemo(() => {
    const match =
      flatNavItems.find((item) => item.to === location.pathname) ||
      flatNavItems.find((item) => !item.end && location.pathname.startsWith(item.to + '/'));
    return match || { section: 'Workspace', label: 'Overview' };
  }, [flatNavItems, location.pathname]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    SmartLibApi.getNotifications()
      .then(setNotifications)
      .catch(() => {});
  }, [user?.id]);

  // Global quick-search books when user types
  useEffect(() => {
    const q = quickQuery.trim();
    if (!q) {
      setQuickBooks([]);
      return;
    }
    const timer = setTimeout(() => {
      SmartLibApi.getBooks({ search: q })
        .then((res) => setQuickBooks(res.slice(0, 5)))
        .catch(() => {});
    }, 180);
    return () => clearTimeout(timer);
  }, [quickQuery]);

  // Close menus on outside click or route change
  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const matchedRoutes = useMemo(() => {
    const q = quickQuery.trim().toLowerCase();
    if (!q) return [];
    return flatNavItems.filter((item) => item.label.toLowerCase().includes(q)).slice(0, 4);
  }, [flatNavItems, quickQuery]);

  const handleMarkRead = async (id) => {
    try {
      await SmartLibApi.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      // ignore
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const roleLabel = user?.role?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="min-h-screen flex bg-[var(--sl-bg)] text-[var(--sl-text)]">
      <a href="#workspace-main" className="skip-link">
        Skip to workspace content
      </a>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-[#252720]/35 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Collapsible Grouped Enterprise Sidebar */}
      <aside
        aria-label="Workspace navigation"
        className={`fixed inset-y-0 left-0 z-40 bg-[var(--sl-card)] border-r border-[var(--sl-border)] flex flex-col transition-all duration-150 lg:static lg:translate-x-0 shrink-0 ${
          mobileOpen ? 'translate-x-0 w-60' : '-translate-x-full'
        } ${collapsed ? 'lg:w-[64px]' : 'lg:w-60'}`}
      >
        <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--sl-border)] shrink-0">
          <Link
            to={getDefaultRouteForRole(user?.role)}
            className="font-display text-base font-semibold tracking-tight text-[var(--sl-text)] whitespace-nowrap overflow-hidden"
            title="SmartLib"
          >
            {collapsed ? 'SL' : 'SmartLib'}
          </Link>

          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:inline-flex p-1.5 rounded text-[var(--sl-muted)] hover:text-[var(--sl-text)] hover:bg-[var(--sl-surface)] cursor-pointer"
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
            className="lg:hidden p-1.5 text-[var(--sl-muted)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5">
          {navGroups.map((group) => (
            <div key={group.section}>
              {!collapsed && (
                <p className="px-2.5 mb-1.5 text-[11px] font-medium text-[var(--sl-subtle)] tracking-wide">
                  {group.section}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      title={collapsed ? item.label : undefined}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center ${
                          collapsed ? 'justify-center px-2' : 'gap-2.5 px-2.5'
                        } py-2 rounded text-[13.5px] transition-colors duration-150 ${
                          isActive
                            ? 'bg-[#526B50] text-white font-medium'
                            : 'text-[var(--sl-muted)] hover:text-[var(--sl-text)] hover:bg-[var(--sl-surface)]'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-2.5 border-t border-[var(--sl-border)] shrink-0">
          <button
            type="button"
            onClick={handleLogout}
            title="Sign Out"
            className={`w-full flex items-center ${
              collapsed ? 'justify-center px-2' : 'gap-2.5 px-2.5'
            } py-2 text-[13px] text-[var(--sl-muted)] hover:text-[#B66F50] hover:bg-[var(--sl-surface)] rounded transition-colors cursor-pointer`}
          >
            <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Workspace Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Enterprise Top Header: Breadcrumb — Global Search — Notifications & Account Menu */}
        <header className="h-14 bg-[var(--sl-card)] border-b border-[var(--sl-border)] px-4 sm:px-7 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-1.5 rounded border border-[var(--sl-border)] text-[var(--sl-text)]"
            >
              <Menu className="w-4 h-4" />
            </button>
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px] min-w-0">
              <span className="text-[var(--sl-subtle)] hidden sm:inline truncate">{activeBreadcrumb.section}</span>
              <span className="text-[var(--sl-border-strong)] hidden sm:inline" aria-hidden="true">/</span>
              <span className="font-display font-medium text-[var(--sl-text)] truncate">
                {activeBreadcrumb.label}
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Functional Global Quick Search */}
            <div ref={searchRef} className="relative hidden md:block w-64 lg:w-72">
              <Search className="w-3.5 h-3.5 text-[var(--sl-subtle)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={quickQuery}
                onFocus={() => setOpenMenu('search')}
                onChange={(e) => {
                  setQuickQuery(e.target.value);
                  setOpenMenu('search');
                }}
                placeholder="Search catalogue or jump to page..."
                aria-label="Quick search catalogue and navigation"
                className="w-full h-8 pl-8 pr-3 text-xs bg-[var(--sl-bg)] text-[var(--sl-text)] border border-[var(--sl-border)] rounded placeholder:text-[var(--sl-subtle)] focus:bg-white focus:border-[#526B50] focus:outline-none transition-colors"
              />

              {openMenu === 'search' && quickQuery.trim() && (
                <div className="sl-animate-in absolute right-0 top-10 w-80 bg-white border border-[var(--sl-border-strong)] rounded-md shadow-lg z-50 overflow-hidden">
                  {matchedRoutes.length > 0 && (
                    <div className="p-2 border-b border-[var(--sl-border)]">
                      <p className="px-2 py-1 text-[11px] font-medium text-[var(--sl-subtle)]">Navigation</p>
                      {matchedRoutes.map((r) => (
                        <button
                          key={r.to}
                          type="button"
                          onClick={() => {
                            navigate(r.to);
                            setQuickQuery('');
                            setOpenMenu(null);
                          }}
                          className="w-full text-left px-2.5 py-1.5 text-xs text-[var(--sl-text)] hover:bg-[var(--sl-surface)] rounded flex items-center justify-between cursor-pointer"
                        >
                          <span>{r.label}</span>
                          <span className="text-[11px] text-[var(--sl-subtle)]">{r.section}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="p-2">
                    <p className="px-2 py-1 text-[11px] font-medium text-[var(--sl-subtle)]">Catalogue Matches</p>
                    {quickBooks.length === 0 ? (
                      <p className="px-2.5 py-2 text-xs text-[var(--sl-muted)]">No matching volumes found.</p>
                    ) : (
                      quickBooks.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            const target =
                              user?.role === 'LIBRARIAN'
                                ? '/librarian/books'
                                : `/student/explore?q=${encodeURIComponent(b.title)}`;
                            navigate(target);
                            setQuickQuery('');
                            setOpenMenu(null);
                          }}
                          className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-[var(--sl-surface)] rounded cursor-pointer"
                        >
                          <p className="font-medium text-[var(--sl-text)] truncate">{b.title}</p>
                          <p className="text-[11px] text-[var(--sl-muted)] truncate">
                            {b.authors.join(', ')} · {b.availableCopies}/{b.totalCopies} available
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Notifications Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu((m) => (m === 'notif' ? null : 'notif'))}
                aria-label={`Notifications (${unreadCount} unread)`}
                aria-expanded={openMenu === 'notif'}
                className="relative inline-flex items-center justify-center h-8 px-2.5 gap-1.5 text-xs font-medium text-[var(--sl-text)] border border-[var(--sl-border)] rounded hover:bg-[var(--sl-surface)] transition-colors cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5 text-[var(--sl-muted)]" />
                <span className="tabular-nums">{unreadCount}</span>
              </button>

              {openMenu === 'notif' && (
                <div className="sl-animate-in absolute right-0 top-10 w-80 sm:w-96 bg-[var(--sl-card)] border border-[var(--sl-border-strong)] rounded-md shadow-lg z-50 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[var(--sl-border)] flex items-center justify-between bg-[var(--sl-bg)]/50">
                    <h3 className="text-xs font-display font-semibold text-[var(--sl-text)]">Notifications</h3>
                    <button
                      type="button"
                      onClick={() => setOpenMenu(null)}
                      aria-label="Close notifications"
                      className="text-[var(--sl-muted)] hover:text-[var(--sl-text)] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-[var(--sl-border)]">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-xs text-[var(--sl-muted)]">No notifications at this time.</p>
                    ) : (
                      notifications.slice(0, 10).map((n) => (
                        <div
                          key={n.id}
                          className={`p-3.5 text-xs ${n.read ? 'bg-[var(--sl-card)]' : 'bg-[#EEF3ED]/70'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-[var(--sl-text)]">{n.title}</p>
                            {!n.read && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="!h-6 !px-2 text-[11px]"
                                onClick={() => handleMarkRead(n.id)}
                              >
                                Mark read
                              </Button>
                            )}
                          </div>
                          <p className="mt-1 text-[var(--sl-muted)] leading-relaxed">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Account & Display Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu((m) => (m === 'profile' ? null : 'profile'))}
                aria-label="Account and display menu"
                aria-expanded={openMenu === 'profile'}
                className="inline-flex items-center gap-2 h-8 pl-1.5 pr-2.5 text-xs font-medium text-[var(--sl-text)] border border-[var(--sl-border)] rounded hover:bg-[var(--sl-surface)] transition-colors cursor-pointer"
              >
                <span className="w-5 h-5 rounded bg-[#526B50] text-white text-[10px] font-semibold inline-flex items-center justify-center shrink-0">
                  {getInitials(user?.fullName)}
                </span>
                <span className="hidden sm:inline max-w-[120px] truncate">{user?.fullName}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[var(--sl-muted)]" />
              </button>

              {openMenu === 'profile' && (
                <div className="sl-animate-in absolute right-0 top-10 w-72 bg-[var(--sl-card)] border border-[var(--sl-border-strong)] rounded-md shadow-lg z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--sl-border)] bg-[var(--sl-bg)]/50">
                    <p className="text-xs font-semibold text-[var(--sl-text)] truncate">{user?.fullName}</p>
                    <p className="text-[11px] text-[var(--sl-muted)] mt-0.5 truncate">
                      {roleLabel} · {user?.institutionalId}
                    </p>
                    <p className="text-[11px] text-[var(--sl-subtle)] truncate">{user?.department}</p>
                  </div>

                  {/* Embedded Accessibility Display Preferences */}
                  <div className="px-4 py-3 border-b border-[var(--sl-border)] space-y-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--sl-muted)]">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Display & Accessibility</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 p-0.5 bg-[var(--sl-surface)] rounded">
                      {[
                        { key: 'sm', label: 'Compact' },
                        { key: 'md', label: 'Standard' },
                        { key: 'lg', label: 'Large' },
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setFontScale(opt.key)}
                          className={`py-1 text-[11px] font-medium rounded cursor-pointer transition-colors ${
                            fontScale === opt.key
                              ? 'bg-white text-[#252720] shadow-xs'
                              : 'text-[var(--sl-muted)] hover:text-[var(--sl-text)]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center justify-between text-xs text-[var(--sl-text)] cursor-pointer">
                      <span>High-Contrast Mode</span>
                      <input
                        type="checkbox"
                        checked={highContrast}
                        onChange={(e) => setHighContrast(e.target.checked)}
                        className="accent-[#526B50] w-3.5 h-3.5"
                      />
                    </label>
                  </div>

                  <div className="p-1.5">
                    {['STUDENT', 'FACULTY'].includes(user?.role) && (
                      <Link
                        to="/student/profile"
                        onClick={() => setOpenMenu(null)}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--sl-text)] hover:bg-[var(--sl-surface)] rounded"
                      >
                        <User className="w-3.5 h-3.5 text-[var(--sl-muted)]" />
                        <span>Profile & Preferences</span>
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#B66F50] hover:bg-[#FBF1EE] rounded cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main id="workspace-main" className="flex-1 px-4 py-6 sm:px-7 sm:py-7 max-w-[1380px] w-full mx-auto">
          <Outlet />
        </main>

        <footer className="border-t border-[var(--sl-border)] bg-[var(--sl-bg)] px-4 sm:px-7 py-5 mt-8">
          <div className="max-w-[1380px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-[var(--sl-subtle)]">
            <div>
              <span className="font-display font-semibold text-[#252720]">SmartLib.</span>{' '}
              <span>A smarter way to discover, manage and experience knowledge.</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>© 2026 SmartLib. All rights reserved.</span>
              <span className="text-[var(--sl-muted)]">
                Designed &amp; Developed by <span className="font-medium text-[#252720]">Subhadeep Sen</span>
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
