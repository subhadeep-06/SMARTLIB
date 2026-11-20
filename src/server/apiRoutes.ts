import express, { type Response } from 'express';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import crypto from 'crypto';
import {
  authenticate,
  issueRefreshToken,
  rateLimit,
  requireRoles,
  rotateRefreshToken,
  signAccessToken,
  type AuthedRequest,
} from './authMiddleware.js';
import {
  calculateOverdueFine,
  checkSeatConflict,
  computeDemandForecast,
  computeQueuePosition,
  computeReadingDna,
  formatBibliographyCitation,
  generateExplainableRecommendations,
  getNextFifoReservation,
  hasBranchPermission,
  type UserRole,
} from './domainEngine.js';
import {
  addAuditLog,
  addNotification,
  getStorageStatus,
  getStore,
  hashToken,
  persistStore,
  resolvePolicy,
  uid,
} from './store.js';
import {
  INDIA_LOCALE,
  formatINR,
  formatIndianDate,
  isNonNegativeMonetaryAmount,
  isValidIndianPhone,
  isValidIndianPinCode,
  roundInrAmount,
} from './locale.js';

export const apiRouter = express.Router();

apiRouter.get('/health', (_req, res) => {
  const storage = getStorageStatus();
  ok(res, {
    status: 'ok',
    storageEngine: storage.engine,
    mongodb: {
      configured: storage.mongo.configured,
      connected: storage.mongo.connected,
      database: storage.mongo.database,
    },
    locale: INDIA_LOCALE,
  });
});

function ok(res: Response, data: unknown, message = 'OK', meta?: Record<string, unknown>) {
  res.json({
    success: true,
    data,
    message,
    ...(meta ? { meta } : {}),
    timestamp: new Date().toISOString(),
  });
}

function fail(res: Response, status: number, message: string, errorCode = 'REQUEST_ERROR') {
  res.status(status).json({
    success: false,
    errorCode,
    message,
    timestamp: new Date().toISOString(),
  });
}

function sanitizeUser(u: ReturnType<typeof getStore>['users'][number]) {
  return {
    id: u.id,
    institutionalId: u.institutionalId,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    branchId: u.branchId,
    department: u.department,
    accountStatus: u.accountStatus,
    emailVerified: u.emailVerified,
    borrowingRestricted: u.borrowingRestricted,
    customBorrowLimit: u.customBorrowLimit,
    digitalCardQrToken: u.digitalCardQrToken,
    enrolledCourseIds: u.enrolledCourseIds,
    accessibilityPrefs: u.accessibilityPrefs,
    createdAt: u.createdAt,
  };
}

function enrichBook(book: ReturnType<typeof getStore>['books'][number]) {
  const store = getStore();
  const copies = store.bookCopies.filter((c) => c.bookId === book.id && c.status !== 'ARCHIVED');
  const availableCopies = copies.filter((c) => c.status === 'AVAILABLE').length;
  const borrowCount = store.bookIssues.filter((i) => i.bookId === book.id).length;
  const activeReservations = store.reservations.filter(
    (r) => r.bookId === book.id && (r.status === 'WAITING' || r.status === 'READY_FOR_PICKUP')
  ).length;
  return {
    ...book,
    totalCopies: copies.length,
    availableCopies,
    borrowCount,
    activeReservations,
  };
}

function allocateCopyToNextReservation(bookId: string, branchId: string, copyId: string) {
  const store = getStore();
  const nextRes = getNextFifoReservation(store.reservations, bookId, branchId);
  if (!nextRes) return null;

  const copy = store.bookCopies.find((c) => c.id === copyId);
  if (!copy) return null;

  const policy = resolvePolicy(store, branchId);
  const nowIso = new Date().toISOString();
  const expiresIso = new Date(Date.now() + policy.reservationHoldHours * 3600000).toISOString();

  copy.status = 'RESERVED_HOLD';
  nextRes.status = 'READY_FOR_PICKUP';
  nextRes.allocatedCopyId = copy.id;
  nextRes.allocatedAt = nowIso;
  nextRes.expiresAt = expiresIso;

  const book = store.books.find((b) => b.id === bookId);
  addNotification(store, {
    userId: nextRes.memberId,
    branchId,
    type: 'RESERVATION_AVAILABLE',
    title: 'Reserved Volume Ready for Pickup',
    message: `"${book?.title ?? 'Your reserved book'}" (Copy ${copy.copyCode}) is now held for you until ${formatIndianDate(expiresIso)}.`,
    idempotencyKey: `RES_READY:${nextRes.id}:${copy.id}`,
  });

  return nextRes;
}

function buildReadingHistoryForUser(userId: string) {
  const store = getStore();
  return store.bookIssues
    .filter((i) => i.memberId === userId)
    .map((issue) => {
      const book = store.books.find((b) => b.id === issue.bookId);
      return {
        userId,
        bookId: issue.bookId,
        category: book?.category ?? 'General',
        authors: book?.authors ?? [],
        tags: book?.tags ?? [],
        borrowedAt: issue.issueDate,
        returnedAt: issue.returnedAt,
        completedVerified: issue.completionConfirmed,
      };
    });
}

// ======================================================
// PUBLIC ENDPOINTS
// ======================================================
apiRouter.get('/health', (_req, res) => {
  ok(res, { status: 'UP', service: 'smartlib-api' });
});

apiRouter.get('/public/overview', (_req, res) => {
  const store = getStore();
  const activeBooks = store.books.filter((b) => !b.archived).map(enrichBook);
  const activeCopies = store.bookCopies.filter((c) => c.status !== 'ARCHIVED');
  const availableSeats = store.seats.filter((s) => s.status === 'ACTIVE').length;

  ok(res, {
    stats: {
      totalBranches: store.branches.filter((b) => b.status === 'ACTIVE').length,
      totalTitles: activeBooks.length,
      totalPhysicalCopies: activeCopies.length,
      totalMembers: store.users.filter((u) => u.role === 'STUDENT' || u.role === 'FACULTY').length,
      studySeats: availableSeats,
      activeLoans: store.bookIssues.filter((i) => i.status === 'ACTIVE' || i.status === 'OVERDUE').length,
    },
    branches: store.branches.map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      campusZone: b.campusZone,
      city: b.city,
      state: b.state,
      pinCode: b.pinCode,
      operatingHours: b.operatingHours,
    })),
    featuredBooks: activeBooks.slice(0, 6),
    locale: INDIA_LOCALE,
  });
});

// ======================================================
// AUTHENTICATION
// ======================================================
apiRouter.post('/auth/register', rateLimit(20, 60_000), (req, res) => {
  const { fullName, email, password, department, branchId, role } = req.body ?? {};
  if (!fullName?.trim() || !email?.trim() || !password || password.length < 8) {
    fail(res, 400, 'Full name, valid institutional email, and password (min 8 chars) are required.');
    return;
  }

  const store = getStore();
  const normalizedEmail = String(email).trim().toLowerCase();
  if (store.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
    fail(res, 409, 'An account with this email already exists.', 'DUPLICATE_EMAIL');
    return;
  }

  const assignedRole: UserRole = role === 'FACULTY' ? 'FACULTY' : 'STUDENT';
  const validBranch =
    store.branches.find((b) => b.id === branchId)?.id ?? store.branches[0]?.id ?? 'br-central';
  const id = uid('u');
  const instCode = `${assignedRole === 'FACULTY' ? 'FAC' : 'STU'}-2026-${Math.floor(1000 + Math.random() * 8999)}`;

  const newUser = {
    id,
    institutionalId: instCode,
    email: normalizedEmail,
    passwordHash: bcrypt.hashSync(password, 10),
    fullName: String(fullName).trim(),
    role: assignedRole,
    branchId: validBranch,
    department: String(department || 'General Studies').trim(),
    accountStatus: 'ACTIVE' as const,
    emailVerified: true,
    borrowingRestricted: false,
    customBorrowLimit: null,
    digitalCardQrToken: `SL-CARD-${instCode}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    enrolledCourseIds: ['crs-cs301'],
    accessibilityPrefs: { fontSize: 'md' as const, highContrast: false },
    createdAt: new Date().toISOString(),
  };

  store.users.push(newUser);
  addAuditLog(store, {
    actorUserId: newUser.id,
    actorName: newUser.fullName,
    actorRole: newUser.role,
    branchId: newUser.branchId,
    action: 'USER_REGISTERED',
    entityType: 'USER',
    entityId: newUser.id,
    summary: `Registered institutional member ${newUser.email} (${newUser.role}).`,
  });
  persistStore();

  const accessToken = signAccessToken(newUser);
  const refreshToken = issueRefreshToken(newUser.id);

  res.status(201).json({
    success: true,
    message: 'Registration successful.',
    data: {
      accessToken,
      refreshToken,
      user: sanitizeUser(newUser),
    },
    timestamp: new Date().toISOString(),
  });
});

apiRouter.post('/auth/login', rateLimit(30, 60_000), (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    fail(res, 400, 'Email and password are required.');
    return;
  }

  const store = getStore();
  const user = store.users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
  if (!user || !bcrypt.compareSync(String(password), user.passwordHash)) {
    fail(res, 401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
    return;
  }
  if (user.accountStatus === 'SUSPENDED') {
    fail(res, 403, 'This institutional account is suspended. Contact library administration.');
    return;
  }

  const accessToken = signAccessToken(user);
  const refreshToken = issueRefreshToken(user.id);
  ok(
    res,
    {
      accessToken,
      refreshToken,
      user: sanitizeUser(user),
    },
    'Signed in successfully.'
  );
});

apiRouter.post('/auth/refresh', rateLimit(40, 60_000), (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (!refreshToken) {
    fail(res, 400, 'Refresh token is required.');
    return;
  }
  const rotated = rotateRefreshToken(String(refreshToken));
  if (!rotated) {
    fail(res, 401, 'Refresh token invalid, expired, or revoked.');
    return;
  }
  const store = getStore();
  const user = store.users.find((u) => u.id === rotated.userId);
  if (!user) {
    fail(res, 401, 'User account not found.');
    return;
  }
  ok(res, {
    accessToken: signAccessToken(user),
    refreshToken: rotated.newRefreshToken,
    user: sanitizeUser(user),
  });
});

apiRouter.post('/auth/logout', authenticate, (req: AuthedRequest, res) => {
  const { refreshToken } = req.body ?? {};
  const store = getStore();
  if (refreshToken) {
    const tokenHash = hashToken(String(refreshToken));
    const rec = store.refreshTokens.find((t) => t.tokenHash === tokenHash);
    if (rec) rec.revoked = true;
  }
  persistStore();
  ok(res, { loggedOut: true }, 'Logged out.');
});

apiRouter.post('/auth/forgot-password', rateLimit(10, 60_000), (req, res) => {
  const { email } = req.body ?? {};
  if (!email) {
    fail(res, 400, 'Email is required.');
    return;
  }
  const store = getStore();
  const user = store.users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
  let devToken: string | null = null;
  if (user) {
    devToken = crypto.randomBytes(16).toString('hex');
    store.passwordResetTokens.push({
      tokenHash: hashToken(devToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      used: false,
    });
    persistStore();
  }
  ok(
    res,
    {
      requested: true,
      devResetToken: process.env.NODE_ENV === 'production' ? undefined : devToken,
    },
    'If the institutional email exists, password reset instructions have been issued.'
  );
});

apiRouter.post('/auth/reset-password', rateLimit(10, 60_000), (req, res) => {
  const { token, newPassword } = req.body ?? {};
  if (!token || !newPassword || String(newPassword).length < 8) {
    fail(res, 400, 'Valid reset token and password (min 8 chars) are required.');
    return;
  }
  const store = getStore();
  const rec = store.passwordResetTokens.find(
    (t) => t.tokenHash === hashToken(String(token)) && !t.used && new Date(t.expiresAt).getTime() > Date.now()
  );
  if (!rec) {
    fail(res, 400, 'Reset token is invalid or expired.');
    return;
  }
  const user = store.users.find((u) => u.id === rec.userId);
  if (!user) {
    fail(res, 404, 'User not found.');
    return;
  }
  user.passwordHash = bcrypt.hashSync(String(newPassword), 10);
  rec.used = true;
  persistStore();
  ok(res, { reset: true }, 'Password updated successfully.');
});

apiRouter.get('/auth/me', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  const user = store.users.find((u) => u.id === req.user!.id);
  if (!user) {
    fail(res, 404, 'User not found.');
    return;
  }
  ok(res, sanitizeUser(user));
});

// ======================================================
// USERS & DIGITAL LIBRARY CARD
// ======================================================
apiRouter.get('/users/me/digital-card', authenticate, async (req: AuthedRequest, res) => {
  const store = getStore();
  const user = store.users.find((u) => u.id === req.user!.id)!;
  const branch = store.branches.find((b) => b.id === user.branchId) ?? null;
  const qrDataUrl = await QRCode.toDataURL(user.digitalCardQrToken, {
    width: 220,
    margin: 1,
    color: { dark: '#252720', light: '#FFFFFF' },
  });
  const activeLoans = store.bookIssues.filter(
    (i) => i.memberId === user.id && (i.status === 'ACTIVE' || i.status === 'OVERDUE')
  ).length;
  const pendingFines = store.fines
    .filter((f) => f.memberId === user.id && (f.status === 'PENDING' || f.status === 'PARTIALLY_PAID'))
    .reduce((acc, f) => acc + Math.max(0, f.amount - f.paidAmount - f.waivedAmount), 0);

  ok(res, {
    user: sanitizeUser(user),
    branchName: branch?.name ?? 'All Institutional Branches',
    qrToken: user.digitalCardQrToken,
    qrDataUrl,
    activeLoans,
    pendingFines: Number(pendingFines.toFixed(2)),
  });
});

apiRouter.put('/users/me/profile', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  const user = store.users.find((u) => u.id === req.user!.id)!;
  const { fullName, department, accessibilityPrefs } = req.body ?? {};
  if (fullName?.trim()) user.fullName = String(fullName).trim();
  if (department?.trim()) user.department = String(department).trim();
  if (accessibilityPrefs) {
    user.accessibilityPrefs = {
      fontSize: ['sm', 'md', 'lg'].includes(accessibilityPrefs.fontSize)
        ? accessibilityPrefs.fontSize
        : user.accessibilityPrefs.fontSize,
      highContrast: Boolean(accessibilityPrefs.highContrast),
    };
  }
  persistStore();
  ok(res, sanitizeUser(user), 'Profile updated.');
});

apiRouter.get(
  '/users',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'),
  (req: AuthedRequest, res) => {
    const store = getStore();
    const { role, branchId, search } = req.query;
    let list = store.users;

    if (req.user!.role === 'BRANCH_ADMIN' || req.user!.role === 'LIBRARIAN') {
      list = list.filter((u) => u.branchId === req.user!.branchId);
    } else if (branchId) {
      list = list.filter((u) => u.branchId === String(branchId));
    }
    if (role) list = list.filter((u) => u.role === String(role));
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        (u) =>
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.institutionalId.toLowerCase().includes(q)
      );
    }

    ok(
      res,
      list.map((u) => ({
        ...sanitizeUser(u),
        activeBorrowings: store.bookIssues.filter(
          (i) => i.memberId === u.id && (i.status === 'ACTIVE' || i.status === 'OVERDUE')
        ).length,
      }))
    );
  }
);

apiRouter.post(
  '/users',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN'),
  (req: AuthedRequest, res) => {
    const { fullName, email, password, role, branchId, department } = req.body ?? {};
    if (!fullName?.trim() || !email?.trim() || !role) {
      fail(res, 400, 'Full name, email, and role are required.');
      return;
    }
    const targetRole = role as UserRole;
    if (req.user!.role === 'BRANCH_ADMIN' && targetRole !== 'LIBRARIAN') {
      fail(res, 403, 'Branch Admins can only create Librarian accounts for their assigned branch.');
      return;
    }
    const targetBranch =
      req.user!.role === 'BRANCH_ADMIN' ? req.user!.branchId : branchId || null;
    const store = getStore();
    if (store.users.some((u) => u.email.toLowerCase() === String(email).toLowerCase())) {
      fail(res, 409, 'Email already registered.');
      return;
    }
    const instId = `${targetRole.slice(0, 3)}-${Math.floor(1000 + Math.random() * 8999)}`;
    const created = {
      id: uid('u'),
      institutionalId: instId,
      email: String(email).trim().toLowerCase(),
      passwordHash: bcrypt.hashSync(String(password || 'SmartLib@2026'), 10),
      fullName: String(fullName).trim(),
      role: targetRole,
      branchId: targetBranch,
      department: String(department || 'Library Services').trim(),
      accountStatus: 'ACTIVE' as const,
      emailVerified: true,
      borrowingRestricted: false,
      customBorrowLimit: null,
      digitalCardQrToken: `SL-CARD-${instId}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      enrolledCourseIds: [],
      accessibilityPrefs: { fontSize: 'md' as const, highContrast: false },
      createdAt: new Date().toISOString(),
    };
    store.users.push(created);
    addAuditLog(store, {
      actorUserId: req.user!.id,
      actorName: req.user!.fullName,
      actorRole: req.user!.role,
      branchId: targetBranch,
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: created.id,
      summary: `Created ${created.role} account for ${created.fullName} (${created.email}).`,
    });
    persistStore();
    res.status(201).json({ success: true, data: sanitizeUser(created), message: 'User created.' });
  }
);

