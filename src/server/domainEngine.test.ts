import test from 'node:test';
import assert from 'node:assert/strict';
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
  type ReservationItem,
  type SeatBookingSlot,
} from './domainEngine';

test('calculateOverdueFine applies grace period, daily rate, and maximum cap accurately', () => {
  const onTime = calculateOverdueFine({
    dueDateIso: '2026-11-10T00:00:00.000Z',
    returnedAtIso: '2026-11-10T00:00:00.000Z',
    gracePeriodDays: 2,
    finePerDay: 1.5,
    maxFineAmount: 25,
  });
  assert.equal(onTime.fineAmount, 0);
  assert.equal(onTime.billableOverdueDays, 0);

  const withinGrace = calculateOverdueFine({
    dueDateIso: '2026-11-10T00:00:00.000Z',
    returnedAtIso: '2026-11-12T00:00:00.000Z',
    gracePeriodDays: 2,
    finePerDay: 1.5,
    maxFineAmount: 25,
  });
  assert.equal(withinGrace.rawOverdueDays, 2);
  assert.equal(withinGrace.billableOverdueDays, 0);
  assert.equal(withinGrace.fineAmount, 0);

  const normalOverdue = calculateOverdueFine({
    dueDateIso: '2026-11-01T00:00:00.000Z',
    returnedAtIso: '2026-11-08T00:00:00.000Z',
    gracePeriodDays: 2,
    finePerDay: 1.5,
    maxFineAmount: 25,
  });
  assert.equal(normalOverdue.rawOverdueDays, 7);
  assert.equal(normalOverdue.billableOverdueDays, 5);
  assert.equal(normalOverdue.fineAmount, 7.5);
  assert.equal(normalOverdue.currency, 'INR');

  const paisePrecision = calculateOverdueFine({
    dueDateIso: '2026-11-01T00:00:00.000Z',
    returnedAtIso: '2026-11-04T00:00:00.000Z',
    gracePeriodDays: 0,
    finePerDay: 0.1,
    maxFineAmount: 100,
  });
  assert.equal(paisePrecision.fineAmount, 0.3);
  assert.equal(paisePrecision.currency, 'INR');

  const capped = calculateOverdueFine({
    dueDateIso: '2026-09-01T00:00:00.000Z',
    returnedAtIso: '2026-11-01T00:00:00.000Z',
    gracePeriodDays: 1,
    finePerDay: 2,
    maxFineAmount: 25,
  });
  assert.equal(capped.fineAmount, 25);
  assert.equal(capped.currency, 'INR');
});

test('FIFO reservation priority allocates earliest queued member and computes positions', () => {
  const queue: ReservationItem[] = [
    {
      id: 'res-2',
      bookId: 'book-1',
      branchId: 'br-1',
      memberId: 'u-2',
      status: 'WAITING',
      queuedAt: '2026-11-18T12:00:00.000Z',
      expiresAt: null,
      allocatedCopyId: null,
    },
    {
      id: 'res-1',
      bookId: 'book-1',
      branchId: 'br-1',
      memberId: 'u-1',
      status: 'WAITING',
      queuedAt: '2026-11-18T09:00:00.000Z',
      expiresAt: null,
      allocatedCopyId: null,
    },
    {
      id: 'res-cancelled',
      bookId: 'book-1',
      branchId: 'br-1',
      memberId: 'u-0',
      status: 'CANCELLED',
      queuedAt: '2026-11-18T08:00:00.000Z',
      expiresAt: null,
      allocatedCopyId: null,
    },
  ];

  const next = getNextFifoReservation(queue, 'book-1', 'br-1');
  assert.equal(next?.id, 'res-1');
  assert.equal(computeQueuePosition(queue, 'res-1'), 1);
  assert.equal(computeQueuePosition(queue, 'res-2'), 2);
  assert.equal(computeQueuePosition(queue, 'res-cancelled'), null);
});

test('checkSeatConflict blocks overlapping seat bookings and overlapping same-user bookings', () => {
  const bookings: SeatBookingSlot[] = [
    {
      id: 'sb-1',
      seatId: 'seat-A1',
      userId: 'stu-1',
      reservationDate: '2026-11-21',
      startTime: '10:00',
      endTime: '12:00',
      status: 'CONFIRMED',
    },
    {
      id: 'sb-cancelled',
      seatId: 'seat-A2',
      userId: 'stu-2',
      reservationDate: '2026-11-21',
      startTime: '10:00',
      endTime: '12:00',
      status: 'CANCELLED',
    },
  ];

  const sameSeatOverlap = checkSeatConflict(bookings, {
    seatId: 'seat-A1',
    userId: 'stu-3',
    reservationDate: '2026-11-21',
    startTime: '11:00',
    endTime: '13:00',
  });
  assert.equal(sameSeatOverlap.conflict, true);

  const sameUserOverlap = checkSeatConflict(bookings, {
    seatId: 'seat-A2',
    userId: 'stu-1',
    reservationDate: '2026-11-21',
    startTime: '11:30',
    endTime: '12:30',
  });
  assert.equal(sameUserOverlap.conflict, true);

  const adjacentNonOverlapping = checkSeatConflict(bookings, {
    seatId: 'seat-A1',
    userId: 'stu-3',
    reservationDate: '2026-11-21',
    startTime: '12:00',
    endTime: '14:00',
  });
  assert.equal(adjacentNonOverlapping.conflict, false);
});

