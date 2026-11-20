import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SmartLibApi, extractErrorMessage } from '../services/api';
import { useAuth, getDefaultRouteForRole } from '../context/AuthContext';
import { AlertBanner, BookCoverThumb, Button, InputField, MetricStrip, SelectField } from '../components/ui/Primitives';
import { formatIndianNumber } from '../utils/formatters';

const HERO_IMG = '/src/assets/images/hero_university_library_1795191778208.jpg';
const STACKS_IMG = '/src/assets/images/smart_shelf_stacks_1795191852333.jpg';
const SEATING_IMG = '/src/assets/images/study_hall_seating_1795191888425.jpg';

const DEMO_ACCOUNTS = [
  { role: 'Student', email: 'ananya.sharma@smartlib.edu', scope: 'Catalogue, loans, study seats, research notes' },
  { role: 'Faculty', email: 'prof.alvarez@smartlib.edu', scope: 'Course reading lists, extended borrowing' },
  { role: 'Librarian', email: 'rajesh.verma@smartlib.edu', scope: 'Circulation desk, physical copies, acquisitions' },
  { role: 'Branch Admin', email: 'meera.nair@smartlib.edu', scope: 'Branch policies, staff, inter-branch transfers' },
  { role: 'Super Admin', email: 'director@smartlib.edu', scope: 'Multi-branch governance, global rules, audit trail' },
];

const CAPABILITIES = [
  {
    num: '01',
    title: 'Copy-Level Circulation & FIFO Queues',
    desc: 'Tracks individual barcoded and QR-tagged copies independently from titles, calculating overdue fines automatically and routing returns to the earliest waiting member.',
  },
  {
    num: '02',
    title: 'Shelf Coordinates & QR Verification',
    desc: 'Maps every physical copy to branch, floor, section, rack, and shelf coordinates with scannable verification and structured lost-and-found recovery.',
  },
  {
    num: '03',
    title: 'Conflict-Free Study Seat Scheduling',
    desc: 'Server-enforced time-window overlap protection across quiet carrels, computer workstations, and accessible desks with live check-in status.',
  },
  {
    num: '04',
    title: 'Demand Forecasting & Acquisitions',
    desc: 'Separates verified historical circulation from statistical exam-period projections to surface inventory shortfalls and human-approved purchasing proposals.',
  },
  {
    num: '05',
    title: 'Multi-Branch Governance & Transfers',
    desc: 'Enforces strict branch-level permissions, configurable role borrowing limits, inter-branch volume transfers, and immutable compliance audit trails.',
  },
  {
    num: '06',
    title: 'Academic Research & Course Lists',
    desc: 'Connects faculty syllabi to live branch holdings, supports structured page annotations, and formats verified APA 7th and IEEE bibliographies.',
  },
];