apiRouter.put(
  '/users/:id/status',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'),
  (req: AuthedRequest, res) => {
    const store = getStore();
    const target = store.users.find((u) => u.id === req.params.id);
    if (!target) {
      fail(res, 404, 'User not found.');
      return;
    }
    if (req.user!.role !== 'SUPER_ADMIN' && target.branchId !== req.user!.branchId) {
      fail(res, 403, 'Cross-branch member modification denied.');
      return;
    }
    const { accountStatus, borrowingRestricted, customBorrowLimit } = req.body ?? {};
    if (accountStatus) target.accountStatus = accountStatus;
    if (typeof borrowingRestricted === 'boolean') target.borrowingRestricted = borrowingRestricted;
    if (customBorrowLimit !== undefined) {
      target.customBorrowLimit = customBorrowLimit === null ? null : Number(customBorrowLimit);
    }
    addAuditLog(store, {
      actorUserId: req.user!.id,
      actorName: req.user!.fullName,
      actorRole: req.user!.role,
      branchId: target.branchId,
      action: 'USER_STATUS_UPDATED',
      entityType: 'USER',
      entityId: target.id,
      summary: `Updated member ${target.fullName} (status=${target.accountStatus}, restricted=${target.borrowingRestricted}).`,
    });
    persistStore();
    ok(res, sanitizeUser(target), 'Member status updated.');
  }
);

// ======================================================
// BOOKS & PHYSICAL COPIES (CATALOG & INVENTORY)
// ======================================================
apiRouter.get('/books', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  const { search, category, author, language, availability, branchId, includeArchived } = req.query;

  let list = store.books
    .filter((b) => (includeArchived === 'true' ? true : !b.archived))
    .map(enrichBook);

  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.authors.some((a) => a.toLowerCase().includes(q)) ||
        b.tags.some((t) => t.toLowerCase().includes(q))
    );
  }
  if (category && category !== 'ALL') {
    list = list.filter((b) => b.category === String(category));
  }
  if (author) {
    const aq = String(author).toLowerCase();
    list = list.filter((b) => b.authors.some((a) => a.toLowerCase().includes(aq)));
  }
  if (language && language !== 'ALL') {
    list = list.filter((b) => b.language === String(language));
  }
  if (availability === 'AVAILABLE') {
    list = list.filter((b) => b.availableCopies > 0);
  } else if (availability === 'UNAVAILABLE') {
    list = list.filter((b) => b.availableCopies === 0);
  }
  if (branchId && branchId !== 'ALL') {
    list = list.filter((b) =>
      store.bookCopies.some((c) => c.bookId === b.id && c.branchId === String(branchId) && c.status !== 'ARCHIVED')
    );
  }

  ok(res, list, 'Catalog retrieved.', { totalElements: list.length });
});

apiRouter.get('/books/:id', authenticate, async (req: AuthedRequest, res) => {
  const store = getStore();
  const book = store.books.find((b) => b.id === req.params.id);
  if (!book) {
    fail(res, 404, 'Book not found.');
    return;
  }
  const copies = await Promise.all(
    store.bookCopies
      .filter((c) => c.bookId === book.id && c.status !== 'ARCHIVED')
      .map(async (c) => {
        const branch = store.branches.find((br) => br.id === c.branchId);
        const qrDataUrl = await QRCode.toDataURL(c.qrToken, {
          width: 140,
          margin: 1,
          color: { dark: '#252720', light: '#FFFFFF' },
        });
        return { ...c, branchName: branch?.name ?? 'Unknown Branch', qrDataUrl };
      })
  );

  ok(res, { ...enrichBook(book), copies });
});

