/**
 * SmartLib Pure Domain Business Logic Engine
 * Decoupled, deterministic business rules mirroring the Java Spring Boot services.
 * Tested directly via node:test.
 */

export type UserRole = 'SUPER_ADMIN' | 'BRANCH_ADMIN' | 'LIBRARIAN' | 'FACULTY' | 'STUDENT';

export interface RolePolicy {
  maxBooks: number;
  borrowDays: number;
  maxRenewals: number;
}

export interface LibraryPolicy {
  id: string;
  scope: 'GLOBAL' | 'BRANCH';
  branchId: string | null;
  currency?: 'INR';
  rolePolicies: Record<'STUDENT' | 'FACULTY', RolePolicy>;
  gracePeriodDays: number;
  finePerDay: number;
  maxFineAmount: number;
  reservationHoldHours: number;
  seatCheckInGraceMinutes: number;
}

export interface FineCalculationInput {
  dueDateIso: string;
  returnedAtIso: string;
  gracePeriodDays: number;
  finePerDay: number;
  maxFineAmount: number;
}

export interface FineCalculationResult {
  rawOverdueDays: number;
  billableOverdueDays: number;
  fineAmount: number;
  currency: 'INR';
}

export function calculateOverdueFine(input: FineCalculationInput): FineCalculationResult {
  const dueMs = new Date(input.dueDateIso).getTime();
  const returnMs = new Date(input.returnedAtIso).getTime();
  const msPerDay = 24 * 60 * 60 * 1000;

  if (Number.isNaN(dueMs) || Number.isNaN(returnMs) || returnMs <= dueMs) {
    return { rawOverdueDays: 0, billableOverdueDays: 0, fineAmount: 0, currency: 'INR' };
  }

  const safeRatePerDay = Math.max(0, Number.isFinite(input.finePerDay) ? input.finePerDay : 0);
  const safeMaxFine = Math.max(0, Number.isFinite(input.maxFineAmount) ? input.maxFineAmount : 0);
  const rawOverdueDays = Math.ceil((returnMs - dueMs) / msPerDay);
  const billableOverdueDays = Math.max(0, rawOverdueDays - Math.max(0, input.gracePeriodDays));

  // Paise-level integer arithmetic prevents IEEE-754 floating-point drift
  const ratePaise = Math.round((safeRatePerDay + Number.EPSILON) * 100);
  const maxPaise = Math.round((safeMaxFine + Number.EPSILON) * 100);
  const computedPaise = Math.min(billableOverdueDays * ratePaise, maxPaise);

  return {
    rawOverdueDays,
    billableOverdueDays,
    fineAmount: computedPaise / 100,
    currency: 'INR',
  };
}

export interface ReservationItem {
  id: string;
  bookId: string;
  branchId: string;
  memberId: string;
  status: 'WAITING' | 'READY_FOR_PICKUP' | 'FULFILLED' | 'EXPIRED' | 'CANCELLED';
  queuedAt: string;
  allocatedAt?: string | null;
  expiresAt: string | null;
  allocatedCopyId: string | null;
}

export function getNextFifoReservation(
  reservations: ReservationItem[],
  bookId: string,
  branchId: string
): ReservationItem | null {
  const waiting = reservations
    .filter((r) => r.bookId === bookId && r.branchId === branchId && r.status === 'WAITING')
    .sort((a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime());
  return waiting[0] ?? null;
}

export function computeQueuePosition(
  reservations: ReservationItem[],
  reservationId: string
): number | null {
  const target = reservations.find((r) => r.id === reservationId);
  if (!target || (target.status !== 'WAITING' && target.status !== 'READY_FOR_PICKUP')) {
    return null;
  }
  const activeForBook = reservations
    .filter(
      (r) =>
        r.bookId === target.bookId &&
        r.branchId === target.branchId &&
        (r.status === 'WAITING' || r.status === 'READY_FOR_PICKUP')
    )
    .sort((a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime());

  const idx = activeForBook.findIndex((r) => r.id === reservationId);
  return idx >= 0 ? idx + 1 : null;
}

export interface SeatBookingSlot {
  id: string;
  seatId: string;
  userId: string;
  reservationDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' | 'NO_SHOW';
}

export function parseTimeToMinutes(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return -1;
  }
  return h * 60 + m;
}

export function intervalsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const a1 = parseTimeToMinutes(startA);
  const a2 = parseTimeToMinutes(endA);
  const b1 = parseTimeToMinutes(startB);
  const b2 = parseTimeToMinutes(endB);
  if (a1 < 0 || a2 <= a1 || b1 < 0 || b2 <= b1) return false;
  return a1 < b2 && b1 < a2;
}