export function LandingPage() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    SmartLibApi.getPublicOverview()
      .then(setOverview)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = overview?.stats;

  return (
    <div>
      {/* Editorial Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-12 pb-14 lg:pt-16 lg:pb-18">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center">
            <p className="text-xs font-medium text-[#526B50]">
              Multi-Branch Library Platform for Indian Educational Institutions
            </p>
            <h1 className="mt-3 text-3xl sm:text-4xl lg:text-[42px] font-display font-semibold leading-[1.14] tracking-tight text-[#252720]">
              Structured operations for modern academic libraries.
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[#666860] max-w-xl">
              SmartLib unifies physical copy inventory, circulation desks, FIFO reservation queues,
              study seat scheduling, and evidence-based acquisition planning across Indian
              universities, colleges, and institutional library branches.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 h-10 px-5 text-sm font-medium text-white bg-[#526B50] hover:bg-[#425840] rounded transition-colors whitespace-nowrap"
              >
                <span>Sign In to Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center h-10 px-5 text-sm font-medium text-[#252720] bg-white border border-[#D7D2C3] hover:bg-[#F1EFE8] rounded transition-colors whitespace-nowrap"
              >
                System Overview
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[280px] rounded-md overflow-hidden border border-[var(--sl-border)] bg-[#F1EFE8]">
              <img
                src={HERO_IMG}
                alt="Sunlit university library reading hall with oak bookshelves and quiet study tables"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Live Institutional Metrics Strip (Single Unified Hairline Bar) */}
        <MetricStrip
          className="mt-10"
          items={[
            {
              label: 'Active Library Branches',
              value: loading ? '—' : formatIndianNumber(stats?.totalBranches ?? 0),
              detail: 'Connected campus facilities across India',
            },
            {
              label: 'Catalog Titles / Copies',
              value: loading
                ? '—'
                : `${formatIndianNumber(stats?.totalTitles ?? 0)} / ${formatIndianNumber(stats?.totalPhysicalCopies ?? 0)}`,
              detail: 'Tracked at individual copy level',
            },
            {
              label: 'Reservable Study Seats',
              value: loading ? '—' : formatIndianNumber(stats?.studySeats ?? 0),
              detail: 'Quiet, computer & accessible zones',
            },
            {
              label: 'Active Circulation Loans',
              value: loading ? '—' : formatIndianNumber(stats?.activeLoans ?? 0),
              detail: 'Synchronized live across desks (IST)',
              tone: 'accent',
            },
          ]}
        />
      </section>

      {/* Hairline-Divided Capability Ledger (No Repetitive Rounded Boxes) */}
      <section id="capabilities" className="border-t border-[var(--sl-border)] bg-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-4">
              <p className="text-xs font-medium text-[#526B50]">Operational Architecture</p>
              <h2 className="mt-2 text-2xl font-display font-semibold text-[#252720]">
                Built for daily stewardship and institutional oversight.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#666860]">
                Every module shares one authoritative data model—connecting student discovery,
                circulation desks, branch policy controls, and compliance logging without silos.
              </p>
            </div>

            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 border-t border-[var(--sl-border)]">
              {CAPABILITIES.map((item) => (
                <div
                  key={item.num}
                  className="py-6 sm:pr-8 border-b border-[var(--sl-border)]"
                >
                  <p className="text-xs font-mono-num text-[#92977A] font-medium">{item.num}</p>
                  <h3 className="mt-1.5 text-[15px] font-display font-semibold text-[#252720]">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#666860]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Architectural Facility Pair */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="rounded-md overflow-hidden border border-[var(--sl-border)] bg-[#F1EFE8]">
              <img
                src={STACKS_IMG}
                alt="Organized university library oak book stacks"
                referrerPolicy="no-referrer"
                className="w-full h-60 object-cover"
              />
            </div>
            <h3 className="mt-4 text-lg font-display font-semibold text-[#252720]">
              Precision Shelf & Physical Asset Control
            </h3>
            <p className="mt-1.5 text-sm text-[#666860] leading-relaxed max-w-lg">
              Follow every volume from initial CSV cataloging through condition audits, inter-branch
              transfer workflows, and lost-and-found recovery.
            </p>
          </div>
          <div>
            <div className="rounded-md overflow-hidden border border-[var(--sl-border)] bg-[#F1EFE8]">
              <img
                src={SEATING_IMG}
                alt="Sunlit university library quiet study carrels and timber tables"
                referrerPolicy="no-referrer"
                className="w-full h-60 object-cover"
              />
            </div>
            <h3 className="mt-4 text-lg font-display font-semibold text-[#252720]">
              Calm, Accessible Academic Study Spaces
            </h3>
            <p className="mt-1.5 text-sm text-[#666860] leading-relaxed max-w-lg">
              Manage quiet study carrels, dual-monitor workstations, and accessible desks with live
              slot occupancy and built-in display accessibility controls.
            </p>
          </div>
        </div>
      </section>

      {/* Live Catalogue Holdings Strip */}
      <section id="catalog" className="border-t border-[var(--sl-border)] bg-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[var(--sl-border)]">
            <div>
              <h2 className="text-2xl font-display font-semibold text-[#252720]">Featured Institutional Holdings</h2>
              <p className="mt-1 text-sm text-[#666860]">
                Live copy availability synchronized directly from active campus branch inventories.
              </p>
            </div>
            <Link
              to="/login"
              className="text-sm font-medium text-[#526B50] hover:underline whitespace-nowrap"
            >
              Sign in to explore full catalogue →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 border-b border-[var(--sl-border)]">
            {(overview?.featuredBooks || []).map((book) => (
              <div
                key={book.id}
                className="flex gap-4 py-6 sm:pr-6 border-b border-[var(--sl-border)]"
              >
                <BookCoverThumb
                  title={book.title}
                  authors={book.authors}
                  category={book.category}
                  year={book.publicationYear}
                  accent={book.coverAccent}
                  size="md"
                />
                <div className="min-w-0 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="text-xs text-[#77786F]">
                      {book.category} · {book.publicationYear}
                    </p>
                    <h3 className="mt-1 text-[14.5px] font-display font-semibold text-[#252720] line-clamp-2 leading-snug">
                      {book.title}
                    </h3>
                    <p className="mt-1 text-xs text-[#666860] truncate">{book.authors.join(', ')}</p>
                  </div>
                  <p className="mt-2.5 text-xs font-medium tabular-nums">
                    <span className={book.availableCopies > 0 ? 'text-[#526B50]' : 'text-[#A67232]'}>
                      {book.availableCopies > 0
                        ? `${book.availableCopies} of ${book.totalCopies} copies available`
                        : `All ${book.totalCopies} copies currently on loan`}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-14 space-y-10">
      <div className="pb-6 border-b border-[var(--sl-border)]">
        <p className="text-xs font-medium text-[#526B50]">Institutional Platform</p>
        <h1 className="mt-2 text-3xl font-display font-semibold text-[#252720]">About SmartLib</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#666860]">
          SmartLib is an enterprise library management and automation system designed and developed
          for Indian universities, colleges, and research institutions. Built around operational
          clarity, strict role isolation, INR (₹) fine governance, and transparent data stewardship.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-2">
          <h2 className="text-base font-display font-semibold text-[#252720]">Enterprise Architecture</h2>
          <p className="text-sm text-[#666860] leading-relaxed">
            Engineered around a layered Java 21 / Spring Boot 3.x and MongoDB Atlas document
            architecture paired with a responsive React + Vite client, enforcing JWT refresh-token
            rotation, BCrypt password hashing, branch-scoped access guards, and transactional
            circulation state transitions.
          </p>
        </div>
        <div className="space-y-2">
          <h2 className="text-base font-display font-semibold text-[#252720]">Transparent Analytics</h2>
          <p className="text-sm text-[#666860] leading-relaxed">
            Recommendations cite the exact borrowing affinities that produced them, acquisition
            proposals present live demand-to-inventory ratios for human sign-off, and APA 7th and
            IEEE bibliographies are generated deterministically from verified catalog records.
          </p>
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('ananya.sharma@smartlib.edu');
  const [password, setPassword] = useState('SmartLib@2026');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await login(email, password);
      navigate(getDefaultRouteForRole(user.role), { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to sign in. Verify your credentials and try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 lg:py-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 border border-[var(--sl-border)] rounded-md bg-white overflow-hidden">
        {/* Left: Primary Sign-In Form */}
        <div className="lg:col-span-6 p-7 sm:p-9">
          <p className="text-xs font-medium text-[#526B50]">Institutional Access</p>
          <h1 className="mt-1.5 text-2xl font-display font-semibold text-[#252720]">Sign in to SmartLib</h1>
          <p className="mt-1.5 text-sm text-[#666860]">
            Use your university email address and password to open your role-scoped workspace.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <AlertBanner type="error" message={error} onDismiss={() => setError('')} />
            <InputField
              id="login-email"
              label="Institutional Email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <InputField
              id="login-password"
              label="Password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="flex items-center justify-between text-xs pt-1">
              <Link to="/forgot-password" className="text-[#526B50] hover:underline font-medium">
                Forgot password?
              </Link>
              <Link to="/register" className="text-[#666860] hover:text-[#252720]">
                New member? Register
              </Link>
            </div>
            <Button type="submit" disabled={submitting} size="lg" className="w-full mt-2">
              {submitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </div>

        {/* Right: Institutional Role Switcher Directory */}
        <div className="lg:col-span-6 p-7 sm:p-9 bg-[var(--sl-bg)]/70 border-t lg:border-t-0 lg:border-l border-[var(--sl-border)]">
          <h2 className="text-sm font-display font-semibold text-[#252720]">
            Role Directory for Evaluation
          </h2>
          <p className="mt-1 text-xs text-[#666860]">
            Select any institutional account below to populate the sign-in form. Default password:{' '}
            <span className="font-mono-num text-[#252720] font-medium">SmartLib@2026</span>
          </p>

          <div className="mt-5 divide-y divide-[var(--sl-border)] border-t border-b border-[var(--sl-border)]">
            {DEMO_ACCOUNTS.map((acc) => {
              const selected = email === acc.email;
              return (
                <div
                  key={acc.email}
                  className={`py-3 flex items-center justify-between gap-3 ${
                    selected ? 'bg-[#EEF3ED]/70 -mx-2 px-2 rounded' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#252720]">{acc.role}</p>
                    <p className="text-xs font-mono-num text-[#666860] truncate">{acc.email}</p>
                    <p className="text-[11px] text-[#77786F] mt-0.5 truncate">{acc.scope}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={selected ? 'primary' : 'secondary'}
                    onClick={() => {
                      setEmail(acc.email);
                      setPassword('SmartLib@2026');
                    }}
                  >
                    {selected ? 'Selected' : 'Select'}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    department: 'Computer Science',
    role: 'STUDENT',
    branchId: 'br-central',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await register(form);
      navigate(getDefaultRouteForRole(user.role), { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-6 py-12 lg:py-16">
      <div className="bg-white border border-[var(--sl-border)] rounded-md p-7 sm:p-8">
        <p className="text-xs font-medium text-[#526B50]">Member Onboarding</p>
        <h1 className="mt-1.5 text-2xl font-display font-semibold text-[#252720]">Create Institutional Account</h1>
        <p className="mt-1.5 text-sm text-[#666860]">
          Register for Student or Faculty borrowing privileges and receive your digital QR card.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <AlertBanner type="error" message={error} onDismiss={() => setError('')} />
          <InputField
            id="reg-name"
            label="Full Name"
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <InputField
            id="reg-email"
            label="Institutional Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <InputField
            id="reg-pass"
            label="Password"
            helper="Minimum 8 characters"
            type="password"
            minLength={8}
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              id="reg-role"
              label="Academic Role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="STUDENT">Student</option>
              <option value="FACULTY">Faculty</option>
            </SelectField>
            <SelectField
              id="reg-branch"
              label="Home Branch"
              value={form.branchId}
              onChange={(e) => setForm({ ...form, branchId: e.target.value })}
            >
              <option value="br-central">Central Heritage Library</option>
              <option value="br-eng">Engineering & Computing Annex</option>
              <option value="br-hum">Humanities & Archives Pavilion</option>
            </SelectField>
          </div>
          <InputField
            id="reg-dept"
            label="Department"
            required
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          />
          <div className="pt-2 flex items-center justify-between gap-3">
            <Link to="/login" className="text-xs text-[#666860] hover:text-[#252720]">
              Already registered? Sign in
            </Link>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating Account...' : 'Create Account'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState('request');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const handleRequest = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await SmartLibApi.forgotPassword(email);
      setFeedback(res.message);
      if (res.data?.devResetToken) setToken(res.data.devResetToken);
      setStep('reset');
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await SmartLibApi.resetPassword({ token, newPassword });
      setFeedback(res.message);
      setStep('done');
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-14">
      <div className="bg-white border border-[var(--sl-border)] rounded-md p-7">
        <h1 className="text-xl font-display font-semibold text-[#252720]">Password Recovery</h1>
        <p className="mt-1 text-xs text-[#666860]">
          Request a single-use institutional reset token to set a new password.
        </p>
        <div className="mt-4">
          <AlertBanner type="error" message={error} onDismiss={() => setError('')} />
          <AlertBanner type="success" message={feedback} onDismiss={() => setFeedback('')} />
        </div>

        {step === 'request' && (
          <form onSubmit={handleRequest} className="mt-4 space-y-4">
            <InputField
              id="fp-email"
              label="Institutional Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="flex items-center justify-between pt-1">
              <Link to="/login" className="text-xs text-[#666860] hover:text-[#252720]">
                Back to Sign In
              </Link>
              <Button type="submit">Request Token</Button>
            </div>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={handleReset} className="mt-4 space-y-4">
            <InputField
              id="fp-token"
              label="Reset Token"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <InputField
              id="fp-pass"
              label="New Password"
              helper="Minimum 8 characters"
              type="password"
              minLength={8}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Button type="submit" className="w-full">
              Update Password
            </Button>
          </form>
        )}

        {step === 'done' && (
          <div className="mt-4">
            <Link to="/login" className="text-sm font-medium text-[#526B50] hover:underline">
              Return to Sign In →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