apiRouter.post(
  '/books',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'),
  (req: AuthedRequest, res) => {
    const {
      isbn,
      title,
      authors,
      publisher,
      category,
      genre,
      edition,
      language,
      publicationYear,
      pages,
      description,
      tags,
      initialCopies,
      branchId,
      floor,
      section,
      rack,
      shelf,
    } = req.body ?? {};

    if (!isbn?.trim() || !title?.trim() || !category?.trim()) {
      fail(res, 400, 'ISBN, title, and category are required.');
      return;
    }
    const store = getStore();
    if (store.books.some((b) => b.isbn === String(isbn).trim())) {
      fail(res, 409, 'A book with this ISBN already exists.');
      return;
    }

    const authorList = Array.isArray(authors)
      ? authors.map(String).filter(Boolean)
      : String(authors || 'Unknown Author')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
    const tagList = Array.isArray(tags)
      ? tags.map(String).filter(Boolean)
      : String(tags || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

    const newBook = {
      id: uid('bk'),
      isbn: String(isbn).trim(),
      title: String(title).trim(),
      authors: authorList,
      publisher: String(publisher || 'University Press').trim(),
      category: String(category).trim(),
      genre: String(genre || category).trim(),
      edition: String(edition || '1st ed.').trim(),
      language: String(language || 'English').trim(),
      publicationYear: Number(publicationYear) || 2026,
      pages: Number(pages) || 320,
      description: String(description || 'Institutional catalog monograph.').trim(),
      coverAccent: '#526B50',
      tags: tagList,
      archived: false,
      createdAt: new Date().toISOString(),
    };
    store.books.unshift(newBook);

    const targetBranchId =
      req.user!.role === 'SUPER_ADMIN' ? branchId || 'br-central' : req.user!.branchId || 'br-central';
    const branchCode = store.branches.find((b) => b.id === targetBranchId)?.code.split('-')[0] || 'MAIN';
    const copyCount = Math.max(0, Math.min(25, Number(initialCopies) || 1));

    for (let i = 1; i <= copyCount; i++) {
      const codeNum = Math.floor(1000 + Math.random() * 8999);
      store.bookCopies.push({
        id: uid('cp'),
        copyCode: `${branchCode}-${newBook.category.slice(0, 2).toUpperCase()}-${codeNum}`,
        bookId: newBook.id,
        barcode: `BC-${newBook.isbn.replace(/[^0-9]/g, '')}-0${i}`,
        qrToken: `QR-${uid('cp').toUpperCase()}`,
        branchId: targetBranchId,
        location: {
          floor: Number(floor) || 2,
          section: String(section || newBook.category),
          rack: String(rack || 'A'),
          shelf: String(shelf || '01'),
        },
        status: 'AVAILABLE',
        condition: 'NEW',
        acquisitionDate: new Date().toISOString(),
        lastVerifiedAt: new Date().toISOString(),
      });
    }

    addAuditLog(store, {
      actorUserId: req.user!.id,
      actorName: req.user!.fullName,
      actorRole: req.user!.role,
      branchId: targetBranchId,
      action: 'BOOK_CREATED',
      entityType: 'BOOK',
      entityId: newBook.id,
      summary: `Added "${newBook.title}" (${newBook.isbn}) with ${copyCount} physical copy(ies).`,
    });
    persistStore();
    res.status(201).json({ success: true, data: enrichBook(newBook), message: 'Book added to catalog.' });
  }
);

apiRouter.put(
  '/books/:id',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'),
  (req: AuthedRequest, res) => {
    const store = getStore();
    const book = store.books.find((b) => b.id === req.params.id);
    if (!book) {
      fail(res, 404, 'Book not found.');
      return;
    }
    const { title, publisher, category, edition, language, publicationYear, description, archived } =
      req.body ?? {};
    if (title?.trim()) book.title = String(title).trim();
    if (publisher?.trim()) book.publisher = String(publisher).trim();
    if (category?.trim()) book.category = String(category).trim();
    if (edition?.trim()) book.edition = String(edition).trim();
    if (language?.trim()) book.language = String(language).trim();
    if (publicationYear) book.publicationYear = Number(publicationYear);
    if (description !== undefined) book.description = String(description);
    if (typeof archived === 'boolean') book.archived = archived;
    persistStore();
    ok(res, enrichBook(book), 'Book updated.');
  }
);

apiRouter.delete(
  '/books/:id',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'),
  (req: AuthedRequest, res) => {
    const store = getStore();
    const book = store.books.find((b) => b.id === req.params.id);
    if (!book) {
      fail(res, 404, 'Book not found.');
      return;
    }
    book.archived = true;
    addAuditLog(store, {
      actorUserId: req.user!.id,
      actorName: req.user!.fullName,
      actorRole: req.user!.role,
      branchId: req.user!.branchId,
      action: 'BOOK_ARCHIVED',
      entityType: 'BOOK',
      entityId: book.id,
      summary: `Archived catalog entry "${book.title}".`,
    });
    persistStore();
    ok(res, { id: book.id, archived: true }, 'Book archived.');
  }
);

apiRouter.post(
  '/books/import-csv',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'),
  (req: AuthedRequest, res) => {
    const { csvText } = req.body ?? {};
    if (!csvText?.trim()) {
      fail(res, 400, 'CSV content is required (columns: isbn,title,author,publisher,category,year).');
      return;
    }
    const store = getStore();
    const lines = String(csvText)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const dataLines = lines[0]?.toLowerCase().includes('isbn') ? lines.slice(1) : lines;
    const imported: string[] = [];
    const targetBranchId = req.user!.branchId || 'br-central';

    for (const line of dataLines) {
      const [isbn, title, author, publisher, category, year] = line.split(',').map((s) => s?.trim());
      if (!isbn || !title) continue;
      if (store.books.some((b) => b.isbn === isbn)) continue;
      const bkId = uid('bk');
      store.books.unshift({
        id: bkId,
        isbn,
        title,
        authors: [author || 'Institutional Author'],
        publisher: publisher || 'Academic Press',
        category: category || 'General',
        genre: category || 'General',
        edition: '1st ed.',
        language: 'English',
        publicationYear: Number(year) || 2026,
        pages: 300,
        description: 'Imported via institutional batch CSV catalog loader.',
        coverAccent: '#526B50',
        tags: [category || 'Academic'],
        archived: false,
        createdAt: new Date().toISOString(),
      });
      store.bookCopies.push({
        id: uid('cp'),
        copyCode: `CSV-${Math.floor(1000 + Math.random() * 8999)}`,
        bookId: bkId,
        barcode: `BC-${isbn.replace(/[^0-9]/g, '')}-01`,
        qrToken: `QR-${uid('cp').toUpperCase()}`,
        branchId: targetBranchId,
        location: { floor: 1, section: category || 'General', rack: 'A', shelf: '01' },
        status: 'AVAILABLE',
        condition: 'NEW',
        acquisitionDate: new Date().toISOString(),
        lastVerifiedAt: new Date().toISOString(),
      });
      imported.push(title);
    }
    persistStore();
    ok(res, { importedCount: imported.length, titles: imported }, `Imported ${imported.length} book(s).`);
  }
);

apiRouter.get(
  '/copies',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'),
  (req: AuthedRequest, res) => {
    const store = getStore();
    let list = store.bookCopies;
    if (req.user!.role !== 'SUPER_ADMIN') {
      list = list.filter((c) => c.branchId === req.user!.branchId);
    } else if (req.query.branchId && req.query.branchId !== 'ALL') {
      list = list.filter((c) => c.branchId === String(req.query.branchId));
    }
    if (req.query.status && req.query.status !== 'ALL') {
      list = list.filter((c) => c.status === String(req.query.status));
    }

    const enriched = list.map((c) => {
      const book = store.books.find((b) => b.id === c.bookId);
      const branch = store.branches.find((b) => b.id === c.branchId);
      return {
        ...c,
        bookTitle: book?.title ?? 'Unknown',
        isbn: book?.isbn ?? '',
        branchName: branch?.name ?? '',
      };
    });
    ok(res, enriched);
  }
);

apiRouter.post(
  '/copies',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'),
  (req: AuthedRequest, res) => {
    const { bookId, branchId, floor, section, rack, shelf, condition } = req.body ?? {};
    const store = getStore();
    const book = store.books.find((b) => b.id === bookId);
    if (!book) {
      fail(res, 404, 'Book not found.');
      return;
    }
    const targetBranch =
      req.user!.role === 'SUPER_ADMIN' ? branchId || 'br-central' : req.user!.branchId!;
    const codePrefix = store.branches.find((b) => b.id === targetBranch)?.code.split('-')[0] || 'MAIN';
    const seq = store.bookCopies.filter((c) => c.bookId === book.id).length + 1;

    const newCopy = {
      id: uid('cp'),
      copyCode: `${codePrefix}-${book.category.slice(0, 2).toUpperCase()}-${Math.floor(1000 + Math.random() * 8999)}`,
      bookId: book.id,
      barcode: `BC-${book.isbn.replace(/[^0-9]/g, '')}-${String(seq).padStart(2, '0')}`,
      qrToken: `QR-${uid('cp').toUpperCase()}`,
      branchId: targetBranch,
      location: {
        floor: Number(floor) || 1,
        section: String(section || book.category),
        rack: String(rack || 'A'),
        shelf: String(shelf || '01'),
      },
      status: 'AVAILABLE' as const,
      condition: (condition || 'NEW') as 'NEW' | 'GOOD' | 'FAIR' | 'WORN' | 'DAMAGED',
      acquisitionDate: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
    };
    store.bookCopies.unshift(newCopy);
    // Automatically fulfill next FIFO reservation if waiting at this branch
    allocateCopyToNextReservation(book.id, targetBranch, newCopy.id);
    persistStore();
    res.status(201).json({ success: true, data: newCopy, message: 'Physical copy registered.' });
  }
);

apiRouter.put(
  '/copies/:id',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'),
  (req: AuthedRequest, res) => {
    const store = getStore();
    const copy = store.bookCopies.find((c) => c.id === req.params.id);
    if (!copy) {
      fail(res, 404, 'Physical copy not found.');
      return;
    }
    if (!hasBranchPermission(req.user!, copy.branchId)) {
      fail(res, 403, 'Branch access denied for this physical copy.');
      return;
    }
    const { floor, section, rack, shelf, condition, status } = req.body ?? {};
    if (floor !== undefined) copy.location.floor = Number(floor);
    if (section) copy.location.section = String(section);
    if (rack) copy.location.rack = String(rack);
    if (shelf) copy.location.shelf = String(shelf);
    if (condition) copy.condition = condition;
    if (status && status !== 'ISSUED') copy.status = status;
    copy.lastVerifiedAt = new Date().toISOString();
    persistStore();
    ok(res, copy, 'Copy metadata and shelf location updated.');
  }
);

// ======================================================
// SMART CIRCULATION (ISSUE, RETURN, RENEW, HISTORY)
// ======================================================
apiRouter.post('/circulation/issue', authenticate, (req: AuthedRequest, res) => {
  const { bookId, copyId, copyCode, memberId } = req.body ?? {};
  const store = getStore();

  const isStaff = ['SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'].includes(req.user!.role);
  const targetMemberId = isStaff && memberId ? String(memberId) : req.user!.id;
  const member = store.users.find(
    (u) => u.id === targetMemberId || u.institutionalId === targetMemberId || u.digitalCardQrToken === targetMemberId
  );
  if (!member) {
    fail(res, 404, 'Member account not found.');
    return;
  }
  if (member.borrowingRestricted || member.accountStatus !== 'ACTIVE') {
    fail(res, 403, 'Member borrowing privileges are currently restricted.', 'BORROWING_RESTRICTED');
    return;
  }

  let copy = copyId
    ? store.bookCopies.find((c) => c.id === copyId)
    : copyCode
      ? store.bookCopies.find(
          (c) =>
            c.copyCode.toLowerCase() === String(copyCode).toLowerCase() ||
            c.barcode.toLowerCase() === String(copyCode).toLowerCase() ||
            c.qrToken.toLowerCase() === String(copyCode).toLowerCase()
        )
      : store.bookCopies.find((c) => c.bookId === bookId && c.status === 'AVAILABLE');

  if (!copy) {
    fail(res, 409, 'No available physical copy found for issuing. Consider placing a FIFO reservation.');
    return;
  }

  if (isStaff && req.user!.role !== 'SUPER_ADMIN' && !hasBranchPermission(req.user!, copy.branchId)) {
    fail(res, 403, 'Cannot issue a copy belonging to another branch.');
    return;
  }

  // Check if copy is held for this member's READY_FOR_PICKUP reservation
  const memberReadyRes = store.reservations.find(
    (r) => r.allocatedCopyId === copy!.id && r.memberId === member.id && r.status === 'READY_FOR_PICKUP'
  );
  if (copy.status === 'DAMAGED' || copy.status === 'LOST') {
    fail(res, 409, 'Damaged or lost copies cannot be issued.');
    return;
  }
  if (copy.status !== 'AVAILABLE' && !memberReadyRes) {
    fail(res, 409, `Physical copy ${copy.copyCode} is currently ${copy.status} and cannot be issued.`);
    return;
  }

  // Enforce active duplicate issue check on same copy
  if (store.bookIssues.some((i) => i.copyId === copy!.id && (i.status === 'ACTIVE' || i.status === 'OVERDUE'))) {
    fail(res, 409, 'Physical copy already has an active circulation record.');
    return;
  }

  const policy = resolvePolicy(store, copy.branchId);
  const roleKey = member.role === 'FACULTY' ? 'FACULTY' : 'STUDENT';
  const rolePol = policy.rolePolicies[roleKey];
  const maxBooks = member.customBorrowLimit ?? rolePol.maxBooks;
  const activeCount = store.bookIssues.filter(
    (i) => i.memberId === member.id && (i.status === 'ACTIVE' || i.status === 'OVERDUE')
  ).length;

  if (activeCount >= maxBooks) {
    fail(res, 409, `Borrowing limit reached (${activeCount}/${maxBooks} active volumes).`, 'LIMIT_REACHED');
    return;
  }

  const now = new Date();
  const dueDate = new Date(now.getTime() + rolePol.borrowDays * 86400000);
  const receiptNumber = `ISS-2026-${Math.floor(1000 + Math.random() * 8999)}`;

  const issue = {
    id: uid('iss'),
    receiptNumber,
    bookId: copy.bookId,
    copyId: copy.id,
    branchId: copy.branchId,
    memberId: member.id,
    issuedByUserId: req.user!.id,
    issueDate: now.toISOString(),
    dueDate: dueDate.toISOString(),
    returnedAt: null,
    renewalCount: 0,
    maxRenewals: rolePol.maxRenewals,
    status: 'ACTIVE' as const,
    completionConfirmed: false,
    completedAt: null,
  };

  copy.status = 'ISSUED';
  if (memberReadyRes) {
    memberReadyRes.status = 'FULFILLED';
    memberReadyRes.fulfilledAt = now.toISOString();
  }
  store.bookIssues.unshift(issue);

  const book = store.books.find((b) => b.id === copy!.bookId);
  addNotification(store, {
    userId: member.id,
    branchId: copy.branchId,
    type: 'ISSUE_SUCCESS',
    title: 'Book Issued Successfully',
    message: `"${book?.title}" (${copy.copyCode}) issued. Receipt ${receiptNumber}. Due on ${formatIndianDate(dueDate)}.`,
    idempotencyKey: `ISSUE:${issue.id}`,
  });
  addAuditLog(store, {
    actorUserId: req.user!.id,
    actorName: req.user!.fullName,
    actorRole: req.user!.role,
    branchId: copy.branchId,
    action: 'BOOK_ISSUED',
    entityType: 'BOOK_ISSUE',
    entityId: issue.id,
    summary: `Issued "${book?.title}" (${copy.copyCode}) to ${member.fullName}. Receipt ${receiptNumber}.`,
  });
  persistStore();

  res.status(201).json({
    success: true,
    message: `Issued successfully. Receipt ${receiptNumber}.`,
    data: {
      ...issue,
      bookTitle: book?.title,
      copyCode: copy.copyCode,
      memberName: member.fullName,
    },
  });
});

apiRouter.post('/circulation/return', authenticate, (req: AuthedRequest, res) => {
  const { issueId, copyCode, conditionOnReturn, notes } = req.body ?? {};
  const store = getStore();

  let issue = issueId
    ? store.bookIssues.find((i) => i.id === issueId && (i.status === 'ACTIVE' || i.status === 'OVERDUE'))
    : undefined;

  if (!issue && copyCode) {
    const copy = store.bookCopies.find(
      (c) =>
        c.copyCode.toLowerCase() === String(copyCode).toLowerCase() ||
        c.barcode.toLowerCase() === String(copyCode).toLowerCase() ||
        c.qrToken.toLowerCase() === String(copyCode).toLowerCase()
    );
    if (copy) {
      issue = store.bookIssues.find(
        (i) => i.copyId === copy.id && (i.status === 'ACTIVE' || i.status === 'OVERDUE')
      );
    }
  }

  if (!issue) {
    fail(res, 404, 'Active circulation record not found for return.');
    return;
  }

  const isStaff = ['SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'].includes(req.user!.role);
  if (!isStaff && issue.memberId !== req.user!.id) {
    fail(res, 403, 'Unauthorized return request.');
    return;
  }
  if (isStaff && req.user!.role !== 'SUPER_ADMIN' && !hasBranchPermission(req.user!, issue.branchId)) {
    fail(res, 403, 'Cannot process return for another branch.');
    return;
  }

  const copy = store.bookCopies.find((c) => c.id === issue!.copyId)!;
  const book = store.books.find((b) => b.id === issue!.bookId);
  const policy = resolvePolicy(store, issue.branchId);
  const nowIso = new Date().toISOString();

  const fineCalc = calculateOverdueFine({
    dueDateIso: issue.dueDate,
    returnedAtIso: nowIso,
    gracePeriodDays: policy.gracePeriodDays,
    finePerDay: policy.finePerDay,
    maxFineAmount: policy.maxFineAmount,
  });

  issue.status = 'RETURNED';
  issue.returnedAt = nowIso;

  const returnCond = conditionOnReturn || copy.condition || 'GOOD';
  copy.condition = returnCond;
  copy.status = returnCond === 'DAMAGED' ? 'DAMAGED' : 'AVAILABLE';

  let generatedFine = null;
  if (fineCalc.fineAmount > 0) {
    const existingPending = store.fines.find((f) => f.issueId === issue!.id && f.reason === 'OVERDUE');
    if (existingPending) {
      existingPending.amount = fineCalc.fineAmount;
      generatedFine = existingPending;
    } else {
      generatedFine = {
        id: uid('fn'),
        issueId: issue.id,
        memberId: issue.memberId,
        branchId: issue.branchId,
        reason: 'OVERDUE' as const,
        currency: 'INR' as const,
        amount: fineCalc.fineAmount,
        paidAmount: 0,
        waivedAmount: 0,
        status: 'PENDING' as const,
        waiverReason: null,
        waivedByUserId: null,
        assessedAt: nowIso,
        settledAt: null,
      };
      store.fines.unshift(generatedFine);
    }
  }

  const returnReceiptNumber = `RET-2026-${Math.floor(1000 + Math.random() * 8999)}`;
  const returnRecord = {
    id: uid('ret'),
    returnReceiptNumber,
    issueId: issue.id,
    copyId: copy.id,
    bookId: issue.bookId,
    branchId: issue.branchId,
    memberId: issue.memberId,
    processedByUserId: req.user!.id,
    returnedAt: nowIso,
    conditionOnReturn: returnCond,
    overdueDays: fineCalc.rawOverdueDays,
    fineGeneratedAmount: fineCalc.fineAmount,
    notes: String(notes || '').trim(),
  };
  store.bookReturns.unshift(returnRecord);

  // Automatic FIFO reservation allocation if copy is healthy
  let allocatedReservation = null;
  if (copy.status === 'AVAILABLE') {
    allocatedReservation = allocateCopyToNextReservation(copy.bookId, copy.branchId, copy.id);
  }

  addNotification(store, {
    userId: issue.memberId,
    branchId: issue.branchId,
    type: 'RETURN_SUCCESS',
    title: 'Book Return Confirmed',
    message: `"${book?.title}" (${copy.copyCode}) returned. Receipt ${returnReceiptNumber}.${fineCalc.fineAmount > 0 ? ` Overdue fine assessed: ${formatINR(fineCalc.fineAmount)}.` : ''}`,
    idempotencyKey: `RETURN:${returnRecord.id}`,
  });
  addAuditLog(store, {
    actorUserId: req.user!.id,
    actorName: req.user!.fullName,
    actorRole: req.user!.role,
    branchId: issue.branchId,
    action: 'BOOK_RETURNED',
    entityType: 'BOOK_RETURN',
    entityId: returnRecord.id,
    summary: `Returned ${copy.copyCode} (${book?.title}). Overdue days: ${fineCalc.rawOverdueDays}. Fine: ${formatINR(fineCalc.fineAmount)}.${allocatedReservation ? ' Allocated to next FIFO reservation.' : ''}`,
  });
  persistStore();

  ok(
    res,
    {
      returnRecord,
      fine: generatedFine,
      allocatedToReservation: allocatedReservation?.id ?? null,
    },
    `Return processed. Receipt ${returnReceiptNumber}.`
  );
});

apiRouter.post('/circulation/renew', authenticate, (req: AuthedRequest, res) => {
  const { issueId } = req.body ?? {};
  const store = getStore();
  const issue = store.bookIssues.find((i) => i.id === issueId);
  if (!issue || (issue.status !== 'ACTIVE' && issue.status !== 'OVERDUE')) {
    fail(res, 404, 'Eligible active borrowing record not found.');
    return;
  }
  const isStaff = ['SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'].includes(req.user!.role);
  if (!isStaff && issue.memberId !== req.user!.id) {
    fail(res, 403, 'You can only renew your own borrowings.');
    return;
  }
  if (issue.renewalCount >= issue.maxRenewals) {
    fail(res, 409, `Renewal limit reached (${issue.renewalCount}/${issue.maxRenewals}).`);
    return;
  }
  const hasWaitingQueue = store.reservations.some(
    (r) => r.bookId === issue.bookId && r.branchId === issue.branchId && r.status === 'WAITING'
  );
  if (hasWaitingQueue) {
    fail(res, 409, 'Cannot renew this title while other institutional members are waiting in the reservation queue.');
    return;
  }

  const policy = resolvePolicy(store, issue.branchId);
  const member = store.users.find((u) => u.id === issue.memberId);
  const extendDays = policy.rolePolicies[member?.role === 'FACULTY' ? 'FACULTY' : 'STUDENT'].borrowDays;
  const baseMs = Math.max(Date.now(), new Date(issue.dueDate).getTime());
  issue.dueDate = new Date(baseMs + extendDays * 86400000).toISOString();
  issue.renewalCount += 1;
  issue.status = 'ACTIVE';
  persistStore();

  ok(res, issue, `Renewed until ${formatIndianDate(issue.dueDate)}.`);
});

apiRouter.post('/circulation/confirm-completion', authenticate, (req: AuthedRequest, res) => {
  const { issueId } = req.body ?? {};
  const store = getStore();
  const issue = store.bookIssues.find((i) => i.id === issueId && i.memberId === req.user!.id);
  if (!issue) {
    fail(res, 404, 'Borrowing record not found.');
    return;
  }
  issue.completionConfirmed = true;
  issue.completedAt = new Date().toISOString();
  persistStore();
  ok(res, issue, 'Reading completion verified and recorded for Reading DNA & Challenges.');
});

apiRouter.get('/circulation/history', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  const isStaff = ['SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'].includes(req.user!.role);
  let list = store.bookIssues;

  if (!isStaff || req.query.mine === 'true') {
    list = list.filter((i) => i.memberId === req.user!.id);
  } else if (req.user!.role !== 'SUPER_ADMIN') {
    list = list.filter((i) => i.branchId === req.user!.branchId);
  }
  if (req.query.status && req.query.status !== 'ALL') {
    list = list.filter((i) => i.status === String(req.query.status));
  }

  const enriched = list.map((i) => {
    const book = store.books.find((b) => b.id === i.bookId);
    const copy = store.bookCopies.find((c) => c.id === i.copyId);
    const member = store.users.find((u) => u.id === i.memberId);
    const branch = store.branches.find((b) => b.id === i.branchId);
    const policy = resolvePolicy(store, i.branchId);
    const liveOverdue =
      i.status === 'ACTIVE' || i.status === 'OVERDUE'
        ? calculateOverdueFine({
            dueDateIso: i.dueDate,
            returnedAtIso: new Date().toISOString(),
            gracePeriodDays: policy.gracePeriodDays,
            finePerDay: policy.finePerDay,
            maxFineAmount: policy.maxFineAmount,
          })
        : { rawOverdueDays: 0, billableOverdueDays: 0, fineAmount: 0 };

    return {
      ...i,
      bookTitle: book?.title ?? 'Unknown',
      bookAuthors: book?.authors ?? [],
      isbn: book?.isbn ?? '',
      category: book?.category ?? '',
      copyCode: copy?.copyCode ?? '',
      memberName: member?.fullName ?? '',
      memberInstitutionalId: member?.institutionalId ?? '',
      branchName: branch?.name ?? '',
      overdueDays: liveOverdue.rawOverdueDays,
      estimatedFine: liveOverdue.fineAmount,
    };
  });

  ok(res, enriched);
});

