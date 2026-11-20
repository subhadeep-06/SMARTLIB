import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BookMarked, Download, Plus, Upload } from 'lucide-react';
import { SmartLibApi, extractErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  AlertBanner,
  Button,
  Card,
  DataTable,
  InputField,
  MetricStrip,
  Modal,
  PageHeader,
  SectionHeader,
  SelectField,
  StatusLabel,
} from '../components/ui/Primitives';
import { formatINR, formatIndianDate, formatIndianNumber } from '../utils/formatters';

export function LibrarianDashboard() {
  const { notify } = useToast();
  const [analytics, setAnalytics] = useState(null);
  const [activeLoans, setActiveLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([
      SmartLibApi.getDashboardAnalytics({}),
      SmartLibApi.getCirculationHistory({}),
    ])
      .then(([a, hist]) => {
        setAnalytics(a);
        setActiveLoans(hist.filter((i) => i.status === 'ACTIVE' || i.status === 'OVERDUE'));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleQuickReturn = async (issueId) => {
    try {
      const res = await SmartLibApi.returnBook({ issueId, conditionOnReturn: 'GOOD' });
      notify(res.message, 'success');
      load();
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const handleExportCsv = async () => {
    const blob = await SmartLibApi.exportCirculationCsv();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smartlib-circulation-report.csv';
    a.click();
    URL.revokeObjectURL(url);
    notify('Circulation report exported as CSV.', 'info');
  };

  const k = analytics?.kpis;

  return (
    <div>
      <PageHeader
        kicker="Circulation & Desk Operations"
        title="Librarian Operations Overview"
        subtitle="Active branch circulation, pending returns, FIFO waitlists, and copy inventory health."
        actions={
          <>
            <Button variant="secondary" onClick={handleExportCsv}>
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </Button>
            <Link to="/librarian/circulation">
              <Button>
                <BookMarked className="w-3.5 h-3.5" />
                <span>Issue / Return Desk</span>
              </Button>
            </Link>
          </>
        }
      />

      <MetricStrip
        className="mb-7"
        items={[
          {
            label: 'Catalog Titles',
            value: k ? formatIndianNumber(k.totalTitles) : '—',
            detail: `${formatIndianNumber(k?.totalCopies ?? 0)} physical copies tracked`,
          },
          {
            label: 'Available / Issued',
            value: k ? `${formatIndianNumber(k.availableCopies)} / ${formatIndianNumber(k.issuedCopies)}` : '—',
            detail: 'Live shelf vs. checked-out balance',
            tone: 'accent',
          },
          {
            label: 'Overdue Volumes',
            value: k ? formatIndianNumber(k.overdueLoans) : '—',
            tone: k?.overdueLoans > 0 ? 'error' : 'default',
            detail: `${formatINR(k?.outstandingFines ?? 0)} outstanding fines`,
          },
          {
            label: 'Reservation Queue',
            value: k ? formatIndianNumber(k.activeReservations) : '—',
            detail: `${formatIndianNumber(k?.pendingAcquisitions ?? 0)} pending acquisitions`,
            tone: 'warning',
          },
        ]}
      />

      {/* Actionable Pending Returns Queue */}
      <section className="mb-7">
        <SectionHeader
          title="Pending Returns & Active Checkouts"
          subtitle="Process desk returns directly to trigger automatic overdue calculations and FIFO waitlist allocations."
          action={
            <Link to="/librarian/circulation" className="text-xs font-medium text-[#526B50] hover:underline">
              Open full circulation desk →
            </Link>
          }
        />
        <DataTable
          loading={loading}
          data={activeLoans}
          pageSize={5}
          searchPlaceholder="Filter active loans by borrower, title, or copy code..."
          searchKeys={['bookTitle', 'memberName', 'memberInstitutionalId', 'copyCode', 'status']}
          emptyTitle="No pending returns"
          emptyDescription="All physical copies in this branch are currently returned."
          columns={[
            {
              key: 'copyCode',
              label: 'Copy / Receipt',
              sortable: true,
              render: (i) => (
                <div className="font-mono-num text-xs">
                  <p className="font-semibold text-[var(--sl-text)]">{i.copyCode}</p>
                  <p className="text-[var(--sl-subtle)]">{i.receiptNumber}</p>
                </div>
              ),
            },
            {
              key: 'bookTitle',
              label: 'Title & Borrower',
              sortable: true,
              render: (i) => (
                <div>
                  <p className="font-medium text-[var(--sl-text)]">{i.bookTitle}</p>
                  <p className="text-xs text-[var(--sl-muted)]">
                    {i.memberName} ({i.memberInstitutionalId})
                  </p>
                </div>
              ),
            },
            {
              key: 'dueDate',
              label: 'Due Date',
              sortable: true,
              render: (i) => <span className="font-mono-num text-xs">{formatIndianDate(i.dueDate)}</span>,
            },
            {
              key: 'status',
              label: 'Status',
              sortable: true,
              render: (i) => <StatusLabel status={i.status} />,
            },
            {
              key: 'action',
              label: 'Desk Action',
              align: 'right',
              render: (i) => (
                <Button size="sm" variant="secondary" onClick={() => handleQuickReturn(i.id)}>
                  Process Return
                </Button>
              ),
            },
          ]}
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7" padding="p-5">
          <SectionHeader
            title="Monthly Circulation Activity"
            subtitle="Verified loans and returns across the last 6 months."
          />
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics?.borrowingTrends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E9E5DA" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#666860' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#666860' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="loans" name="Loans" stroke="#526B50" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="returns" name="Returns" stroke="#92977A" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-5" padding="p-5">
          <SectionHeader
            title="Circulation by Subject"
            subtitle="Most active academic disciplines in branch loans."
            action={
              <Link to="/librarian/demand" className="text-xs text-[#526B50] hover:underline">
                Demand analytics →
              </Link>
            }
          />
          <div className="divide-y divide-[var(--sl-border)]">
            {(analytics?.popularCategories || []).map((c) => (
              <div key={c.category} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-[var(--sl-text)]">{c.category}</span>
                <span className="font-mono-num text-xs font-semibold text-[#526B50]">{c.count} loans</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function BookManagementPage() {
  const { notify } = useToast();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [csvText, setCsvText] = useState('isbn,title,author,publisher,category,year\n978-0201633610,Design Patterns,Erich Gamma,Addison-Wesley,Computer Science,1994');
  const [form, setForm] = useState({
    isbn: '',
    title: '',
    authors: '',
    publisher: '',
    category: 'Computer Science',
    edition: '1st ed.',
    publicationYear: 2026,
    initialCopies: 2,
    floor: 2,
    section: 'Computer Science',
    rack: 'C',
    shelf: '09',
  });
  const [error, setError] = useState('');

  const load = () =>
    SmartLibApi.getBooks({ includeArchived: 'true' })
      .then(setBooks)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await SmartLibApi.createBook(form);
      setShowAdd(false);
      notify('Book title and initial physical copies cataloged.', 'success');
      load();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Book Catalogue Management"
        subtitle="Catalog new titles, batch-import via CSV, and archive retired holdings."
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowCsv(true)}>
              <Upload className="w-3.5 h-3.5" />
              <span>Import CSV</span>
            </Button>
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="w-3.5 h-3.5" />
              <span>Add Title</span>
            </Button>
          </>
        }
      />
      <AlertBanner type="error" message={error} onDismiss={() => setError('')} />

      <DataTable
        loading={loading}
        data={books}
        searchPlaceholder="Search by title, ISBN, author, or category..."
        searchKeys={['title', 'isbn', 'category', 'publisher', (b) => b.authors.join(' ')]}
        columns={[
          {
            key: 'title',
            label: 'ISBN & Title',
            sortable: true,
            render: (b) => (
              <div>
                <p className="font-medium text-[var(--sl-text)]">{b.title}</p>
                <p className="text-xs font-mono-num text-[var(--sl-subtle)]">{b.isbn}</p>
              </div>
            ),
          },
          {
            key: 'publisher',
            label: 'Authors / Publisher',
            render: (b) => (
              <div className="text-xs text-[var(--sl-muted)]">
                <p>{b.authors.join(', ')}</p>
                <p>
                  {b.publisher} ({b.publicationYear})
                </p>
              </div>
            ),
          },
          {
            key: 'category',
            label: 'Category',
            sortable: true,
            render: (b) => <span className="text-xs">{b.category}</span>,
          },
          {
            key: 'availableCopies',
            label: 'Copies (Avail / Total)',
            align: 'right',
            sortable: true,
            render: (b) => (
              <span className="font-mono-num text-xs">
                {b.availableCopies} / {b.totalCopies}
              </span>
            ),
          },
          {
            key: 'action',
            label: 'Action',
            align: 'right',
            render: (b) =>
              !b.archived ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await SmartLibApi.archiveBook(b.id);
                    notify(`Archived "${b.title}".`, 'info');
                    load();
                  }}
                >
                  Archive
                </Button>
              ) : (
                <span className="text-xs text-[var(--sl-subtle)]">Archived</span>
              ),
          },
        ]}
      />

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Catalog New Book Title">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <InputField id="bk-isbn" label="ISBN" required value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />
            <InputField id="bk-title" label="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <InputField id="bk-auth" label="Authors (comma-separated)" required value={form.authors} onChange={(e) => setForm({ ...form, authors: e.target.value })} />
            <InputField id="bk-pub" label="Publisher" value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} />
            <InputField id="bk-cat" label="Category" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <InputField id="bk-yr" label="Publication Year" type="number" value={form.publicationYear} onChange={(e) => setForm({ ...form, publicationYear: e.target.value })} />
            <InputField id="bk-cnt" label="Initial Physical Copies" type="number" min={1} max={10} value={form.initialCopies} onChange={(e) => setForm({ ...form, initialCopies: e.target.value })} />
            <InputField
              id="bk-shelf"
              label="Rack - Shelf"
              value={`${form.rack}-${form.shelf}`}
              onChange={(e) => {
                const [r, s] = e.target.value.split('-');
                setForm({ ...form, rack: r || 'A', shelf: s || '01' });
              }}
            />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button type="submit">Save & Generate QR Copies</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showCsv} onClose={() => setShowCsv(false)} title="Batch Import Books via CSV">
        <div className="space-y-3">
          <p className="text-xs text-[var(--sl-muted)]">
            Columns: <code className="font-mono-num">isbn,title,author,publisher,category,year</code>
          </p>
          <textarea
            rows={6}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            className="w-full p-3 text-xs font-mono-num border border-[#D7D2C3] rounded bg-white focus:border-[#526B50] focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCsv(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const res = await SmartLibApi.importBooksCsv(csvText);
                setShowCsv(false);
                notify(res.message, 'success');
                load();
              }}
            >
              Run Import
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function PhysicalInventoryPage() {
  const { notify } = useToast();
  const [copies, setCopies] = useState([]);
  const [books, setBooks] = useState([]);
  const [newCopyBookId, setNewCopyBookId] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([SmartLibApi.getCopies({}), SmartLibApi.getBooks({})])
      .then(([c, b]) => {
        setCopies(c);
        setBooks(b);
        if (!newCopyBookId && b[0]) setNewCopyBookId(b[0].id);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader
        title="Physical Copy Inventory"
        subtitle="Manage individual barcoded & QR-tagged book copies, shelf coordinates, and physical condition audits."
      />

      <div className="pb-5 mb-6 border-b border-[var(--sl-border)] flex flex-col sm:flex-row gap-3 items-end">
        <SelectField
          id="inv-bk"
          label="Register New Physical Copy for Title"
          value={newCopyBookId}
          onChange={(e) => setNewCopyBookId(e.target.value)}
          className="flex-1"
        >
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title} ({b.isbn})
            </option>
          ))}
        </SelectField>
        <Button
          onClick={async () => {
            await SmartLibApi.createCopy({ bookId: newCopyBookId, floor: 2, rack: 'C', shelf: '05' });
            notify('New physical copy registered with unique QR token.', 'success');
            load();
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Register Copy</span>
        </Button>
      </div>

      <DataTable
        loading={loading}
        data={copies}
        searchPlaceholder="Search by copy code, QR token, title, or status..."
        searchKeys={['copyCode', 'qrToken', 'bookTitle', 'condition', 'status']}
        columns={[
          {
            key: 'copyCode',
            label: 'Copy Code / QR',
            sortable: true,
            render: (c) => (
              <div className="font-mono-num text-xs">
                <p className="font-semibold text-[var(--sl-text)]">{c.copyCode}</p>
                <p className="text-[var(--sl-subtle)]">{c.qrToken}</p>
              </div>
            ),
          },
          {
            key: 'bookTitle',
            label: 'Title',
            sortable: true,
            render: (c) => <span className="font-medium text-[var(--sl-text)]">{c.bookTitle}</span>,
          },
          {
            key: 'location',
            label: 'Shelf Coordinates',
            render: (c) => (
              <span className="text-xs text-[var(--sl-muted)] font-mono-num">
                F{c.location.floor} · {c.location.section} · R{c.location.rack}-S{c.location.shelf}
              </span>
            ),
          },
          {
            key: 'condition',
            label: 'Condition',
            sortable: true,
            render: (c) => <span className="text-xs">{c.condition}</span>,
          },
          {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: (c) => <StatusLabel status={c.status} />,
          },
        ]}
      />
    </div>
  );
}

export function IssueReturnDeskPage() {
  const { notify } = useToast();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [memberId, setMemberId] = useState('STU-2026-0412');
  const [copyCode, setCopyCode] = useState('MAIN-CS-0102');
  const [error, setError] = useState('');

  const load = () =>
    SmartLibApi.getCirculationHistory({})
      .then(setIssues)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const handleIssue = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await SmartLibApi.issueBook({ memberId, copyCode });
      notify(res.message, 'success');
      load();
    } catch (err) {
      const msg = extractErrorMessage(err);
      setError(msg);
      notify(msg, 'error');
    }
  };

  const handleReturn = async (issueId) => {
    setError('');
    try {
      const res = await SmartLibApi.returnBook({ issueId, conditionOnReturn: 'GOOD' });
      notify(res.message, 'success');
      load();
    } catch (err) {
      const msg = extractErrorMessage(err);
      setError(msg);
      notify(msg, 'error');
    }
  };

  const active = issues.filter((i) => i.status === 'ACTIVE' || i.status === 'OVERDUE');

  return (
    <div>
      <PageHeader
        title="Circulation Desk: Issue & Return"
        subtitle="Check out physical copies, process returns, calculate overdue fines, and advance FIFO waitlists."
      />
      <AlertBanner type="error" message={error} onDismiss={() => setError('')} />

      <Card className="mb-6" padding="p-5">
        <SectionHeader title="Issue Physical Copy" />
        <form onSubmit={handleIssue} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <InputField id="desk-mem" label="Member ID or QR Token" required value={memberId} onChange={(e) => setMemberId(e.target.value)} />
          <InputField id="desk-cp" label="Copy Code, Barcode, or QR Token" required value={copyCode} onChange={(e) => setCopyCode(e.target.value)} />
          <Button type="submit">Issue Volume</Button>
        </form>
      </Card>

      <DataTable
        loading={loading}
        data={active}
        searchPlaceholder="Search active loans by receipt, borrower, or copy..."
        searchKeys={['receiptNumber', 'copyCode', 'bookTitle', 'memberName', 'memberInstitutionalId']}
        emptyTitle="No active loans"
        emptyDescription="Issued copies awaiting return will appear in this desk ledger."
        columns={[
          {
            key: 'receiptNumber',
            label: 'Receipt / Copy',
            sortable: true,
            render: (i) => (
              <div className="font-mono-num text-xs">
                <p className="font-semibold text-[var(--sl-text)]">{i.receiptNumber}</p>
                <p className="text-[var(--sl-subtle)]">{i.copyCode}</p>
              </div>
            ),
          },
          {
            key: 'bookTitle',
            label: 'Title & Borrower',
            sortable: true,
            render: (i) => (
              <div>
                <p className="font-medium text-[var(--sl-text)]">{i.bookTitle}</p>
                <p className="text-xs text-[var(--sl-muted)]">
                  {i.memberName} ({i.memberInstitutionalId})
                </p>
              </div>
            ),
          },
          {
            key: 'dueDate',
            label: 'Due Date',
            sortable: true,
            render: (i) => <span className="font-mono-num text-xs">{formatIndianDate(i.dueDate)}</span>,
          },
          {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: (i) => <StatusLabel status={i.status} />,
          },
          {
            key: 'action',
            label: 'Desk Action',
            align: 'right',
            render: (i) => (
              <Button size="sm" onClick={() => handleReturn(i.id)}>
                Process Return
              </Button>
            ),
          },
        ]}
      />
    </div>
  );
}

