import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Award, BookMarked, Copy, MapPin, Plus, Search } from 'lucide-react';
import { SmartLibApi, extractErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  AlertBanner,
  BookCoverThumb,
  Button,
  Card,
  EmptyState,
  InputField,
  MetricStrip,
  PageHeader,
  SectionHeader,
  SelectField,
  StatusLabel,
} from '../components/ui/Primitives';
import { formatIndianDate } from '../utils/formatters';

export function ReadingDnaPage() {
  const [dna, setDna] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    SmartLibApi.getReadingDna()
      .then(setDna)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Smart Reading DNA"
        subtitle="Reading analytics computed strictly from your verified library circulation history and confirmed completions."
      />

      {loading || !dna ? (
        <p className="text-sm text-[var(--sl-muted)]">Computing reading profile from circulation records...</p>
      ) : (
        <>
          <MetricStrip
            className="mb-7"
            items={[
              { label: 'Total Volumes Borrowed', value: dna.totalBorrowed },
              {
                label: 'Verified Completions',
                value: dna.totalCompletedVerified,
                tone: 'accent',
                detail: `${dna.completionRatePct}% confirmation rate`,
              },
              { label: 'Primary Discipline', value: dna.primaryInterest || 'Not enough data' },
              { label: 'Authors Tracked', value: dna.favoriteAuthors.length },
            ]}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-7">
              <SectionHeader
                title="Monthly Reading Velocity"
                subtitle="Borrowed volumes compared against explicitly verified completions."
              />
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dna.monthlyActivity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E9E5DA" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#666860' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#666860' }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="borrowed" name="Borrowed" fill="#92977A" radius={[2, 2, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="completed" name="Verified Completed" fill="#526B50" radius={[2, 2, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="lg:col-span-5 space-y-5">
              <div>
                <SectionHeader title="Discipline Affinities" />
                <div className="space-y-3">
                  {dna.categoryAffinities.map((cat) => (
                    <div key={cat.category}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-[var(--sl-text)]">{cat.category}</span>
                        <span className="font-mono-num text-[var(--sl-muted)]">
                          {cat.count} loans ({Math.round(cat.weight * 100)}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-[var(--sl-surface)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#526B50]"
                          style={{ width: `${Math.round(cat.weight * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--sl-border)]">
                <h3 className="text-xs font-display font-semibold text-[var(--sl-text)]">Frequently Read Authors</h3>
                <p className="mt-1.5 text-xs text-[var(--sl-muted)] leading-relaxed">
                  {dna.favoriteAuthors.map((a) => `${a.author} (${a.count})`).join(' · ') || 'No history yet.'}
                </p>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export function RecommendationsPage() {
  const { notify } = useToast();
  const [recs, setRecs] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    SmartLibApi.getRecommendations()
      .then(setRecs)
      .catch((err) => setError(extractErrorMessage(err)));
  }, []);

  const handleBorrowOrReserve = async (book) => {
    setError('');
    try {
      const res =
        book.availableCopies > 0
          ? await SmartLibApi.issueBook({ bookId: book.id })
          : await SmartLibApi.createReservation({ bookId: book.id, branchId: 'br-central' });
      notify(res.message, 'success');
    } catch (err) {
      const msg = extractErrorMessage(err);
      setError(msg);
      notify(msg, 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Explainable Book Recommendations"
        subtitle="Deterministic suggestions computed from your Reading DNA and institutional circulation history. Every entry explains why it appears."
      />
      <AlertBanner type="error" message={error} onDismiss={() => setError('')} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recs.map((rec) => (
          <Card key={rec.bookId} padding="p-5" className="flex flex-col justify-between">
            <div className="flex gap-4">
              <BookCoverThumb
                title={rec.book.title}
                category={rec.book.category}
                year={rec.book.publicationYear}
                accent={rec.book.coverAccent}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-[var(--sl-subtle)]">
                  {rec.book.category} · {rec.book.publicationYear} · ISBN {rec.book.isbn}
                </p>
                <h3 className="mt-1 text-[15px] font-display font-semibold text-[var(--sl-text)] leading-snug">
                  {rec.book.title}
                </h3>
                <p className="text-xs text-[var(--sl-muted)] mt-0.5">{rec.book.authors.join(', ')}</p>
                <p className="mt-2.5 text-xs text-[#3C533A] bg-[#EEF3ED] border border-[#D4E0D2] rounded px-3 py-2 leading-relaxed">
                  {rec.explanation}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[var(--sl-border)] flex items-center justify-between">
              <span className="text-xs font-mono-num text-[var(--sl-muted)]">
                {rec.book.availableCopies} of {rec.book.totalCopies} available
              </span>
              <Button size="sm" onClick={() => handleBorrowOrReserve(rec.book)}>
                {rec.book.availableCopies > 0 ? 'Borrow Copy' : 'Reserve Title'}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ShelfLocatorPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const runSearch = (q) => {
    SmartLibApi.searchShelf(q).then(setResults).catch(() => {});
  };

  useEffect(() => {
    runSearch('');
  }, []);

  return (
    <div>
      <PageHeader
        title="Smart Shelf Locator"
        subtitle="Pinpoint exact branch, floor, section, rack, and shelf coordinates by book title, copy code, barcode, or QR token."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(query);
        }}
        className="pb-5 mb-6 border-b border-[var(--sl-border)] flex flex-col sm:flex-row gap-3"
      >
        <InputField
          id="shelf-query"
          placeholder="Scan or enter QR token (e.g. QR-CP-102-B7E2), copy code, ISBN, or title..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
        />
        <Button type="submit">
          <Search className="w-3.5 h-3.5" />
          <span>Locate Copy</span>
        </Button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {results.map((item) => (
          <Card key={item.id} padding="p-4">
            <div className="flex items-start gap-4">
              {item.qrDataUrl && (
                <img
                  src={item.qrDataUrl}
                  alt={`QR code for ${item.copyCode}`}
                  className="w-16 h-16 border border-[var(--sl-border)] rounded p-1 bg-white shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono-num font-semibold text-[#526B50]">
                    {item.copyCode}
                  </span>
                  <StatusLabel status={item.status} />
                </div>
                <h3 className="mt-0.5 text-sm font-display font-semibold text-[var(--sl-text)] truncate">
                  {item.bookTitle}
                </h3>
                <div className="mt-2.5 pt-2 border-t border-[var(--sl-border)] text-xs space-y-0.5">
                  <p className="font-medium text-[var(--sl-text)] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#526B50] shrink-0" />
                    <span>{item.branchName}</span>
                  </p>
                  <p className="text-[var(--sl-muted)] font-mono-num">
                    Floor {item.location.floor} · {item.location.section} · Rack {item.location.rack} · Shelf {item.location.shelf}
                  </p>
                  <p className="text-[11px] font-mono-num text-[var(--sl-subtle)]">QR {item.qrToken}</p>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function SeatReservationPage() {
  const { notify } = useToast();
  const [branchId, setBranchId] = useState('br-central');
  const [date, setDate] = useState('2026-11-20');
  const [slot, setSlot] = useState('14:00-16:00');
  const [seats, setSeats] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [error, setError] = useState('');

  const [startTime, endTime] = slot.split('-');

  const load = () => {
    Promise.all([
      SmartLibApi.getSeats({ branchId, date, startTime, endTime }),
      SmartLibApi.getMySeatReservations(),
    ])
      .then(([s, b]) => {
        setSeats(s);
        setMyBookings(b);
      })
      .catch((err) => setError(extractErrorMessage(err)));
  };

  useEffect(() => {
    load();
  }, [branchId, date, slot]);

  const handleReserve = async (seatId) => {
    setError('');
    try {
      const res = await SmartLibApi.reserveSeat({
        seatId,
        reservationDate: date,
        startTime,
        endTime,
      });
      notify(res.message, 'success');
      load();
    } catch (err) {
      const msg = extractErrorMessage(err);
      setError(msg);
      notify(msg, 'error');
    }
  };

  const handleAction = async (fn, id) => {
    setError('');
    try {
      const res = await fn(id);
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
        title="Study Seat Reservation"
        subtitle="Select a branch, date, and time window to book quiet carrels, dual-monitor workstations, or accessible desks."
      />
      <AlertBanner type="error" message={error} onDismiss={() => setError('')} />

      {/* Integrated Inline Selector Bar */}
      <div className="pb-5 mb-6 border-b border-[var(--sl-border)] grid grid-cols-1 md:grid-cols-3 gap-4">
        <SelectField id="seat-branch" label="Library Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="br-central">Central Heritage Library</option>
          <option value="br-eng">Engineering & Computing Annex</option>
        </SelectField>
        <InputField id="seat-date" label="Study Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <SelectField id="seat-slot" label="Time Window (IST)" value={slot} onChange={(e) => setSlot(e.target.value)}>
          <option value="09:00-11:00">09:00 – 11:00 IST</option>
          <option value="11:00-13:00">11:00 – 13:00 IST</option>
          <option value="13:00-15:00">13:00 – 15:00 IST</option>
          <option value="14:00-16:00">14:00 – 16:00 IST</option>
          <option value="16:00-18:00">16:00 – 18:00 IST</option>
        </SelectField>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <SectionHeader
            title="Floor Seating Availability"
            subtitle="Server-verified time-slot availability for selected window."
            action={
              <span className="text-xs text-[var(--sl-subtle)]">
                Green: Available · Amber: Reserved · Neutral: Unavailable
              </span>
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {seats.map((seat) => {
              const isAvail = seat.slotStatus === 'AVAILABLE';
              return (
                <div
                  key={seat.id}
                  className={`p-3.5 rounded-md border flex flex-col justify-between min-h-[146px] ${
                    isAvail
                      ? 'bg-white border-[#C8D4C5]'
                      : seat.slotStatus === 'RESERVED'
                        ? 'bg-[#FAF4EA] border-[#E4D1B3]'
                        : 'bg-[var(--sl-surface)] border-[var(--sl-border)] opacity-85'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-num text-sm font-semibold text-[var(--sl-text)] shrink-0">
                        {seat.seatCode}
                      </span>
                      <StatusLabel status={seat.slotStatus} />
                    </div>
                    <p className="mt-1.5 text-[11px] text-[var(--sl-muted)] truncate">
                      Floor {seat.floor} · {seat.zone.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--sl-subtle)] line-clamp-2">{seat.amenities.join(' · ')}</p>
                  </div>
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant={isAvail ? 'primary' : 'secondary'}
                      disabled={!isAvail}
                      className="w-full"
                      onClick={() => handleReserve(seat.id)}
                    >
                      {isAvail ? 'Reserve Seat' : seat.slotStatus.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-4">
          <Card padding="p-5">
            <h2 className="text-sm font-display font-semibold text-[var(--sl-text)] pb-3 border-b border-[var(--sl-border)]">
              My Seat Bookings
            </h2>
            {myBookings.length === 0 ? (
              <p className="pt-4 text-xs text-[var(--sl-muted)]">No seat reservations yet.</p>
            ) : (
              <div className="divide-y divide-[var(--sl-border)]">
                {myBookings.map((b) => (
                  <div key={b.id} className="py-3.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono-num text-sm font-semibold">{b.seatCode}</span>
                      <StatusLabel status={b.status} />
                    </div>
                    <p className="text-xs text-[var(--sl-muted)] mt-1">
                      {b.branchName} · Floor {b.floor}
                    </p>
                    <p className="text-xs font-mono-num text-[var(--sl-text)] mt-0.5">
                      {formatIndianDate(b.reservationDate)} · {b.startTime}–{b.endTime} IST
                    </p>
                    <div className="mt-2.5 flex gap-2">
                      {b.status === 'CONFIRMED' && (
                        <>
                          <Button size="sm" onClick={() => handleAction(SmartLibApi.checkInSeat, b.id)}>
                            Check In
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleAction(SmartLibApi.cancelSeatReservation, b.id)}
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                      {b.status === 'CHECKED_IN' && (
                        <Button size="sm" variant="secondary" onClick={() => handleAction(SmartLibApi.checkOutSeat, b.id)}>
                          Check Out
                        </Button>
                      )}
                    </div>
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

export function ChallengesPage() {
  const { notify } = useToast();
  const [data, setData] = useState(null);
  const [title, setTitle] = useState('');
  const [targetBooks, setTargetBooks] = useState(4);

  const load = () => SmartLibApi.getChallenges().then(setData).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    await SmartLibApi.createChallenge({ title, targetBooks: Number(targetBooks) });
    setTitle('');
    notify('Personal reading goal created.', 'success');
    load();
  };

  return (
    <div>
      <PageHeader
        title="Reading Challenges & Milestones"
        subtitle="Progress updates strictly upon explicitly verified reading completions."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-[var(--sl-border)] rounded-md divide-y divide-[var(--sl-border)]">
            {(data?.challenges || []).map((c) => (
              <div key={c.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] text-[var(--sl-subtle)]">
                      {c.scope} Challenge · Ends {formatIndianDate(c.endDate)}
                    </p>
                    <h3 className="text-[15px] font-display font-semibold text-[var(--sl-text)] mt-0.5">{c.title}</h3>
                    <p className="text-xs text-[var(--sl-muted)] mt-1">{c.description}</p>
                  </div>
                  {!c.joined && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        await SmartLibApi.joinChallenge(c.id);
                        notify(`Joined "${c.title}".`, 'success');
                        load();
                      }}
                    >
                      Join
                    </Button>
                  )}
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs font-mono-num mb-1">
                    <span>{c.verifiedCompletedCount} / {c.targetBooks} verified books</span>
                    <span>{c.progressPct}%</span>
                  </div>
                  <div className="h-1.5 bg-[var(--sl-surface)] rounded-full overflow-hidden">
                    <div className="h-full bg-[#526B50]" style={{ width: `${c.progressPct}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Card padding="p-5">
            <SectionHeader title="Set Personal Reading Goal" />
            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <InputField
                id="ch-title"
                label="Goal Title"
                placeholder="e.g. Semester Philosophy & History Goal"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="sm:col-span-7"
                required
              />
              <InputField
                id="ch-target"
                label="Target Volumes"
                type="number"
                min={1}
                max={50}
                value={targetBooks}
                onChange={(e) => setTargetBooks(e.target.value)}
                className="sm:col-span-3"
              />
              <Button type="submit" className="sm:col-span-2">Create</Button>
            </form>
          </Card>
        </div>

        <div className="lg:col-span-5">
          <SectionHeader title="Verified Milestones" />
          <div className="bg-white border border-[var(--sl-border)] rounded-md divide-y divide-[var(--sl-border)]">
            {(data?.achievements || []).map((a) => (
              <div
                key={a.badgeCode}
                className={`p-4 ${a.earned ? '' : 'opacity-65'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--sl-text)] flex items-center gap-2">
                    <Award className={`w-4 h-4 ${a.earned ? 'text-[#526B50]' : 'text-[var(--sl-muted)]'}`} />
                    {a.title}
                  </span>
                  <span className={`text-xs font-semibold ${a.earned ? 'text-[#526B50]' : 'text-[var(--sl-subtle)]'}`}>
                    {a.earned ? 'Earned' : 'In Progress'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--sl-muted)]">{a.description}</p>
                <p className="mt-1 text-[11px] font-mono-num text-[var(--sl-subtle)]">{a.evidence}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ResearchCompanionPage() {
  const { notify } = useToast();
  const [lists, setLists] = useState([]);
  const [books, setBooks] = useState([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [newListTitle, setNewListTitle] = useState('');
  const [newListSubject, setNewListSubject] = useState('Computer Science');
  const [bookToAdd, setBookToAdd] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [notePage, setNotePage] = useState('');
  const [bibStyle, setBibStyle] = useState('APA');
  const [bibOutput, setBibOutput] = useState(null);

  const load = async () => {
    const [l, b] = await Promise.all([SmartLibApi.getResearchLists(), SmartLibApi.getBooks({})]);
    setLists(l);
    setBooks(b);
    if (!selectedListId && l[0]) setSelectedListId(l[0].id);
    if (!bookToAdd && b[0]) setBookToAdd(b[0].id);
  };

  useEffect(() => {
    load();
  }, []);

  const currentList = lists.find((l) => l.id === selectedListId) || lists[0] || null;

  const handleExportBib = async (style) => {
    if (!currentList) return;
    setBibStyle(style);
    const res = await SmartLibApi.exportBibliography(currentList.id, style);
    setBibOutput(res);
  };

  return (
    <div>
      <PageHeader
        title="Academic Research Companion"
        subtitle="Organize reading lists, capture page-anchored scholarly notes, and export verified APA 7th or IEEE bibliographies."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-5">
          <Card padding="p-4">
            <h2 className="text-xs font-display font-semibold text-[var(--sl-text)] mb-3">Research Lists</h2>
            <div className="space-y-1.5">
              {lists.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    setSelectedListId(l.id);
                    setBibOutput(null);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded border text-sm transition-colors cursor-pointer ${
                    currentList?.id === l.id
                      ? 'bg-[#EEF3ED] border-[#526B50] font-medium text-[var(--sl-text)]'
                      : 'bg-white border-[var(--sl-border)] hover:bg-[var(--sl-surface)] text-[var(--sl-text)]'
                  }`}
                >
                  <p className="text-[13px]">{l.title}</p>
                  <p className="text-[11px] text-[var(--sl-muted)] mt-0.5">
                    {l.subject} · {l.books.length} refs · {l.notes.length} notes
                  </p>
                </button>
              ))}
            </div>
          </Card>

          <Card padding="p-4">
            <h3 className="text-xs font-display font-semibold text-[var(--sl-text)] mb-3">New Reading List</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const created = await SmartLibApi.createResearchList({
                  title: newListTitle,
                  subject: newListSubject,
                });
                setNewListTitle('');
                setSelectedListId(created.id);
                notify('Research reading list created.', 'success');
                load();
              }}
              className="space-y-3"
            >
              <InputField
                id="rl-title"
                label="List Title"
                required
                value={newListTitle}
                onChange={(e) => setNewListTitle(e.target.value)}
              />
              <InputField
                id="rl-subj"
                label="Academic Subject"
                value={newListSubject}
                onChange={(e) => setNewListSubject(e.target.value)}
              />
              <Button type="submit" size="sm" className="w-full">
                <Plus className="w-3.5 h-3.5" />
                <span>Create List</span>
              </Button>
            </form>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-6">
          {!currentList ? (
            <EmptyState title="Select or create a research list" description="Save catalog references and export APA 7th or IEEE bibliographies." />
          ) : (
            <>
              <Card padding="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--sl-border)]">
                  <div>
                    <h2 className="text-lg font-display font-semibold text-[var(--sl-text)]">{currentList.title}</h2>
                    <p className="text-xs text-[var(--sl-muted)] mt-0.5">{currentList.subject}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => handleExportBib('APA')}>
                      Export APA 7th
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleExportBib('IEEE')}>
                      Export IEEE
                    </Button>
                  </div>
                </div>

                {bibOutput && (
                  <div className="mt-4 p-4 rounded bg-[var(--sl-surface)] border border-[var(--sl-border)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-[#526B50]">
                        {bibStyle} Bibliography ({bibOutput.citations.length} entries)
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard?.writeText(bibOutput.citations.map((c) => c.citation).join('\n'));
                          notify(`${bibStyle} bibliography copied to clipboard.`, 'info');
                        }}
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </Button>
                    </div>
                    <div className="space-y-2 text-xs font-mono-num text-[var(--sl-text)]">
                      {bibOutput.citations.map((c) => (
                        <p key={c.bookId} className="leading-relaxed">{c.citation}</p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-col sm:flex-row gap-2 items-end">
                  <SelectField
                    id="add-ref-book"
                    label="Add Catalog Reference"
                    value={bookToAdd}
                    onChange={(e) => setBookToAdd(e.target.value)}
                    className="flex-1"
                  >
                    {books.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title} ({b.publicationYear})
                      </option>
                    ))}
                  </SelectField>
                  <Button
                    onClick={async () => {
                      await SmartLibApi.addBookToResearchList(currentList.id, bookToAdd);
                      notify('Catalog reference added to list.', 'success');
                      load();
                    }}
                  >
                    Add Reference
                  </Button>
                </div>

                <div className="mt-5 divide-y divide-[var(--sl-border)]">
                  {currentList.books.map((b) => (
                    <div key={b.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--sl-text)]">{b.title}</p>
                        <p className="text-xs text-[var(--sl-muted)]">
                          {b.authors.join(', ')} · {b.publisher} ({b.publicationYear}) · ISBN {b.isbn}
                        </p>
                      </div>
                      <BookMarked className="w-4 h-4 text-[#526B50] shrink-0" />
                    </div>
                  ))}
                </div>
              </Card>

              <Card padding="p-5">
                <SectionHeader title="Scholarly Notes" />
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await SmartLibApi.createResearchNote({
                      readingListId: currentList.id,
                      title: noteTitle,
                      content: noteContent,
                      pageReference: notePage,
                    });
                    setNoteTitle('');
                    setNoteContent('');
                    setNotePage('');
                    notify('Research note saved.', 'success');
                    load();
                  }}
                  className="space-y-3 pb-5 border-b border-[var(--sl-border)]"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <InputField
                      id="rn-title"
                      label="Note Heading"
                      required
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      className="sm:col-span-2"
                    />
                    <InputField
                      id="rn-page"
                      label="Page Reference"
                      placeholder="e.g. pp. 112–118"
                      value={notePage}
                      onChange={(e) => setNotePage(e.target.value)}
                    />
                  </div>
                  <textarea
                    rows={2}
                    required
                    placeholder="Write structured scholarly annotations..."
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D7D2C3] rounded focus:border-[#526B50] focus:outline-none"
                  />
                  <Button type="submit" size="sm">Save Note</Button>
                </form>

                <div className="mt-4 divide-y divide-[var(--sl-border)]">
                  {currentList.notes.map((n) => (
                    <div key={n.id} className="py-3">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-[var(--sl-text)]">{n.title}</span>
                        <span className="font-mono-num text-[var(--sl-subtle)]">{n.pageReference}</span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--sl-muted)] leading-relaxed">{n.content}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function CourseReadingListsPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [courses, setCourses] = useState([]);
  const [books, setBooks] = useState([]);
  const [courseForm, setCourseForm] = useState({ courseCode: '', courseTitle: '', department: 'Computer Science' });

  const isFacultyOrAdmin = ['FACULTY', 'BRANCH_ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  const load = () => {
    Promise.all([SmartLibApi.getCourses(), SmartLibApi.getBooks({})])
      .then(([c, b]) => {
        setCourses(c);
        setBooks(b);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader
        title="Course Reading Lists"
        subtitle="Faculty-curated textbooks, required readings, and alternative editions linked directly to branch holdings."
      />

      {isFacultyOrAdmin && (
        <Card className="mb-6" padding="p-5">
          <SectionHeader title="Publish New Course Reading List" />
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await SmartLibApi.createCourse(courseForm);
              setCourseForm({ courseCode: '', courseTitle: '', department: 'Computer Science' });
              notify('Course reading list published.', 'success');
              load();
            }}
            className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
          >
            <InputField
              id="crs-code"
              label="Course Code"
              placeholder="CS-420"
              required
              value={courseForm.courseCode}
              onChange={(e) => setCourseForm({ ...courseForm, courseCode: e.target.value })}
            />
            <InputField
              id="crs-title"
              label="Course Title"
              placeholder="Database Systems Internals"
              required
              value={courseForm.courseTitle}
              onChange={(e) => setCourseForm({ ...courseForm, courseTitle: e.target.value })}
              className="sm:col-span-2"
            />
            <Button type="submit">Create Course</Button>
          </form>
        </Card>
      )}

      <div className="space-y-5">
        {courses.map((course) => (
          <Card key={course.id} padding="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[var(--sl-border)]">
              <div>
                <p className="text-xs font-mono-num text-[#526B50] font-semibold">
                  {course.courseCode} · {course.semester}
                </p>
                <h2 className="text-lg font-display font-semibold text-[var(--sl-text)]">{course.courseTitle}</h2>
                <p className="text-xs text-[var(--sl-muted)]">
                  Instructor: {course.facultyName} · {course.department}
                </p>
              </div>
              {isFacultyOrAdmin && books[0] && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await SmartLibApi.addCourseMaterial(course.id, {
                      bookId: books[0].id,
                      materialType: 'REFERENCE',
                      required: false,
                      notes: 'Supplementary faculty reading.',
                    });
                    notify(`Added reference to ${course.courseCode}.`, 'success');
                    load();
                  }}
                >
                  Add Reference Material
                </Button>
              )}
            </div>

            <div className="mt-3 divide-y divide-[var(--sl-border)]">
              {course.materials.map((m, idx) => (
                <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--sl-text)]">
                      {m.book?.title} ·{' '}
                      <span className="text-xs text-[#526B50] font-semibold">
                        {m.required ? 'Required' : m.materialType}
                      </span>
                    </p>
                    <p className="text-xs text-[var(--sl-muted)] mt-0.5">{m.notes}</p>
                    {m.alternatives?.length > 0 && (
                      <p className="text-xs text-[var(--sl-subtle)] mt-1">
                        Alternative edition: {m.alternatives.map((a) => a.title).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="text-xs font-mono-num shrink-0">
                    {m.book && (
                      <span className={m.book.availableCopies > 0 ? 'text-[#526B50] font-semibold' : 'text-[#A67232] font-semibold'}>
                        {m.book.availableCopies} / {m.book.totalCopies} available
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function BookExchangePage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [listings, setListings] = useState([]);
  const [form, setForm] = useState({
    title: '',
    author: '',
    subject: 'Computer Science',
    condition: 'GOOD',
    listingType: 'EXCHANGE',
    description: '',
  });
  const [error, setError] = useState('');

  const load = () => SmartLibApi.getExchangeListings({}).then(setListings).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const handlePublish = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await SmartLibApi.createExchangeListing(form);
      setForm({
        title: '',
        author: '',
        subject: 'Computer Science',
        condition: 'GOOD',
        listingType: 'EXCHANGE',
        description: '',
      });
      notify('Personal book listing published.', 'success');
      load();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Campus Book Exchange"
        subtitle="Member-to-member textbook exchange and donations kept strictly separate from official institutional holdings."
      />
      <AlertBanner type="error" message={error} onDismiss={() => setError('')} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-4 self-start" padding="p-5">
          <SectionHeader title="Post a Personal Book" />
          <form onSubmit={handlePublish} className="space-y-3">
            <InputField id="ex-t" label="Book Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <InputField id="ex-a" label="Author" required value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
            <InputField id="ex-s" label="Subject" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <SelectField id="ex-c" label="Condition" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                <option value="LIKE_NEW">Like New</option>
                <option value="GOOD">Good</option>
                <option value="FAIR">Fair</option>
                <option value="ACCEPTABLE">Acceptable</option>
              </SelectField>
              <SelectField id="ex-type" label="Offer Type" value={form.listingType} onChange={(e) => setForm({ ...form, listingType: e.target.value })}>
                <option value="EXCHANGE">Exchange</option>
                <option value="DONATION">Donation</option>
              </SelectField>
            </div>
            <InputField id="ex-d" label="Notes" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Button type="submit" className="w-full">Publish Listing</Button>
          </form>
        </Card>

        <div className="lg:col-span-8">
          <div className="bg-white border border-[var(--sl-border)] rounded-md divide-y divide-[var(--sl-border)]">
            {listings.map((item) => (
              <div key={item.id} className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] text-[var(--sl-subtle)]">
                      {item.listingType} · {item.subject} · Condition: {item.condition.replace(/_/g, ' ')}
                    </p>
                    <h3 className="mt-1 text-[15px] font-display font-semibold text-[var(--sl-text)]">{item.title}</h3>
                    <p className="text-xs text-[var(--sl-muted)]">
                      By {item.author} · Listed by {item.ownerName} ({item.ownerDepartment})
                    </p>
                    {item.description && (
                      <p className="mt-1.5 text-xs text-[var(--sl-muted)] leading-relaxed">{item.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusLabel status={item.status} />
                    {item.ownerUserId !== user?.id && item.status === 'AVAILABLE' && (
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            const res = await SmartLibApi.requestExchange(item.id, 'Interested in exchanging on campus.');
                            notify(res.message, 'success');
                            load();
                          } catch (err) {
                            notify(extractErrorMessage(err), 'error');
                          }
                        }}
                      >
                        Request
                      </Button>
                    )}
                  </div>
                </div>

                {item.requests?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[var(--sl-border)] space-y-2">
                    {item.requests.map((req) => (
                      <div key={req.id} className="flex items-center justify-between gap-3 text-xs bg-[var(--sl-bg)] px-3 py-2 rounded">
                        <span>
                          <strong className="text-[var(--sl-text)]">{req.requesterName}</strong>: {req.message}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusLabel status={req.status} />
                          {item.ownerUserId === user?.id && req.status === 'PENDING' && (
                            <>
                              <Button
                                size="sm"
                                onClick={async () => {
                                  await SmartLibApi.respondExchangeRequest(item.id, req.id, 'APPROVED');
                                  notify('Exchange request approved.', 'success');
                                  load();
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={async () => {
                                  await SmartLibApi.respondExchangeRequest(item.id, req.id, 'DECLINED');
                                  notify('Exchange request declined.', 'info');
                                  load();
                                }}
                              >
                                Decline
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