// ======================================================
// SMART FIFO RESERVATIONS
// ======================================================
apiRouter.post('/reservations', authenticate, (req: AuthedRequest, res) => {
  const { bookId, branchId } = req.body ?? {};
  const store = getStore();
  const book = store.books.find((b) => b.id === bookId && !b.archived);
  if (!book) {
    fail(res, 404, 'Book not found.');
    return;
  }

  const targetBranch = branchId || req.user!.branchId || 'br-central';
  const availableInBranch = store.bookCopies.some(
    (c) => c.bookId === book.id && c.branchId === targetBranch && c.status === 'AVAILABLE'
  );
  if (availableInBranch) {
    fail(
      res,
      409,
      'A physical copy is currently available at this branch. You can borrow it directly instead of reserving.'
    );
    return;
  }

  const duplicate = store.reservations.some(
    (r) =>
      r.bookId === book.id &&
      r.branchId === targetBranch &&
      r.memberId === req.user!.id &&
      (r.status === 'WAITING' || r.status === 'READY_FOR_PICKUP')
  );
  if (duplicate) {
    fail(res, 409, 'You already hold an active reservation for this title at this branch.');
    return;
  }

  const created = {
    id: uid('res'),
    bookId: book.id,
    branchId: targetBranch,
    memberId: req.user!.id,
    status: 'WAITING' as const,
    allocatedCopyId: null,
    queuedAt: new Date().toISOString(),
    allocatedAt: null,
    expiresAt: null,
    fulfilledAt: null,
  };
  store.reservations.push(created);
  const queuePosition = computeQueuePosition(store.reservations, created.id);
  persistStore();

  res.status(201).json({
    success: true,
    message: `Added to FIFO reservation queue at position #${queuePosition}.`,
    data: { ...created, queuePosition },
  });
});

apiRouter.get('/reservations/my', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  const list = store.reservations
    .filter((r) => r.memberId === req.user!.id)
    .map((r) => {
      const book = store.books.find((b) => b.id === r.bookId);
      const branch = store.branches.find((b) => b.id === r.branchId);
      const copy = r.allocatedCopyId ? store.bookCopies.find((c) => c.id === r.allocatedCopyId) : null;
      return {
        ...r,
        bookTitle: book?.title ?? '',
        isbn: book?.isbn ?? '',
        branchName: branch?.name ?? '',
        allocatedCopyCode: copy?.copyCode ?? null,
        queuePosition: computeQueuePosition(store.reservations, r.id),
      };
    });
  ok(res, list);
});

apiRouter.get(
  '/reservations',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'),
  (req: AuthedRequest, res) => {
    const store = getStore();
    let list = store.reservations;
    if (req.user!.role !== 'SUPER_ADMIN') {
      list = list.filter((r) => r.branchId === req.user!.branchId);
    }
    const enriched = list.map((r) => {
      const book = store.books.find((b) => b.id === r.bookId);
      const member = store.users.find((u) => u.id === r.memberId);
      const branch = store.branches.find((b) => b.id === r.branchId);
      return {
        ...r,
        bookTitle: book?.title ?? '',
        memberName: member?.fullName ?? '',
        memberInstitutionalId: member?.institutionalId ?? '',
        branchName: branch?.name ?? '',
        queuePosition: computeQueuePosition(store.reservations, r.id),
      };
    });
    ok(res, enriched);
  }
);

apiRouter.delete('/reservations/:id', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  const target = store.reservations.find((r) => r.id === req.params.id);
  if (!target) {
    fail(res, 404, 'Reservation not found.');
    return;
  }
  const isStaff = ['SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'].includes(req.user!.role);
  if (!isStaff && target.memberId !== req.user!.id) {
    fail(res, 403, 'Cannot cancel another member reservation.');
    return;
  }
  const freedCopyId = target.status === 'READY_FOR_PICKUP' ? target.allocatedCopyId : null;
  target.status = 'CANCELLED';
  target.allocatedCopyId = null;

  if (freedCopyId) {
    const copy = store.bookCopies.find((c) => c.id === freedCopyId);
    if (copy) {
      copy.status = 'AVAILABLE';
      allocateCopyToNextReservation(copy.bookId, copy.branchId, copy.id);
    }
  }
  persistStore();
  ok(res, { id: target.id, status: 'CANCELLED' }, 'Reservation cancelled.');
});

// ======================================================
// FINES & MOCK PAYMENT ADAPTER
// ======================================================
apiRouter.get('/fines', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  const isStaff = ['SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'].includes(req.user!.role);
  let list = store.fines;
  if (!isStaff || req.query.mine === 'true') {
    list = list.filter((f) => f.memberId === req.user!.id);
  } else if (req.user!.role !== 'SUPER_ADMIN') {
    list = list.filter((f) => f.branchId === req.user!.branchId);
  }

  const enriched = list.map((f) => {
    const member = store.users.find((u) => u.id === f.memberId);
    const issue = store.bookIssues.find((i) => i.id === f.issueId);
    const book = issue ? store.books.find((b) => b.id === issue.bookId) : null;
    const balance = Math.max(0, roundInrAmount(f.amount - f.paidAmount - f.waivedAmount));
    return {
      ...f,
      currency: f.currency || 'INR',
      balance,
      memberName: member?.fullName ?? '',
      memberInstitutionalId: member?.institutionalId ?? '',
      bookTitle: book?.title ?? 'Library Fine',
      receipts: store.finePayments.filter((p) => p.fineId === f.id),
    };
  });
  ok(res, enriched);
});

apiRouter.post('/fines/:id/pay', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  const fine = store.fines.find((f) => f.id === req.params.id);
  if (!fine) {
    fail(res, 404, 'Fine record not found.');
    return;
  }
  const isStaff = ['SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'].includes(req.user!.role);
  if (!isStaff && fine.memberId !== req.user!.id) {
    fail(res, 403, 'Unauthorized fine payment.');
    return;
  }
  const balance = Math.max(0, roundInrAmount(fine.amount - fine.paidAmount - fine.waivedAmount));
  if (balance <= 0) {
    fail(res, 409, 'Fine is already settled.');
    return;
  }
  if (req.body?.amount !== undefined && (!isNonNegativeMonetaryAmount(req.body.amount) || Number(req.body.amount) <= 0)) {
    fail(res, 400, 'Payment amount must be a valid positive INR value.');
    return;
  }
  const requestedAmount = req.body?.amount !== undefined ? roundInrAmount(Number(req.body.amount)) : balance;
  const payAmount = Math.min(balance, requestedAmount);
  const payment = {
    id: uid('pay'),
    receiptNumber: `PAY-MOCK-${Math.floor(10000 + Math.random() * 89999)}`,
    fineId: fine.id,
    memberId: fine.memberId,
    branchId: fine.branchId,
    currency: 'INR' as const,
    amount: roundInrAmount(payAmount),
    paymentMethod: String(req.body?.paymentMethod || 'MOCK_UPI'),
    gatewayMode: 'MOCK_DEV' as const,
    paidAt: new Date().toISOString(),
  };
  store.finePayments.unshift(payment);
  fine.currency = 'INR';
  fine.paidAmount = roundInrAmount(fine.paidAmount + payAmount);
  const remaining = Math.max(0, roundInrAmount(fine.amount - fine.paidAmount - fine.waivedAmount));
  fine.status = remaining <= 0 ? 'PAID' : 'PARTIALLY_PAID';
  if (remaining <= 0) fine.settledAt = payment.paidAt;

  addAuditLog(store, {
    actorUserId: req.user!.id,
    actorName: req.user!.fullName,
    actorRole: req.user!.role,
    branchId: fine.branchId,
    action: 'FINE_PAID_MOCK',
    entityType: 'FINE',
    entityId: fine.id,
    summary: `Recorded development mock payment of ${formatINR(payAmount)} via ${payment.paymentMethod} (Receipt ${payment.receiptNumber}).`,
  });
  persistStore();
  ok(
    res,
    { fine, payment },
    `Development mock payment of ${formatINR(payAmount)} recorded (${payment.receiptNumber}).`
  );
});

apiRouter.post(
  '/fines/:id/waive',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'),
  (req: AuthedRequest, res) => {
    const store = getStore();
    const fine = store.fines.find((f) => f.id === req.params.id);
    if (!fine) {
      fail(res, 404, 'Fine record not found.');
      return;
    }
    if (req.user!.role !== 'SUPER_ADMIN' && !hasBranchPermission(req.user!, fine.branchId)) {
      fail(res, 403, 'Branch access denied.');
      return;
    }
    const reason = String(req.body?.reason || '').trim();
    if (!reason) {
      fail(res, 400, 'Waiver justification reason is required for audit compliance.');
      return;
    }
    const remaining = Math.max(0, roundInrAmount(fine.amount - fine.paidAmount - fine.waivedAmount));
    fine.currency = 'INR';
    fine.waivedAmount = roundInrAmount(fine.waivedAmount + remaining);
    fine.waiverReason = reason;
    fine.waivedByUserId = req.user!.id;
    fine.status = 'WAIVED';
    fine.settledAt = new Date().toISOString();

    addAuditLog(store, {
      actorUserId: req.user!.id,
      actorName: req.user!.fullName,
      actorRole: req.user!.role,
      branchId: fine.branchId,
      action: 'FINE_WAIVED',
      entityType: 'FINE',
      entityId: fine.id,
      summary: `Waived ${formatINR(remaining)} fine. Reason: ${reason}`,
    });
    persistStore();
    ok(res, fine, `Fine of ${formatINR(remaining)} waived and logged in audit trail.`);
  }
);

// ======================================================
// SMART READING DNA & EXPLAINABLE RECOMMENDATIONS
// ======================================================
apiRouter.get('/reading-profile/me', authenticate, (req: AuthedRequest, res) => {
  const history = buildReadingHistoryForUser(req.user!.id);
  const dna = computeReadingDna(history);
  ok(res, dna);
});