export function LibrarianReservationsPage() {
  const { notify } = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    SmartLibApi.getAllReservations()
      .then(setList)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader title="Branch FIFO Reservation Queue" subtitle="Monitor prioritized book holds and manage pickup expirations." />
      <DataTable
        loading={loading}
        data={list}
        searchPlaceholder="Search by title, member name, or status..."
        searchKeys={['bookTitle', 'memberName', 'memberInstitutionalId', 'status']}
        columns={[
          {
            key: 'queuePosition',
            label: 'Queue #',
            sortable: true,
            render: (r) => (
              <span className="font-mono-num font-semibold text-[#526B50]">
                {r.queuePosition ? `#${r.queuePosition}` : '—'}
              </span>
            ),
          },
          {
            key: 'bookTitle',
            label: 'Book Title',
            sortable: true,
            render: (r) => <span className="font-medium text-[var(--sl-text)]">{r.bookTitle}</span>,
          },
          {
            key: 'memberName',
            label: 'Member',
            sortable: true,
            render: (r) => (
              <span className="text-xs text-[var(--sl-muted)]">
                {r.memberName} ({r.memberInstitutionalId})
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: (r) => <StatusLabel status={r.status} />,
          },
          {
            key: 'action',
            label: 'Action',
            align: 'right',
            render: (r) =>
              (r.status === 'WAITING' || r.status === 'READY_FOR_PICKUP') && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await SmartLibApi.cancelReservation(r.id);
                    notify('Reservation cancelled and queue advanced.', 'info');
                    load();
                  }}
                >
                  Cancel Hold
                </Button>
              ),
          },
        ]}
      />
    </div>
  );
}