export function checkSeatConflict(
  existingBookings: SeatBookingSlot[],
  candidate: {
    seatId: string;
    userId: string;
    reservationDate: string;
    startTime: string;
    endTime: string;
  }
): { conflict: boolean; reason: string | null } {
  const startMin = parseTimeToMinutes(candidate.startTime);
  const endMin = parseTimeToMinutes(candidate.endTime);
  if (startMin < 0 || endMin <= startMin) {
    return { conflict: true, reason: 'End time must be strictly after start time.' };
  }

  const activeStatuses = new Set(['CONFIRMED', 'CHECKED_IN']);
  for (const booking of existingBookings) {
    if (!activeStatuses.has(booking.status)) continue;
    if (booking.reservationDate !== candidate.reservationDate) continue;
    if (!intervalsOverlap(booking.startTime, booking.endTime, candidate.startTime, candidate.endTime)) {
      continue;
    }
    if (booking.seatId === candidate.seatId) {
      return {
        conflict: true,
        reason: `Seat is already reserved between ${booking.startTime} and ${booking.endTime}.`,
      };
    }
    if (booking.userId === candidate.userId) {
      return {
        conflict: true,
        reason: `You already hold an overlapping seat booking (${booking.startTime}–${booking.endTime}).`,
      };
    }
  }
  return { conflict: false, reason: null };
}

export interface ReadingHistoryEntry {
  userId: string;
  bookId: string;
  category: string;
  authors: string[];
  tags: string[];
  borrowedAt: string;
  returnedAt: string | null;
  completedVerified: boolean;
}

export interface ReadingDnaProfile {
  totalBorrowed: number;
  totalCompletedVerified: number;
  completionRatePct: number;
  categoryAffinities: Array<{ category: string; count: number; weight: number }>;
  favoriteAuthors: Array<{ author: string; count: number }>;
  topTags: Array<{ tag: string; count: number }>;
  monthlyActivity: Array<{ month: string; borrowed: number; completed: number }>;
  primaryInterest: string | null;
}