apiRouter.get('/reading-profile/history', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  const history = store.bookIssues
    .filter((i) => i.memberId === req.user!.id)
    .map((i) => {
      const book = store.books.find((b) => b.id === i.bookId);
      return {
        issueId: i.id,
        bookId: i.bookId,
        title: book?.title ?? '',
        authors: book?.authors ?? [],
        category: book?.category ?? '',
        issueDate: i.issueDate,
        returnedAt: i.returnedAt,
        status: i.status,
        completionConfirmed: i.completionConfirmed,
      };
    });
  ok(res, history);
});

apiRouter.get('/recommendations', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  const history = buildReadingHistoryForUser(req.user!.id);
  const candidates = store.books
    .filter((b) => !b.archived)
    .map(enrichBook)
    .map((b) => ({
      id: b.id,
      title: b.title,
      authors: b.authors,
      category: b.category,
      tags: b.tags,
      availableCopies: b.availableCopies,
      borrowCount: b.borrowCount,
      publicationYear: b.publicationYear,
    }));

  const recs = generateExplainableRecommendations(candidates, history, 8).map((r) => {
    const book = enrichBook(store.books.find((b) => b.id === r.bookId)!);
    return { ...r, book };
  });

  ok(res, recs);
});

// ======================================================
// SMART SHELF LOCATOR & QR VERIFICATION
// ======================================================
apiRouter.get('/shelf/search', authenticate, async (req: AuthedRequest, res) => {
  const store = getStore();
  const q = String(req.query.q || '').trim().toLowerCase();
  let copies = store.bookCopies.filter((c) => c.status !== 'ARCHIVED');

  if (q) {
    copies = copies.filter((c) => {
      const book = store.books.find((b) => b.id === c.bookId);
      return (
        c.copyCode.toLowerCase().includes(q) ||
        c.barcode.toLowerCase().includes(q) ||
        c.qrToken.toLowerCase().includes(q) ||
        c.location.section.toLowerCase().includes(q) ||
        book?.title.toLowerCase().includes(q) ||
        book?.isbn.toLowerCase().includes(q)
      );
    });
  }

  const enriched = await Promise.all(
    copies.slice(0, 20).map(async (c) => {
      const book = store.books.find((b) => b.id === c.bookId);
      const branch = store.branches.find((b) => b.id === c.branchId);
      const qrDataUrl = await QRCode.toDataURL(c.qrToken, {
        width: 120,
        margin: 1,
        color: { dark: '#252720', light: '#FFFFFF' },
      });
      return {
        ...c,
        bookTitle: book?.title ?? '',
        bookAuthors: book?.authors ?? [],
        isbn: book?.isbn ?? '',
        branchName: branch?.name ?? '',
        qrDataUrl,
      };
    })
  );
  ok(res, enriched);
});

apiRouter.get('/shelf/location/:bookCopyId', authenticate, async (req: AuthedRequest, res) => {
  const store = getStore();
  const copy = store.bookCopies.find(
    (c) => c.id === req.params.bookCopyId || c.qrToken === req.params.bookCopyId || c.copyCode === req.params.bookCopyId
  );
  if (!copy) {
    fail(res, 404, 'Physical copy not found.');
    return;
  }
  const book = store.books.find((b) => b.id === copy.bookId);
  const branch = store.branches.find((b) => b.id === copy.branchId);
  const qrDataUrl = await QRCode.toDataURL(copy.qrToken, {
    width: 180,
    margin: 1,
    color: { dark: '#252720', light: '#FFFFFF' },
  });
  ok(res, { ...copy, bookTitle: book?.title, branchName: branch?.name, qrDataUrl });
});

apiRouter.post(
  '/shelf/verify',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'),
  (req: AuthedRequest, res) => {
    const { qrToken, misplaced, notes } = req.body ?? {};
    const store = getStore();
    const copy = store.bookCopies.find(
      (c) => c.qrToken === qrToken || c.copyCode === qrToken || c.id === qrToken
    );
    if (!copy) {
      fail(res, 404, 'No physical copy matches that QR token or copy code.');
      return;
    }
    copy.lastVerifiedAt = new Date().toISOString();
    addAuditLog(store, {
      actorUserId: req.user!.id,
      actorName: req.user!.fullName,
      actorRole: req.user!.role,
      branchId: copy.branchId,
      action: misplaced ? 'SHELF_MISPLACED_REPORTED' : 'SHELF_VERIFIED',
      entityType: 'BOOK_COPY',
      entityId: copy.id,
      summary: misplaced
        ? `Flagged misplaced copy ${copy.copyCode}. Notes: ${notes || 'Re-shelving required.'}`
        : `Verified copy ${copy.copyCode} at Floor ${copy.location.floor}, ${copy.location.section}, Rack ${copy.location.rack}, Shelf ${copy.location.shelf}.`,
    });
    persistStore();
    ok(res, copy, misplaced ? 'Misplaced volume logged for re-shelving.' : 'Shelf location verified.');
  }
);

// ======================================================
// SMART SEAT RESERVATION SYSTEM
// ======================================================
apiRouter.get('/seats', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  const branchId = String(req.query.branchId || req.user!.branchId || 'br-central');
  const date = String(req.query.date || new Date().toISOString().slice(0, 10));
  const startTime = String(req.query.startTime || '10:00');
  const endTime = String(req.query.endTime || '12:00');

  const branchSeats = store.seats.filter((s) => branchId === 'ALL' || s.branchId === branchId);
  const enriched = branchSeats.map((seat) => {
    const branch = store.branches.find((b) => b.id === seat.branchId);
    const activeBooking = store.seatReservations.find(
      (r) =>
        r.seatId === seat.id &&
        r.reservationDate === date &&
        (r.status === 'CONFIRMED' || r.status === 'CHECKED_IN') &&
        r.startTime < endTime &&
        startTime < r.endTime
    );
    let slotStatus: 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'UNAVAILABLE' = 'AVAILABLE';
    if (seat.status !== 'ACTIVE') {
      slotStatus = 'UNAVAILABLE';
    } else if (activeBooking?.status === 'CHECKED_IN') {
      slotStatus = 'OCCUPIED';
    } else if (activeBooking?.status === 'CONFIRMED') {
      slotStatus = 'RESERVED';
    }
    return {
      ...seat,
      branchName: branch?.name ?? '',
      slotStatus,
      activeReservationId: activeBooking?.id ?? null,
    };
  });

  ok(res, enriched);
});

apiRouter.post(
  '/seats',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'),
  (req: AuthedRequest, res) => {
    const { seatCode, floor, zone, row, column, amenities, branchId } = req.body ?? {};
    if (!seatCode?.trim()) {
      fail(res, 400, 'Seat code is required.');
      return;
    }
    const store = getStore();
    const targetBranch =
      req.user!.role === 'SUPER_ADMIN' ? branchId || 'br-central' : req.user!.branchId!;
    if (store.seats.some((s) => s.branchId === targetBranch && s.seatCode === seatCode.trim())) {
      fail(res, 409, 'Seat code already exists in this branch.');
      return;
    }
    const created = {
      id: uid('st'),
      branchId: targetBranch,
      seatCode: String(seatCode).trim().toUpperCase(),
      floor: Number(floor) || 1,
      zone: zone || 'QUIET_STUDY',
      row: Number(row) || 3,
      column: Number(column) || 1,
      amenities: Array.isArray(amenities) ? amenities : ['Power', 'Task Lamp'],
      status: 'ACTIVE' as const,
    };
    store.seats.push(created);
    persistStore();
    res.status(201).json({ success: true, data: created, message: 'Study seat added.' });
  }
);

apiRouter.put(
  '/seats/:id',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'),
  (req: AuthedRequest, res) => {
    const store = getStore();
    const seat = store.seats.find((s) => s.id === req.params.id);
    if (!seat) {
      fail(res, 404, 'Seat not found.');
      return;
    }
    if (!hasBranchPermission(req.user!, seat.branchId)) {
      fail(res, 403, 'Branch access denied.');
      return;
    }
    if (req.body?.status) seat.status = req.body.status;
    if (req.body?.zone) seat.zone = req.body.zone;
    persistStore();
    ok(res, seat, 'Seat updated.');
  }
);

apiRouter.post('/seats/reservations', authenticate, (req: AuthedRequest, res) => {
  const { seatId, reservationDate, startTime, endTime } = req.body ?? {};
  const store = getStore();
  const seat = store.seats.find((s) => s.id === seatId);
  if (!seat) {
    fail(res, 404, 'Study seat not found.');
    return;
  }
  if (seat.status !== 'ACTIVE') {
    fail(res, 409, 'This seat is currently unavailable or under maintenance.');
    return;
  }

  const conflict = checkSeatConflict(store.seatReservations, {
    seatId: seat.id,
    userId: req.user!.id,
    reservationDate: String(reservationDate),
    startTime: String(startTime),
    endTime: String(endTime),
  });
  if (conflict.conflict) {
    fail(res, 409, conflict.reason || 'Seat time-slot conflict.', 'SEAT_CONFLICT');
    return;
  }

  const booking = {
    id: uid('sres'),
    seatId: seat.id,
    branchId: seat.branchId,
    userId: req.user!.id,
    reservationDate: String(reservationDate),
    startTime: String(startTime),
    endTime: String(endTime),
    status: 'CONFIRMED' as const,
    checkedInAt: null,
    checkedOutAt: null,
    createdAt: new Date().toISOString(),
  };
  store.seatReservations.unshift(booking);
  addNotification(store, {
    userId: req.user!.id,
    branchId: seat.branchId,
    type: 'SEAT_CONFIRMATION',
    title: 'Study Seat Confirmed',
    message: `Seat ${seat.seatCode} (Floor ${seat.floor}) reserved for ${booking.reservationDate}, ${booking.startTime}–${booking.endTime}.`,
    idempotencyKey: `SEAT:${booking.id}`,
  });
  persistStore();
  res.status(201).json({ success: true, data: booking, message: `Seat ${seat.seatCode} reserved.` });
});

apiRouter.get('/seats/reservations/my', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  const list = store.seatReservations
    .filter((r) => r.userId === req.user!.id)
    .map((r) => {
      const seat = store.seats.find((s) => s.id === r.seatId);
      const branch = store.branches.find((b) => b.id === r.branchId);
      return {
        ...r,
        seatCode: seat?.seatCode ?? '',
        floor: seat?.floor ?? 1,
        zone: seat?.zone ?? '',
        branchName: branch?.name ?? '',
      };
    });
  ok(res, list);
});

apiRouter.post('/seats/check-in', authenticate, (req: AuthedRequest, res) => {
  const { reservationId } = req.body ?? {};
  const store = getStore();
  const booking = store.seatReservations.find((r) => r.id === reservationId);
  if (!booking) {
    fail(res, 404, 'Seat reservation not found.');
    return;
  }
  const isStaff = ['SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'].includes(req.user!.role);
  if (!isStaff && booking.userId !== req.user!.id) {
    fail(res, 403, 'Unauthorized check-in.');
    return;
  }
  if (booking.status !== 'CONFIRMED') {
    fail(res, 409, `Cannot check in a reservation with status ${booking.status}.`);
    return;
  }
  booking.status = 'CHECKED_IN';
  booking.checkedInAt = new Date().toISOString();
  persistStore();
  ok(res, booking, 'Seat check-in confirmed.');
});

apiRouter.post('/seats/check-out', authenticate, (req: AuthedRequest, res) => {
  const { reservationId } = req.body ?? {};
  const store = getStore();
  const booking = store.seatReservations.find((r) => r.id === reservationId);
  if (!booking) {
    fail(res, 404, 'Seat reservation not found.');
    return;
  }
  booking.status = 'COMPLETED';
  booking.checkedOutAt = new Date().toISOString();
  persistStore();
  ok(res, booking, 'Checked out of study seat.');
});

apiRouter.delete('/seats/reservations/:id', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  const booking = store.seatReservations.find((r) => r.id === req.params.id);
  if (!booking) {
    fail(res, 404, 'Seat reservation not found.');
    return;
  }
  const isStaff = ['SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'].includes(req.user!.role);
  if (!isStaff && booking.userId !== req.user!.id) {
    fail(res, 403, 'Unauthorized cancellation.');
    return;
  }
  booking.status = 'CANCELLED';
  persistStore();
  ok(res, booking, 'Seat reservation cancelled.');
});

// ======================================================
// PREDICTIVE DEMAND ANALYTICS & INTELLIGENT ACQUISITION
// ======================================================
apiRouter.get(
  '/analytics/demand',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'),
  (req: AuthedRequest, res) => {
    const store = getStore();
    const months = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];

    const forecasts = store.books
      .filter((b) => !b.archived)
      .map((book) => {
        const copies = store.bookCopies.filter((c) => c.bookId === book.id && c.status !== 'ARCHIVED');
        const available = copies.filter((c) => c.status === 'AVAILABLE').length;
        const activeRes = store.reservations.filter(
          (r) => r.bookId === book.id && (r.status === 'WAITING' || r.status === 'READY_FOR_PICKUP')
        ).length;
        const monthlyHistory = months.map((m) => ({
          month: m,
          borrows: store.bookIssues.filter((i) => i.bookId === book.id && i.issueDate.startsWith(m)).length,
        }));
        return computeDemandForecast({
          bookId: book.id,
          title: book.title,
          category: book.category,
          totalCopies: copies.length,
          availableCopies: available,
          monthlyHistory,
          activeReservations: activeRes,
          nextMonthLabel: '2026-12 (Forecast)',
        });
      })
      .sort((a, b) => b.demandToInventoryRatio - a.demandToInventoryRatio);

    // Aggregate institutional trend (strictly separating historical vs forecast)
    const aggregateSeries = months.map((m) => ({
      month: m,
      historicalBorrows: store.bookIssues.filter((i) => i.issueDate.startsWith(m)).length,
      forecastBorrows: null as number | null,
    }));
    const nextMonthTotal = forecasts.reduce((acc, f) => acc + f.predictedNextMonthBorrows, 0);
    aggregateSeries.push({
      month: '2026-12 (Forecast)',
      historicalBorrows: null as unknown as number,
      forecastBorrows: nextMonthTotal,
    });

    ok(res, {
      methodology:
        'Statistical weighted moving average over 6 months of verified circulation records combined with active reservation backlog and a 1.15x examination-period seasonal factor. Historical counts and forecasts are separated explicitly.',
      aggregateSeries,
      bookForecasts: forecasts.slice(0, 10),
    });
  }
);