export function MemberDirectoryPage() {
  const { notify } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    SmartLibApi.getUsers({})
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader title="Institutional Member Directory" subtitle="Verify member borrowing standing and manage circulation restrictions." />
      <DataTable
        loading={loading}
        data={users}
        searchPlaceholder="Search members by name, email, ID, or role..."
        searchKeys={['fullName', 'email', 'institutionalId', 'role']}
        columns={[
          {
            key: 'fullName',
            label: 'Member',
            sortable: true,
            render: (u) => (
              <div>
                <p className="font-medium text-[var(--sl-text)]">{u.fullName}</p>
                <p className="text-xs text-[var(--sl-muted)]">{u.email}</p>
              </div>
            ),
          },
          {
            key: 'institutionalId',
            label: 'ID / Role',
            sortable: true,
            render: (u) => (
              <span className="text-xs font-mono-num">
                {u.institutionalId} · {u.role}
              </span>
            ),
          },
          {
            key: 'activeBorrowings',
            label: 'Active Loans',
            align: 'right',
            sortable: true,
            render: (u) => <span className="font-mono-num text-xs">{u.activeBorrowings}</span>,
          },
          {
            key: 'accountStatus',
            label: 'Standing',
            render: (u) => <StatusLabel status={u.borrowingRestricted ? 'RESTRICTED' : u.accountStatus} />,
          },
          {
            key: 'control',
            label: 'Control',
            align: 'right',
            render: (u) =>
              ['STUDENT', 'FACULTY'].includes(u.role) && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await SmartLibApi.updateUserStatus(u.id, {
                      borrowingRestricted: !u.borrowingRestricted,
                    });
                    notify(`Updated borrowing standing for ${u.fullName}.`, 'success');
                    load();
                  }}
                >
                  {u.borrowingRestricted ? 'Lift Restriction' : 'Restrict Borrowing'}
                </Button>
              ),
          },
        ]}
      />
    </div>
  );
}

