import fs from 'fs';
import os from 'os';
import path from 'path';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { LibraryPolicy, UserRole } from './domainEngine.js';
import {
  getMongoStatus,
  isMongoConfigured,
  loadStateFromMongo,
  saveStateToMongo,
} from './mongoPersistence.js';

const STORE_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), 'smartlib-data')
  : path.resolve(process.cwd(), 'data');
const STORE_FILE = path.join(STORE_DIR, 'smartlib-store.json');

export interface SmartLibStore {
  users: Array<{
    id: string;
    institutionalId: string;
    email: string;
    passwordHash: string;
    fullName: string;
    role: UserRole;
    branchId: string | null;
    department: string;
    accountStatus: 'ACTIVE' | 'SUSPENDED' | 'RESTRICTED';
    emailVerified: boolean;
    borrowingRestricted: boolean;
    customBorrowLimit: number | null;
    digitalCardQrToken: string;
    enrolledCourseIds: string[];
    accessibilityPrefs: { fontSize: 'sm' | 'md' | 'lg'; highContrast: boolean };
    createdAt: string;
  }>;
  refreshTokens: Array<{
    id: string;
    userId: string;
    tokenFamilyId: string;
    tokenHash: string;
    expiresAt: string;
    revoked: boolean;
    replacedByTokenHash: string | null;
  }>;
  passwordResetTokens: Array<{
    tokenHash: string;
    userId: string;
    expiresAt: string;
    used: boolean;
  }>;
  branches: Array<{
    id: string;
    code: string;
    name: string;
    campusZone: string;
    address: string;
    city?: string;
    state?: string;
    pinCode?: string;
    country?: string;
    contactEmail: string;
    contactPhone: string;
    operatingHours: string;
    floors: number[];
    status: 'ACTIVE' | 'INACTIVE';
    adminUserId: string | null;
    createdAt: string;
  }>;
  policies: LibraryPolicy[];
  books: Array<{
    id: string;
    isbn: string;
    title: string;
    authors: string[];
    publisher: string;
    category: string;
    genre: string;
    edition: string;
    language: string;
    publicationYear: number;
    pages: number;
    description: string;
    coverAccent: string;
    tags: string[];
    archived: boolean;
    createdAt: string;
  }>;
  bookCopies: Array<{
    id: string;
    copyCode: string;
    bookId: string;
    barcode: string;
    qrToken: string;
    branchId: string;
    location: {
      floor: number;
      section: string;
      rack: string;
      shelf: string;
    };
    status: 'AVAILABLE' | 'ISSUED' | 'RESERVED_HOLD' | 'IN_TRANSIT' | 'DAMAGED' | 'LOST' | 'ARCHIVED';
    condition: 'NEW' | 'GOOD' | 'FAIR' | 'WORN' | 'DAMAGED';
    acquisitionDate: string;
    lastVerifiedAt: string;
  }>;
  bookIssues: Array<{
    id: string;
    receiptNumber: string;
    bookId: string;
    copyId: string;
    branchId: string;
    memberId: string;
    issuedByUserId: string;
    issueDate: string;
    dueDate: string;
    returnedAt: string | null;
    renewalCount: number;
    maxRenewals: number;
    status: 'ACTIVE' | 'OVERDUE' | 'RETURNED' | 'LOST';
    completionConfirmed: boolean;
    completedAt: string | null;
  }>;
  bookReturns: Array<{
    id: string;
    returnReceiptNumber: string;
    issueId: string;
    copyId: string;
    bookId: string;
    branchId: string;
    memberId: string;
    processedByUserId: string;
    returnedAt: string;
    conditionOnReturn: string;
    overdueDays: number;
    fineGeneratedAmount: number;
    notes: string;
  }>;
  reservations: Array<{
    id: string;
    bookId: string;
    branchId: string;
    memberId: string;
    status: 'WAITING' | 'READY_FOR_PICKUP' | 'FULFILLED' | 'EXPIRED' | 'CANCELLED';
    allocatedCopyId: string | null;
    queuedAt: string;
    allocatedAt: string | null;
    expiresAt: string | null;
    fulfilledAt: string | null;
  }>;
  fines: Array<{
    id: string;
    issueId: string;
    memberId: string;
    branchId: string;
    reason: 'OVERDUE' | 'DAMAGE' | 'LOST';
    currency?: 'INR';
    amount: number;
    paidAmount: number;
    waivedAmount: number;
    status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'WAIVED';
    waiverReason: string | null;
    waivedByUserId: string | null;
    assessedAt: string;
    settledAt: string | null;
  }>;
  finePayments: Array<{
    id: string;
    receiptNumber: string;
    fineId: string;
    memberId: string;
    branchId: string;
    currency?: 'INR';
    amount: number;
    paymentMethod: string;
    gatewayMode: 'MOCK_DEV';
    paidAt: string;
  }>;
  seats: Array<{
    id: string;
    branchId: string;
    seatCode: string;
    floor: number;
    zone: 'QUIET_STUDY' | 'COLLABORATIVE' | 'COMPUTER_CARREL' | 'ACCESSIBLE';
    row: number;
    column: number;
    amenities: string[];
    status: 'ACTIVE' | 'MAINTENANCE' | 'UNAVAILABLE';
  }>;
  seatReservations: Array<{
    id: string;
    seatId: string;
    branchId: string;
    userId: string;
    reservationDate: string;
    startTime: string;
    endTime: string;
    status: 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' | 'NO_SHOW';
    checkedInAt: string | null;
    checkedOutAt: string | null;
    createdAt: string;
  }>;
  acquisitionDecisions: Array<{
    id: string;
    bookId: string;
    branchId: string;
    suggestedAdditionalCopies: number;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    demandToInventoryRatio: number;
    explanation: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    reviewedByUserId: string | null;
    rejectionReason: string | null;
    reviewedAt: string | null;
    createdAt: string;
  }>;
  readingLists: Array<{
    id: string;
    userId: string;
    title: string;
    subject: string;
    description: string;
    tags: string[];
    bookIds: string[];
    createdAt: string;
  }>;
  researchNotes: Array<{
    id: string;
    userId: string;
    readingListId: string;
    bookId: string | null;
    title: string;
    content: string;
    pageReference: string;
    tags: string[];
    createdAt: string;
  }>;
  courses: Array<{
    id: string;
    courseCode: string;
    courseTitle: string;
    department: string;
    semester: string;
    facultyUserId: string;
    branchId: string;
    enrolledStudentIds: string[];
    materials: Array<{
      bookId: string;
      materialType: 'TEXTBOOK' | 'REFERENCE' | 'PRACTICE';
      required: boolean;
      notes: string;
      alternativeBookIds: string[];
    }>;
  }>;
  readingChallenges: Array<{
    id: string;
    scope: 'PERSONAL' | 'CAMPUS';
    branchId: string | null;
    creatorUserId: string;
    title: string;
    description: string;
    targetBooks: number;
    startDate: string;
    endDate: string;
    participantIds: string[];
  }>;
  exchangeListings: Array<{
    id: string;
    ownerUserId: string;
    branchId: string;
    title: string;
    author: string;
    isbn: string;
    subject: string;
    condition: 'LIKE_NEW' | 'GOOD' | 'FAIR' | 'ACCEPTABLE';
    listingType: 'EXCHANGE' | 'DONATION';
    description: string;
    photoUrl: string;
    status: 'AVAILABLE' | 'REQUESTED' | 'COMPLETED' | 'REMOVED_BY_MOD';
    reports: Array<{ reporterId: string; reason: string; reportedAt: string }>;
    createdAt: string;
  }>;
  exchangeRequests: Array<{
    id: string;
    listingId: string;
    ownerUserId: string;
    requesterUserId: string;
    offeredBookTitle: string;
    message: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
    createdAt: string;
    respondedAt: string | null;
  }>;
  lostFoundReports: Array<{
    id: string;
    incidentCode: string;
    copyId: string;
    bookId: string;
    branchId: string;
    reportedByUserId: string;
    memberId: string | null;
    incidentType: 'LOST' | 'DAMAGED' | 'RECOVERED';
    status: 'REPORTED' | 'VERIFIED_LOST' | 'VERIFIED_DAMAGED' | 'RECOVERED_VERIFIED' | 'CLOSED';
    description: string;
    recoveryDetails: string;
    currency?: 'INR';
    penaltyAmount: number;
    verifiedByLibrarianId: string | null;
    createdAt: string;
    verifiedAt: string | null;
  }>;
  bookTransfers: Array<{
    id: string;
    transferCode: string;
    copyId: string;
    bookId: string;
    fromBranchId: string;
    toBranchId: string;
    requestedByUserId: string;
    approvedByUserId: string | null;
    status: 'REQUESTED' | 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'REJECTED';
    reason: string;
    createdAt: string;
    updatedAt: string;
  }>;
  kioskTransactions: Array<{
    id: string;
    kioskId: string;
    branchId: string;
    memberId: string;
    copyId: string | null;
    action: 'ISSUE' | 'RETURN' | 'RESERVATION_LOOKUP' | 'AVAILABILITY_CHECK';
    status: 'SUCCESS' | 'DENIED';
    summary: string;
    timestamp: string;
  }>;
  notifications: Array<{
    id: string;
    userId: string;
    branchId: string | null;
    type: string;
    title: string;
    message: string;
    read: boolean;
    emailStatus: 'SKIPPED_DEV' | 'SENT';
    idempotencyKey: string | null;
    createdAt: string;
  }>;
  auditLogs: Array<{
    id: string;
    actorUserId: string;
    actorName: string;
    actorRole: UserRole;
    branchId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
    timestamp: string;
  }>;
}