apiRouter.get(
  '/acquisition/suggestions',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'),
  (req: AuthedRequest, res) => {
    const store = getStore();
    let list = store.acquisitionDecisions;
    if (req.user!.role !== 'SUPER_ADMIN') {
      list = list.filter((a) => a.branchId === req.user!.branchId);
    }
    const enriched = list.map((a) => {
      const book = store.books.find((b) => b.id === a.bookId);
      const branch = store.branches.find((b) => b.id === a.branchId);
      const reviewer = a.reviewedByUserId ? store.users.find((u) => u.id === a.reviewedByUserId) : null;
      return {
        ...a,
        bookTitle: book?.title ?? '',
        isbn: book?.isbn ?? '',
        category: book?.category ?? '',
        branchName: branch?.name ?? '',
        reviewedByName: reviewer?.fullName ?? null,
      };
    });
    ok(res, enriched);
  }
);

apiRouter.post(
  '/acquisition/suggestions',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'),
  (req: AuthedRequest, res) => {
    const { bookId, suggestedAdditionalCopies, explanation } = req.body ?? {};
    const store = getStore();
    const book = store.books.find((b) => b.id === bookId);
    if (!book) {
      fail(res, 404, 'Book not found.');
      return;
    }
    const branchId = req.user!.branchId || 'br-central';
    const created = {
      id: uid('acq'),
      bookId: book.id,
      branchId,
      suggestedAdditionalCopies: Math.max(1, Number(suggestedAdditionalCopies) || 2),
      priority: 'MEDIUM' as const,
      demandToInventoryRatio: 2.1,
      explanation:
        String(explanation || '').trim() ||
        'Generated from observed circulation pressure and repeated unavailability.',
      status: 'PENDING' as const,
      reviewedByUserId: null,
      rejectionReason: null,
      reviewedAt: null,
      createdAt: new Date().toISOString(),
    };
    store.acquisitionDecisions.unshift(created);
    persistStore();
    res.status(201).json({ success: true, data: created, message: 'Acquisition suggestion recorded.' });
  }
);

apiRouter.put(
  '/acquisition/suggestions/:id/approve',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'),
  (req: AuthedRequest, res) => {
    const store = getStore();
    const item = store.acquisitionDecisions.find((a) => a.id === req.params.id);
    if (!item) {
      fail(res, 404, 'Suggestion not found.');
      return;
    }
    item.status = 'APPROVED';
    item.reviewedByUserId = req.user!.id;
    item.reviewedAt = new Date().toISOString();
    addAuditLog(store, {
      actorUserId: req.user!.id,
      actorName: req.user!.fullName,
      actorRole: req.user!.role,
      branchId: item.branchId,
      action: 'ACQUISITION_APPROVED',
      entityType: 'ACQUISITION_SUGGESTION',
      entityId: item.id,
      summary: `Approved purchase requisition for ${item.suggestedAdditionalCopies} additional copies (manual procurement workflow).`,
    });
    persistStore();
    ok(res, item, 'Acquisition suggestion approved for procurement.');
  }
);

apiRouter.put(
  '/acquisition/suggestions/:id/reject',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'),
  (req: AuthedRequest, res) => {
    const reason = String(req.body?.reason || '').trim();
    if (!reason) {
      fail(res, 400, 'Rejection reason is required.');
      return;
    }
    const store = getStore();
    const item = store.acquisitionDecisions.find((a) => a.id === req.params.id);
    if (!item) {
      fail(res, 404, 'Suggestion not found.');
      return;
    }
    item.status = 'REJECTED';
    item.rejectionReason = reason;
    item.reviewedByUserId = req.user!.id;
    item.reviewedAt = new Date().toISOString();
    persistStore();
    ok(res, item, 'Acquisition suggestion rejected.');
  }
);

// ======================================================
// RESEARCH COMPANION (LISTS, NOTES, APA/IEEE BIBLIOGRAPHY)
// ======================================================
apiRouter.get('/research/lists', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  const lists = store.readingLists
    .filter((l) => l.userId === req.user!.id)
    .map((l) => ({
      ...l,
      books: l.bookIds
        .map((bid) => store.books.find((b) => b.id === bid))
        .filter(Boolean)
        .map((b) => enrichBook(b!)),
      notes: store.researchNotes.filter((n) => n.readingListId === l.id),
    }));
  ok(res, lists);
});

apiRouter.post('/research/lists', authenticate, (req: AuthedRequest, res) => {
  const { title, subject, description, tags, bookIds } = req.body ?? {};
  if (!title?.trim()) {
    fail(res, 400, 'Reading list title is required.');
    return;
  }
  const store = getStore();
  const created = {
    id: uid('rl'),
    userId: req.user!.id,
    title: String(title).trim(),
    subject: String(subject || 'Interdisciplinary Research').trim(),
    description: String(description || '').trim(),
    tags: Array.isArray(tags)
      ? tags
      : String(tags || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
    bookIds: Array.isArray(bookIds) ? bookIds : [],
    createdAt: new Date().toISOString(),
  };
  store.readingLists.unshift(created);
  persistStore();
  res.status(201).json({ success: true, data: created, message: 'Research reading list created.' });
});

apiRouter.post('/research/lists/:id/books', authenticate, (req: AuthedRequest, res) => {
  const { bookId } = req.body ?? {};
  const store = getStore();
  const list = store.readingLists.find((l) => l.id === req.params.id && l.userId === req.user!.id);
  if (!list) {
    fail(res, 404, 'Reading list not found.');
    return;
  }
  if (!list.bookIds.includes(bookId)) {
    list.bookIds.push(bookId);
    persistStore();
  }
  ok(res, list, 'Reference added to reading list.');
});

apiRouter.post('/research/notes', authenticate, (req: AuthedRequest, res) => {
  const { readingListId, bookId, title, content, pageReference, tags } = req.body ?? {};
  if (!readingListId || !title?.trim() || !content?.trim()) {
    fail(res, 400, 'Reading list, note title, and content are required.');
    return;
  }
  const store = getStore();
  const note = {
    id: uid('rn'),
    userId: req.user!.id,
    readingListId,
    bookId: bookId || null,
    title: String(title).trim(),
    content: String(content).trim(),
    pageReference: String(pageReference || '').trim(),
    tags: Array.isArray(tags) ? tags : [],
    createdAt: new Date().toISOString(),
  };
  store.researchNotes.unshift(note);
  persistStore();
  res.status(201).json({ success: true, data: note, message: 'Research note saved.' });
});

apiRouter.get('/research/bibliography', authenticate, (req: AuthedRequest, res) => {
  const style = String(req.query.style || 'APA').toUpperCase() === 'IEEE' ? 'IEEE' : 'APA';
  const listId = String(req.query.listId || '');
  const store = getStore();
  const list = store.readingLists.find((l) => l.id === listId && l.userId === req.user!.id);
  if (!list) {
    fail(res, 404, 'Reading list not found.');
    return;
  }
  const citations = list.bookIds
    .map((bid) => store.books.find((b) => b.id === bid))
    .filter(Boolean)
    .map((book, idx) => ({
      bookId: book!.id,
      citation: formatBibliographyCitation(
        {
          title: book!.title,
          authors: book!.authors,
          publisher: book!.publisher,
          publicationYear: book!.publicationYear,
          edition: book!.edition,
          isbn: book!.isbn,
        },
        style,
        idx + 1
      ),
    }));

  ok(res, { listTitle: list.title, style, citations });
});

// ======================================================
// COURSE-BASED READING LISTS
// ======================================================
apiRouter.get('/courses', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  let list = store.courses;
  if (req.user!.role === 'STUDENT') {
    list = list.filter((c) => c.enrolledStudentIds.includes(req.user!.id));
  } else if (req.user!.role === 'FACULTY') {
    list = list.filter((c) => c.facultyUserId === req.user!.id);
  }

  const enriched = list.map((c) => {
    const faculty = store.users.find((u) => u.id === c.facultyUserId);
    return {
      ...c,
      facultyName: faculty?.fullName ?? 'Faculty Member',
      materials: c.materials.map((m) => {
        const book = store.books.find((b) => b.id === m.bookId);
        const alternatives = m.alternativeBookIds
          .map((aid) => store.books.find((b) => b.id === aid))
          .filter(Boolean)
          .map((b) => enrichBook(b!));
        return {
          ...m,
          book: book ? enrichBook(book) : null,
          alternatives,
        };
      }),
    };
  });
  ok(res, enriched);
});

apiRouter.post(
  '/courses',
  authenticate,
  requireRoles('FACULTY', 'SUPER_ADMIN', 'BRANCH_ADMIN'),
  (req: AuthedRequest, res) => {
    const { courseCode, courseTitle, department, semester } = req.body ?? {};
    if (!courseCode?.trim() || !courseTitle?.trim()) {
      fail(res, 400, 'Course code and course title are required.');
      return;
    }
    const store = getStore();
    const studentIds = store.users.filter((u) => u.role === 'STUDENT').map((u) => u.id);
    const created = {
      id: uid('crs'),
      courseCode: String(courseCode).trim().toUpperCase(),
      courseTitle: String(courseTitle).trim(),
      department: String(department || 'Academic Department').trim(),
      semester: String(semester || 'Fall 2026').trim(),
      facultyUserId: req.user!.id,
      branchId: req.user!.branchId || 'br-central',
      enrolledStudentIds: studentIds,
      materials: [],
    };
    store.courses.unshift(created);
    persistStore();
    res.status(201).json({ success: true, data: created, message: 'Course created.' });
  }
);

apiRouter.post(
  '/courses/:id/reading-lists',
  authenticate,
  requireRoles('FACULTY', 'SUPER_ADMIN', 'BRANCH_ADMIN'),
  (req: AuthedRequest, res) => {
    const { bookId, materialType, required, notes } = req.body ?? {};
    const store = getStore();
    const course = store.courses.find((c) => c.id === req.params.id);
    if (!course) {
      fail(res, 404, 'Course not found.');
      return;
    }
    course.materials.push({
      bookId,
      materialType: materialType || 'TEXTBOOK',
      required: Boolean(required),
      notes: String(notes || '').trim(),
      alternativeBookIds: [],
    });
    for (const studentId of course.enrolledStudentIds) {
      addNotification(store, {
        userId: studentId,
        branchId: course.branchId,
        type: 'COURSE_READING_LIST_UPDATE',
        title: `${course.courseCode} Reading List Updated`,
        message: `New academic reading material added to ${course.courseCode} ${course.courseTitle}.`,
        idempotencyKey: `COURSE:${course.id}:${bookId}:${studentId}`,
      });
    }
    persistStore();
    ok(res, course, 'Material added to course reading list.');
  }
);

// ======================================================
// READING CHALLENGES & VERIFIED ACHIEVEMENTS
// ======================================================
apiRouter.get('/challenges', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  const verifiedCompletedCount = store.bookIssues.filter(
    (i) => i.memberId === req.user!.id && i.completionConfirmed
  ).length;
  const totalBorrowedCount = store.bookIssues.filter((i) => i.memberId === req.user!.id).length;

  const challenges = store.readingChallenges.map((c) => {
    const joined = c.participantIds.includes(req.user!.id);
    const progressPct = Math.min(100, Math.round((verifiedCompletedCount / Math.max(1, c.targetBooks)) * 100));
    return {
      ...c,
      joined,
      verifiedCompletedCount,
      progressPct,
    };
  });

  const categoriesExplored = new Set(
    store.bookIssues
      .filter((i) => i.memberId === req.user!.id)
      .map((i) => store.books.find((b) => b.id === i.bookId)?.category)
      .filter(Boolean)
  ).size;
  const researchCount = store.readingLists.filter((l) => l.userId === req.user!.id).length;

  const achievements = [
    {
      badgeCode: 'FIRST_BORROW',
      title: 'First Book Borrowed',
      description: 'Completed your first verified institutional library checkout.',
      earned: totalBorrowedCount >= 1,
      evidence: `${totalBorrowedCount} verified loan(s)`,
    },
    {
      badgeCode: 'FIVE_COMPLETED',
      title: 'Five Books Completed',
      description: 'Confirmed reading completion on five or more returned library volumes.',
      earned: verifiedCompletedCount >= 5,
      evidence: `${verifiedCompletedCount}/5 verified completions`,
    },
    {
      badgeCode: 'READING_EXPLORER',
      title: 'Reading Explorer',
      description: 'Explored scholarly works across two or more distinct academic disciplines.',
      earned: categoriesExplored >= 2,
      evidence: `${categoriesExplored} disciplines explored`,
    },
    {
      badgeCode: 'RESEARCH_ENTHUSIAST',
      title: 'Research Enthusiast',
      description: 'Curated a structured bibliography list inside Research Companion.',
      earned: researchCount >= 1,
      evidence: `${researchCount} research list(s)`,
    },
  ];

  ok(res, { challenges, achievements, verifiedCompletedCount });
});

apiRouter.post('/challenges', authenticate, (req: AuthedRequest, res) => {
  const { title, description, targetBooks, endDate } = req.body ?? {};
  if (!title?.trim()) {
    fail(res, 400, 'Challenge title is required.');
    return;
  }
  const store = getStore();
  const created = {
    id: uid('chl'),
    scope: ['LIBRARIAN', 'BRANCH_ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)
      ? ('CAMPUS' as const)
      : ('PERSONAL' as const),
    branchId: req.user!.branchId,
    creatorUserId: req.user!.id,
    title: String(title).trim(),
    description: String(description || 'Verified reading completion milestone.').trim(),
    targetBooks: Math.max(1, Number(targetBooks) || 4),
    startDate: new Date().toISOString().slice(0, 10),
    endDate: String(endDate || '2026-12-31'),
    participantIds: [req.user!.id],
  };
  store.readingChallenges.unshift(created);
  persistStore();
  res.status(201).json({ success: true, data: created, message: 'Reading challenge created.' });
});

apiRouter.post('/challenges/:id/join', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  const ch = store.readingChallenges.find((c) => c.id === req.params.id);
  if (!ch) {
    fail(res, 404, 'Challenge not found.');
    return;
  }
  if (!ch.participantIds.includes(req.user!.id)) {
    ch.participantIds.push(req.user!.id);
    persistStore();
  }
  ok(res, ch, 'Joined reading challenge.');
});