export function FineManagementPage() {
  const { notify } = useToast();
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () =>
    SmartLibApi.getFines({})
      .then(setFines)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader title="Fine & Payment Ledger (INR)" subtitle="Collect desk payments in INR (₹) or record audited academic hardship waivers." />
      <AlertBanner type="error" message={error} onDismiss={() => setError('')} />

      <DataTable
        loading={loading}
        data={fines}
        searchPlaceholder="Search fines by member, volume, or status..."
        searchKeys={['memberName', 'bookTitle', 'reason', 'status']}
        columns={[
          {
            key: 'memberName',
            label: 'Member / Volume',
            sortable: true,
            render: (f) => (
              <div>
                <p className="font-medium text-[var(--sl-text)]">{f.memberName}</p>
                <p className="text-xs text-[var(--sl-muted)]">{f.bookTitle}</p>
              </div>
            ),
          },
          {
            key: 'reason',
            label: 'Reason',
            render: (f) => <span className="text-xs">{f.reason}</span>,
          },
          {
            key: 'balance',
            label: 'Balance (INR)',
            align: 'right',
            sortable: true,
            render: (f) => (
              <div className="font-mono-num text-right">
                <p className="font-semibold text-[var(--sl-text)]">{formatINR(f.balance)}</p>
                <p className="text-[11px] text-[var(--sl-subtle)]">
                  Assessed {formatINR(f.amount)}
                </p>
              </div>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: (f) => <StatusLabel status={f.status} />,
          },
          {
            key: 'action',
            label: 'Action',
            align: 'right',
            render: (f) =>
              f.balance > 0 && (
                <div className="inline-flex gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        const res = await SmartLibApi.payFine(f.id, { paymentMethod: 'DESK_CASH' });
                        notify(res.message, 'success');
                        load();
                      } catch (err) {
                        setError(extractErrorMessage(err));
                      }
                    }}
                  >
                    Record Payment
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      try {
                        const res = await SmartLibApi.waiveFine(f.id, 'Authorized academic hardship waiver.');
                        notify(res.message, 'info');
                        load();
                      } catch (err) {
                        setError(extractErrorMessage(err));
                      }
                    }}
                  >
                    Waive
                  </Button>
                </div>
              ),
          },
        ]}
      />
    </div>
  );
}