export function uid(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(4).toString('hex')}`;
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function createInitialSeed(): SmartLibStore {
  const defaultHash = bcrypt.hashSync('SmartLib@2026', 10);
  const now = new Date('2026-11-20T09:00:00.000Z');
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
  const daysFromNow = (d: number) => new Date(now.getTime() + d * 86400000).toISOString();

  const branches: SmartLibStore['branches'] = [
    {
      id: 'br-central',
      code: 'MAIN-01',
      name: 'Central Heritage Library',
      campusZone: 'Vidya Vihar Academic Block',
      address: 'Plot 14, Knowledge Park Road, Malleswaram, Bengaluru, Karnataka 560012',
      city: 'Bengaluru',
      state: 'Karnataka',
      pinCode: '560012',
      country: 'India',
      contactEmail: 'central@smartlib.ac.in',
      contactPhone: '+91 80412 44001',
      operatingHours: 'Mon–Sat 07:30–23:00 IST, Sun 10:00–20:00 IST',
      floors: [1, 2, 3],
      status: 'ACTIVE',
      adminUserId: 'u-badmin-1',
      createdAt: daysAgo(400),
    },
    {
      id: 'br-eng',
      code: 'ENG-02',
      name: 'Engineering & Computing Annex',
      campusZone: 'Ramanujan Technology Block',
      address: 'Block EP, Sector V, Salt Lake Academic Campus, Kolkata, West Bengal 700091',
      city: 'Kolkata',
      state: 'West Bengal',
      pinCode: '700091',
      country: 'India',
      contactEmail: 'engineering@smartlib.ac.in',
      contactPhone: '+91 33401 44010',
      operatingHours: 'Mon–Sun 08:00–24:00 IST',
      floors: [1, 2],
      status: 'ACTIVE',
      adminUserId: 'u-badmin-2',
      createdAt: daysAgo(350),
    },
    {
      id: 'br-hum',
      code: 'HUM-03',
      name: 'Humanities & Archives Pavilion',
      campusZone: 'Tagore Arts & Humanities Wing',
      address: '18 Ganeshkhind University Road, Shivajinagar, Pune, Maharashtra 411007',
      city: 'Pune',
      state: 'Maharashtra',
      pinCode: '411007',
      country: 'India',
      contactEmail: 'humanities@smartlib.ac.in',
      contactPhone: '+91 20410 44020',
      operatingHours: 'Mon–Fri 08:00–21:00 IST, Sat 09:00–18:00 IST',
      floors: [1, 2],
      status: 'ACTIVE',
      adminUserId: null,
      createdAt: daysAgo(300),
    },
  ];

  const users: SmartLibStore['users'] = [
    {
      id: 'u-super',
      institutionalId: 'ADM-0001',
      email: 'director@smartlib.edu',
      passwordHash: defaultHash,
      fullName: 'Dr. Eleanor Vance',
      role: 'SUPER_ADMIN',
      branchId: null,
      department: 'University Library Directorate',
      accountStatus: 'ACTIVE',
      emailVerified: true,
      borrowingRestricted: false,
      customBorrowLimit: null,
      digitalCardQrToken: 'SL-CARD-ADM0001-9F2A',
      enrolledCourseIds: [],
      accessibilityPrefs: { fontSize: 'md', highContrast: false },
      createdAt: daysAgo(390),
    },
    {
      id: 'u-badmin-1',
      institutionalId: 'BADM-101',
      email: 'meera.nair@smartlib.edu',
      passwordHash: defaultHash,
      fullName: 'Meera Nair',
      role: 'BRANCH_ADMIN',
      branchId: 'br-central',
      department: 'Central Heritage Operations',
      accountStatus: 'ACTIVE',
      emailVerified: true,
      borrowingRestricted: false,
      customBorrowLimit: null,
      digitalCardQrToken: 'SL-CARD-BADM101-7C3B',
      enrolledCourseIds: [],
      accessibilityPrefs: { fontSize: 'md', highContrast: false },
      createdAt: daysAgo(320),
    },
    {
      id: 'u-badmin-2',
      institutionalId: 'BADM-102',
      email: 'david.chen@smartlib.edu',
      passwordHash: defaultHash,
      fullName: 'David Chen',
      role: 'BRANCH_ADMIN',
      branchId: 'br-eng',
      department: 'Engineering Library Operations',
      accountStatus: 'ACTIVE',
      emailVerified: true,
      borrowingRestricted: false,
      customBorrowLimit: null,
      digitalCardQrToken: 'SL-CARD-BADM102-8A1E',
      enrolledCourseIds: [],
      accessibilityPrefs: { fontSize: 'md', highContrast: false },
      createdAt: daysAgo(310),
    },
    {
      id: 'u-lib-1',
      institutionalId: 'LIB-201',
      email: 'rajesh.verma@smartlib.edu',
      passwordHash: defaultHash,
      fullName: 'Rajesh Verma',
      role: 'LIBRARIAN',
      branchId: 'br-central',
      department: 'Circulation & Cataloging',
      accountStatus: 'ACTIVE',
      emailVerified: true,
      borrowingRestricted: false,
      customBorrowLimit: null,
      digitalCardQrToken: 'SL-CARD-LIB201-4D8F',
      enrolledCourseIds: [],
      accessibilityPrefs: { fontSize: 'md', highContrast: false },
      createdAt: daysAgo(290),
    },
    {
      id: 'u-lib-2',
      institutionalId: 'LIB-202',
      email: 'claire.bennett@smartlib.edu',
      passwordHash: defaultHash,
      fullName: 'Claire Bennett',
      role: 'LIBRARIAN',
      branchId: 'br-eng',
      department: 'STEM Reference Desk',
      accountStatus: 'ACTIVE',
      emailVerified: true,
      borrowingRestricted: false,
      customBorrowLimit: null,
      digitalCardQrToken: 'SL-CARD-LIB202-5E1C',
      enrolledCourseIds: [],
      accessibilityPrefs: { fontSize: 'md', highContrast: false },
      createdAt: daysAgo(280),
    },
    {
      id: 'u-fac-1',
      institutionalId: 'FAC-301',
      email: 'prof.alvarez@smartlib.edu',
      passwordHash: defaultHash,
      fullName: 'Prof. Mateo Alvarez',
      role: 'FACULTY',
      branchId: 'br-central',
      department: 'Computer Science & Systems',
      accountStatus: 'ACTIVE',
      emailVerified: true,
      borrowingRestricted: false,
      customBorrowLimit: 12,
      digitalCardQrToken: 'SL-CARD-FAC301-2B9D',
      enrolledCourseIds: ['crs-cs301', 'crs-cs410'],
      accessibilityPrefs: { fontSize: 'md', highContrast: false },
      createdAt: daysAgo(270),
    },
    {
      id: 'u-stu-1',
      institutionalId: 'STU-2026-0412',
      email: 'ananya.sharma@smartlib.edu',
      passwordHash: defaultHash,
      fullName: 'Ananya Sharma',
      role: 'STUDENT',
      branchId: 'br-central',
      department: 'Computer Science',
      accountStatus: 'ACTIVE',
      emailVerified: true,
      borrowingRestricted: false,
      customBorrowLimit: null,
      digitalCardQrToken: 'SL-CARD-STU0412-6A4E',
      enrolledCourseIds: ['crs-cs301', 'crs-cs410'],
      accessibilityPrefs: { fontSize: 'md', highContrast: false },
      createdAt: daysAgo(240),
    },
    {
      id: 'u-stu-2',
      institutionalId: 'STU-2026-0488',
      email: 'liam.oconnor@smartlib.edu',
      passwordHash: defaultHash,
      fullName: "Liam O'Connor",
      role: 'STUDENT',
      branchId: 'br-central',
      department: 'Data Science & Economics',
      accountStatus: 'ACTIVE',
      emailVerified: true,
      borrowingRestricted: false,
      customBorrowLimit: null,
      digitalCardQrToken: 'SL-CARD-STU0488-9D2C',
      enrolledCourseIds: ['crs-cs301'],
      accessibilityPrefs: { fontSize: 'md', highContrast: false },
      createdAt: daysAgo(230),
    },
  ];

  const policies: LibraryPolicy[] = [
    {
      id: 'pol-global',
      scope: 'GLOBAL',
      branchId: null,
      currency: 'INR',
      rolePolicies: {
        STUDENT: { maxBooks: 5, borrowDays: 14, maxRenewals: 2 },
        FACULTY: { maxBooks: 12, borrowDays: 30, maxRenewals: 3 },
      },
      gracePeriodDays: 2,
      finePerDay: 1.5,
      maxFineAmount: 30,
      reservationHoldHours: 48,
      seatCheckInGraceMinutes: 15,
    },
    {
      id: 'pol-central',
      scope: 'BRANCH',
      branchId: 'br-central',
      currency: 'INR',
      rolePolicies: {
        STUDENT: { maxBooks: 5, borrowDays: 14, maxRenewals: 2 },
        FACULTY: { maxBooks: 12, borrowDays: 30, maxRenewals: 3 },
      },
      gracePeriodDays: 2,
      finePerDay: 1.5,
      maxFineAmount: 30,
      reservationHoldHours: 48,
      seatCheckInGraceMinutes: 15,
    },
    {
      id: 'pol-eng',
      scope: 'BRANCH',
      branchId: 'br-eng',
      currency: 'INR',
      rolePolicies: {
        STUDENT: { maxBooks: 6, borrowDays: 14, maxRenewals: 2 },
        FACULTY: { maxBooks: 15, borrowDays: 30, maxRenewals: 4 },
      },
      gracePeriodDays: 1,
      finePerDay: 2.0,
      maxFineAmount: 35,
      reservationHoldHours: 24,
      seatCheckInGraceMinutes: 15,
    },
  ];

  const books: SmartLibStore['books'] = [
    {
      id: 'bk-1',
      isbn: '978-0134685991',
      title: 'Effective Java',
      authors: ['Joshua Bloch'],
      publisher: 'Addison-Wesley',
      category: 'Computer Science',
      genre: 'Software Engineering',
      edition: '3rd ed.',
      language: 'English',
      publicationYear: 2018,
      pages: 416,
      description: 'Definitive guide to best practices for the Java platform, covering generics, concurrency, lambdas, and API design.',
      coverAccent: '#526B50',
      tags: ['Java', 'Concurrency', 'API Design'],
      archived: false,
      createdAt: daysAgo(350),
    },
    {
      id: 'bk-2',
      isbn: '978-1449373320',
      title: 'Designing Data-Intensive Applications',
      authors: ['Martin Kleppmann'],
      publisher: "O'Reilly Media",
      category: 'Computer Science',
      genre: 'Distributed Systems',
      edition: '1st ed.',
      language: 'English',
      publicationYear: 2017,
      pages: 616,
      description: 'Foundational analysis of reliable, scalable, and maintainable distributed data systems, replication, and consensus.',
      coverAccent: '#3D523B',
      tags: ['Distributed Systems', 'Databases', 'Architecture'],
      archived: false,
      createdAt: daysAgo(340),
    },
    {
      id: 'bk-3',
      isbn: '978-0262046305',
      title: 'Introduction to Algorithms',
      authors: ['Thomas H. Cormen', 'Charles E. Leiserson', 'Ronald L. Rivest', 'Clifford Stein'],
      publisher: 'MIT Press',
      category: 'Computer Science',
      genre: 'Algorithms',
      edition: '4th ed.',
      language: 'English',
      publicationYear: 2022,
      pages: 1312,
      description: 'Comprehensive textbook covering modern algorithm design, graph theory, dynamic programming, and amortized analysis.',
      coverAccent: '#485A46',
      tags: ['Algorithms', 'Data Structures', 'Graph Theory'],
      archived: false,
      createdAt: daysAgo(330),
    },
    {
      id: 'bk-4',
      isbn: '978-0132350884',
      title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
      authors: ['Robert C. Martin'],
      publisher: 'Prentice Hall',
      category: 'Computer Science',
      genre: 'Software Engineering',
      edition: '1st ed.',
      language: 'English',
      publicationYear: 2008,
      pages: 464,
      description: 'Principled practices for readable, maintainable, and testable object-oriented software systems.',
      coverAccent: '#617056',
      tags: ['Software Engineering', 'Java', 'Testing'],
      archived: false,
      createdAt: daysAgo(325),
    },
    {
      id: 'bk-5',
      isbn: '978-1617294945',
      title: 'Spring in Action',
      authors: ['Craig Walls'],
      publisher: 'Manning Publications',
      category: 'Computer Science',
      genre: 'Enterprise Systems',
      edition: '6th ed.',
      language: 'English',
      publicationYear: 2022,
      pages: 520,
      description: 'Practical enterprise guide to Spring Boot, Spring Security, reactive microservices, and Spring Data persistence.',
      coverAccent: '#526B50',
      tags: ['Java', 'Spring Boot', 'Enterprise Architecture'],
      archived: false,
      createdAt: daysAgo(310),
    },
    {
      id: 'bk-6',
      isbn: '978-0321573513',
      title: 'Algorithms',
      authors: ['Robert Sedgewick', 'Kevin Wayne'],
      publisher: 'Addison-Wesley',
      category: 'Computer Science',
      genre: 'Algorithms',
      edition: '4th ed.',
      language: 'English',
      publicationYear: 2011,
      pages: 976,
      description: 'Essential algorithms and data structures implemented in Java with thorough empirical and mathematical analysis.',
      coverAccent: '#6C7359',
      tags: ['Java', 'Algorithms', 'Data Structures'],
      archived: false,
      createdAt: daysAgo(300),
    },
    {
      id: 'bk-7',
      isbn: '978-0262035613',
      title: 'Deep Learning',
      authors: ['Ian Goodfellow', 'Yoshua Bengio', 'Aaron Courville'],
      publisher: 'MIT Press',
      category: 'Artificial Intelligence',
      genre: 'Machine Learning',
      edition: '1st ed.',
      language: 'English',
      publicationYear: 2016,
      pages: 800,
      description: 'Mathematical and conceptual foundations of deep neural networks, optimization, and representation learning.',
      coverAccent: '#4A5443',
      tags: ['Machine Learning', 'Linear Algebra', 'Optimization'],
      archived: false,
      createdAt: daysAgo(290),
    },
    {
      id: 'bk-8',
      isbn: '978-0387848570',
      title: 'The Elements of Statistical Learning',
      authors: ['Trevor Hastie', 'Robert Tibshirani', 'Jerome Friedman'],
      publisher: 'Springer',
      category: 'Mathematics & Statistics',
      genre: 'Statistical Inference',
      edition: '2nd ed.',
      language: 'English',
      publicationYear: 2009,
      pages: 745,
      description: 'Rigorous statistical framework for supervised prediction, ensemble methods, regularization, and inference.',
      coverAccent: '#6E745D',
      tags: ['Statistics', 'Forecasting', 'Data Science'],
      archived: false,
      createdAt: daysAgo(280),
    },
    {
      id: 'bk-9',
      isbn: '978-0691158648',
      title: 'Introduction to Linear Algebra',
      authors: ['Gilbert Strang'],
      publisher: 'Wellesley-Cambridge Press',
      category: 'Mathematics & Statistics',
      genre: 'Linear Algebra',
      edition: '5th ed.',
      language: 'English',
      publicationYear: 2016,
      pages: 584,
      description: 'Classic university text connecting vector spaces, eigenvalues, singular value decomposition, and applied modeling.',
      coverAccent: '#7C8269',
      tags: ['Linear Algebra', 'Mathematics', 'Optimization'],
      archived: false,
      createdAt: daysAgo(270),
    },
    {
      id: 'bk-10',
      isbn: '978-0199535927',
      title: 'A History of Modern Europe',
      authors: ['John Merriman'],
      publisher: 'W. W. Norton & Company',
      category: 'History',
      genre: 'Modern History',
      edition: '4th ed.',
      language: 'English',
      publicationYear: 2019,
      pages: 1320,
      description: 'Scholarly survey tracing institutional, cultural, and political transformations across Europe from the Renaissance to the present.',
      coverAccent: '#866C4E',
      tags: ['History', 'Political Economy', 'Archives'],
      archived: false,
      createdAt: daysAgo(260),
    },
    {
      id: 'bk-11',
      isbn: '978-0674979857',
      title: 'Capital in the Twenty-First Century',
      authors: ['Thomas Piketty'],
      publisher: 'Harvard University Press',
      category: 'Economics',
      genre: 'Macroeconomics',
      edition: '1st ed.',
      language: 'English',
      publicationYear: 2014,
      pages: 696,
      description: 'Long-run empirical study of wealth distribution, capital returns, and fiscal institutions across three centuries.',
      coverAccent: '#7A6852',
      tags: ['Economics', 'Empirical Analysis', 'Policy'],
      archived: false,
      createdAt: daysAgo(250),
    },
    {
      id: 'bk-12',
      isbn: '978-0262533058',
      title: 'The Architecture of the City',
      authors: ['Aldo Rossi'],
      publisher: 'MIT Press',
      category: 'Architecture & Design',
      genre: 'Urban Theory',
      edition: 'Revised ed.',
      language: 'English',
      publicationYear: 1982,
      pages: 208,
      description: 'Seminal architectural treatise examining urban morphology, collective memory, and civic monuments.',
      coverAccent: '#5E6557',
      tags: ['Architecture', 'Urbanism', 'Design Theory'],
      archived: false,
      createdAt: daysAgo(240),
    },
    {
      id: 'bk-13',
      isbn: '978-0140449334',
      title: 'Nicomachean Ethics',
      authors: ['Aristotle'],
      publisher: 'Penguin Classics',
      category: 'Philosophy',
      genre: 'Classical Philosophy',
      edition: 'Revised Translation',
      language: 'English',
      publicationYear: 2004,
      pages: 384,
      description: 'Foundational inquiry into virtue, practical wisdom, civic friendship, and human flourishing.',
      coverAccent: '#6C5F4C',
      tags: ['Ethics', 'Philosophy', 'Classics'],
      archived: false,
      createdAt: daysAgo(220),
    },
    {
      id: 'bk-14',
      isbn: '978-1491950357',
      title: 'Building Microservices',
      authors: ['Sam Newman'],
      publisher: "O'Reilly Media",
      category: 'Computer Science',
      genre: 'Distributed Systems',
      edition: '2nd ed.',
      language: 'English',
      publicationYear: 2021,
      pages: 612,
      description: 'Architectural trade-offs, domain boundaries, security, observability, and resiliency for distributed services.',
      coverAccent: '#465D45',
      tags: ['Distributed Systems', 'Enterprise Architecture', 'API Design'],
      archived: false,
      createdAt: daysAgo(180),
    },
    {
      id: 'bk-15',
      isbn: '978-0136042594',
      title: 'Artificial Intelligence: A Modern Approach',
      authors: ['Stuart Russell', 'Peter Norvig'],
      publisher: 'Pearson',
      category: 'Artificial Intelligence',
      genre: 'Foundations of AI',
      edition: '4th ed.',
      language: 'English',
      publicationYear: 2020,
      pages: 1136,
      description: 'Authoritative university curriculum spanning heuristic search, probabilistic reasoning, planning, and learning agents.',
      coverAccent: '#566A54',
      tags: ['Algorithms', 'Machine Learning', 'Reasoning'],
      archived: false,
      createdAt: daysAgo(160),
    },
    {
      id: 'bk-16',
      isbn: '978-0521880688',
      title: 'Database Internals',
      authors: ['Alex Petrov'],
      publisher: "O'Reilly Media",
      category: 'Computer Science',
      genre: 'Databases',
      edition: '1st ed.',
      language: 'English',
      publicationYear: 2019,
      pages: 376,
      description: 'Deep dive into B-trees, LSM storage engines, write-ahead logs, replication, and distributed consensus protocols.',
      coverAccent: '#4B5E4A',
      tags: ['Databases', 'Distributed Systems', 'Storage Engines'],
      archived: false,
      createdAt: daysAgo(120),
    },
  ];

  // Create physical copies with floor/section/rack/shelf & unique QR tokens
  const bookCopies: SmartLibStore['bookCopies'] = [
    // bk-1 Effective Java (3 copies: 1 issued to ananya, 2 available)
    { id: 'cp-101', copyCode: 'MAIN-CS-0101', bookId: 'bk-1', barcode: 'BC-9780134685991-01', qrToken: 'QR-CP-101-A8F1', branchId: 'br-central', location: { floor: 2, section: 'Computer Science', rack: 'C', shelf: '04' }, status: 'ISSUED', condition: 'GOOD', acquisitionDate: daysAgo(340), lastVerifiedAt: daysAgo(12) },
    { id: 'cp-102', copyCode: 'MAIN-CS-0102', bookId: 'bk-1', barcode: 'BC-9780134685991-02', qrToken: 'QR-CP-102-B7E2', branchId: 'br-central', location: { floor: 2, section: 'Computer Science', rack: 'C', shelf: '04' }, status: 'AVAILABLE', condition: 'GOOD', acquisitionDate: daysAgo(340), lastVerifiedAt: daysAgo(12) },
    { id: 'cp-103', copyCode: 'ENG-CS-0103', bookId: 'bk-1', barcode: 'BC-9780134685991-03', qrToken: 'QR-CP-103-C6D3', branchId: 'br-eng', location: { floor: 1, section: 'Software Engineering', rack: 'A', shelf: '02' }, status: 'AVAILABLE', condition: 'NEW', acquisitionDate: daysAgo(150), lastVerifiedAt: daysAgo(8) },

    // bk-2 Designing Data-Intensive Applications (2 copies: BOTH ISSUED -> creates real unavailability for FIFO reservations & high demand!)
    { id: 'cp-201', copyCode: 'MAIN-CS-0201', bookId: 'bk-2', barcode: 'BC-9781449373320-01', qrToken: 'QR-CP-201-D5C4', branchId: 'br-central', location: { floor: 2, section: 'Computer Science', rack: 'C', shelf: '06' }, status: 'ISSUED', condition: 'GOOD', acquisitionDate: daysAgo(330), lastVerifiedAt: daysAgo(20) },
    { id: 'cp-202', copyCode: 'MAIN-CS-0202', bookId: 'bk-2', barcode: 'BC-9781449373320-02', qrToken: 'QR-CP-202-E4B5', branchId: 'br-central', location: { floor: 2, section: 'Computer Science', rack: 'C', shelf: '06' }, status: 'ISSUED', condition: 'FAIR', acquisitionDate: daysAgo(330), lastVerifiedAt: daysAgo(20) },

    // bk-3 Introduction to Algorithms (3 copies: 1 issued overdue, 2 available)
    { id: 'cp-301', copyCode: 'MAIN-CS-0301', bookId: 'bk-3', barcode: 'BC-9780262046305-01', qrToken: 'QR-CP-301-F3A6', branchId: 'br-central', location: { floor: 2, section: 'Computer Science', rack: 'B', shelf: '01' }, status: 'ISSUED', condition: 'GOOD', acquisitionDate: daysAgo(320), lastVerifiedAt: daysAgo(15) },
    { id: 'cp-302', copyCode: 'MAIN-CS-0302', bookId: 'bk-3', barcode: 'BC-9780262046305-02', qrToken: 'QR-CP-302-A2B7', branchId: 'br-central', location: { floor: 2, section: 'Computer Science', rack: 'B', shelf: '01' }, status: 'AVAILABLE', condition: 'NEW', acquisitionDate: daysAgo(210), lastVerifiedAt: daysAgo(5) },
    { id: 'cp-303', copyCode: 'ENG-CS-0303', bookId: 'bk-3', barcode: 'BC-9780262046305-03', qrToken: 'QR-CP-303-B1C8', branchId: 'br-eng', location: { floor: 1, section: 'Algorithms', rack: 'B', shelf: '03' }, status: 'AVAILABLE', condition: 'GOOD', acquisitionDate: daysAgo(210), lastVerifiedAt: daysAgo(9) },

    // bk-4 Clean Code
    { id: 'cp-401', copyCode: 'MAIN-CS-0401', bookId: 'bk-4', barcode: 'BC-9780132350884-01', qrToken: 'QR-CP-401-C9D1', branchId: 'br-central', location: { floor: 2, section: 'Computer Science', rack: 'C', shelf: '02' }, status: 'AVAILABLE', condition: 'GOOD', acquisitionDate: daysAgo(310), lastVerifiedAt: daysAgo(10) },
    { id: 'cp-402', copyCode: 'ENG-CS-0402', bookId: 'bk-4', barcode: 'BC-9780132350884-02', qrToken: 'QR-CP-402-D8E2', branchId: 'br-eng', location: { floor: 1, section: 'Software Engineering', rack: 'A', shelf: '05' }, status: 'DAMAGED', condition: 'DAMAGED', acquisitionDate: daysAgo(310), lastVerifiedAt: daysAgo(14) },

    // bk-5 Spring in Action (all copies checked out / reserved hold -> high demand!)
    { id: 'cp-501', copyCode: 'MAIN-CS-0501', bookId: 'bk-5', barcode: 'BC-9781617294945-01', qrToken: 'QR-CP-501-E7F3', branchId: 'br-central', location: { floor: 2, section: 'Computer Science', rack: 'C', shelf: '05' }, status: 'ISSUED', condition: 'NEW', acquisitionDate: daysAgo(280), lastVerifiedAt: daysAgo(7) },
    { id: 'cp-502', copyCode: 'ENG-CS-0502', bookId: 'bk-5', barcode: 'BC-9781617294945-02', qrToken: 'QR-CP-502-F6A4', branchId: 'br-eng', location: { floor: 1, section: 'Software Engineering', rack: 'A', shelf: '04' }, status: 'AVAILABLE', condition: 'GOOD', acquisitionDate: daysAgo(200), lastVerifiedAt: daysAgo(6) },

    // bk-6 Algorithms (Sedgewick)
    { id: 'cp-601', copyCode: 'MAIN-CS-0601', bookId: 'bk-6', barcode: 'BC-9780321573513-01', qrToken: 'QR-CP-601-A5B5', branchId: 'br-central', location: { floor: 2, section: 'Computer Science', rack: 'B', shelf: '02' }, status: 'AVAILABLE', condition: 'GOOD', acquisitionDate: daysAgo(290), lastVerifiedAt: daysAgo(11) },
    { id: 'cp-602', copyCode: 'ENG-CS-0602', bookId: 'bk-6', barcode: 'BC-9780321573513-02', qrToken: 'QR-CP-602-B4C6', branchId: 'br-eng', location: { floor: 1, section: 'Algorithms', rack: 'B', shelf: '04' }, status: 'AVAILABLE', condition: 'FAIR', acquisitionDate: daysAgo(290), lastVerifiedAt: daysAgo(11) },

    // bk-7 Deep Learning
    { id: 'cp-701', copyCode: 'MAIN-AI-0701', bookId: 'bk-7', barcode: 'BC-9780262035613-01', qrToken: 'QR-CP-701-C3D7', branchId: 'br-central', location: { floor: 2, section: 'Artificial Intelligence', rack: 'D', shelf: '01' }, status: 'AVAILABLE', condition: 'GOOD', acquisitionDate: daysAgo(260), lastVerifiedAt: daysAgo(4) },
    { id: 'cp-702', copyCode: 'ENG-AI-0702', bookId: 'bk-7', barcode: 'BC-9780262035613-02', qrToken: 'QR-CP-702-D2E8', branchId: 'br-eng', location: { floor: 2, section: 'Machine Learning', rack: 'A', shelf: '01' }, status: 'AVAILABLE', condition: 'NEW', acquisitionDate: daysAgo(220), lastVerifiedAt: daysAgo(4) },

    // bk-8 Elements of Statistical Learning
    { id: 'cp-801', copyCode: 'MAIN-MS-0801', bookId: 'bk-8', barcode: 'BC-9780387848570-01', qrToken: 'QR-CP-801-E1F9', branchId: 'br-central', location: { floor: 3, section: 'Mathematics & Statistics', rack: 'A', shelf: '03' }, status: 'AVAILABLE', condition: 'GOOD', acquisitionDate: daysAgo(250), lastVerifiedAt: daysAgo(18) },
    { id: 'cp-802', copyCode: 'ENG-MS-0802', bookId: 'bk-8', barcode: 'BC-9780387848570-02', qrToken: 'QR-CP-802-F0A0', branchId: 'br-eng', location: { floor: 2, section: 'Applied Mathematics', rack: 'C', shelf: '02' }, status: 'AVAILABLE', condition: 'GOOD', acquisitionDate: daysAgo(250), lastVerifiedAt: daysAgo(18) },

    // bk-9 Linear Algebra
    { id: 'cp-901', copyCode: 'MAIN-MS-0901', bookId: 'bk-9', barcode: 'BC-9780691158648-01', qrToken: 'QR-CP-901-A1C1', branchId: 'br-central', location: { floor: 3, section: 'Mathematics & Statistics', rack: 'A', shelf: '01' }, status: 'AVAILABLE', condition: 'GOOD', acquisitionDate: daysAgo(240), lastVerifiedAt: daysAgo(9) },

    // bk-10 Modern Europe
    { id: 'cp-1001', copyCode: 'HUM-HS-1001', bookId: 'bk-10', barcode: 'BC-9780199535927-01', qrToken: 'QR-CP-1001-B2D2', branchId: 'br-hum', location: { floor: 1, section: 'European History', rack: 'H', shelf: '02' }, status: 'AVAILABLE', condition: 'GOOD', acquisitionDate: daysAgo(230), lastVerifiedAt: daysAgo(15) },
    { id: 'cp-1002', copyCode: 'MAIN-HS-1002', bookId: 'bk-10', barcode: 'BC-9780199535927-02', qrToken: 'QR-CP-1002-C3E3', branchId: 'br-central', location: { floor: 1, section: 'History', rack: 'A', shelf: '06' }, status: 'AVAILABLE', condition: 'GOOD', acquisitionDate: daysAgo(230), lastVerifiedAt: daysAgo(15) },

    // bk-11 Capital
    { id: 'cp-1101', copyCode: 'MAIN-EC-1101', bookId: 'bk-11', barcode: 'BC-9780674979857-01', qrToken: 'QR-CP-1101-D4F4', branchId: 'br-central', location: { floor: 1, section: 'Economics', rack: 'E', shelf: '01' }, status: 'AVAILABLE', condition: 'GOOD', acquisitionDate: daysAgo(215), lastVerifiedAt: daysAgo(20) },

    // bk-12 Architecture of the City
    { id: 'cp-1201', copyCode: 'HUM-AR-1201', bookId: 'bk-12', barcode: 'BC-9780262533058-01', qrToken: 'QR-CP-1201-E5A5', branchId: 'br-hum', location: { floor: 2, section: 'Architecture', rack: 'B', shelf: '03' }, status: 'AVAILABLE', condition: 'GOOD', acquisitionDate: daysAgo(210), lastVerifiedAt: daysAgo(14) },

    // bk-13 Nicomachean Ethics
    { id: 'cp-1301', copyCode: 'HUM-PH-1301', bookId: 'bk-13', barcode: 'BC-9780140449334-01', qrToken: 'QR-CP-1301-F6B6', branchId: 'br-hum', location: { floor: 1, section: 'Philosophy', rack: 'P', shelf: '01' }, status: 'AVAILABLE', condition: 'FAIR', acquisitionDate: daysAgo(200), lastVerifiedAt: daysAgo(12) },

    // bk-14 Building Microservices
    { id: 'cp-1401', copyCode: 'MAIN-CS-1401', bookId: 'bk-14', barcode: 'BC-9781491950357-01', qrToken: 'QR-CP-1401-A7C7', branchId: 'br-central', location: { floor: 2, section: 'Computer Science', rack: 'C', shelf: '07' }, status: 'AVAILABLE', condition: 'NEW', acquisitionDate: daysAgo(160), lastVerifiedAt: daysAgo(3) },
    { id: 'cp-1402', copyCode: 'ENG-CS-1402', bookId: 'bk-14', barcode: 'BC-9781491950357-02', qrToken: 'QR-CP-1402-B8D8', branchId: 'br-eng', location: { floor: 1, section: 'Software Engineering', rack: 'A', shelf: '06' }, status: 'AVAILABLE', condition: 'NEW', acquisitionDate: daysAgo(160), lastVerifiedAt: daysAgo(3) },

    // bk-15 AI Modern Approach
    { id: 'cp-1501', copyCode: 'MAIN-AI-1501', bookId: 'bk-15', barcode: 'BC-9780136042594-01', qrToken: 'QR-CP-1501-C9E9', branchId: 'br-central', location: { floor: 2, section: 'Artificial Intelligence', rack: 'D', shelf: '02' }, status: 'AVAILABLE', condition: 'NEW', acquisitionDate: daysAgo(140), lastVerifiedAt: daysAgo(5) },

    // bk-16 Database Internals
    { id: 'cp-1601', copyCode: 'MAIN-CS-1601', bookId: 'bk-16', barcode: 'BC-9780521880688-01', qrToken: 'QR-CP-1601-D0F0', branchId: 'br-central', location: { floor: 2, section: 'Computer Science', rack: 'C', shelf: '08' }, status: 'AVAILABLE', condition: 'NEW', acquisitionDate: daysAgo(100), lastVerifiedAt: daysAgo(2) },
  ];

  // Rich historical + active circulation records across 6 months (June–Nov 2026)
  const bookIssues: SmartLibStore['bookIssues'] = [
    // Active loans
    { id: 'iss-active-1', receiptNumber: 'ISS-2026-8801', bookId: 'bk-1', copyId: 'cp-101', branchId: 'br-central', memberId: 'u-stu-1', issuedByUserId: 'u-lib-1', issueDate: daysAgo(6), dueDate: daysFromNow(8), returnedAt: null, renewalCount: 0, maxRenewals: 2, status: 'ACTIVE', completionConfirmed: false, completedAt: null },
    { id: 'iss-active-2', receiptNumber: 'ISS-2026-8802', bookId: 'bk-2', copyId: 'cp-201', branchId: 'br-central', memberId: 'u-stu-2', issuedByUserId: 'u-lib-1', issueDate: daysAgo(10), dueDate: daysFromNow(4), returnedAt: null, renewalCount: 0, maxRenewals: 2, status: 'ACTIVE', completionConfirmed: false, completedAt: null },
    { id: 'iss-active-3', receiptNumber: 'ISS-2026-8803', bookId: 'bk-2', copyId: 'cp-202', branchId: 'br-central', memberId: 'u-fac-1', issuedByUserId: 'u-lib-1', issueDate: daysAgo(12), dueDate: daysFromNow(18), returnedAt: null, renewalCount: 0, maxRenewals: 3, status: 'ACTIVE', completionConfirmed: false, completedAt: null },
    { id: 'iss-overdue-1', receiptNumber: 'ISS-2026-8744', bookId: 'bk-3', copyId: 'cp-301', branchId: 'br-central', memberId: 'u-stu-1', issuedByUserId: 'u-lib-1', issueDate: daysAgo(21), dueDate: daysAgo(7), returnedAt: null, renewalCount: 1, maxRenewals: 2, status: 'OVERDUE', completionConfirmed: false, completedAt: null },
    { id: 'iss-active-4', receiptNumber: 'ISS-2026-8809', bookId: 'bk-5', copyId: 'cp-501', branchId: 'br-central', memberId: 'u-stu-2', issuedByUserId: 'u-lib-1', issueDate: daysAgo(4), dueDate: daysFromNow(10), returnedAt: null, renewalCount: 0, maxRenewals: 2, status: 'ACTIVE', completionConfirmed: false, completedAt: null },

    // Historical completed & returned records for Reading DNA & Demand Forecasting
    { id: 'iss-hist-1', receiptNumber: 'ISS-2026-7101', bookId: 'bk-4', copyId: 'cp-401', branchId: 'br-central', memberId: 'u-stu-1', issuedByUserId: 'u-lib-1', issueDate: '2026-06-12T10:00:00.000Z', dueDate: '2026-06-26T10:00:00.000Z', returnedAt: '2026-06-24T14:00:00.000Z', renewalCount: 0, maxRenewals: 2, status: 'RETURNED', completionConfirmed: true, completedAt: '2026-06-24T14:00:00.000Z' },
    { id: 'iss-hist-2', receiptNumber: 'ISS-2026-7240', bookId: 'bk-6', copyId: 'cp-601', branchId: 'br-central', memberId: 'u-stu-1', issuedByUserId: 'u-lib-1', issueDate: '2026-07-08T11:00:00.000Z', dueDate: '2026-07-22T11:00:00.000Z', returnedAt: '2026-07-20T15:00:00.000Z', renewalCount: 0, maxRenewals: 2, status: 'RETURNED', completionConfirmed: true, completedAt: '2026-07-20T15:00:00.000Z' },
    { id: 'iss-hist-3', receiptNumber: 'ISS-2026-7490', bookId: 'bk-5', copyId: 'cp-501', branchId: 'br-central', memberId: 'u-stu-1', issuedByUserId: 'u-lib-1', issueDate: '2026-08-14T09:00:00.000Z', dueDate: '2026-08-28T09:00:00.000Z', returnedAt: '2026-08-27T16:00:00.000Z', renewalCount: 0, maxRenewals: 2, status: 'RETURNED', completionConfirmed: true, completedAt: '2026-08-27T16:00:00.000Z' },
    { id: 'iss-hist-4', receiptNumber: 'ISS-2026-7812', bookId: 'bk-8', copyId: 'cp-801', branchId: 'br-central', memberId: 'u-stu-1', issuedByUserId: 'u-lib-1', issueDate: '2026-09-10T10:30:00.000Z', dueDate: '2026-09-24T10:30:00.000Z', returnedAt: '2026-09-23T12:00:00.000Z', renewalCount: 0, maxRenewals: 2, status: 'RETURNED', completionConfirmed: true, completedAt: '2026-09-23T12:00:00.000Z' },
    { id: 'iss-hist-5', receiptNumber: 'ISS-2026-8120', bookId: 'bk-2', copyId: 'cp-201', branchId: 'br-central', memberId: 'u-stu-1', issuedByUserId: 'u-lib-1', issueDate: '2026-10-03T10:00:00.000Z', dueDate: '2026-10-17T10:00:00.000Z', returnedAt: '2026-10-16T11:30:00.000Z', renewalCount: 0, maxRenewals: 2, status: 'RETURNED', completionConfirmed: true, completedAt: '2026-10-16T11:30:00.000Z' },
    { id: 'iss-hist-6', receiptNumber: 'ISS-2026-7311', bookId: 'bk-2', copyId: 'cp-202', branchId: 'br-central', memberId: 'u-stu-2', issuedByUserId: 'u-lib-1', issueDate: '2026-07-15T10:00:00.000Z', dueDate: '2026-07-29T10:00:00.000Z', returnedAt: '2026-07-28T10:00:00.000Z', renewalCount: 0, maxRenewals: 2, status: 'RETURNED', completionConfirmed: true, completedAt: '2026-07-28T10:00:00.000Z' },
    { id: 'iss-hist-7', receiptNumber: 'ISS-2026-7615', bookId: 'bk-2', copyId: 'cp-201', branchId: 'br-central', memberId: 'u-fac-1', issuedByUserId: 'u-lib-1', issueDate: '2026-08-20T10:00:00.000Z', dueDate: '2026-09-19T10:00:00.000Z', returnedAt: '2026-09-02T10:00:00.000Z', renewalCount: 0, maxRenewals: 3, status: 'RETURNED', completionConfirmed: true, completedAt: '2026-09-02T10:00:00.000Z' },
    { id: 'iss-hist-8', receiptNumber: 'ISS-2026-7955', bookId: 'bk-2', copyId: 'cp-202', branchId: 'br-central', memberId: 'u-stu-2', issuedByUserId: 'u-lib-1', issueDate: '2026-09-18T10:00:00.000Z', dueDate: '2026-10-02T10:00:00.000Z', returnedAt: '2026-10-01T10:00:00.000Z', renewalCount: 0, maxRenewals: 2, status: 'RETURNED', completionConfirmed: false, completedAt: null },
    { id: 'iss-hist-9', receiptNumber: 'ISS-2026-8205', bookId: 'bk-2', copyId: 'cp-201', branchId: 'br-central', memberId: 'u-stu-2', issuedByUserId: 'u-lib-1', issueDate: '2026-10-18T10:00:00.000Z', dueDate: '2026-11-01T10:00:00.000Z', returnedAt: '2026-10-31T10:00:00.000Z', renewalCount: 0, maxRenewals: 2, status: 'RETURNED', completionConfirmed: true, completedAt: '2026-10-31T10:00:00.000Z' },
    { id: 'iss-hist-10', receiptNumber: 'ISS-2026-8301', bookId: 'bk-1', copyId: 'cp-103', branchId: 'br-eng', memberId: 'u-stu-2', issuedByUserId: 'u-lib-2', issueDate: '2026-10-20T10:00:00.000Z', dueDate: '2026-11-03T10:00:00.000Z', returnedAt: '2026-11-02T10:00:00.000Z', renewalCount: 0, maxRenewals: 2, status: 'RETURNED', completionConfirmed: true, completedAt: '2026-11-02T10:00:00.000Z' },
    { id: 'iss-hist-11', receiptNumber: 'ISS-2026-8322', bookId: 'bk-7', copyId: 'cp-701', branchId: 'br-central', memberId: 'u-fac-1', issuedByUserId: 'u-lib-1', issueDate: '2026-09-25T10:00:00.000Z', dueDate: '2026-10-25T10:00:00.000Z', returnedAt: '2026-10-19T10:00:00.000Z', renewalCount: 0, maxRenewals: 3, status: 'RETURNED', completionConfirmed: true, completedAt: '2026-10-19T10:00:00.000Z' },
    { id: 'iss-hist-12', receiptNumber: 'ISS-2026-8390', bookId: 'bk-11', copyId: 'cp-1101', branchId: 'br-central', memberId: 'u-stu-2', issuedByUserId: 'u-lib-1', issueDate: '2026-10-09T10:00:00.000Z', dueDate: '2026-10-23T10:00:00.000Z', returnedAt: '2026-10-22T10:00:00.000Z', renewalCount: 0, maxRenewals: 2, status: 'RETURNED', completionConfirmed: true, completedAt: '2026-10-22T10:00:00.000Z' },
    { id: 'iss-hist-13', receiptNumber: 'ISS-2026-8410', bookId: 'bk-5', copyId: 'cp-501', branchId: 'br-central', memberId: 'u-fac-1', issuedByUserId: 'u-lib-1', issueDate: '2026-10-12T10:00:00.000Z', dueDate: '2026-11-11T10:00:00.000Z', returnedAt: '2026-11-05T10:00:00.000Z', renewalCount: 0, maxRenewals: 3, status: 'RETURNED', completionConfirmed: true, completedAt: '2026-11-05T10:00:00.000Z' },
    { id: 'iss-hist-14', receiptNumber: 'ISS-2026-8450', bookId: 'bk-10', copyId: 'cp-1001', branchId: 'br-hum', memberId: 'u-stu-2', issuedByUserId: 'u-lib-1', issueDate: '2026-08-05T10:00:00.000Z', dueDate: '2026-08-19T10:00:00.000Z', returnedAt: '2026-08-18T10:00:00.000Z', renewalCount: 0, maxRenewals: 2, status: 'RETURNED', completionConfirmed: true, completedAt: '2026-08-18T10:00:00.000Z' },
  ];

  const bookReturns: SmartLibStore['bookReturns'] = [
    { id: 'ret-1', returnReceiptNumber: 'RET-2026-4401', issueId: 'iss-hist-5', copyId: 'cp-201', bookId: 'bk-2', branchId: 'br-central', memberId: 'u-stu-1', processedByUserId: 'u-lib-1', returnedAt: '2026-10-16T11:30:00.000Z', conditionOnReturn: 'GOOD', overdueDays: 0, fineGeneratedAmount: 0, notes: 'Returned in excellent condition.' },
  ];

  const reservations: SmartLibStore['reservations'] = [
    { id: 'res-1', bookId: 'bk-2', branchId: 'br-central', memberId: 'u-stu-1', status: 'WAITING', allocatedCopyId: null, queuedAt: daysAgo(3), allocatedAt: null, expiresAt: null, fulfilledAt: null },
    { id: 'res-2', bookId: 'bk-2', branchId: 'br-central', memberId: 'u-lib-2', status: 'WAITING', allocatedCopyId: null, queuedAt: daysAgo(2), allocatedAt: null, expiresAt: null, fulfilledAt: null },
    { id: 'res-3', bookId: 'bk-5', branchId: 'br-central', memberId: 'u-stu-1', status: 'WAITING', allocatedCopyId: null, queuedAt: daysAgo(1), allocatedAt: null, expiresAt: null, fulfilledAt: null },
  ];

  const fines: SmartLibStore['fines'] = [
    { id: 'fn-1', issueId: 'iss-overdue-1', memberId: 'u-stu-1', branchId: 'br-central', reason: 'OVERDUE', currency: 'INR', amount: 7.5, paidAmount: 0, waivedAmount: 0, status: 'PENDING', waiverReason: null, waivedByUserId: null, assessedAt: daysAgo(1), settledAt: null },
  ];

  const seats: SmartLibStore['seats'] = [
    { id: 'st-1', branchId: 'br-central', seatCode: 'Q-101', floor: 2, zone: 'QUIET_STUDY', row: 1, column: 1, amenities: ['Power', 'Task Lamp'], status: 'ACTIVE' },
    { id: 'st-2', branchId: 'br-central', seatCode: 'Q-102', floor: 2, zone: 'QUIET_STUDY', row: 1, column: 2, amenities: ['Power', 'Task Lamp'], status: 'ACTIVE' },
    { id: 'st-3', branchId: 'br-central', seatCode: 'Q-103', floor: 2, zone: 'QUIET_STUDY', row: 1, column: 3, amenities: ['Power', 'Task Lamp', 'Window'], status: 'ACTIVE' },
    { id: 'st-4', branchId: 'br-central', seatCode: 'Q-104', floor: 2, zone: 'QUIET_STUDY', row: 1, column: 4, amenities: ['Power', 'Task Lamp'], status: 'ACTIVE' },
    { id: 'st-5', branchId: 'br-central', seatCode: 'C-201', floor: 2, zone: 'COMPUTER_CARREL', row: 2, column: 1, amenities: ['Dual Monitor', 'Power', 'Ethernet'], status: 'ACTIVE' },
    { id: 'st-6', branchId: 'br-central', seatCode: 'C-202', floor: 2, zone: 'COMPUTER_CARREL', row: 2, column: 2, amenities: ['Dual Monitor', 'Power', 'Ethernet'], status: 'ACTIVE' },
    { id: 'st-7', branchId: 'br-central', seatCode: 'A-203', floor: 2, zone: 'ACCESSIBLE', row: 2, column: 3, amenities: ['Height-Adjustable Desk', 'Power', 'Wide Clearance'], status: 'ACTIVE' },
    { id: 'st-8', branchId: 'br-central', seatCode: 'G-204', floor: 2, zone: 'COLLABORATIVE', row: 2, column: 4, amenities: ['Whiteboard', 'Power'], status: 'MAINTENANCE' },
    { id: 'st-9', branchId: 'br-eng', seatCode: 'E-101', floor: 1, zone: 'QUIET_STUDY', row: 1, column: 1, amenities: ['Power', 'USB-C'], status: 'ACTIVE' },
    { id: 'st-10', branchId: 'br-eng', seatCode: 'E-102', floor: 1, zone: 'COMPUTER_CARREL', row: 1, column: 2, amenities: ['Workstation', 'Power'], status: 'ACTIVE' },
  ];

  const todayStr = '2026-11-20';
  const seatReservations: SmartLibStore['seatReservations'] = [
    { id: 'sres-1', seatId: 'st-2', branchId: 'br-central', userId: 'u-stu-2', reservationDate: todayStr, startTime: '09:00', endTime: '11:00', status: 'CHECKED_IN', checkedInAt: `${todayStr}T09:04:00.000Z`, checkedOutAt: null, createdAt: daysAgo(1) },
    { id: 'sres-2', seatId: 'st-5', branchId: 'br-central', userId: 'u-fac-1', reservationDate: todayStr, startTime: '13:00', endTime: '15:00', status: 'CONFIRMED', checkedInAt: null, checkedOutAt: null, createdAt: daysAgo(1) },
  ];

  const acquisitionDecisions: SmartLibStore['acquisitionDecisions'] = [
    {
      id: 'acq-1',
      bookId: 'bk-2',
      branchId: 'br-central',
      suggestedAdditionalCopies: 3,
      priority: 'HIGH',
      demandToInventoryRatio: 3.5,
      explanation: '2 physical copies (0 available) against 7 recent loans and 2 waiting FIFO reservations. Weighted moving average forecasts sustained demand through winter examinations.',
      status: 'PENDING',
      reviewedByUserId: null,
      rejectionReason: null,
      reviewedAt: null,
      createdAt: daysAgo(2),
    },
    {
      id: 'acq-2',
      bookId: 'bk-5',
      branchId: 'br-central',
      suggestedAdditionalCopies: 2,
      priority: 'MEDIUM',
      demandToInventoryRatio: 2.0,
      explanation: '1 Central branch copy currently issued with active student queue for CS-410 Enterprise Systems coursework.',
      status: 'PENDING',
      reviewedByUserId: null,
      rejectionReason: null,
      reviewedAt: null,
      createdAt: daysAgo(1),
    },
  ];

  const readingLists: SmartLibStore['readingLists'] = [
    {
      id: 'rl-1',
      userId: 'u-stu-1',
      title: 'Distributed Consensus & Storage Engines Thesis',
      subject: 'Computer Science',
      description: 'Core bibliographic sources for senior seminar on fault-tolerant replicated databases.',
      tags: ['Distributed Systems', 'Storage', 'Thesis'],
      bookIds: ['bk-2', 'bk-16', 'bk-14'],
      createdAt: daysAgo(25),
    },
  ];

  const researchNotes: SmartLibStore['researchNotes'] = [
    {
      id: 'rn-1',
      userId: 'u-stu-1',
      readingListId: 'rl-1',
      bookId: 'bk-2',
      title: 'Linearizability vs Serializability Comparison',
      content: 'Kleppmann distinguishes recency guarantees (linearizability) from multi-object transactional isolation (serializability). Relevant to library copy checkout locking.',
      pageReference: 'pp. 324–338',
      tags: ['Transactions', 'Concurrency'],
      createdAt: daysAgo(18),
    },
  ];

  const courses: SmartLibStore['courses'] = [
    {
      id: 'crs-cs301',
      courseCode: 'CS-301',
      courseTitle: 'Data Structures & Algorithms',
      department: 'Computer Science',
      semester: 'Autumn Semester 2026',
      facultyUserId: 'u-fac-1',
      branchId: 'br-central',
      enrolledStudentIds: ['u-stu-1', 'u-stu-2'],
      materials: [
        { bookId: 'bk-3', materialType: 'TEXTBOOK', required: true, notes: 'Primary text for dynamic programming and graph algorithms.', alternativeBookIds: ['bk-6'] },
        { bookId: 'bk-6', materialType: 'PRACTICE', required: false, notes: 'Java implementation walkthroughs for lectures 4–10.', alternativeBookIds: ['bk-3'] },
      ],
    },
    {
      id: 'crs-cs410',
      courseCode: 'CS-410',
      courseTitle: 'Enterprise Distributed Systems',
      department: 'Computer Science',
      semester: 'Autumn Semester 2026',
      facultyUserId: 'u-fac-1',
      branchId: 'br-central',
      enrolledStudentIds: ['u-stu-1'],
      materials: [
        { bookId: 'bk-2', materialType: 'TEXTBOOK', required: true, notes: 'Chapters 5–9 on replication, partitioning, and consensus.', alternativeBookIds: ['bk-16'] },
        { bookId: 'bk-5', materialType: 'REFERENCE', required: false, notes: 'Spring Boot security and MongoDB persistence patterns.', alternativeBookIds: ['bk-14'] },
      ],
    },
  ];

  const readingChallenges: SmartLibStore['readingChallenges'] = [
    {
      id: 'chl-1',
      scope: 'CAMPUS',
      branchId: 'br-central',
      creatorUserId: 'u-lib-1',
      title: 'Autumn Academic Depth Challenge',
      description: 'Complete and verify 5 scholarly volumes across two or more departments before winter break.',
      targetBooks: 5,
      startDate: '2026-09-01',
      endDate: '2026-12-20',
      participantIds: ['u-stu-1', 'u-stu-2'],
    },
    {
      id: 'chl-2',
      scope: 'PERSONAL',
      branchId: 'br-central',
      creatorUserId: 'u-stu-1',
      title: 'Systems Engineering Reading Milestone',
      description: 'Verify completion of 6 foundational systems and algorithms books this academic year.',
      targetBooks: 6,
      startDate: '2026-06-01',
      endDate: '2026-12-31',
      participantIds: ['u-stu-1'],
    },
  ];

  const exchangeListings: SmartLibStore['exchangeListings'] = [
    {
      id: 'ex-1',
      ownerUserId: 'u-stu-2',
      branchId: 'br-central',
      title: 'Linear Algebra Done Right (3rd Edition)',
      author: 'Sheldon Axler',
      isbn: '978-3319110790',
      subject: 'Mathematics',
      condition: 'LIKE_NEW',
      listingType: 'EXCHANGE',
      description: 'Clean personal copy with light pencil margin notes in Chapter 2. Open to trading for an Economics or Algorithms paperback.',
      photoUrl: '',
      status: 'AVAILABLE',
      reports: [],
      createdAt: daysAgo(5),
    },
    {
      id: 'ex-2',
      ownerUserId: 'u-fac-1',
      branchId: 'br-central',
      title: 'The Pragmatic Programmer (20th Anniversary)',
      author: 'David Thomas, Andrew Hunt',
      isbn: '978-0135957059',
      subject: 'Computer Science',
      condition: 'GOOD',
      listingType: 'DONATION',
      description: 'Personal desk copy donated to a verified undergraduate computer science student.',
      photoUrl: '',
      status: 'AVAILABLE',
      reports: [],
      createdAt: daysAgo(3),
    },
  ];

  const lostFoundReports: SmartLibStore['lostFoundReports'] = [
    {
      id: 'lf-1',
      incidentCode: 'INC-2026-0091',
      copyId: 'cp-402',
      bookId: 'bk-4',
      branchId: 'br-eng',
      reportedByUserId: 'u-lib-2',
      memberId: 'u-stu-2',
      incidentType: 'DAMAGED',
      status: 'VERIFIED_DAMAGED',
      description: 'Water damage along spine and final 40 pages observed during shelf intake inspection.',
      recoveryDetails: 'Sent to bindery assessment desk; marked unavailable for circulation.',
      currency: 'INR',
      penaltyAmount: 12.0,
      verifiedByLibrarianId: 'u-lib-2',
      createdAt: daysAgo(14),
      verifiedAt: daysAgo(13),
    },
  ];

  const bookTransfers: SmartLibStore['bookTransfers'] = [
    {
      id: 'tr-1',
      transferCode: 'TRF-2026-0301',
      copyId: 'cp-1402',
      bookId: 'bk-14',
      fromBranchId: 'br-eng',
      toBranchId: 'br-central',
      requestedByUserId: 'u-lib-1',
      approvedByUserId: null,
      status: 'REQUESTED',
      reason: 'High enrollment demand in CS-410 Enterprise Distributed Systems at Central Heritage.',
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
  ];

  const kioskTransactions: SmartLibStore['kioskTransactions'] = [
    {
      id: 'ksk-1',
      kioskId: 'KIOSK-MAIN-F1',
      branchId: 'br-central',
      memberId: 'u-stu-1',
      copyId: 'cp-101',
      action: 'ISSUE',
      status: 'SUCCESS',
      summary: 'Self-checkout completed for Effective Java (MAIN-CS-0101).',
      timestamp: daysAgo(6),
    },
  ];

  const notifications: SmartLibStore['notifications'] = [
    {
      id: 'ntf-1',
      userId: 'u-stu-1',
      branchId: 'br-central',
      type: 'OVERDUE_BOOK',
      title: 'Overdue Volume Notice',
      message: 'Introduction to Algorithms (MAIN-CS-0301) is overdue. Please return to Central Heritage Library to prevent additional fine accrual.',
      read: false,
      emailStatus: 'SKIPPED_DEV',
      idempotencyKey: 'OVERDUE:iss-overdue-1:2026-11-20',
      createdAt: daysAgo(1),
    },
    {
      id: 'ntf-2',
      userId: 'u-stu-1',
      branchId: 'br-central',
      type: 'COURSE_READING_LIST_UPDATE',
      title: 'Course Reading List Updated',
      message: 'Prof. Mateo Alvarez updated required readings for CS-410 Enterprise Distributed Systems.',
      read: false,
      emailStatus: 'SKIPPED_DEV',
      idempotencyKey: 'COURSE:crs-cs410:2026-11-18',
      createdAt: daysAgo(2),
    },
    {
      id: 'ntf-3',
      userId: 'u-lib-1',
      branchId: 'br-central',
      type: 'ACQUISITION_SUGGESTION',
      title: 'High-Priority Acquisition Alert',
      message: 'Designing Data-Intensive Applications reached 3.5x demand-to-inventory ratio at Central Heritage Library.',
      read: false,
      emailStatus: 'SKIPPED_DEV',
      idempotencyKey: 'ACQ:bk-2:br-central',
      createdAt: daysAgo(2),
    },
  ];

  const auditLogs: SmartLibStore['auditLogs'] = [
    {
      id: 'aud-1',
      actorUserId: 'u-lib-1',
      actorName: 'Rajesh Verma',
      actorRole: 'LIBRARIAN',
      branchId: 'br-central',
      action: 'BOOK_ISSUED',
      entityType: 'BOOK_ISSUE',
      entityId: 'iss-active-1',
      summary: 'Issued copy MAIN-CS-0101 (Effective Java) to Ananya Sharma.',
      timestamp: daysAgo(6),
    },
    {
      id: 'aud-2',
      actorUserId: 'u-lib-2',
      actorName: 'Claire Bennett',
      actorRole: 'LIBRARIAN',
      branchId: 'br-eng',
      action: 'INCIDENT_VERIFIED',
      entityType: 'LOST_FOUND_REPORT',
      entityId: 'lf-1',
      summary: 'Verified damaged copy ENG-CS-0402 and assessed ₹12.00 repair penalty.',
      timestamp: daysAgo(13),
    },
    {
      id: 'aud-3',
      actorUserId: 'u-super',
      actorName: 'Dr. Eleanor Vance',
      actorRole: 'SUPER_ADMIN',
      branchId: null,
      action: 'POLICY_UPDATED',
      entityType: 'LIBRARY_POLICY',
      entityId: 'pol-global',
      summary: 'Confirmed Autumn Semester 2026 global borrowing & INR fine policy parameters.',
      timestamp: daysAgo(20),
    },
  ];

  return {
    users,
    refreshTokens: [],
    passwordResetTokens: [],
    branches,
    policies,
    books,
    bookCopies,
    bookIssues,
    bookReturns,
    reservations,
    fines,
    finePayments: [],
    seats,
    seatReservations,
    acquisitionDecisions,
    readingLists,
    researchNotes,
    courses,
    readingChallenges,
    exchangeListings,
    exchangeRequests: [],
    lostFoundReports,
    bookTransfers,
    kioskTransactions,
    notifications,
    auditLogs,
  };
}

let cachedStore: SmartLibStore | null = null;

function migrateStoreToIndiaLocale(store: SmartLibStore): boolean {
  let dirty = false;

  const branchDefaults: Record<
    string,
    {
      campusZone: string;
      address: string;
      city: string;
      state: string;
      pinCode: string;
      country: string;
      contactEmail: string;
      contactPhone: string;
      operatingHours: string;
    }
  > = {
    'br-central': {
      campusZone: 'Vidya Vihar Academic Block',
      address: 'Plot 14, Knowledge Park Road, Malleswaram, Bengaluru, Karnataka 560012',
      city: 'Bengaluru',
      state: 'Karnataka',
      pinCode: '560012',
      country: 'India',
      contactEmail: 'central@smartlib.ac.in',
      contactPhone: '+91 80412 44001',
      operatingHours: 'Mon–Sat 07:30–23:00 IST, Sun 10:00–20:00 IST',
    },
    'br-eng': {
      campusZone: 'Ramanujan Technology Block',
      address: 'Block EP, Sector V, Salt Lake Academic Campus, Kolkata, West Bengal 700091',
      city: 'Kolkata',
      state: 'West Bengal',
      pinCode: '700091',
      country: 'India',
      contactEmail: 'engineering@smartlib.ac.in',
      contactPhone: '+91 33401 44010',
      operatingHours: 'Mon–Sun 08:00–24:00 IST',
    },
    'br-hum': {
      campusZone: 'Tagore Arts & Humanities Wing',
      address: '18 Ganeshkhind University Road, Shivajinagar, Pune, Maharashtra 411007',
      city: 'Pune',
      state: 'Maharashtra',
      pinCode: '411007',
      country: 'India',
      contactEmail: 'humanities@smartlib.ac.in',
      contactPhone: '+91 20410 44020',
      operatingHours: 'Mon–Fri 08:00–21:00 IST, Sat 09:00–18:00 IST',
    },
  };

  for (const branch of store.branches) {
    const def = branchDefaults[branch.id];
    if (
      def &&
      (branch.contactPhone.startsWith('+1') ||
        !branch.pinCode ||
        !branch.city ||
        !branch.country)
    ) {
      branch.campusZone = def.campusZone;
      branch.address = def.address;
      branch.city = def.city;
      branch.state = def.state;
      branch.pinCode = def.pinCode;
      branch.country = def.country;
      branch.contactEmail = def.contactEmail;
      branch.contactPhone = def.contactPhone;
      branch.operatingHours = def.operatingHours;
      dirty = true;
    } else if (!branch.country) {
      branch.country = 'India';
      dirty = true;
    }
  }

  for (const policy of store.policies) {
    if (policy.currency !== 'INR') {
      policy.currency = 'INR';
      dirty = true;
    }
  }
  for (const fine of store.fines) {
    if (fine.currency !== 'INR') {
      fine.currency = 'INR';
      dirty = true;
    }
  }
  for (const payment of store.finePayments) {
    if (payment.currency !== 'INR') {
      payment.currency = 'INR';
      dirty = true;
    }
  }
  for (const report of store.lostFoundReports) {
    if (report.currency !== 'INR') {
      report.currency = 'INR';
      dirty = true;
    }
  }

  const replaceUsdSymbol = (text: string) =>
    text.replace(/\$([0-9][0-9,]*(?:\.\d{1,2})?)/g, '₹$1');

  for (const log of store.auditLogs) {
    const next = replaceUsdSymbol(log.summary).replace('Fall 2026', 'Autumn Semester 2026');
    if (next !== log.summary) {
      log.summary = next;
      dirty = true;
    }
  }
  for (const n of store.notifications) {
    const next = replaceUsdSymbol(n.message);
    if (next !== n.message) {
      n.message = next;
      dirty = true;
    }
  }
  for (const course of store.courses) {
    if (course.semester === 'Fall 2026') {
      course.semester = 'Autumn Semester 2026';
      dirty = true;
    }
  }

  return dirty;
}

let mongoHydrated = false;
let mongoDirty = false;
let hydrationPromise: Promise<SmartLibStore> | null = null;
let pendingFlushPromise: Promise<void> | null = null;

export async function ensureStoreHydrated(): Promise<SmartLibStore> {
  if (!isMongoConfigured()) {
    return getStore();
  }
  if (mongoHydrated && cachedStore) {
    return cachedStore;
  }
  if (!hydrationPromise) {
    hydrationPromise = (async () => {
      const remote = await loadStateFromMongo();
      if (remote) {
        cachedStore = remote;
        const migrated = migrateStoreToIndiaLocale(cachedStore);
        mongoHydrated = true;
        if (migrated) {
          await saveStateToMongo(cachedStore);
        }
        return cachedStore;
      }
      const seeded = getStore();
      const saved = await saveStateToMongo(seeded);
      if (saved) {
        mongoHydrated = true;
      }
      return seeded;
    })().finally(() => {
      hydrationPromise = null;
    });
  }
  return hydrationPromise;
}

export async function flushStore(): Promise<void> {
  if (!isMongoConfigured() || !mongoDirty || !cachedStore) return;
  if (pendingFlushPromise) {
    await pendingFlushPromise;
    return;
  }
  mongoDirty = false;
  const snapshot = cachedStore;
  pendingFlushPromise = (async () => {
    const ok = await saveStateToMongo(snapshot);
    if (!ok) {
      mongoDirty = true;
    }
  })().finally(() => {
    pendingFlushPromise = null;
  });
  await pendingFlushPromise;
}

export function getStorageStatus() {
  const mongo = getMongoStatus();
  return {
    engine: mongo.configured && mongo.connected ? 'mongodb-atlas' : 'local-json',
    mongo,
  };
}

export function getStore(): SmartLibStore {
  if (cachedStore) return cachedStore;
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      cachedStore = JSON.parse(raw) as SmartLibStore;
      if (migrateStoreToIndiaLocale(cachedStore)) {
        persistStore();
      }
      return cachedStore;
    }
  } catch {
    // Fallback to in-memory seed if disk is unavailable or corrupted
  }
  cachedStore = createInitialSeed();
  persistStore();
  return cachedStore;
}

export function persistStore(): void {
  if (!cachedStore) return;
  if (isMongoConfigured()) {
    mongoDirty = true;
  }
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(cachedStore, null, 2), 'utf-8');
  } catch {
    // Serverless or read-only filesystem: keep state in memory / MongoDB
  }
}

export function resolvePolicy(store: SmartLibStore, branchId: string | null): LibraryPolicy {
  if (branchId) {
    const branchPol = store.policies.find((p) => p.scope === 'BRANCH' && p.branchId === branchId);
    if (branchPol) return branchPol;
  }
  return store.policies.find((p) => p.scope === 'GLOBAL') ?? store.policies[0];
}

export function addAuditLog(
  store: SmartLibStore,
  entry: Omit<SmartLibStore['auditLogs'][number], 'id' | 'timestamp'>
): void {
  store.auditLogs.unshift({
    id: uid('aud'),
    timestamp: new Date().toISOString(),
    ...entry,
  });
}

export function addNotification(
  store: SmartLibStore,
  entry: Omit<SmartLibStore['notifications'][number], 'id' | 'createdAt' | 'read' | 'emailStatus'>
): void {
  if (
    entry.idempotencyKey &&
    store.notifications.some((n) => n.idempotencyKey === entry.idempotencyKey)
  ) {
    return;
  }
  store.notifications.unshift({
    id: uid('ntf'),
    read: false,
    emailStatus: 'SKIPPED_DEV',
    createdAt: new Date().toISOString(),
    ...entry,
  });
}