// ======================================================
// CAMPUS BOOK EXCHANGE (ISOLATED FROM LIBRARY INVENTORY)
// ======================================================
apiRouter.get('/exchange/listings', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  const isStaff = ['SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'].includes(req.user!.role);
  let list = store.exchangeListings.filter((l) => isStaff || l.status !== 'REMOVED_BY_MOD');
  if (req.query.subject && req.query.subject !== 'ALL') {
    list = list.filter((l) => l.subject === String(req.query.subject));
  }
  if (req.query.search) {
    const q = String(req.query.search).toLowerCase();
    list = list.filter(
      (l) => l.title.toLowerCase().includes(q) || l.author.toLowerCase().includes(q) || l.subject.toLowerCase().includes(q)
    );
  }
  const enriched = list.map((l) => {
    const owner = store.users.find((u) => u.id === l.ownerUserId);
    const requests = store.exchangeRequests
      .filter((r) => r.listingId === l.id)
      .map((r) => ({
        ...r,
        requesterName: store.users.find((u) => u.id === r.requesterUserId)?.fullName ?? '',
      }));
    return {
      ...l,
      ownerName: owner?.fullName ?? 'Verified Member',
      ownerDepartment: owner?.department ?? '',
      requests,
    };
  });
  ok(res, enriched);
});

apiRouter.post('/exchange/listings', authenticate, (req: AuthedRequest, res) => {
  const { title, author, isbn, subject, condition, listingType, description, photoUrl } = req.body ?? {};
  if (!title?.trim() || !author?.trim() || !subject?.trim()) {
    fail(res, 400, 'Title, author, and subject are required.');
    return;
  }
  const store = getStore();
  const created = {
    id: uid('ex'),
    ownerUserId: req.user!.id,
    branchId: req.user!.branchId || 'br-central',
    title: String(title).trim(),
    author: String(author).trim(),
    isbn: String(isbn || '').trim(),
    subject: String(subject).trim(),
    condition: condition || 'GOOD',
    listingType: listingType === 'DONATION' ? ('DONATION' as const) : ('EXCHANGE' as const),
    description: String(description || '').trim(),
    photoUrl: String(photoUrl || '').trim(),
    status: 'AVAILABLE' as const,
    reports: [],
    createdAt: new Date().toISOString(),
  };
  store.exchangeListings.unshift(created);
  persistStore();
  res.status(201).json({ success: true, data: created, message: 'Personal book listing published.' });
});

apiRouter.post('/exchange/requests', authenticate, (req: AuthedRequest, res) => {
  const { listingId, offeredBookTitle, message } = req.body ?? {};
  const store = getStore();
  const listing = store.exchangeListings.find((l) => l.id === listingId && l.status === 'AVAILABLE');
  if (!listing) {
    fail(res, 404, 'Available exchange listing not found.');
    return;
  }
  if (listing.ownerUserId === req.user!.id) {
    fail(res, 400, 'You cannot request your own listing.');
    return;
  }
  const request = {
    id: uid('exr'),
    listingId: listing.id,
    ownerUserId: listing.ownerUserId,
    requesterUserId: req.user!.id,
    offeredBookTitle: String(offeredBookTitle || '').trim(),
    message: String(message || 'Interested in this campus book exchange.').trim(),
    status: 'PENDING' as const,
    createdAt: new Date().toISOString(),
    respondedAt: null,
  };
  store.exchangeRequests.unshift(request);
  addNotification(store, {
    userId: listing.ownerUserId,
    branchId: listing.branchId,
    type: 'EXCHANGE_REQUEST',
    title: 'New Campus Exchange Request',
    message: `${req.user!.fullName} requested "${listing.title}".`,
    idempotencyKey: `EXR:${request.id}`,
  });
  persistStore();
  res.status(201).json({ success: true, data: request, message: 'Exchange request sent.' });
});

apiRouter.put('/exchange/requests/:id/approve', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  const reqItem = store.exchangeRequests.find((r) => r.id === req.params.id);
  if (!reqItem || reqItem.ownerUserId !== req.user!.id) {
    fail(res, 404, 'Exchange request not found or unauthorized.');
    return;
  }
  reqItem.status = 'APPROVED';
  reqItem.respondedAt = new Date().toISOString();
  const listing = store.exchangeListings.find((l) => l.id === reqItem.listingId);
  if (listing) listing.status = 'COMPLETED';
  addNotification(store, {
    userId: reqItem.requesterUserId,
    branchId: req.user!.branchId,
    type: 'EXCHANGE_APPROVED',
    title: 'Exchange Request Approved',
    message: `Your exchange request for "${listing?.title}" was approved.`,
    idempotencyKey: `EXR_APP:${reqItem.id}`,
  });
  persistStore();
  ok(res, reqItem, 'Exchange request approved.');
});

apiRouter.put('/exchange/requests/:id/reject', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  const reqItem = store.exchangeRequests.find((r) => r.id === req.params.id);
  if (!reqItem || reqItem.ownerUserId !== req.user!.id) {
    fail(res, 404, 'Exchange request not found or unauthorized.');
    return;
  }
  reqItem.status = 'REJECTED';
  reqItem.respondedAt = new Date().toISOString();
  persistStore();
  ok(res, reqItem, 'Exchange request rejected.');
});

apiRouter.post('/exchange/listings/:id/report', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  const listing = store.exchangeListings.find((l) => l.id === req.params.id);
  if (!listing) {
    fail(res, 404, 'Listing not found.');
    return;
  }
  listing.reports.push({
    reporterId: req.user!.id,
    reason: String(req.body?.reason || 'Inappropriate listing').trim(),
    reportedAt: new Date().toISOString(),
  });
  persistStore();
  ok(res, { reported: true }, 'Listing flagged for librarian moderation.');
});

// ======================================================
// LOST & FOUND BOOK RECOVERY
// ======================================================
apiRouter.get('/lost-found', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  const isStaff = ['SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'].includes(req.user!.role);
  let list = store.lostFoundReports;
  if (!isStaff) {
    list = list.filter((r) => r.reportedByUserId === req.user!.id || r.memberId === req.user!.id);
  } else if (req.user!.role !== 'SUPER_ADMIN') {
    list = list.filter((r) => r.branchId === req.user!.branchId);
  }
  const enriched = list.map((r) => {
    const copy = store.bookCopies.find((c) => c.id === r.copyId);
    const book = store.books.find((b) => b.id === r.bookId);
    return { ...r, copyCode: copy?.copyCode ?? '', bookTitle: book?.title ?? '' };
  });
  ok(res, enriched);
});

apiRouter.post('/lost-found', authenticate, (req: AuthedRequest, res) => {
  const { copyId, copyCode, incidentType, description, recoveryDetails } = req.body ?? {};
  const store = getStore();
  const copy = store.bookCopies.find(
    (c) => c.id === copyId || c.copyCode === copyCode || c.qrToken === copyCode
  );
  if (!copy) {
    fail(res, 404, 'Physical book copy not found.');
    return;
  }
  const report = {
    id: uid('lf'),
    incidentCode: `INC-2026-${Math.floor(1000 + Math.random() * 8999)}`,
    copyId: copy.id,
    bookId: copy.bookId,
    branchId: copy.branchId,
    reportedByUserId: req.user!.id,
    memberId: ['STUDENT', 'FACULTY'].includes(req.user!.role) ? req.user!.id : null,
    incidentType: (incidentType || 'LOST') as 'LOST' | 'DAMAGED' | 'RECOVERED',
    status: 'REPORTED' as const,
    description: String(description || 'Incident reported for librarian review.').trim(),
    recoveryDetails: String(recoveryDetails || '').trim(),
    currency: 'INR' as const,
    penaltyAmount: 0,
    verifiedByLibrarianId: null,
    createdAt: new Date().toISOString(),
    verifiedAt: null,
  };
  store.lostFoundReports.unshift(report);
  persistStore();
  res.status(201).json({ success: true, data: report, message: `Incident ${report.incidentCode} logged.` });
});

apiRouter.put(
  '/lost-found/:id/verify',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'),
  (req: AuthedRequest, res) => {
    const { status, penaltyAmount, recoveryDetails } = req.body ?? {};
    const store = getStore();
    const report = store.lostFoundReports.find((r) => r.id === req.params.id);
    if (!report) {
      fail(res, 404, 'Incident report not found.');
      return;
    }
    if (penaltyAmount !== undefined && !isNonNegativeMonetaryAmount(penaltyAmount)) {
      fail(res, 400, 'Penalty amount must be a valid non-negative INR value.');
      return;
    }
    const copy = store.bookCopies.find((c) => c.id === report.copyId);
    report.status = status || 'RECOVERED_VERIFIED';
    report.currency = 'INR';
    report.penaltyAmount = roundInrAmount(Number(penaltyAmount) || 0);
    if (recoveryDetails) report.recoveryDetails = String(recoveryDetails);
    report.verifiedByLibrarianId = req.user!.id;
    report.verifiedAt = new Date().toISOString();

    if (copy) {
      if (report.status === 'VERIFIED_LOST') copy.status = 'LOST';
      else if (report.status === 'VERIFIED_DAMAGED') {
        copy.status = 'DAMAGED';
        copy.condition = 'DAMAGED';
      } else if (report.status === 'RECOVERED_VERIFIED') {
        copy.status = 'AVAILABLE';
        copy.condition = 'GOOD';
      }
    }

    addAuditLog(store, {
      actorUserId: req.user!.id,
      actorName: req.user!.fullName,
      actorRole: req.user!.role,
      branchId: report.branchId,
      action: 'LOST_FOUND_VERIFIED',
      entityType: 'LOST_FOUND_REPORT',
      entityId: report.id,
      summary: `Verified incident ${report.incidentCode} as ${report.status}.${report.penaltyAmount > 0 ? ` Penalty: ${formatINR(report.penaltyAmount)}.` : ''} Copy synced to ${copy?.status}.`,
    });
    persistStore();
    ok(res, report, 'Incident verified and inventory status updated.');
  }
);

// ======================================================
// SELF-SERVICE LIBRARY KIOSK (USES SAME SECURED RULES)
// ======================================================
apiRouter.post('/kiosk/lookup', authenticate, (req: AuthedRequest, res) => {
  const { memberQr, bookQr } = req.body ?? {};
  const store = getStore();

  const member = memberQr
    ? store.users.find(
        (u) =>
          u.digitalCardQrToken.toLowerCase() === String(memberQr).toLowerCase() ||
          u.institutionalId.toLowerCase() === String(memberQr).toLowerCase()
      )
    : store.users.find((u) => u.id === req.user!.id);

  const copy = bookQr
    ? store.bookCopies.find(
        (c) =>
          c.qrToken.toLowerCase() === String(bookQr).toLowerCase() ||
          c.copyCode.toLowerCase() === String(bookQr).toLowerCase() ||
          c.barcode.toLowerCase() === String(bookQr).toLowerCase()
      )
    : null;

  const book = copy ? store.books.find((b) => b.id === copy.bookId) : null;
  const activeIssues = member
    ? store.bookIssues.filter((i) => i.memberId === member.id && (i.status === 'ACTIVE' || i.status === 'OVERDUE'))
    : [];
  const policy = resolvePolicy(store, member?.branchId ?? 'br-central');
  const maxBooks =
    member?.customBorrowLimit ??
    policy.rolePolicies[member?.role === 'FACULTY' ? 'FACULTY' : 'STUDENT'].maxBooks;

  const eligible = Boolean(
    member &&
      member.accountStatus === 'ACTIVE' &&
      !member.borrowingRestricted &&
      activeIssues.length < maxBooks
  );

  const memberReservations = member
    ? store.reservations.filter(
        (r) => r.memberId === member.id && (r.status === 'WAITING' || r.status === 'READY_FOR_PICKUP')
      )
    : [];

  store.kioskTransactions.unshift({
    id: uid('ksk'),
    kioskId: 'KIOSK-TERMINAL-01',
    branchId: copy?.branchId || member?.branchId || 'br-central',
    memberId: member?.id || req.user!.id,
    copyId: copy?.id || null,
    action: 'AVAILABILITY_CHECK',
    status: 'SUCCESS',
    summary: `Kiosk lookup for member ${member?.institutionalId ?? 'N/A'} / copy ${copy?.copyCode ?? 'None'}.`,
    timestamp: new Date().toISOString(),
  });
  persistStore();

  ok(res, {
    member: member ? sanitizeUser(member) : null,
    eligible,
    activeBorrowCount: activeIssues.length,
    maxBorrowLimit: maxBooks,
    copy: copy ? { ...copy, bookTitle: book?.title, isbn: book?.isbn } : null,
    activeReservationsCount: memberReservations.length,
  });
});

// ======================================================
// MULTI-BRANCH, POLICIES, TRANSFERS, NOTIFICATIONS, ANALYTICS, AUDIT
// ======================================================
apiRouter.get('/branches', authenticate, (_req, res) => {
  const store = getStore();
  const enriched = store.branches.map((b) => {
    const copies = store.bookCopies.filter((c) => c.branchId === b.id && c.status !== 'ARCHIVED');
    const admin = b.adminUserId ? store.users.find((u) => u.id === b.adminUserId) : null;
    return {
      ...b,
      adminName: admin?.fullName ?? 'Unassigned',
      totalCopies: copies.length,
      availableCopies: copies.filter((c) => c.status === 'AVAILABLE').length,
      activeLoans: store.bookIssues.filter(
        (i) => i.branchId === b.id && (i.status === 'ACTIVE' || i.status === 'OVERDUE')
      ).length,
      totalSeats: store.seats.filter((s) => s.branchId === b.id).length,
    };
  });
  ok(res, enriched);
});