export function SeatManagementPage() {
  const { notify } = useToast();
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seatCode, setSeatCode] = useState('');
  const [zone, setZone] = useState('QUIET_STUDY');

  const load = () =>
    SmartLibApi.getSeats({ branchId: 'ALL' })
      .then(setSeats)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader title="Study Seat Management" subtitle="Register study spaces, toggle maintenance windows, and oversee floor zones." />

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await SmartLibApi.createSeat({ seatCode, zone, floor: 2 });
          setSeatCode('');
          notify('Study seat registered.', 'success');
          load();
        }}
        className="pb-5 mb-6 border-b border-[var(--sl-border)] grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
      >
        <InputField id="sm-code" label="Seat Code" placeholder="Q-105" required value={seatCode} onChange={(e) => setSeatCode(e.target.value)} />
        <SelectField id="sm-zone" label="Zone" value={zone} onChange={(e) => setZone(e.target.value)}>
          <option value="QUIET_STUDY">Quiet Study</option>
          <option value="COMPUTER_CARREL">Computer Carrel</option>
          <option value="ACCESSIBLE">Accessible Desk</option>
          <option value="COLLABORATIVE">Collaborative</option>
        </SelectField>
        <Button type="submit">Add Study Seat</Button>
      </form>

      <DataTable
        loading={loading}
        data={seats}
        searchPlaceholder="Search seats by code, branch, or zone..."
        searchKeys={['seatCode', 'branchName', 'zone', 'status']}
        columns={[
          {
            key: 'seatCode',
            label: 'Seat',
            sortable: true,
            render: (s) => <span className="font-mono-num font-semibold">{s.seatCode}</span>,
          },
          {
            key: 'branchName',
            label: 'Branch & Floor',
            sortable: true,
            render: (s) => <span className="text-xs text-[var(--sl-muted)]">{s.branchName} · Floor {s.floor}</span>,
          },
          {
            key: 'zone',
            label: 'Zone',
            sortable: true,
            render: (s) => <span className="text-xs">{s.zone.replace(/_/g, ' ')}</span>,
          },
          {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: (s) => <StatusLabel status={s.status} />,
          },
          {
            key: 'control',
            label: 'Control',
            align: 'right',
            render: (s) => (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  const next = s.status === 'ACTIVE' ? 'MAINTENANCE' : 'ACTIVE';
                  await SmartLibApi.updateSeat(s.id, { status: next });
                  notify(`Seat ${s.seatCode} set to ${next}.`, 'info');
                  load();
                }}
              >
                {s.status === 'ACTIVE' ? 'Set Maintenance' : 'Activate Seat'}
              </Button>
            ),
          },
        ]}
      />
    </div>
  );
}