test('Reading DNA & Explainable Recommendations produce transparent explanations without fabricated completion', () => {
  const history = [
    {
      userId: 'stu-1',
      bookId: 'b-1',
      category: 'Computer Science',
      authors: ['Joshua Bloch'],
      tags: ['Java', 'Architecture'],
      borrowedAt: '2026-09-05T10:00:00.000Z',
      returnedAt: '2026-09-18T10:00:00.000Z',
      completedVerified: true,
    },
    {
      userId: 'stu-1',
      bookId: 'b-2',
      category: 'Computer Science',
      authors: ['Robert Sedgewick'],
      tags: ['Algorithms', 'Data Structures'],
      borrowedAt: '2026-10-02T10:00:00.000Z',
      returnedAt: null,
      completedVerified: false,
    },
  ];

  const dna = computeReadingDna(history);
  assert.equal(dna.totalBorrowed, 2);
  assert.equal(dna.totalCompletedVerified, 1);
  assert.equal(dna.completionRatePct, 50);
  assert.equal(dna.primaryInterest, 'Computer Science');

  const recs = generateExplainableRecommendations(
    [
      {
        id: 'b-1',
        title: 'Effective Java',
        authors: ['Joshua Bloch'],
        category: 'Computer Science',
        tags: ['Java'],
        availableCopies: 2,
        borrowCount: 20,
        publicationYear: 2018,
      },
      {
        id: 'b-3',
        title: 'Designing Data-Intensive Applications',
        authors: ['Martin Kleppmann'],
        category: 'Computer Science',
        tags: ['Architecture', 'Data Structures'],
        availableCopies: 1,
        borrowCount: 18,
        publicationYear: 2017,
      },
      {
        id: 'b-4',
        title: 'Modern European History',
        authors: ['John Merriman'],
        category: 'History',
        tags: ['Europe'],
        availableCopies: 3,
        borrowCount: 4,
        publicationYear: 2019,
      },
    ],
    history
  );

  assert.equal(recs[0].bookId, 'b-3');
  assert.match(recs[0].explanation, /Computer Science/);
});

test('Demand forecast distinguishes historical vs forecast points and flags high-demand acquisitions', () => {
  const analysis = computeDemandForecast({
    bookId: 'b-3',
    title: 'Designing Data-Intensive Applications',
    category: 'Computer Science',
    totalCopies: 2,
    availableCopies: 0,
    monthlyHistory: [
      { month: '2026-08', borrows: 4 },
      { month: '2026-09', borrows: 5 },
      { month: '2026-10', borrows: 7 },
    ],
    activeReservations: 4,
    nextMonthLabel: '2026-12',
  });

  assert.equal(analysis.series.filter((p) => p.type === 'HISTORICAL').length, 3);
  assert.equal(analysis.series.filter((p) => p.type === 'FORECAST').length, 1);
  assert.equal(analysis.priority, 'HIGH');
  assert.ok(analysis.suggestedAdditionalCopies >= 2);
});

test('APA 7th and IEEE bibliography formatters never fabricate missing metadata', () => {
  const apaFull = formatBibliographyCitation(
    {
      title: 'Designing Data-Intensive Applications',
      authors: ['Martin Kleppmann'],
      publisher: "O'Reilly Media",
      publicationYear: 2017,
      edition: '1st ed.',
    },
    'APA'
  );
  assert.equal(
    apaFull,
    "Kleppmann, M. (2017). Designing Data-Intensive Applications (1st ed.). O'Reilly Media."
  );

  const apaMissingPublisher = formatBibliographyCitation(
    {
      title: 'Untitled Monograph',
      authors: ['Ada Lovelace'],
      publisher: null,
      publicationYear: null,
    },
    'APA'
  );
  assert.equal(apaMissingPublisher, 'Lovelace, A. (n.d.). Untitled Monograph.');

  const ieee = formatBibliographyCitation(
    {
      title: 'Introduction to Algorithms',
      authors: ['Thomas Cormen', 'Charles Leiserson'],
      publisher: 'MIT Press',
      publicationYear: 2022,
      edition: '4th ed.',
    },
    'IEEE',
    3
  );
  assert.equal(
    ieee,
    '[3] T. Cormen and C. Leiserson, Introduction to Algorithms, 4th ed., MIT Press, 2022.'
  );
});

test('hasBranchPermission enforces strict branch isolation for Branch Admin and Librarian', () => {
  assert.equal(hasBranchPermission({ role: 'SUPER_ADMIN', branchId: null }, 'br-2'), true);
  assert.equal(hasBranchPermission({ role: 'BRANCH_ADMIN', branchId: 'br-1' }, 'br-1'), true);
  assert.equal(hasBranchPermission({ role: 'BRANCH_ADMIN', branchId: 'br-1' }, 'br-2'), false);
  assert.equal(hasBranchPermission({ role: 'LIBRARIAN', branchId: 'br-1' }, 'br-2'), false);
  assert.equal(hasBranchPermission({ role: 'STUDENT', branchId: 'br-1' }, 'br-1'), false);
});