apiRouter.post('/branches', authenticate, requireRoles('SUPER_ADMIN'), (req: AuthedRequest, res) => {
  const { code, name, campusZone, address, city, state, pinCode, contactEmail, contactPhone, operatingHours } =
    req.body ?? {};
  if (!code?.trim() || !name?.trim()) {
    fail(res, 400, 'Branch code and name are required.');
    return;
  }
  if (pinCode && !isValidIndianPinCode(String(pinCode))) {
    fail(res, 400, 'PIN code must be a valid 6-digit Indian postal code (e.g. 560012).');
    return;
  }
  if (contactPhone && !isValidIndianPhone(String(contactPhone))) {
    fail(res, 400, 'Contact phone must follow Indian format (+91 XXXXX XXXXX).');
    return;
  }
  const store = getStore();
  if (store.branches.some((b) => b.code.toLowerCase() === String(code).toLowerCase())) {
    fail(res, 409, 'Branch code already exists.');
    return;
  }
  const cleanCity = String(city || 'Bengaluru').trim();
  const cleanState = String(state || 'Karnataka').trim();
  const cleanPin = String(pinCode || '560012').trim();
  const defaultAddress = `${String(campusZone || 'Academic Campus').trim()}, ${cleanCity}, ${cleanState} ${cleanPin}`;
  const created = {
    id: uid('br'),
    code: String(code).trim().toUpperCase(),
    name: String(name).trim(),
    campusZone: String(campusZone || 'Main Academic Block').trim(),
    address: String(address || defaultAddress).trim(),
    city: cleanCity,
    state: cleanState,
    pinCode: cleanPin,
    country: 'India',
    contactEmail: String(contactEmail || `${String(code).trim().toLowerCase()}@smartlib.ac.in`).trim(),
    contactPhone: String(contactPhone || '+91 80412 44099').trim(),
    operatingHours: String(operatingHours || 'Mon–Sat 08:00–22:00 IST').trim(),
    floors: [1, 2],
    status: 'ACTIVE' as const,
    adminUserId: null,
    createdAt: new Date().toISOString(),
  };
  store.branches.push(created);
  addAuditLog(store, {
    actorUserId: req.user!.id,
    actorName: req.user!.fullName,
    actorRole: req.user!.role,
    branchId: created.id,
    action: 'BRANCH_CREATED',
    entityType: 'LIBRARY_BRANCH',
    entityId: created.id,
    summary: `Established library branch "${created.name}" (${created.code}) in ${created.city}, ${created.state} ${created.pinCode}.`,
  });
  persistStore();
  res.status(201).json({ success: true, data: created, message: 'Library branch created.' });
});

apiRouter.get('/policies', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  if (req.user!.role === 'SUPER_ADMIN') {
    ok(res, store.policies);
    return;
  }
  const relevant = store.policies.filter(
    (p) => p.scope === 'GLOBAL' || p.branchId === req.user!.branchId
  );
  ok(res, relevant);
});

apiRouter.put(
  '/policies/:id',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN'),
  (req: AuthedRequest, res) => {
    const store = getStore();
    const policy = store.policies.find((p) => p.id === req.params.id);
    if (!policy) {
      fail(res, 404, 'Policy not found.');
      return;
    }
    if (req.user!.role === 'BRANCH_ADMIN' && policy.branchId !== req.user!.branchId) {
      fail(res, 403, 'Branch Admins can only modify their assigned branch policy.');
      return;
    }
    const { gracePeriodDays, finePerDay, maxFineAmount, reservationHoldHours, rolePolicies } =
      req.body ?? {};
    if (finePerDay !== undefined && !isNonNegativeMonetaryAmount(finePerDay)) {
      fail(res, 400, 'Daily overdue fine must be a valid non-negative INR amount.');
      return;
    }
    if (maxFineAmount !== undefined && !isNonNegativeMonetaryAmount(maxFineAmount)) {
      fail(res, 400, 'Maximum fine cap must be a valid non-negative INR amount.');
      return;
    }
    if (gracePeriodDays !== undefined) policy.gracePeriodDays = Math.max(0, Number(gracePeriodDays) || 0);
    if (finePerDay !== undefined) policy.finePerDay = roundInrAmount(Number(finePerDay));
    if (maxFineAmount !== undefined) policy.maxFineAmount = roundInrAmount(Number(maxFineAmount));
    if (reservationHoldHours !== undefined) {
      policy.reservationHoldHours = Math.max(1, Number(reservationHoldHours) || 24);
    }
    policy.currency = 'INR';
    if (rolePolicies?.STUDENT) policy.rolePolicies.STUDENT = rolePolicies.STUDENT;
    if (rolePolicies?.FACULTY) policy.rolePolicies.FACULTY = rolePolicies.FACULTY;

    addAuditLog(store, {
      actorUserId: req.user!.id,
      actorName: req.user!.fullName,
      actorRole: req.user!.role,
      branchId: policy.branchId,
      action: 'POLICY_UPDATED',
      entityType: 'LIBRARY_POLICY',
      entityId: policy.id,
      summary: `Updated ${policy.scope} borrowing policy (fine/day=${formatINR(policy.finePerDay)}, grace=${policy.gracePeriodDays}d, maxFine=${formatINR(policy.maxFineAmount)}).`,
    });
    persistStore();
    ok(res, policy, 'Library policy saved.');
  }
);

apiRouter.get(
  '/transfers',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'),
  (req: AuthedRequest, res) => {
    const store = getStore();
    let list = store.bookTransfers;
    if (req.user!.role !== 'SUPER_ADMIN') {
      list = list.filter(
        (t) => t.fromBranchId === req.user!.branchId || t.toBranchId === req.user!.branchId
      );
    }
    const enriched = list.map((t) => ({
      ...t,
      bookTitle: store.books.find((b) => b.id === t.bookId)?.title ?? '',
      copyCode: store.bookCopies.find((c) => c.id === t.copyId)?.copyCode ?? '',
      fromBranchName: store.branches.find((b) => b.id === t.fromBranchId)?.name ?? '',
      toBranchName: store.branches.find((b) => b.id === t.toBranchId)?.name ?? '',
    }));
    ok(res, enriched);
  }
);

apiRouter.post(
  '/transfers',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'),
  (req: AuthedRequest, res) => {
    const { copyId, toBranchId, reason } = req.body ?? {};
    const store = getStore();
    const copy = store.bookCopies.find((c) => c.id === copyId && c.status === 'AVAILABLE');
    if (!copy) {
      fail(res, 404, 'Available physical copy not found for transfer.');
      return;
    }
    if (copy.branchId === toBranchId) {
      fail(res, 400, 'Destination branch must differ from current branch.');
      return;
    }
    const transfer = {
      id: uid('tr'),
      transferCode: `TRF-2026-${Math.floor(1000 + Math.random() * 8999)}`,
      copyId: copy.id,
      bookId: copy.bookId,
      fromBranchId: copy.branchId,
      toBranchId,
      requestedByUserId: req.user!.id,
      approvedByUserId: null,
      status: 'REQUESTED' as const,
      reason: String(reason || 'Inter-library demand balancing').trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.bookTransfers.unshift(transfer);
    persistStore();
    res.status(201).json({ success: true, data: transfer, message: 'Transfer request submitted.' });
  }
);

apiRouter.put(
  '/transfers/:id/status',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN'),
  (req: AuthedRequest, res) => {
    const { status } = req.body ?? {};
    const store = getStore();
    const tr = store.bookTransfers.find((t) => t.id === req.params.id);
    if (!tr) {
      fail(res, 404, 'Transfer request not found.');
      return;
    }
    const copy = store.bookCopies.find((c) => c.id === tr.copyId);
    tr.status = status;
    tr.approvedByUserId = req.user!.id;
    tr.updatedAt = new Date().toISOString();

    if (copy) {
      if (status === 'IN_TRANSIT') copy.status = 'IN_TRANSIT';
      if (status === 'RECEIVED') {
        copy.branchId = tr.toBranchId;
        copy.status = 'AVAILABLE';
      }
    }
    addAuditLog(store, {
      actorUserId: req.user!.id,
      actorName: req.user!.fullName,
      actorRole: req.user!.role,
      branchId: tr.toBranchId,
      action: `TRANSFER_${status}`,
      entityType: 'BOOK_TRANSFER',
      entityId: tr.id,
      summary: `Transfer ${tr.transferCode} updated to ${status}.`,
    });
    persistStore();
    ok(res, tr, `Transfer updated to ${status}.`);
  }
);

apiRouter.get('/notifications', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  const list = store.notifications.filter((n) => n.userId === req.user!.id);
  ok(res, list);
});

apiRouter.put('/notifications/:id/read', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  const item = store.notifications.find((n) => n.id === req.params.id && n.userId === req.user!.id);
  if (!item) {
    fail(res, 404, 'Notification not found.');
    return;
  }
  item.read = true;
  persistStore();
  ok(res, item);
});

apiRouter.get('/analytics/dashboard', authenticate, (req: AuthedRequest, res) => {
  const store = getStore();
  const branchFilter =
    req.user!.role === 'SUPER_ADMIN'
      ? req.query.branchId && req.query.branchId !== 'ALL'
        ? String(req.query.branchId)
        : null
      : req.user!.branchId;

  const copies = store.bookCopies.filter(
    (c) => c.status !== 'ARCHIVED' && (!branchFilter || c.branchId === branchFilter)
  );
  const issues = store.bookIssues.filter((i) => !branchFilter || i.branchId === branchFilter);
  const reservations = store.reservations.filter(
    (r) =>
      (!branchFilter || r.branchId === branchFilter) &&
      (r.status === 'WAITING' || r.status === 'READY_FOR_PICKUP')
  );
  const fines = store.fines.filter((f) => !branchFilter || f.branchId === branchFilter);
  const seats = store.seats.filter((s) => !branchFilter || s.branchId === branchFilter);
  const seatBookings = store.seatReservations.filter(
    (r) => (!branchFilter || r.branchId === branchFilter) && (r.status === 'CONFIRMED' || r.status === 'CHECKED_IN')
  );

  const months = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
  const borrowingTrends = months.map((m) => ({
    month: m,
    loans: issues.filter((i) => i.issueDate.startsWith(m)).length,
    returns: issues.filter((i) => i.returnedAt && i.returnedAt.startsWith(m)).length,
  }));

  const categoryCounts = new Map<string, number>();
  for (const i of issues) {
    const cat = store.books.find((b) => b.id === i.bookId)?.category ?? 'Other';
    categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
  }
  const popularCategories = [...categoryCounts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const branchPerformance = store.branches.map((b) => ({
    branchId: b.id,
    branchName: b.name,
    code: b.code,
    copies: store.bookCopies.filter((c) => c.branchId === b.id && c.status !== 'ARCHIVED').length,
    activeLoans: store.bookIssues.filter(
      (i) => i.branchId === b.id && (i.status === 'ACTIVE' || i.status === 'OVERDUE')
    ).length,
    overdueLoans: store.bookIssues.filter((i) => i.branchId === b.id && i.status === 'OVERDUE').length,
    pendingFines: roundInrAmount(
      store.fines
        .filter((f) => f.branchId === b.id && (f.status === 'PENDING' || f.status === 'PARTIALLY_PAID'))
        .reduce((acc, f) => acc + Math.max(0, f.amount - f.paidAmount - f.waivedAmount), 0)
    ),
  }));

  const outstandingFines = roundInrAmount(
    fines
      .filter((f) => f.status === 'PENDING' || f.status === 'PARTIALLY_PAID')
      .reduce((acc, f) => acc + Math.max(0, f.amount - f.paidAmount - f.waivedAmount), 0)
  );

  ok(res, {
    currency: 'INR',
    locale: INDIA_LOCALE,
    kpis: {
      totalBranches: store.branches.length,
      totalUsers: store.users.length,
      totalTitles: store.books.filter((b) => !b.archived).length,
      totalCopies: copies.length,
      availableCopies: copies.filter((c) => c.status === 'AVAILABLE').length,
      issuedCopies: copies.filter((c) => c.status === 'ISSUED').length,
      overdueLoans: issues.filter((i) => i.status === 'OVERDUE').length,
      activeReservations: reservations.length,
      outstandingFines,
      seatUtilizationPct:
        seats.length > 0 ? Math.min(100, Math.round((seatBookings.length / seats.length) * 100)) : 0,
      pendingAcquisitions: store.acquisitionDecisions.filter((a) => a.status === 'PENDING').length,
    },
    borrowingTrends,
    popularCategories,
    branchPerformance,
  });
});

apiRouter.get(
  '/analytics/export-csv',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN', 'LIBRARIAN'),
  (req: AuthedRequest, res) => {
    const store = getStore();
    const rows = [
      'Receipt,BookTitle,CopyCode,Member,Branch,IssueDate (DD/MM/YYYY),DueDate (DD/MM/YYYY),Status,AssessedFine (INR)',
      ...store.bookIssues.map((i) => {
        const bk = store.books.find((b) => b.id === i.bookId)?.title.replace(/,/g, ' ') ?? '';
        const cp = store.bookCopies.find((c) => c.id === i.copyId)?.copyCode ?? '';
        const mb = store.users.find((u) => u.id === i.memberId)?.fullName.replace(/,/g, ' ') ?? '';
        const br = store.branches.find((b) => b.id === i.branchId)?.code ?? '';
        const fineAmt = store.fines
          .filter((f) => f.issueId === i.id)
          .reduce((acc, f) => acc + f.amount, 0);
        return `${i.receiptNumber},${bk},${cp},${mb},${br},${formatIndianDate(i.issueDate)},${formatIndianDate(i.dueDate)},${i.status},${roundInrAmount(fineAmt).toFixed(2)}`;
      }),
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="smartlib-circulation-report.csv"');
    res.send(rows);
  }
);

apiRouter.get(
  '/audit-logs',
  authenticate,
  requireRoles('SUPER_ADMIN', 'BRANCH_ADMIN'),
  (req: AuthedRequest, res) => {
    const store = getStore();
    let logs = store.auditLogs;
    if (req.user!.role === 'BRANCH_ADMIN') {
      logs = logs.filter((l) => l.branchId === req.user!.branchId);
    }
    ok(res, logs);
  }
);