export function ShelfAndLostFoundPage() {
  const { notify } = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrInput, setQrInput] = useState('QR-CP-102-B7E2');
  const [incCopyCode, setIncCopyCode] = useState('');
  const [incType, setIncType] = useState('LOST');
  const [incDesc, setIncDesc] = useState('');
  const [error, setError] = useState('');

  const load = () =>
    SmartLibApi.getLostFoundReports()
      .then(setReports)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader
        title="Shelf QR Verification & Lost / Found"
        subtitle="Verify shelf placement via QR scans and record lost, damaged, or recovered volume incidents."
      />
      <AlertBanner type="error" message={error} onDismiss={() => setError('')} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card padding="p-5">
          <SectionHeader title="Verify Shelf Inventory via QR" />
          <div className="space-y-3">
            <InputField id="qr-ver" label="Copy QR Token or Copy Code" value={qrInput} onChange={(e) => setQrInput(e.target.value)} />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    const res = await SmartLibApi.verifyShelfCopy({ qrToken: qrInput, misplaced: false });
                    notify(res.message, 'success');
                  } catch (err) {
                    setError(extractErrorMessage(err));
                  }
                }}
              >
                Verify On Shelf
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    const res = await SmartLibApi.verifyShelfCopy({ qrToken: qrInput, misplaced: true });
                    notify(res.message, 'info');
                  } catch (err) {
                    setError(extractErrorMessage(err));
                  }
                }}
              >
                Flag Misplaced
              </Button>
            </div>
          </div>
        </Card>

        <Card padding="p-5">
          <SectionHeader title="Log Lost / Damaged Incident" />
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await SmartLibApi.createLostFoundReport({
                  copyCode: incCopyCode,
                  incidentType: incType,
                  description: incDesc,
                });
                setIncCopyCode('');
                setIncDesc('');
                notify(res.message, 'success');
                load();
              } catch (err) {
                setError(extractErrorMessage(err));
              }
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <InputField id="lf-cp" label="Copy Code" placeholder="MAIN-CS-0102" required value={incCopyCode} onChange={(e) => setIncCopyCode(e.target.value)} />
              <SelectField id="lf-tp" label="Incident Type" value={incType} onChange={(e) => setIncType(e.target.value)}>
                <option value="LOST">Lost</option>
                <option value="DAMAGED">Damaged</option>
                <option value="RECOVERED">Recovered</option>
              </SelectField>
            </div>
            <InputField id="lf-desc" label="Incident Details" required value={incDesc} onChange={(e) => setIncDesc(e.target.value)} />
            <Button type="submit" size="sm">Log Incident</Button>
          </form>
        </Card>
      </div>

      <DataTable
        loading={loading}
        data={reports}
        searchPlaceholder="Search incident reports..."
        searchKeys={['incidentCode', 'copyCode', 'bookTitle', 'description', 'status']}
        columns={[
          {
            key: 'incidentCode',
            label: 'Incident / Copy',
            sortable: true,
            render: (r) => (
              <div className="font-mono-num text-xs">
                <p className="font-semibold">{r.incidentCode}</p>
                <p className="text-[var(--sl-subtle)]">{r.copyCode}</p>
              </div>
            ),
          },
          {
            key: 'bookTitle',
            label: 'Volume & Notes',
            sortable: true,
            render: (r) => (
              <div>
                <p className="font-medium text-[var(--sl-text)]">{r.bookTitle}</p>
                <p className="text-xs text-[var(--sl-muted)]">{r.description}</p>
                {r.penaltyAmount > 0 && (
                  <p className="text-[11px] font-mono-num text-[#B66F50] mt-0.5">
                    Assessed Repair / Replacement Penalty: {formatINR(r.penaltyAmount)}
                  </p>
                )}
              </div>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: (r) => <StatusLabel status={r.status} />,
          },
          {
            key: 'action',
            label: 'Verification',
            align: 'right',
            render: (r) =>
              r.status !== 'RECOVERED_VERIFIED' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    const res = await SmartLibApi.verifyLostFoundReport(r.id, {
                      status: 'RECOVERED_VERIFIED',
                      recoveryDetails: 'Inspected and returned to active shelf stock.',
                    });
                    notify(res.message, 'success');
                    load();
                  }}
                >
                  Mark Recovered
                </Button>
              ),
          },
        ]}
      />
    </div>
  );
}