export function computeReadingDna(history: ReadingHistoryEntry[]): ReadingDnaProfile {
  const totalBorrowed = history.length;
  const totalCompletedVerified = history.filter((h) => h.completedVerified).length;
  const completionRatePct =
    totalBorrowed > 0 ? Math.round((totalCompletedVerified / totalBorrowed) * 100) : 0;

  const catMap = new Map<string, number>();
  const authorMap = new Map<string, number>();
  const tagMap = new Map<string, number>();
  const monthMap = new Map<string, { borrowed: number; completed: number }>();

  for (const item of history) {
    catMap.set(item.category, (catMap.get(item.category) ?? 0) + 1);
    for (const a of item.authors) {
      authorMap.set(a, (authorMap.get(a) ?? 0) + 1);
    }
    for (const t of item.tags) {
      tagMap.set(t, (tagMap.get(t) ?? 0) + 1);
    }
    const ym = item.borrowedAt.slice(0, 7);
    const curr = monthMap.get(ym) ?? { borrowed: 0, completed: 0 };
    curr.borrowed += 1;
    if (item.completedVerified) curr.completed += 1;
    monthMap.set(ym, curr);
  }

  const categoryAffinities = [...catMap.entries()]
    .map(([category, count]) => ({
      category,
      count,
      weight: totalBorrowed > 0 ? Number((count / totalBorrowed).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const favoriteAuthors = [...authorMap.entries()]
    .map(([author, count]) => ({ author, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topTags = [...tagMap.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const monthlyActivity = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, counts]) => ({ month, ...counts }));

  return {
    totalBorrowed,
    totalCompletedVerified,
    completionRatePct,
    categoryAffinities,
    favoriteAuthors,
    topTags,
    monthlyActivity,
    primaryInterest: categoryAffinities[0]?.category ?? null,
  };
}

export interface BookCandidate {
  id: string;
  title: string;
  authors: string[];
  category: string;
  tags: string[];
  availableCopies: number;
  borrowCount: number;
  publicationYear: number;
}

export interface ExplainedRecommendation {
  bookId: string;
  score: number;
  explanation: string;
  factors: string[];
}

export function generateExplainableRecommendations(
  books: BookCandidate[],
  userHistory: ReadingHistoryEntry[],
  limit = 6
): ExplainedRecommendation[] {
  const borrowedIds = new Set(userHistory.map((h) => h.bookId));
  const dna = computeReadingDna(userHistory);
  const catWeights = new Map(dna.categoryAffinities.map((c) => [c.category, c.weight]));
  const authorCounts = new Map(dna.favoriteAuthors.map((a) => [a.author, a.count]));
  const tagCounts = new Map(dna.topTags.map((t) => [t.tag, t.count]));
  const maxBorrows = Math.max(1, ...books.map((b) => b.borrowCount));

  const scored: ExplainedRecommendation[] = [];

  for (const book of books) {
    if (borrowedIds.has(book.id)) continue;

    const catScore = (catWeights.get(book.category) ?? 0) * 45;
    const matchedAuthor = book.authors.find((a) => authorCounts.has(a)) ?? null;
    const authorScore = matchedAuthor ? 25 : 0;
    const matchedTags = book.tags.filter((t) => tagCounts.has(t));
    const tagScore = Math.min(20, matchedTags.length * 10);
    const popularityScore = (book.borrowCount / maxBorrows) * 10;
    const totalScore = Number((catScore + authorScore + tagScore + popularityScore).toFixed(1));

    const factors: string[] = [];
    if (catScore > 0) {
      factors.push(`frequently borrow ${book.category} titles`);
    }
    if (matchedAuthor) {
      factors.push(`read works by ${matchedAuthor}`);
    }
    if (matchedTags.length > 0) {
      factors.push(`recently explored ${matchedTags.slice(0, 2).join(' and ')}`);
    }
    if (factors.length === 0 && book.borrowCount > 0) {
      factors.push(`this title is among the most borrowed volumes across campus (${book.borrowCount} loans)`);
    } else if (factors.length === 0) {
      factors.push(`recently added to the ${book.category} collection`);
    }

    const explanation =
      factors.length === 1
        ? `Recommended because you ${factors[0]}.`
            .replace('because you this title', 'because this title')
            .replace('because you recently added', 'because it was recently added')
        : `Recommended because you ${factors[0]} and ${factors[1]}.`;

    scored.push({
      bookId: book.id,
      score: totalScore,
      explanation,
      factors,
    });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

export interface DemandForecastPoint {
  month: string;
  borrows: number;
  type: 'HISTORICAL' | 'FORECAST';
}

export interface BookDemandAnalysis {
  bookId: string;
  title: string;
  category: string;
  totalCopies: number;
  availableCopies: number;
  rollingBorrows: number;
  activeReservations: number;
  predictedNextMonthBorrows: number;
  demandToInventoryRatio: number;
  suggestedAdditionalCopies: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  explanation: string;
  series: DemandForecastPoint[];
}

export function computeDemandForecast(params: {
  bookId: string;
  title: string;
  category: string;
  totalCopies: number;
  availableCopies: number;
  monthlyHistory: Array<{ month: string; borrows: number }>;
  activeReservations: number;
  nextMonthLabel: string;
  examPeriodMultiplier?: number;
}): BookDemandAnalysis {
  const multiplier = params.examPeriodMultiplier ?? 1.15;
  const sorted = [...params.monthlyHistory].sort((a, b) => a.month.localeCompare(b.month));
  const rollingBorrows = sorted.reduce((acc, m) => acc + m.borrows, 0);

  // Transparent weighted moving average over up to 6 historical months
  let weightedSum = 0;
  let weightTotal = 0;
  sorted.forEach((entry, idx) => {
    const w = idx + 1;
    weightedSum += entry.borrows * w;
    weightTotal += w;
  });
  const baseAvg = weightTotal > 0 ? weightedSum / weightTotal : 0;
  const predictedNextMonthBorrows = Math.max(
    params.activeReservations,
    Math.round((baseAvg + params.activeReservations * 0.6) * multiplier)
  );

  const effectiveCopies = Math.max(1, params.totalCopies);
  const demandToInventoryRatio = Number(
    ((predictedNextMonthBorrows + params.activeReservations) / effectiveCopies).toFixed(2)
  );

  let suggestedAdditionalCopies = 0;
  if (demandToInventoryRatio >= 2.2) {
    suggestedAdditionalCopies = Math.max(
      2,
      Math.ceil((predictedNextMonthBorrows + params.activeReservations) / 2) - params.totalCopies
    );
  } else if (demandToInventoryRatio >= 1.4 || (params.availableCopies === 0 && params.activeReservations >= 2)) {
    suggestedAdditionalCopies = Math.max(1, params.activeReservations);
  }

  const priority: 'HIGH' | 'MEDIUM' | 'LOW' =
    demandToInventoryRatio >= 2.2 || params.activeReservations >= 3
      ? 'HIGH'
      : demandToInventoryRatio >= 1.4
        ? 'MEDIUM'
        : 'LOW';

  const explanation =
    suggestedAdditionalCopies > 0
      ? `${params.totalCopies} physical ${params.totalCopies === 1 ? 'copy' : 'copies'} (${params.availableCopies} available) against ${rollingBorrows} historical borrows and ${params.activeReservations} active reservations (demand-to-inventory ratio ${demandToInventoryRatio}x). Statistical weighted moving average projects ${predictedNextMonthBorrows} requests next month.`
      : `Inventory (${params.totalCopies} copies, ${params.availableCopies} available) currently satisfies projected monthly demand of ${predictedNextMonthBorrows} borrows.`;

  const series: DemandForecastPoint[] = [
    ...sorted.map((m) => ({ month: m.month, borrows: m.borrows, type: 'HISTORICAL' as const })),
    { month: params.nextMonthLabel, borrows: predictedNextMonthBorrows, type: 'FORECAST' as const },
  ];

  return {
    bookId: params.bookId,
    title: params.title,
    category: params.category,
    totalCopies: params.totalCopies,
    availableCopies: params.availableCopies,
    rollingBorrows,
    activeReservations: params.activeReservations,
    predictedNextMonthBorrows,
    demandToInventoryRatio,
    suggestedAdditionalCopies: Math.max(0, suggestedAdditionalCopies),
    priority,
    explanation,
    series,
  };
}

export interface CitationMetadata {
  title: string;
  authors: string[];
  publisher?: string | null;
  publicationYear?: number | null;
  edition?: string | null;
  isbn?: string | null;
}

function formatApaAuthor(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName.trim();
  const last = parts[parts.length - 1];
  const initials = parts
    .slice(0, -1)
    .map((p) => `${p[0].toUpperCase()}.`)
    .join(' ');
  return `${last}, ${initials}`;
}

function formatIeeeAuthor(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName.trim();
  const last = parts[parts.length - 1];
  const initials = parts
    .slice(0, -1)
    .map((p) => `${p[0].toUpperCase()}.`)
    .join(' ');
  return `${initials} ${last}`;
}

export function formatBibliographyCitation(
  meta: CitationMetadata,
  style: 'APA' | 'IEEE',
  index = 1
): string {
  const cleanAuthors = meta.authors.map((a) => a.trim()).filter(Boolean);
  const yearPart = meta.publicationYear ? `${meta.publicationYear}` : 'n.d.';
  const publisherPart = meta.publisher?.trim() || null;
  const editionPart = meta.edition?.trim() || null;

  if (style === 'APA') {
    const authorStr =
      cleanAuthors.length === 0
        ? ''
        : cleanAuthors.length === 1
          ? `${formatApaAuthor(cleanAuthors[0])} `
          : cleanAuthors.length === 2
            ? `${formatApaAuthor(cleanAuthors[0])}, & ${formatApaAuthor(cleanAuthors[1])} `
            : `${cleanAuthors
                .slice(0, -1)
                .map(formatApaAuthor)
                .join(', ')}, & ${formatApaAuthor(cleanAuthors[cleanAuthors.length - 1])} `;
    const edSuffix = editionPart ? ` (${editionPart})` : '';
    const pubSuffix = publisherPart ? ` ${publisherPart}.` : '';
    return `${authorStr}(${yearPart}). ${meta.title}${edSuffix}.${pubSuffix}`.trim();
  }

  // IEEE
  const ieeeAuthors =
    cleanAuthors.length === 0
      ? ''
      : cleanAuthors.length === 1
        ? `${formatIeeeAuthor(cleanAuthors[0])}, `
        : `${cleanAuthors
            .slice(0, -1)
            .map(formatIeeeAuthor)
            .join(', ')} and ${formatIeeeAuthor(cleanAuthors[cleanAuthors.length - 1])}, `;
  const edPart = editionPart ? `, ${editionPart}` : '';
  const pubPart = publisherPart ? `, ${publisherPart}` : '';
  const yrPart = meta.publicationYear ? `, ${meta.publicationYear}` : '';
  return `[${index}] ${ieeeAuthors}${meta.title}${edPart}${pubPart}${yrPart}.`;
}

export function hasBranchPermission(
  actor: { role: UserRole; branchId: string | null },
  targetBranchId: string | null
): boolean {
  if (actor.role === 'SUPER_ADMIN') return true;
  if (actor.role === 'BRANCH_ADMIN' || actor.role === 'LIBRARIAN') {
    return Boolean(actor.branchId && targetBranchId && actor.branchId === targetBranchId);
  }
  return false;
}
