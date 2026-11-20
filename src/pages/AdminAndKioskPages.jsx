import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { Building2, MonitorSmartphone, QrCode, Scale, Users } from 'lucide-react';
import { SmartLibApi, extractErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  AlertBanner,
  Button,
  Card,
  DataTable,
  InputField,
  MetricStrip,
  PageHeader,
  SectionHeader,
  SelectField,
  StatusLabel,
} from '../components/ui/Primitives';
import { formatINR, formatIndianDateTime, formatIndianNumber } from '../utils/formatters';

export function BranchAdminDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [transfers, setTransfers] = useState([]);

  useEffect(() => {
    Promise.all([
      SmartLibApi.getDashboardAnalytics({}),
      SmartLibApi.getTransfers(),
    ])
      .then(([a, t]) => {
        setAnalytics(a);
        setTransfers(t);
      })
      .catch(() => {});
  }, []);

  const k = analytics?.kpis;

  return (
    <div>
      <PageHeader
        kicker="Branch Operations & Stewardship"
        title="Branch Administration Dashboard"
        subtitle="Branch-scoped physical holdings, circulation volume, active transfers, and study seat utilization."
        actions={
          <>
            <Link to="/branch-admin/policies">
              <Button variant="secondary">
                <Scale className="w-3.5 h-3.5" />
                <span>Branch Policies</span>
              </Button>
            </Link>
            <Link to="/branch-admin/librarians">
              <Button>
                <Users className="w-3.5 h-3.5" />
                <span>Manage Staff</span>
              </Button>
            </Link>
          </>
        }
      />

      <MetricStrip
        className="mb-7"
        items={[
          {
            label: 'Branch Physical Copies',
            value: k ? formatIndianNumber(k.totalCopies) : '—',
            detail: `${formatIndianNumber(k?.availableCopies ?? 0)} currently on shelf`,
          },
          {
            label: 'Issued Copies',
            value: k ? formatIndianNumber(k.issuedCopies) : '—',
            detail: `${formatIndianNumber(k?.overdueLoans ?? 0)} overdue returns`,
            tone: k?.overdueLoans > 0 ? 'error' : 'default',
          },
          {
            label: 'Seat Utilization',
            value: k ? `${k.seatUtilizationPct}%` : '—',
            detail: 'Active reading room occupancy',
            tone: 'accent',
          },
          {
            label: 'Outstanding Fines',
            value: k ? formatINR(k.outstandingFines) : '—',
            detail: 'Branch fine ledger balance (INR)',
            tone: 'warning',
          },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7" padding="p-5">
          <SectionHeader
            title="Branch Circulation Activity"
            subtitle="Monthly checked-out volumes vs. completed returns."
          />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.borrowingTrends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E9E5DA" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#666860' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#666860' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="loans" name="Loans" fill="#526B50" radius={[2, 2, 0, 0]} maxBarSize={28} />
                <Bar dataKey="returns" name="Returns" fill="#92977A" radius={[2, 2, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-5" padding="p-5">
          <SectionHeader
            title="Inter-Branch Transfer Queue"
            subtitle="Recent volume requests across university branches."
            action={
              <Link to="/branch-admin/transfers" className="text-xs text-[#526B50] hover:underline">
                Manage transfers →
              </Link>
            }
          />
          {transfers.length === 0 ? (
            <p className="text-xs text-[var(--sl-muted)] py-4">No transfer requests queued.</p>
          ) : (
            <div className="divide-y divide-[var(--sl-border)]">
              {transfers.slice(0, 5).map((t) => (
                <div key={t.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono-num font-semibold text-[var(--sl-text)]">{t.transferCode}</span>
                    <StatusLabel status={t.status} />
                  </div>
                  <p className="text-sm font-medium text-[var(--sl-text)] mt-0.5 truncate">{t.bookTitle}</p>
                  <p className="text-xs text-[var(--sl-muted)] mt-0.5">
                    {t.fromBranchName} → {t.toBranchName}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export function SuperAdminDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [recentAudits, setRecentAudits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      SmartLibApi.getDashboardAnalytics({}),
      SmartLibApi.getAuditLogs(),
    ])
      .then(([a, logs]) => {
        setAnalytics(a);
        setRecentAudits(logs.slice(0, 6));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const k = analytics?.kpis;
  const branchPerf = analytics?.branchPerformance || [];

  return (
    <div>
      <PageHeader
        kicker="Enterprise Governance"
        title="Organization Overview"
        subtitle="Multi-branch performance ledger, physical inventory distribution, institutional users, and compliance events."
        actions={
          <>
            <Link to="/super-admin/policies">
              <Button variant="secondary">
                <Scale className="w-3.5 h-3.5" />
                <span>Global Policies</span>
              </Button>
            </Link>
            <Link to="/super-admin/branches">
              <Button>
                <Building2 className="w-3.5 h-3.5" />
                <span>Manage Branches</span>
              </Button>
            </Link>
          </>
        }
      />

      <MetricStrip
        className="mb-7"
        items={[
          {
            label: 'Library Branches',
            value: k ? formatIndianNumber(k.totalBranches) : '—',
            detail: 'Active institutional locations',
            tone: 'accent',
          },
          {
            label: 'Institutional Users',
            value: k ? formatIndianNumber(k.totalUsers) : '—',
            detail: 'Students, faculty, and staff',
          },
          {
            label: 'Titles / Physical Copies',
            value: k ? `${formatIndianNumber(k.totalTitles)} / ${formatIndianNumber(k.totalCopies)}` : '—',
            detail: 'Organization-wide catalog holdings',
          },
          {
            label: 'Org Outstanding Fines',
            value: k ? formatINR(k.outstandingFines) : '—',
            detail: 'Aggregated across all branches (INR)',
            tone: 'warning',
          },
        ]}
      />

      <div className="mb-7">
        <SectionHeader
          title="Multi-Branch Performance Ledger"
          subtitle="Live holdings, circulation volume, overdue counts, and fine balances by campus branch."
        />
        <DataTable
          loading={loading}
          data={branchPerf}
          rowKey="branchId"
          searchPlaceholder="Filter branches..."
          searchKeys={['branchName', 'code']}
          columns={[
            {
              key: 'branchName',
              label: 'Library Branch',
              sortable: true,
              render: (bp) => (
                <div>
                  <p className="font-medium text-[var(--sl-text)]">{bp.branchName}</p>
                  <p className="text-xs font-mono-num text-[var(--sl-subtle)]">{bp.code}</p>
                </div>
              ),
            },
            {
              key: 'copies',
              label: 'Physical Copies',
              align: 'right',
              sortable: true,
              render: (bp) => <span className="font-mono-num text-xs">{bp.copies}</span>,
            },
            {
              key: 'activeLoans',
              label: 'Active Loans',
              align: 'right',
              sortable: true,
              render: (bp) => <span className="font-mono-num text-xs">{bp.activeLoans}</span>,
            },
            {
              key: 'overdueLoans',
              label: 'Overdue',
              align: 'right',
              sortable: true,
              render: (bp) => (
                <span className={`font-mono-num text-xs ${bp.overdueLoans > 0 ? 'text-[#B66F50] font-semibold' : ''}`}>
                  {bp.overdueLoans}
                </span>
              ),
            },
            {
              key: 'pendingFines',
              label: 'Pending Fines (INR)',
              align: 'right',
              sortable: true,
              render: (bp) => <span className="font-mono-num text-xs">{formatINR(bp.pendingFines)}</span>,
            },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-6" padding="p-5">
          <SectionHeader
            title="Holdings & Active Loans by Branch"
            subtitle="Comparative copy allocation across campus facilities."
          />
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchPerf}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E9E5DA" />
                <XAxis dataKey="code" tick={{ fontSize: 12, fill: '#666860' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#666860' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="copies" name="Physical Copies" fill="#526B50" radius={[2, 2, 0, 0]} maxBarSize={36} />
                <Bar dataKey="activeLoans" name="Active Loans" fill="#92977A" radius={[2, 2, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-6" padding="p-5">
          <SectionHeader
            title="Recent Compliance & Audit Events"
            subtitle="Latest recorded operational actions across all roles."
            action={
              <Link to="/super-admin/audit" className="text-xs text-[#526B50] hover:underline">
                Full audit log →
              </Link>
            }
          />
          <div className="divide-y divide-[var(--sl-border)]">
            {recentAudits.map((l) => (
              <div key={l.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-mono-num font-semibold text-[#526B50]">{l.action}</p>
                  <p className="text-[var(--sl-text)] mt-0.5 line-clamp-1">{l.summary}</p>
                  <p className="text-[var(--sl-subtle)] mt-0.5">
                    {l.actorName} ({l.actorRole})
                  </p>
                </div>
                <span className="font-mono-num text-[11px] text-[var(--sl-subtle)] shrink-0">
                  {formatIndianDateTime(l.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function BranchesManagementPage() {
  const { notify } = useToast();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({
    code: '',
    name: '',
    campusZone: '',
    city: 'Bengaluru',
    state: 'Karnataka',
    pinCode: '',
    contactPhone: '',
    operatingHours: 'Mon–Sat 08:00–22:00 IST',
  });
  const [error, setError] = useState('');

  const load = () => SmartLibApi.getBranches().then(setBranches).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader
        title="Library Branch Administration"
        subtitle="Establish and monitor institutional library facilities across Indian campus zones."
      />
      <AlertBanner type="error" message={error} onDismiss={() => setError('')} />

      <Card className="mb-6" padding="p-5">
        <SectionHeader title="Establish New Branch" />
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            try {
              await SmartLibApi.createBranch(form);
              setForm({
                code: '',
                name: '',
                campusZone: '',
                city: 'Bengaluru',
                state: 'Karnataka',
                pinCode: '',
                contactPhone: '',
                operatingHours: 'Mon–Sat 08:00–22:00 IST',
              });
              notify('Library branch created and recorded in audit log.', 'success');
              load();
            } catch (err) {
              setError(extractErrorMessage(err));
            }
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end"
        >
          <InputField id="br-code" label="Branch Code" placeholder="LAW-04" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <InputField id="br-name" label="Branch Name" placeholder="Faculty of Law Library" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <InputField id="br-zone" label="Campus Block / Zone" placeholder="South Academic Block" value={form.campusZone} onChange={(e) => setForm({ ...form, campusZone: e.target.value })} />
          <InputField id="br-city" label="City" placeholder="Bengaluru" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <InputField id="br-state" label="State" placeholder="Karnataka" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          <InputField id="br-pin" label="PIN Code (6 digits)" placeholder="560012" maxLength={6} value={form.pinCode} onChange={(e) => setForm({ ...form, pinCode: e.target.value })} />
          <InputField id="br-phone" label="Contact Phone" placeholder="+91 80412 44099" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
          <Button type="submit">Create Branch</Button>
        </form>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {branches.map((b) => (
          <Card key={b.id} padding="p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono-num text-xs font-semibold text-[#526B50]">{b.code}</span>
              <StatusLabel status={b.status} />
            </div>
            <h3 className="mt-1.5 text-base font-display font-semibold text-[var(--sl-text)]">{b.name}</h3>
            <p className="text-xs text-[var(--sl-muted)] mt-1">
              {b.campusZone} · {b.operatingHours}
            </p>
            <p className="text-xs text-[var(--sl-subtle)] mt-1.5 leading-relaxed">
              {b.address}
            </p>
            <p className="text-xs font-mono-num text-[var(--sl-subtle)] mt-1">
              {b.contactPhone} · {b.contactEmail}
            </p>
            <div className="mt-4 pt-3 border-t border-[var(--sl-border)] text-xs font-mono-num space-y-1 text-[var(--sl-muted)]">
              <p>Branch Admin: {b.adminName}</p>
              <p>
                Inventory: {formatIndianNumber(b.availableCopies)} avail / {formatIndianNumber(b.totalCopies)} total
              </p>
              <p>
                Active Loans: {formatIndianNumber(b.activeLoans)} · Study Seats: {formatIndianNumber(b.totalSeats)}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function StaffUsersPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    role: user?.role === 'BRANCH_ADMIN' ? 'LIBRARIAN' : 'BRANCH_ADMIN',
    branchId: user?.branchId || 'br-central',
    department: 'Library Operations',
  });
  const [error, setError] = useState('');

  const load = () => {
    Promise.all([SmartLibApi.getUsers({}), SmartLibApi.getBranches()])
      .then(([u, b]) => {
        setUsers(u);
        setBranches(b);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader
        title={user?.role === 'BRANCH_ADMIN' ? 'Branch Staff Directory' : 'Institutional User Governance'}
        subtitle="Provision staff accounts and manage institutional role assignments."
      />
      <AlertBanner type="error" message={error} onDismiss={() => setError('')} />

      <Card className="mb-6" padding="p-5">
        <SectionHeader title="Provision Institutional Account" />
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            try {
              await SmartLibApi.createUser(form);
              setForm({ ...form, fullName: '', email: '' });
              notify('Account provisioned with default onboarding password SmartLib@2026.', 'success');
              load();
            } catch (err) {
              setError(extractErrorMessage(err));
            }
          }}
          className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
        >
          <InputField id="u-name" label="Full Name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <InputField id="u-mail" label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <SelectField id="u-role" label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="LIBRARIAN">Librarian</option>
            {user?.role === 'SUPER_ADMIN' && <option value="BRANCH_ADMIN">Branch Admin</option>}
            {user?.role === 'SUPER_ADMIN' && <option value="FACULTY">Faculty</option>}
          </SelectField>
          {user?.role === 'SUPER_ADMIN' ? (
            <SelectField id="u-br" label="Branch" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </SelectField>
          ) : (
            <InputField id="u-dept" label="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          )}
          <Button type="submit">Create Account</Button>
        </form>
      </Card>

      <DataTable
        loading={loading}
        data={users}
        searchPlaceholder="Search users by name, email, role, or department..."
        searchKeys={['fullName', 'email', 'role', 'department', 'accountStatus']}
        columns={[
          {
            key: 'fullName',
            label: 'Name & Email',
            sortable: true,
            render: (u) => (
              <div>
                <p className="font-medium text-[var(--sl-text)]">{u.fullName}</p>
                <p className="text-xs text-[var(--sl-muted)]">{u.email}</p>
              </div>
            ),
          },
          {
            key: 'role',
            label: 'Role',
            sortable: true,
            render: (u) => <span className="text-xs font-mono-num">{u.role}</span>,
          },
          {
            key: 'department',
            label: 'Department',
            sortable: true,
            render: (u) => <span className="text-xs text-[var(--sl-muted)]">{u.department}</span>,
          },
          {
            key: 'accountStatus',
            label: 'Status',
            sortable: true,
            render: (u) => <StatusLabel status={u.accountStatus} />,
          },
        ]}
      />
    </div>
  );
}

export function PoliciesManagementPage() {
  const { notify } = useToast();
  const [policies, setPolicies] = useState([]);
  const [error, setError] = useState('');

  const load = () => SmartLibApi.getPolicies().then(setPolicies).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const updateField = (id, key, val) => {
    setPolicies((prev) => prev.map((p) => (p.id === id ? { ...p, [key]: Number(val) } : p)));
  };

  return (
    <div>
      <PageHeader
        title="Borrowing & Fine Policies (INR)"
        subtitle="Configure grace periods, daily overdue rates in Indian Rupees (₹), maximum fine caps, and reservation hold durations."
      />
      <AlertBanner type="error" message={error} onDismiss={() => setError('')} />

      <div className="space-y-5">
        {policies.map((p) => (
          <Card key={p.id} padding="p-5">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--sl-border)]">
              <div>
                <h2 className="text-sm font-display font-semibold text-[var(--sl-text)]">
                  {p.scope === 'GLOBAL' ? 'Global Organization Default Policy' : `Branch Policy (${p.branchId})`}
                </h2>
                <p className="text-xs text-[var(--sl-subtle)] mt-0.5 font-mono-num">
                  Currency: INR (₹) · Rate: {formatINR(p.finePerDay)}/day · Cap: {formatINR(p.maxFineAmount)}
                </p>
              </div>
              <Button
                size="sm"
                onClick={async () => {
                  setError('');
                  try {
                    await SmartLibApi.updatePolicy(p.id, p);
                    notify('Policy parameters saved and logged in audit trail.', 'success');
                    load();
                  } catch (err) {
                    setError(extractErrorMessage(err));
                  }
                }}
              >
                Save Policy
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <InputField id={`gp-${p.id}`} label="Grace Period (Days)" type="number" min="0" value={p.gracePeriodDays} onChange={(e) => updateField(p.id, 'gracePeriodDays', e.target.value)} />
              <InputField id={`fp-${p.id}`} label="Fine Per Day (₹)" type="number" min="0" step="0.25" value={p.finePerDay} onChange={(e) => updateField(p.id, 'finePerDay', e.target.value)} />
              <InputField id={`mf-${p.id}`} label="Max Fine Cap (₹)" type="number" min="0" step="1" value={p.maxFineAmount} onChange={(e) => updateField(p.id, 'maxFineAmount', e.target.value)} />
              <InputField id={`rh-${p.id}`} label="Reservation Hold (Hours)" type="number" min="1" value={p.reservationHoldHours} onChange={(e) => updateField(p.id, 'reservationHoldHours', e.target.value)} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function TransfersPage() {
  const { notify } = useToast();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    SmartLibApi.getTransfers()
      .then(setTransfers)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader title="Inter-Branch Book Transfers" subtitle="Approve, dispatch, and confirm receipt of physical volume transfers across branches." />

      <DataTable
        loading={loading}
        data={transfers}
        searchPlaceholder="Search transfers by code, title, or branch..."
        searchKeys={['transferCode', 'bookTitle', 'copyCode', 'fromBranchName', 'toBranchName', 'status']}
        columns={[
          {
            key: 'transferCode',
            label: 'Transfer Code',
            sortable: true,
            render: (t) => <span className="font-mono-num text-xs font-semibold">{t.transferCode}</span>,
          },
          {
            key: 'bookTitle',
            label: 'Book & Copy',
            sortable: true,
            render: (t) => (
              <div>
                <p className="font-medium text-[var(--sl-text)]">{t.bookTitle}</p>
                <p className="text-xs font-mono-num text-[var(--sl-subtle)]">{t.copyCode}</p>
              </div>
            ),
          },
          {
            key: 'fromBranchName',
            label: 'Route',
            render: (t) => (
              <span className="text-xs text-[var(--sl-muted)]">
                {t.fromBranchName} → {t.toBranchName}
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: (t) => <StatusLabel status={t.status} />,
          },
          {
            key: 'workflow',
            label: 'Workflow',
            align: 'right',
            render: (t) => (
              <div className="inline-flex gap-2">
                {t.status === 'REQUESTED' && (
                  <Button
                    size="sm"
                    onClick={async () => {
                      await SmartLibApi.updateTransferStatus(t.id, 'IN_TRANSIT');
                      notify('Transfer approved and dispatched.', 'success');
                      load();
                    }}
                  >
                    Approve & Ship
                  </Button>
                )}
                {t.status === 'IN_TRANSIT' && (
                  <Button
                    size="sm"
                    onClick={async () => {
                      await SmartLibApi.updateTransferStatus(t.id, 'RECEIVED');
                      notify('Copy received and assigned to destination branch.', 'success');
                      load();
                    }}
                  >
                    Confirm Receipt
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

export function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    SmartLibApi.getAuditLogs()
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="System Audit Trail" subtitle="Immutable compliance log of circulation transactions, policy updates, fine waivers, and administrative actions." />
      <DataTable
        loading={loading}
        data={logs}
        pageSize={12}
        searchPlaceholder="Filter audit trail by actor, action, or summary..."
        searchKeys={['actorName', 'actorRole', 'action', 'summary']}
        columns={[
          {
            key: 'timestamp',
            label: 'Timestamp (IST)',
            sortable: true,
            render: (l) => (
              <span className="font-mono-num text-xs text-[var(--sl-muted)] whitespace-nowrap">
                {formatIndianDateTime(l.timestamp)}
              </span>
            ),
          },
          {
            key: 'actorName',
            label: 'Actor',
            sortable: true,
            render: (l) => (
              <div className="text-xs">
                <p className="font-medium text-[var(--sl-text)]">{l.actorName}</p>
                <p className="text-[var(--sl-subtle)]">{l.actorRole}</p>
              </div>
            ),
          },
          {
            key: 'action',
            label: 'Action',
            sortable: true,
            render: (l) => <span className="font-mono-num text-xs font-semibold text-[#526B50]">{l.action}</span>,
          },
          {
            key: 'summary',
            label: 'Summary',
            render: (l) => <span className="text-xs text-[var(--sl-muted)]">{l.summary}</span>,
          },
        ]}
      />
    </div>
  );
}

export function SystemSettingsPage() {
  return (
    <div>
      <PageHeader title="System Configuration & Deployment Posture" subtitle="Security controls, Indian institutional localization defaults, database architecture, and integration adapters." />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card padding="p-5">
          <SectionHeader title="Security & Authentication" />
          <ul className="space-y-2.5 text-[13px] text-[var(--sl-muted)]">
            <li className="border-b border-[var(--sl-border)] pb-2">BCrypt password hashing (cost factor 12 in Spring Boot / 10 in Node runtime)</li>
            <li className="border-b border-[var(--sl-border)] pb-2">Stateless JWT access tokens paired with SHA-256 hashed refresh-token rotation</li>
            <li className="border-b border-[var(--sl-border)] pb-2">Strict backend branch isolation via BranchScopeGuard</li>
            <li>Opaque QR identifiers preventing PII exposure on physical labels</li>
          </ul>
        </Card>
        <Card padding="p-5">
          <SectionHeader title="India Institutional Localization" />
          <ul className="space-y-2.5 text-[13px] text-[var(--sl-muted)]">
            <li className="border-b border-[var(--sl-border)] pb-2">Country &amp; Locale: India · en-IN (Indian numbering system)</li>
            <li className="border-b border-[var(--sl-border)] pb-2">Standard Currency: Indian Rupee (₹ / INR) with decimal precision</li>
            <li className="border-b border-[var(--sl-border)] pb-2">Time Zone &amp; Date Format: Asia/Kolkata (IST) · DD/MM/YYYY</li>
            <li>Contact &amp; Postal Standards: +91 XXXXX XXXXX · 6-digit PIN code</li>
          </ul>
        </Card>
        <Card padding="p-5">
          <SectionHeader title="External Adapters & Hosting" />
          <ul className="space-y-2.5 text-[13px] text-[var(--sl-muted)]">
            <li className="border-b border-[var(--sl-border)] pb-2">Primary Database: MongoDB Atlas replica-set schema with ACID transactions</li>
            <li className="border-b border-[var(--sl-border)] pb-2">Email Notifications: Configurable SMTP adapter with development fallback</li>
            <li className="border-b border-[var(--sl-border)] pb-2">Fine Payments: Development mock adapter (MOCK_DEV · INR) with audit receipts</li>
            <li>Deployment: React/Vite on Vercel · Spring Boot Docker service on Render</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

export function SelfServiceKioskPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [memberQr, setMemberQr] = useState(user?.digitalCardQrToken || 'SL-CARD-STU0412-6A4E');
  const [bookQr, setBookQr] = useState('QR-CP-102-B7E2');
  const [lookup, setLookup] = useState(null);
  const [error, setError] = useState('');

  const handleLookup = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await SmartLibApi.kioskLookup({ memberQr, bookQr });
      setLookup(res);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Self-Service Library Kiosk"
        subtitle="Scan a member digital card QR and physical copy QR to verify eligibility, check out, or return volumes."
      />
      <AlertBanner type="error" message={error} onDismiss={() => setError('')} />

      <Card className="mb-6" padding="p-5">
        <form onSubmit={handleLookup} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
          <InputField
            id="k-mem"
            label="Member QR Token or Institutional ID"
            value={memberQr}
            onChange={(e) => setMemberQr(e.target.value)}
            className="sm:col-span-5"
          />
          <InputField
            id="k-bk"
            label="Book Copy QR Token or Copy Code"
            value={bookQr}
            onChange={(e) => setBookQr(e.target.value)}
            className="sm:col-span-5"
          />
          <Button type="submit" className="sm:col-span-2">
            <QrCode className="w-3.5 h-3.5" />
            <span>Scan</span>
          </Button>
        </form>
      </Card>

      {lookup && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card padding="p-5">
            <h2 className="text-sm font-display font-semibold text-[var(--sl-text)] flex items-center gap-2 pb-3 border-b border-[var(--sl-border)]">
              <MonitorSmartphone className="w-4 h-4 text-[#526B50]" />
              <span>Member Eligibility</span>
            </h2>
            {lookup.member ? (
              <div className="mt-3 space-y-1.5 text-sm">
                <p className="font-medium">
                  {lookup.member.fullName} ({lookup.member.institutionalId})
                </p>
                <p className="text-xs text-[var(--sl-muted)]">
                  Active Loans: {lookup.activeBorrowCount} / {lookup.maxBorrowLimit} · Reservations: {lookup.activeReservationsCount}
                </p>
                <p className={`text-xs font-semibold pt-1 ${lookup.eligible ? 'text-[#526B50]' : 'text-[#B66F50]'}`}>
                  {lookup.eligible ? 'Eligible to Borrow' : 'Not Eligible for Additional Loans'}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-[#B66F50]">Member QR not recognized.</p>
            )}
          </Card>

          <Card padding="p-5">
            <h2 className="text-sm font-display font-semibold text-[var(--sl-text)] pb-3 border-b border-[var(--sl-border)]">
              Scanned Volume Copy
            </h2>
            {lookup.copy ? (
              <div className="mt-3 space-y-2 text-sm">
                <p className="font-medium">{lookup.copy.bookTitle}</p>
                <p className="text-xs font-mono-num text-[var(--sl-muted)]">
                  {lookup.copy.copyCode} · Status: <StatusLabel status={lookup.copy.status} />
                </p>
                <div className="pt-2 flex gap-2">
                  {lookup.copy.status === 'AVAILABLE' && lookup.eligible && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          const res = await SmartLibApi.issueBook({
                            copyId: lookup.copy.id,
                            memberId: lookup.member?.id,
                          });
                          notify(res.message, 'success');
                          const refreshed = await SmartLibApi.kioskLookup({ memberQr, bookQr });
                          setLookup(refreshed);
                        } catch (err) {
                          setError(extractErrorMessage(err));
                        }
                      }}
                    >
                      Confirm Self-Checkout
                    </Button>
                  )}
                  {lookup.copy.status === 'ISSUED' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        try {
                          const res = await SmartLibApi.returnBook({ copyCode: lookup.copy.copyCode });
                          notify(res.message, 'success');
                          const refreshed = await SmartLibApi.kioskLookup({ memberQr, bookQr });
                          setLookup(refreshed);
                        } catch (err) {
                          setError(extractErrorMessage(err));
                        }
                      }}
                    >
                      Return Volume
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-[var(--sl-muted)]">No physical copy matched that QR code.</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