export function DemandAnalyticsPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    SmartLibApi.getDemandAnalytics().then(setData).catch(() => {});
  }, []);

  return (
    <div>
      <PageHeader
        title="Predictive Book Demand Analytics"
        subtitle="Statistical demand modeling separating verified historical circulation from projected examination-period demand."
      />

      {data && (
        <div className="space-y-6">
          <Card padding="p-5">
            <SectionHeader title="Historical vs. Forecasted Demand" subtitle={data.methodology} />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.aggregateSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E9E5DA" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#666860' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#666860' }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="historicalBorrows" stackId="demand" name="Actual Historical Loans" fill="#526B50" radius={[2, 2, 0, 0]} maxBarSize={44} />
                  <Bar dataKey="forecastBorrows" stackId="demand" name="Statistical Forecast" fill="#B66F50" radius={[2, 2, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <DataTable
            data={data.bookForecasts}
            rowKey="bookId"
            searchPlaceholder="Filter demand table by title or priority..."
            searchKeys={['title', 'priority', 'explanation']}
            columns={[
              {
                key: 'title',
                label: 'Title & Rationale',
                sortable: true,
                render: (f) => (
                  <div>
                    <p className="font-medium text-[var(--sl-text)]">{f.title}</p>
                    <p className="text-xs text-[var(--sl-muted)]">{f.explanation}</p>
                  </div>
                ),
              },
              {
                key: 'totalCopies',
                label: 'Copies (Avail)',
                align: 'right',
                sortable: true,
                render: (f) => (
                  <span className="font-mono-num text-xs">
                    {f.totalCopies} ({f.availableCopies})
                  </span>
                ),
              },
              {
                key: 'activeReservations',
                label: 'Active Queue',
                align: 'right',
                sortable: true,
                render: (f) => <span className="font-mono-num text-xs">{f.activeReservations}</span>,
              },
              {
                key: 'predictedNextMonthBorrows',
                label: 'Forecast',
                align: 'right',
                sortable: true,
                render: (f) => <span className="font-mono-num text-xs">{f.predictedNextMonthBorrows}</span>,
              },
              {
                key: 'demandToInventoryRatio',
                label: 'Demand Ratio',
                align: 'right',
                sortable: true,
                render: (f) => <span className="font-mono-num font-semibold">{f.demandToInventoryRatio}x</span>,
              },
              {
                key: 'priority',
                label: 'Priority',
                sortable: true,
                render: (f) => <StatusLabel status={f.priority} />,
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}

export function AcquisitionSuggestionsPage() {
  const { notify } = useToast();
  const [items, setItems] = useState([]);

  const load = () => SmartLibApi.getAcquisitionSuggestions().then(setItems).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader
        title="Book Acquisition Proposals"
        subtitle="Evidence-backed purchasing suggestions requiring explicit librarian or branch admin approval."
      />

      <div className="bg-white border border-[var(--sl-border)] rounded-md divide-y divide-[var(--sl-border)]">
        {items.map((item) => (
          <div key={item.id} className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <p className="text-xs text-[var(--sl-subtle)] font-mono-num">
                {item.branchName} · ISBN {item.isbn} · Demand Ratio {item.demandToInventoryRatio}x · Priority {item.priority}
              </p>
              <h3 className="mt-1 text-[15.5px] font-display font-semibold text-[var(--sl-text)]">
                {item.bookTitle} (+{item.suggestedAdditionalCopies} suggested copies)
              </h3>
              <p className="mt-1.5 text-sm text-[var(--sl-muted)] leading-relaxed">{item.explanation}</p>
              {item.rejectionReason && (
                <p className="mt-1.5 text-xs text-[#B66F50]">Rejection reason: {item.rejectionReason}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusLabel status={item.status} />
              {item.status === 'PENDING' && (
                <>
                  <Button
                    size="sm"
                    onClick={async () => {
                      const res = await SmartLibApi.approveAcquisition(item.id);
                      notify(res.message, 'success');
                      load();
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const res = await SmartLibApi.rejectAcquisition(
                        item.id,
                        'Deferred to next fiscal quarter budget allocation.'
                      );
                      notify(res.message, 'info');
                      load();
                    }}
                  >
                    Defer
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
