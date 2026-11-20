import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  LayoutGrid,
  List,
  MapPin,
  QrCode,
  RefreshCw,
  Search,
  Layers,
  BookOpen,
} from 'lucide-react';
import { SmartLibApi, extractErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { useToast } from '../context/ToastContext';
import {
  AlertBanner,
  BookCoverThumb,
  Button,
  Card,
  DataTable,
  EmptyState,
  GridSkeleton,
  InputField,
  MetricStrip,
  Modal,
  PageHeader,
  SectionHeader,
  SelectField,
  StatusLabel,
} from '../components/ui/Primitives';
import {
  buildFinePaymentReceiptText,
  formatINR,
  formatIndianDate,
  formatIndianDateTime,
  formatIndianNumber,
} from '../utils/formatters';

function daysUntil(isoDate) {
  if (!isoDate) return null;
  const diff = Math.ceil((new Date(isoDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return diff;
}

export function StudentDashboard() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [borrowings, setBorrowings] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [seatBookings, setSeatBookings] = useState([]);
  const [fines, setFines] = useState([]);
  const [recs, setRecs] = useState([]);
  const [dna, setDna] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([
      SmartLibApi.getCirculationHistory({ mine: 'true' }),
      SmartLibApi.getMyReservations(),
      SmartLibApi.getMySeatReservations(),
      SmartLibApi.getFines({ mine: 'true' }),
      SmartLibApi.getRecommendations(),
      SmartLibApi.getReadingDna(),
    ])
      .then(([b, r, s, f, rc, d]) => {
        setBorrowings(b);
        setReservations(r);
        setSeatBookings(s);
        setFines(f);
        setRecs(rc);
        setDna(d);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleQuickRenew = async (issueId) => {
    try {
      const res = await SmartLibApi.renewBook(issueId);
      notify(res.message, 'success');
      load();
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const activeLoans = borrowings.filter((b) => b.status === 'ACTIVE' || b.status === 'OVERDUE');
  const activeRes = reservations.filter((r) => r.status === 'WAITING' || r.status === 'READY_FOR_PICKUP');
  const activeSeats = seatBookings.filter((s) => s.status === 'CONFIRMED' || s.status === 'CHECKED_IN');
  const pendingFineTotal = fines
    .filter((f) => f.status === 'PENDING' || f.status === 'PARTIALLY_PAID')
    .reduce((sum, f) => sum + f.balance, 0);

  return (
    <div>
      <PageHeader
        kicker={`${user?.department} · ${user?.institutionalId}`}
        title={`Welcome back, ${user?.fullName?.split(' ')[0]}`}
        subtitle="Your active borrowings, due dates, reservation queue, study bookings, and reading recommendations."
        actions={
          <>
            <Link to="/student/seats">
              <Button variant="secondary">
                <Layers className="w-3.5 h-3.5" />
                <span>Reserve Seat</span>
              </Button>
            </Link>
            <Link to="/student/explore">
              <Button>
                <BookOpen className="w-3.5 h-3.5" />
                <span>Browse Catalogue</span>
              </Button>
            </Link>
          </>
        }
      />

      <MetricStrip
        className="mb-7"
        items={[
          {
            label: 'Active Borrowings',
            value: loading ? '—' : formatIndianNumber(activeLoans.length),
            detail: `${formatIndianNumber(activeLoans.filter((l) => l.status === 'OVERDUE').length)} overdue`,
            tone: activeLoans.some((l) => l.status === 'OVERDUE') ? 'error' : 'default',
          },
          {
            label: 'FIFO Reservations',
            value: loading ? '—' : formatIndianNumber(activeRes.length),
            detail: activeRes.some((r) => r.status === 'READY_FOR_PICKUP')
              ? 'Hold ready for pickup'
              : 'Live queue tracking',
          },
          {
            label: 'Verified Completions',
            value: loading ? '—' : formatIndianNumber(dna?.totalCompletedVerified ?? 0),
            detail: dna?.primaryInterest ? `Primary: ${dna.primaryInterest}` : 'Reading profile',
            tone: 'accent',
          },
          {
            label: 'Account Balance',
            value: loading ? '—' : formatINR(pendingFineTotal),
            detail: pendingFineTotal > 0 ? 'Pending library fines (INR)' : 'In good standing',
            tone: pendingFineTotal > 0 ? 'warning' : 'accent',
          },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        {/* Main Column: Active Loans Table + Explainable Recommendations */}
        <div className="lg:col-span-8 space-y-7">
          <section>
            <SectionHeader
              title="Current Borrowings & Due Dates"
              subtitle="Renew eligible volumes directly or review full loan history."
              action={
                <Link to="/student/borrowings" className="text-xs font-medium text-[#526B50] hover:underline">
                  Full borrowing history →
                </Link>
              }
            />
            {activeLoans.length === 0 && !loading ? (
              <EmptyState
                title="No books currently on loan"
                description="Explore the university catalogue to borrow available physical copies."
                action={
                  <Link to="/student/explore">
                    <Button size="sm">Open Book Catalogue</Button>
                  </Link>
                }
              />
            ) : (
              <div className="bg-white border border-[var(--sl-border)] rounded-md overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[var(--sl-border)] bg-[var(--sl-surface)] text-xs text-[var(--sl-muted)]">
                      <th className="py-2.5 px-4 font-medium">Volume & Copy</th>
                      <th className="py-2.5 px-4 font-medium">Due Date</th>
                      <th className="py-2.5 px-4 font-medium">Status</th>
                      <th className="py-2.5 px-4 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--sl-border)]">
                    {activeLoans.map((item) => {
                      const dLeft = daysUntil(item.dueDate);
                      return (
                        <tr key={item.id} className="hover:bg-[#FAF9F5]">
                          <td className="py-3 px-4">
                            <p className="font-medium text-[var(--sl-text)]">{item.bookTitle}</p>
                            <p className="text-xs text-[var(--sl-muted)] font-mono-num mt-0.5">
                              {item.copyCode} · {item.branchName}
                            </p>
                          </td>
                          <td className="py-3 px-4 font-mono-num text-xs">
                            <p className="text-[var(--sl-text)]">{formatIndianDate(item.dueDate)}</p>
                            {dLeft !== null && (
                              <p className={dLeft < 0 ? 'text-[#B66F50]' : 'text-[var(--sl-muted)]'}>
                                {dLeft < 0 ? `${Math.abs(dLeft)}d overdue` : `${dLeft}d remaining`}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <StatusLabel status={item.status} />
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleQuickRenew(item.id)}
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Renew</span>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="pt-2 border-t border-[var(--sl-border)]">
            <SectionHeader
              title="Recommended Reading"
              subtitle="Selected transparently from your borrowing affinities and institutional holdings."
              action={
                <Link to="/student/recommendations" className="text-xs font-medium text-[#526B50] hover:underline">
                  View all recommendations →
                </Link>
              }
            />
            <div className="divide-y divide-[var(--sl-border)] border-t border-b border-[var(--sl-border)] bg-white rounded-md px-5">
              {recs.slice(0, 3).map((rec) => (
                <div key={rec.bookId} className="py-4 flex items-start gap-4">
                  <BookCoverThumb
                    title={rec.book.title}
                    category={rec.book.category}
                    accent={rec.book.coverAccent}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-[var(--sl-text)]">{rec.book.title}</p>
                      <span className="text-xs font-mono-num text-[#526B50]">
                        {rec.book.availableCopies}/{rec.book.totalCopies} available
                      </span>
                    </div>
                    <p className="text-xs text-[var(--sl-muted)] mt-0.5">
                      {rec.book.authors.join(', ')} · {rec.book.category}
                    </p>
                    <p className="mt-1.5 text-xs text-[#526B50] leading-relaxed">{rec.explanation}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Side Column: Active Reservations & Study Seat Schedule */}
        <div className="lg:col-span-4 space-y-6">
          <Card padding="p-5">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--sl-border)]">
              <h2 className="text-sm font-display font-semibold text-[var(--sl-text)]">Active Reservations</h2>
              <Link to="/student/reservations" className="text-xs text-[#526B50] hover:underline">
                Manage
              </Link>
            </div>
            {activeRes.length === 0 ? (
              <p className="pt-4 text-xs text-[var(--sl-muted)]">
                No active waitlist holds. Reserve unavailable titles from the catalogue to enter the FIFO queue.
              </p>
            ) : (
              <div className="divide-y divide-[var(--sl-border)]">
                {activeRes.map((r) => (
                  <div key={r.id} className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-medium text-[var(--sl-text)] truncate">{r.bookTitle}</p>
                      <span className="text-xs font-mono-num font-semibold text-[#526B50] shrink-0">
                        {r.queuePosition ? `#${r.queuePosition}` : 'Ready'}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-[var(--sl-muted)]">
                      <span className="truncate">{r.branchName}</span>
                      <StatusLabel status={r.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card padding="p-5">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--sl-border)]">
              <h2 className="text-sm font-display font-semibold text-[var(--sl-text)]">Study Seat Bookings</h2>
              <Link to="/student/seats" className="text-xs text-[#526B50] hover:underline">
                Floor map
              </Link>
            </div>
            {activeSeats.length === 0 ? (
              <p className="pt-4 text-xs text-[var(--sl-muted)]">
                No upcoming study carrels booked. Reserve quiet desks or dual-monitor workstations.
              </p>
            ) : (
              <div className="divide-y divide-[var(--sl-border)]">
                {activeSeats.map((s) => (
                  <div key={s.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-mono-num font-semibold text-[var(--sl-text)]">
                        Seat {s.seatCode}
                      </span>
                      <StatusLabel status={s.status} />
                    </div>
                    <p className="text-xs text-[var(--sl-muted)] mt-0.5">{s.branchName} · Floor {s.floor}</p>
                    <p className="text-xs font-mono-num text-[var(--sl-text)] mt-0.5">
                      {formatIndianDate(s.reservationDate)} · {s.startTime}–{s.endTime} IST
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export function ExploreBooksPage() {
  const [searchParams] = useSearchParams();
  const { notify } = useToast();

  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState('ALL');
  const [availability, setAvailability] = useState('ALL');
  const [sortBy, setSortBy] = useState('title');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [page, setPage] = useState(1);
  const [selectedBook, setSelectedBook] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  const pageSize = viewMode === 'grid' ? 9 : 10;

  const loadBooks = (queryOverride) => {
    setLoading(true);
    SmartLibApi.getBooks({
      search: queryOverride !== undefined ? queryOverride : search,
      category,
      availability,
    })
      .then((res) => {
        setBooks(res);
        setPage(1);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null && q !== search) {
      setSearch(q);
      loadBooks(q);
      return;
    }
    loadBooks();
  }, [category, availability, searchParams]);

  const sortedBooks = useMemo(() => {
    const arr = [...books];
    if (sortBy === 'year_desc') return arr.sort((a, b) => (b.publicationYear || 0) - (a.publicationYear || 0));
    if (sortBy === 'available_desc') return arr.sort((a, b) => (b.availableCopies || 0) - (a.availableCopies || 0));
    return arr.sort((a, b) => a.title.localeCompare(b.title));
  }, [books, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedBooks.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleBooks = sortedBooks.slice((safePage - 1) * pageSize, safePage * pageSize);

  const openDetail = async (id) => {
    setDetailLoading(true);
    setError('');
    try {
      const detail = await SmartLibApi.getBookDetail(id);
      setSelectedBook(detail);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBorrowCopy = async (copyId) => {
    setError('');
    try {
      const res = await SmartLibApi.issueBook({ copyId });
      notify(res.message, 'success');
      await openDetail(selectedBook.id);
      loadBooks();
    } catch (err) {
      const msg = extractErrorMessage(err);
      setError(msg);
      notify(msg, 'error');
    }
  };

  const handleReserveBook = async (bookId, branchId) => {
    setError('');
    try {
      const res = await SmartLibApi.createReservation({ bookId, branchId });
      notify(res.message, 'success');
      loadBooks();
    } catch (err) {
      const msg = extractErrorMessage(err);
      setError(msg);
      notify(msg, 'error');
    }
  };

  const categories = [
    'ALL',
    'Computer Science',
    'Artificial Intelligence',
    'Mathematics & Statistics',
    'History',
    'Economics',
    'Architecture & Design',
    'Philosophy',
  ];

  return (
    <div>
      <PageHeader
        title="University Book Catalogue"
        subtitle="Browse multi-branch holdings, inspect barcoded physical copies with shelf coordinates, borrow immediately, or enter a FIFO waitlist."
        actions={
          <div className="inline-flex items-center p-0.5 bg-[var(--sl-surface)] border border-[var(--sl-border)] rounded">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              className={`inline-flex items-center gap-1.5 px-2.5 h-7 text-xs font-medium rounded transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-[var(--sl-text)] shadow-xs' : 'text-[var(--sl-muted)]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className={`inline-flex items-center gap-1.5 px-2.5 h-7 text-xs font-medium rounded transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-white text-[var(--sl-text)] shadow-xs' : 'text-[var(--sl-muted)]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>
        }
      />

      <AlertBanner type="error" message={error} onDismiss={() => setError('')} />

      {/* Integrated Inline Filter Toolbar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          loadBooks();
        }}
        className="pb-5 mb-6 border-b border-[var(--sl-border)] grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
      >
        <div className="md:col-span-4">
          <InputField
            id="catalog-search"
            label="Search Title, Author, or ISBN"
            placeholder="e.g. Kleppmann, Algorithms, 978-..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="md:col-span-3">
          <SelectField
            id="catalog-category"
            label="Subject Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'ALL' ? 'All Subjects' : c}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="md:col-span-2">
          <SelectField
            id="catalog-avail"
            label="Availability"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
          >
            <option value="ALL">All Holdings</option>
            <option value="AVAILABLE">Available Now</option>
            <option value="UNAVAILABLE">Checked Out</option>
          </SelectField>
        </div>
        <div className="md:col-span-2">
          <SelectField
            id="catalog-sort"
            label="Sort By"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="title">Title (A–Z)</option>
            <option value="available_desc">Availability</option>
            <option value="year_desc">Newest Edition</option>
          </SelectField>
        </div>
        <div className="md:col-span-1">
          <Button type="submit" className="w-full" aria-label="Apply search filters">
            <Search className="w-3.5 h-3.5" />
          </Button>
        </div>
      </form>

      <div className="flex items-center justify-between mb-4 text-xs text-[var(--sl-muted)]">
        <span className="tabular-nums">
          Showing {visibleBooks.length} of {sortedBooks.length} catalog titles
        </span>
        {(search || category !== 'ALL' || availability !== 'ALL') && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setCategory('ALL');
              setAvailability('ALL');
              loadBooks('');
            }}
            className="text-[#526B50] hover:underline font-medium cursor-pointer"
          >
            Reset filters
          </button>
        )}
      </div>

      {loading ? (
        <GridSkeleton count={6} />
      ) : sortedBooks.length === 0 ? (
        <EmptyState
          title="No matching titles in the catalogue"
          description="Try clearing your subject filter or searching by a shorter author surname or ISBN."
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setSearch('');
                setCategory('ALL');
                setAvailability('ALL');
                loadBooks('');
              }}
            >
              Clear All Filters
            </Button>
          }
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleBooks.map((book) => (
            <div
              key={book.id}
              className="bg-white border border-[var(--sl-border)] rounded-md p-4 flex flex-col justify-between hover:border-[var(--sl-border-strong)] transition-colors"
            >
              <div className="flex gap-3.5">
                <BookCoverThumb
                  title={book.title}
                  authors={book.authors}
                  category={book.category}
                  year={book.publicationYear}
                  accent={book.coverAccent}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-[var(--sl-subtle)] truncate">
                    {book.category} · {book.publicationYear}
                  </p>
                  <h3 className="mt-1 text-[14.5px] font-display font-semibold text-[var(--sl-text)] leading-snug line-clamp-2">
                    {book.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--sl-muted)] truncate">
                    {book.authors.join(', ')}
                  </p>
                  <p className="mt-2 text-[11px] font-mono-num text-[var(--sl-subtle)]">
                    ISBN {book.isbn}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[var(--sl-border)] flex items-center justify-between gap-2">
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    book.availableCopies > 0 ? 'text-[#526B50]' : 'text-[#A67232]'
                  }`}
                >
                  {book.availableCopies > 0
                    ? `${book.availableCopies} of ${book.totalCopies} available`
                    : `0 of ${book.totalCopies} · ${book.activeReservations} queued`}
                </span>
                <Button size="sm" variant="secondary" onClick={() => openDetail(book.id)}>
                  Details & Copies
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-[var(--sl-border)] rounded-md overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--sl-border)] bg-[var(--sl-surface)] text-xs text-[var(--sl-muted)]">
                <th className="py-2.5 px-4 font-medium">Title & Authors</th>
                <th className="py-2.5 px-4 font-medium">ISBN</th>
                <th className="py-2.5 px-4 font-medium">Category</th>
                <th className="py-2.5 px-4 font-medium text-right">Availability</th>
                <th className="py-2.5 px-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--sl-border)]">
              {visibleBooks.map((book) => (
                <tr key={book.id} className="hover:bg-[#FAF9F5]">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <BookCoverThumb
                        title={book.title}
                        category={book.category}
                        accent={book.coverAccent}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--sl-text)]">{book.title}</p>
                        <p className="text-xs text-[var(--sl-muted)]">
                          {book.authors.join(', ')} · {book.publisher} ({book.publicationYear})
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono-num text-xs text-[var(--sl-muted)] whitespace-nowrap">
                    {book.isbn}
                  </td>
                  <td className="py-3 px-4 text-xs text-[var(--sl-text)] whitespace-nowrap">{book.category}</td>
                  <td className="py-3 px-4 text-right font-mono-num text-xs whitespace-nowrap">
                    <span className={book.availableCopies > 0 ? 'text-[#526B50] font-semibold' : 'text-[#A67232] font-semibold'}>
                      {book.availableCopies} / {book.totalCopies}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button size="sm" variant="secondary" onClick={() => openDetail(book.id)}>
                      Inspect Copies
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between text-xs text-[var(--sl-muted)]">
          <span className="tabular-nums">
            Page {safePage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Book Detail & Copy Locator Modal */}
      <Modal
        open={Boolean(selectedBook)}
        onClose={() => setSelectedBook(null)}
        title={selectedBook?.title || 'Volume Details'}
        subtitle={selectedBook ? `${selectedBook.category} · ${selectedBook.publisher} (${selectedBook.publicationYear})` : ''}
        maxWidth="max-w-3xl"
      >
        {detailLoading || !selectedBook ? (
          <p className="text-sm text-[var(--sl-muted)]">Loading physical copy inventory...</p>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-5 pb-5 border-b border-[var(--sl-border)]">
              <BookCoverThumb
                title={selectedBook.title}
                authors={selectedBook.authors}
                category={selectedBook.category}
                year={selectedBook.publicationYear}
                accent={selectedBook.coverAccent}
                size="lg"
              />
              <div className="flex-1 text-sm space-y-2">
                <p className="font-medium text-[var(--sl-text)]">{selectedBook.authors.join(', ')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2.5 border-y border-[var(--sl-border)] text-xs">
                  <div>
                    <p className="text-[var(--sl-subtle)]">ISBN</p>
                    <p className="font-mono-num text-[var(--sl-text)] mt-0.5">{selectedBook.isbn}</p>
                  </div>
                  <div>
                    <p className="text-[var(--sl-subtle)]">Edition</p>
                    <p className="text-[var(--sl-text)] mt-0.5">{selectedBook.edition}</p>
                  </div>
                  <div>
                    <p className="text-[var(--sl-subtle)]">Language</p>
                    <p className="text-[var(--sl-text)] mt-0.5">{selectedBook.language}</p>
                  </div>
                  <div>
                    <p className="text-[var(--sl-subtle)]">Length</p>
                    <p className="font-mono-num text-[var(--sl-text)] mt-0.5">{selectedBook.pages} pp.</p>
                  </div>
                </div>
                <p className="text-[13.5px] text-[var(--sl-muted)] leading-relaxed">{selectedBook.description}</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-display font-semibold text-[var(--sl-text)]">
                  Physical Copies & Shelf Locations ({selectedBook.copies?.length || 0})
                </h3>
                {selectedBook.availableCopies === 0 && (
                  <Button
                    size="sm"
                    onClick={() => handleReserveBook(selectedBook.id, 'br-central')}
                  >
                    Join FIFO Reservation Queue
                  </Button>
                )}
              </div>

              <div className="divide-y divide-[var(--sl-border)] border border-[var(--sl-border)] rounded-md bg-white">
                {(selectedBook.copies || []).map((copy) => (
                  <div
                    key={copy.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      {copy.qrDataUrl && (
                        <img
                          src={copy.qrDataUrl}
                          alt={`QR code for copy ${copy.copyCode}`}
                          className="w-14 h-14 border border-[var(--sl-border)] rounded bg-white p-1 shrink-0"
                        />
                      )}
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono-num font-semibold text-[var(--sl-text)]">
                            {copy.copyCode}
                          </span>
                          <StatusLabel status={copy.status} />
                        </div>
                        <p className="mt-1 text-xs text-[var(--sl-text)] flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#526B50] shrink-0" />
                          <span>
                            {copy.branchName} · Floor {copy.location.floor} · {copy.location.section} · Rack{' '}
                            {copy.location.rack} · Shelf {copy.location.shelf}
                          </span>
                        </p>
                        <p className="mt-1 text-[11px] font-mono-num text-[var(--sl-subtle)]">
                          Barcode {copy.barcode} · QR {copy.qrToken} · Condition: {copy.condition}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {copy.status === 'AVAILABLE' ? (
                        <Button size="sm" onClick={() => handleBorrowCopy(copy.id)}>
                          Borrow Copy
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleReserveBook(selectedBook.id, copy.branchId)}
                        >
                          Reserve Title
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function MyBorrowingsPage() {
  const { notify } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    SmartLibApi.getCirculationHistory({ mine: 'true' })
      .then(setRecords)
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleRenew = async (issueId) => {
    setError('');
    try {
      const res = await SmartLibApi.renewBook(issueId);
      notify(res.message, 'success');
      load();
    } catch (err) {
      const msg = extractErrorMessage(err);
      setError(msg);
      notify(msg, 'error');
    }
  };

  const handleConfirmComplete = async (issueId) => {
    setError('');
    try {
      const res = await SmartLibApi.confirmCompletion(issueId);
      notify(res.message, 'success');
      load();
    } catch (err) {
      const msg = extractErrorMessage(err);
      setError(msg);
      notify(msg, 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="My Borrowings & History"
        subtitle="Track due dates, renew eligible copies, inspect loan receipts, and verify reading completions for Reading DNA and challenges."
      />
      <AlertBanner type="error" message={error} onDismiss={() => setError('')} />

      <DataTable
        loading={loading}
        data={records}
        searchPlaceholder="Search by title, receipt, copy code, or branch..."
        searchKeys={['bookTitle', 'receiptNumber', 'copyCode', 'branchName', 'status']}
        emptyTitle="No borrowing records yet"
        emptyDescription="Borrowed books and historical loan receipts will appear here."
        columns={[
          {
            key: 'receiptNumber',
            label: 'Receipt / Copy',
            sortable: true,
            render: (rec) => (
              <div className="font-mono-num text-xs">
                <p className="text-[var(--sl-text)] font-medium">{rec.receiptNumber}</p>
                <p className="text-[var(--sl-subtle)]">{rec.copyCode}</p>
              </div>
            ),
          },
          {
            key: 'bookTitle',
            label: 'Title & Branch',
            sortable: true,
            render: (rec) => (
              <div>
                <p className="font-medium text-[var(--sl-text)]">{rec.bookTitle}</p>
                <p className="text-xs text-[var(--sl-muted)]">{rec.branchName}</p>
              </div>
            ),
          },
          {
            key: 'dueDate',
            label: 'Issued / Due',
            sortable: true,
            render: (rec) => (
              <div className="font-mono-num text-xs text-[var(--sl-muted)] whitespace-nowrap">
                <p>Out: {formatIndianDate(rec.issueDate)}</p>
                <p>Due: {formatIndianDate(rec.dueDate)}</p>
              </div>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: (rec) => (
              <div>
                <StatusLabel status={rec.status} />
                {rec.estimatedFine > 0 && (
                  <p className="text-xs font-mono-num text-[#B66F50] mt-0.5">
                    Est. {formatINR(rec.estimatedFine)}
                  </p>
                )}
              </div>
            ),
          },
          {
            key: 'actions',
            label: 'Actions',
            align: 'right',
            render: (rec) => (
              <div className="inline-flex items-center gap-2">
                {(rec.status === 'ACTIVE' || rec.status === 'OVERDUE') && (
                  <Button size="sm" variant="secondary" onClick={() => handleRenew(rec.id)}>
                    <RefreshCw className="w-3 h-3" />
                    <span>Renew ({rec.renewalCount}/{rec.maxRenewals})</span>
                  </Button>
                )}
                {!rec.completionConfirmed ? (
                  <Button size="sm" variant="ghost" onClick={() => handleConfirmComplete(rec.id)}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verify Read</span>
                  </Button>
                ) : (
                  <span className="text-xs text-[#526B50] font-medium px-2">Verified</span>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

export function MyReservationsPage() {
  const { notify } = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    SmartLibApi.getMyReservations()
      .then(setList)
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCancel = async (id) => {
    setError('');
    try {
      const res = await SmartLibApi.cancelReservation(id);
      notify(res.message, 'success');
      load();
    } catch (err) {
      const msg = extractErrorMessage(err);
      setError(msg);
      notify(msg, 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="FIFO Reservations"
        subtitle="Priority queue tracking for unavailable titles. Returned copies are allocated automatically in strict first-in, first-out order."
        actions={
          <Link to="/student/explore">
            <Button variant="secondary">Browse Catalogue</Button>
          </Link>
        }
      />
      <AlertBanner type="error" message={error} onDismiss={() => setError('')} />

      <DataTable
        loading={loading}
        data={list}
        searchPlaceholder="Search reserved books or branches..."
        searchKeys={['bookTitle', 'isbn', 'branchName', 'status']}
        emptyTitle="No reservation records"
        emptyDescription="When a book has no available copies, reserve it from the catalogue to enter the FIFO queue."
        columns={[
          {
            key: 'bookTitle',
            label: 'Book Title',
            sortable: true,
            render: (r) => (
              <div>
                <p className="font-medium text-[var(--sl-text)]">{r.bookTitle}</p>
                <p className="text-xs font-mono-num text-[var(--sl-subtle)]">ISBN {r.isbn}</p>
              </div>
            ),
          },
          {
            key: 'branchName',
            label: 'Branch',
            sortable: true,
            render: (r) => <span className="text-xs text-[var(--sl-muted)]">{r.branchName}</span>,
          },
          {
            key: 'queuePosition',
            label: 'Queue Position',
            sortable: true,
            render: (r) => (
              <span className="font-mono-num text-sm font-semibold text-[#526B50]">
                {r.queuePosition ? `#${r.queuePosition}` : '—'}
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Status & Hold',
            sortable: true,
            render: (r) => (
              <div>
                <StatusLabel status={r.status} />
                {r.expiresAt && (
                  <p className="text-xs font-mono-num text-[var(--sl-subtle)] mt-0.5">
                    Expires {formatIndianDate(r.expiresAt)}
                  </p>
                )}
              </div>
            ),
          },
          {
            key: 'action',
            label: 'Action',
            align: 'right',
            render: (r) =>
              (r.status === 'WAITING' || r.status === 'READY_FOR_PICKUP') && (
                <Button size="sm" variant="secondary" onClick={() => handleCancel(r.id)}>
                  Cancel Hold
                </Button>
              ),
          },
        ]}
      />
    </div>
  );
}

export function DigitalLibraryCardPage() {
  const { notify } = useToast();
  const [card, setCard] = useState(null);
  const [fines, setFines] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('MOCK_UPI');
  const [error, setError] = useState('');

  const load = () => {
    Promise.all([SmartLibApi.getDigitalCard(), SmartLibApi.getFines({ mine: 'true' })])
      .then(([c, f]) => {
        setCard(c);
        setFines(f);
      })
      .catch((err) => setError(extractErrorMessage(err)));
  };

  useEffect(() => {
    load();
  }, []);

  const handlePayFine = async (fineId) => {
    setError('');
    try {
      const res = await SmartLibApi.payFine(fineId, { paymentMethod });
      notify(res.message, 'success');
      load();
    } catch (err) {
      const msg = extractErrorMessage(err);
      setError(msg);
      notify(msg, 'error');
    }
  };

  const handleDownloadReceipt = (fine, payment) => {
    const content = buildFinePaymentReceiptText({ fine, payment, member: card?.user });
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${payment.receiptNumber}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    notify(`Downloaded receipt ${payment.receiptNumber}.`, 'info');
  };

  return (
    <div>
      <PageHeader
        title="Digital Library Card & Fines"
        subtitle="Present your institutional QR credential at circulation desks or self-service kiosks, and settle pending library fines in INR (₹)."
      />
      <AlertBanner type="error" message={error} onDismiss={() => setError('')} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        <div className="lg:col-span-5 bg-[#252720] text-[#F7F5EF] rounded-md p-6 border border-[#252720] self-start">
          <div className="flex items-center justify-between border-b border-white/15 pb-4">
            <div>
              <p className="font-display text-base font-semibold tracking-tight">SmartLib</p>
              <p className="text-xs text-[#C7C8BE]">Institutional Member Credential</p>
            </div>
            <QrCode className="w-5 h-5 text-[#92977A]" />
          </div>

          {card && (
            <div className="mt-5 flex flex-col sm:flex-row items-center gap-5">
              <img
                src={card.qrDataUrl}
                alt="Member Digital Library Card QR Code"
                className="w-32 h-32 bg-white p-2 rounded shrink-0"
              />
              <div className="space-y-1 text-sm min-w-0">
                <p className="font-display font-semibold text-base">{card.user.fullName}</p>
                <p className="text-xs text-[#C7C8BE]">{card.user.department}</p>
                <p className="text-xs font-mono-num text-[#C7C8BE]">{card.user.institutionalId}</p>
                <p className="text-xs text-[#C7C8BE]">{card.branchName}</p>
                <p className="pt-2 text-[11px] font-mono-num text-[#92977A] break-all">
                  {card.qrToken}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-7">
          <SectionHeader
            title="Fine Ledger & Payment Receipts (INR)"
            subtitle="Development mock payment adapter active (INR · transactions labeled MOCK_DEV; no real charges occur)."
            action={
              <select
                aria-label="Mock payment method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="h-8 px-2.5 text-xs bg-white text-[#252720] border border-[#D7D2C3] rounded focus:border-[#526B50] focus:outline-none"
              >
                <option value="MOCK_UPI">UPI (Mock Dev)</option>
                <option value="MOCK_CARD">Card (Mock Dev)</option>
              </select>
            }
          />
          <div className="bg-white border border-[var(--sl-border)] rounded-md divide-y divide-[var(--sl-border)]">
            {fines.length === 0 ? (
              <p className="p-6 text-sm text-[var(--sl-muted)]">No fine records on your account.</p>
            ) : (
              fines.map((f) => (
                <div key={f.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--sl-text)]">
                      {f.bookTitle} · <span className="text-[var(--sl-muted)] font-normal">{f.reason}</span>
                    </p>
                    <p className="text-xs font-mono-num text-[var(--sl-subtle)] mt-1">
                      Assessed {formatINR(f.amount)} · Paid {formatINR(f.paidAmount)} · Balance {formatINR(f.balance)}
                    </p>
                    {f.receipts?.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-3">
                        <p className="text-[11px] font-mono-num text-[#526B50]">
                          Receipt {f.receipts[0].receiptNumber} · {formatINR(f.receipts[0].amount)} ({f.receipts[0].gatewayMode} · {formatIndianDateTime(f.receipts[0].paidAt)})
                        </p>
                        <button
                          type="button"
                          onClick={() => handleDownloadReceipt(f, f.receipts[0])}
                          className="text-[11px] font-medium text-[#526B50] hover:underline cursor-pointer"
                        >
                          Download Receipt
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusLabel status={f.status} />
                    {f.balance > 0 && (
                      <Button size="sm" onClick={() => handlePayFine(f.id)}>
                        Pay {formatINR(f.balance)}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { fontScale, setFontScale, highContrast, setHighContrast } = useAccessibility();
  const { notify } = useToast();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await SmartLibApi.updateProfile({
        fullName,
        department,
        accessibilityPrefs: { fontSize: fontScale, highContrast },
      });
      await refreshUser();
      notify('Profile and display preferences updated.', 'success');
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Profile & Display Preferences"
        subtitle="Manage your institutional directory profile and persistent accessibility display settings."
      />
      <AlertBanner type="error" message={error} onDismiss={() => setError('')} />

      <Card padding="p-6">
        <form onSubmit={handleSave} className="space-y-4">
          <InputField
            id="prof-name"
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <InputField
            id="prof-dept"
            label="Department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            required
          />
          <SelectField
            id="prof-font"
            label="Interface Text Scale"
            value={fontScale}
            onChange={(e) => setFontScale(e.target.value)}
          >
            <option value="sm">Compact (14px base)</option>
            <option value="md">Standard (15.5px base)</option>
            <option value="lg">Large Accessible (17.5px base)</option>
          </SelectField>
          <label className="flex items-center gap-3 text-sm text-[var(--sl-text)] cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={highContrast}
              onChange={(e) => setHighContrast(e.target.checked)}
              className="accent-[#526B50] w-4 h-4"
            />
            <span>Enable High-Contrast Display Mode</span>
          </label>
          <div className="pt-2 flex items-center gap-2">
            <Button type="submit">Save Preferences</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setFullName(user?.fullName || '');
                setDepartment(user?.department || '');
              }}
            >
              Reset
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
