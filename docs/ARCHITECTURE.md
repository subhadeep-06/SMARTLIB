# SMARTLIB — Phase 1: System Architecture & Engineering Blueprint

**Project Name:** SMARTLIB — Enterprise Smart Library Management & Automation System  
**Tagline:** *"Transforming Traditional Libraries into Intelligent Digital Ecosystems."*  
**Design Identity:** Premium Minimalist Academic Enterprise (Warm Ivory `#F7F5EF`, Charcoal `#252720`, Forest Green `#526B50`, Muted Olive `#92977A`).  
**Target Stack:** Java 21, Spring Boot 3.x, Spring Security, Spring Data MongoDB, MongoDB Atlas, React + Vite (JavaScript), Tailwind CSS, Recharts, Lucide React, Docker, Render, Vercel.

---

## 1. Complete Technical Architecture

SmartLib follows a **decoupled, multi-tier modular monolith** architecture on the backend paired with an independently deployable Single Page Application (SPA) frontend.

### 1.1 Architectural Layers
1. **Presentation Layer (React + Vite + JavaScript)**
   - Role-aware SPA built strictly in JavaScript (`.js`/`.jsx`, no TypeScript), Tailwind CSS, React Router, Axios, Recharts, and Lucide React.
   - Centralized design system enforcing the institutional palette, editorial serif headings, Inter UI typography, and WCAG 2.1 AA accessibility controls (font scaling, high-contrast academic mode, keyboard navigation, ARIA live regions).
   - Centralized Axios client with automatic silent refresh-token rotation and normalized error handling.
2. **API & Security Perimeter (Spring Boot 3.x + Spring Security 6)**
   - Stateless REST APIs under `/api/**` documented via OpenAPI 3 / Swagger (`springdoc-openapi`).
   - Filter chain: `CORS -> SecurityHeaders -> RateLimitFilter -> JwtAuthenticationFilter -> BranchContextFilter -> Controller`.
   - Strict DTO boundary: Controllers accept validated request DTOs (`@Valid`) and return response DTOs wrapped in a uniform `ApiResponse<T>` envelope. MongoDB `@Document` entities are never serialized directly to HTTP responses.
3. **Domain & Business Logic Layer (Spring Services)**
   - Modular package-by-feature structure (`com.smartlib.<domain>`).
   - Encapsulates borrowing rules, FIFO reservation allocation, fine computation, seat overlap checks, Reading DNA profiling, explainable recommendations, statistical demand forecasting, acquisition intelligence, and audit logging.
   - Uses `@Transactional` (backed by `MongoTransactionManager` on a MongoDB Atlas replica set) paired with optimistic locking (`@Version`) and atomic conditional updates via `MongoTemplate.findAndModify`.
4. **Automation & Scheduling Layer (Spring Scheduling)**
   - Idempotent background jobs for overdue detection, daily fine accrual, reservation pickup deadline expiration + FIFO cascade, expired seat reservation release, upcoming due-date alerts, and periodic demand/acquisition recalculation.
   - Deduplication enforced via persisted `idempotencyKey` on `notifications` and distributed/DB-backed job lock metadata.
5. **Persistence Layer (MongoDB Atlas)**
   - 32 domain-aligned BSON collections (17 Core + 15 Innovation).
   - `MongoRepository` for standard CRUD/finder queries and `MongoTemplate` for Aggregation Framework pipelines, atomic conditional updates, and dynamic filtered pagination.
6. **External & Pluggable Adapters**
   - **Email Adapter**: Spring Mail SMTP in production; structured console/DB fallback in development when credentials are unset.
   - **Payment Adapter**: Explicitly labeled mock payment gateway for fine settlements during development/staging with full audit logging.
   - **QR Generator**: ZXing server-side QR encoding of opaque signed/UUID resource tokens (never exposing PII).

---

## 2. System Architecture Diagram

```text
+-----------------------------------------------------------------------------------+
|                                   CLIENT LAYER                                    |
|  [Student / Faculty SPA]   [Librarian Console]   [Branch / Super Admin]   [Kiosk] |
|                 React + Vite (JavaScript) + Tailwind CSS + Recharts               |
+-----------------------------------------+-----------------------------------------+
                                          | HTTPS / JSON (REST + Bearer JWT)
                                          v
+-----------------------------------------------------------------------------------+
|                         VERCEL (CDN + SPA Edge Rewrites)                          |
+-----------------------------------------+-----------------------------------------+
                                          | VITE_API_BASE_URL
                                          v
+-----------------------------------------------------------------------------------+
|                  RENDER (Docker Container: Java 21 / Spring Boot 3)               |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | SECURITY PERIMETER                                                          |  |
|  | CORS Whitelist -> Rate Limiter -> JWT Filter -> RBAC -> Branch Scope Guard  |  |
|  +--------------------------------------+--------------------------------------+  |
|                                         v                                         |
|  +-----------------------------------------------------------------------------+  |
|  | REST CONTROLLERS (DTO Validation, Pagination, OpenAPI/Swagger, Actuator)    |  |
|  +--------------------------------------+--------------------------------------+  |
|                                         v                                         |
|  +-----------------------------------------------------------------------------+  |
|  | DOMAIN SERVICE LAYER (Transactional + Optimistic Locking + Audit AOP)       |  |
|  |                                                                             |  |
|  |  [Auth & Users]  [Catalog & Inventory]  [Circulation & Fines]  [Branches]   |  |
|  |  [FIFO Reservations]  [Seat Engine]  [Shelf QR Locator]  [Lost & Found]     |  |
|  |  [Reading DNA & Explainable Recommender]  [Demand Forecast & Acquisition]   |  |
|  |  [Research & Citations]  [Courses]  [Challenges]  [Campus Book Exchange]    |  |
|  |  [Kiosk Orchestrator]  [Analytics Aggregator]  [Notification Service]       |  |
|  +------------------+---------------------------------------+------------------+  |
|                     |                                       |                     |
|  +------------------v------------------+  +-----------------v------------------+  |
|  | SPRING SCHEDULING (Idempotent Jobs) |  | ADAPTERS (SMTP/Dev, MockPay, ZXing)|  |
|  +------------------+------------------+  +------------------------------------+  |
|                     |                                                             |
|  +------------------v----------------------------------------------------------+  |
|  | DATA ACCESS LAYER: Spring Data MongoRepository + MongoTemplate + TxManager  |  |
|  +--------------------------------------+--------------------------------------+  |
+-----------------------------------------+-----------------------------------------+
                                          | TLS (mongodb+srv://)
                                          v
+-----------------------------------------------------------------------------------+
|                      MONGODB ATLAS (Replica Set Cluster)                          |
|  17 Core Collections + 15 Innovation Collections                                  |
|  Unique / Compound / Partial / TTL / Text Indexes + Aggregation Pipelines         |
+-----------------------------------------------------------------------------------+
```

---

## 3. MongoDB Collection Design (32 Collections)

All collections include `createdAt` (`ISODate`) and `updatedAt` (`ISODate`) via Spring Data MongoDB Auditing (`@EnableMongoAuditing`), rendered in `Asia/Kolkata` (IST, `DD/MM/YYYY`) for Indian institutional operations. Monetary fields represent Indian Rupees (`INR` / `₹`) stored as `Decimal128` (`BigDecimal`, scale 2) to avoid floating-point drift and formatted using `en-IN` Indian numbering.

### A. Core Collections (1–17)

| # | Collection | Key Fields & Embedded Structures | Critical Indexes |
|---|---|---|---|
| 1 | `users` | `_id`, `institutionalId`, `email`, `passwordHash`, `fullName`, `role` (`SUPER_ADMIN`, `BRANCH_ADMIN`, `LIBRARIAN`, `FACULTY`, `STUDENT`), `branchId` (ref), `department`, `accountStatus` (`ACTIVE`, `SUSPENDED`, `RESTRICTED`, `PENDING_VERIFICATION`), `emailVerified`, `borrowingRestricted`, `customBorrowLimit`, `digitalCardQrToken`, `accessibilityPrefs` `{fontSize, highContrast}`, `enrolledCourseIds[]`, `version` | Unique: `{email: 1}`, `{institutionalId: 1}`, `{digitalCardQrToken: 1}`; Compound: `{branchId: 1, role: 1, accountStatus: 1}` |
| 2 | `library_branches` | `_id`, `code`, `name`, `address` `{street, city, state, pinCode, country, campusZone}`, `contactEmail`, `contactPhone` (`+91 XXXXX XXXXX`), `operatingHours[]` (IST), `floors[]`, `status` (`ACTIVE`, `INACTIVE`), `adminUserId` (ref) | Unique: `{code: 1}`; Index: `{status: 1}` |
| 3 | `books` | `_id`, `isbn`, `title`, `subtitle`, `authorIds[]`, `authorNames[]` (denorm), `publisherId`, `publisherName` (denorm), `categoryId`, `categoryName` (denorm), `genres[]`, `edition`, `language`, `publicationYear`, `pages`, `description`, `coverUrl`, `tags[]`, `totalCopies`, `availableCopies`, `archived`, `version` | Unique: `{isbn: 1}`; Text: `{title: "text", authorNames: "text", tags: "text", isbn: "text"}`; Compound: `{categoryId: 1, language: 1, archived: 1}`, `{availableCopies: 1, archived: 1}` |
| 4 | `book_copies` | `_id`, `copyCode`, `bookId` (ref), `barcode`, `qrToken`, `branchId` (ref), `location` `{floor, section, rack, shelf}`, `status` (`AVAILABLE`, `ISSUED`, `RESERVED_HOLD`, `IN_TRANSIT`, `DAMAGED`, `LOST`, `ARCHIVED`), `condition` (`NEW`, `GOOD`, `FAIR`, `WORN`, `DAMAGED`), `acquisitionDate`, `lastVerifiedAt`, `currentIssueId`, `version` | Unique: `{copyCode: 1}`, `{barcode: 1}`, `{qrToken: 1}`; Compound: `{bookId: 1, branchId: 1, status: 1}`, `{branchId: 1, "location.floor": 1, "location.section": 1}` |
| 5 | `authors` | `_id`, `name`, `normalizedName`, `biography`, `nationality` | Unique: `{normalizedName: 1}` |
| 6 | `publishers` | `_id`, `name`, `normalizedName`, `website`, `country` | Unique: `{normalizedName: 1}` |
| 7 | `categories` | `_id`, `name`, `slug`, `parentCategoryId`, `deweyRange`, `description` | Unique: `{slug: 1}` |
| 8 | `book_issues` | `_id`, `receiptNumber`, `bookId`, `copyId`, `branchId`, `memberId`, `issuedByUserId`, `bookSnapshot` `{title, isbn, copyCode, coverUrl}`, `issueDate`, `dueDate`, `returnedAt`, `renewalCount`, `maxRenewalsSnapshot`, `status` (`ACTIVE`, `OVERDUE`, `RETURNED`, `LOST`), `completionConfirmed`, `completedAt`, `version` | Unique: `{receiptNumber: 1}`; Partial Unique: `{copyId: 1}` where `status in ["ACTIVE", "OVERDUE"]` (prevents double-issuing same physical copy); Compound: `{memberId: 1, status: 1}`, `{branchId: 1, status: 1, dueDate: 1}` |
| 9 | `book_returns` | `_id`, `returnReceiptNumber`, `issueId`, `copyId`, `bookId`, `branchId`, `memberId`, `processedByUserId`, `returnedAt`, `conditionOnReturn`, `overdueDays`, `fineGeneratedAmount` (`Decimal128`, INR), `fineId`, `notes` | Unique: `{returnReceiptNumber: 1}`, `{issueId: 1}`; Compound: `{branchId: 1, returnedAt: -1}` |
| 10 | `reservations` | `_id`, `bookId`, `branchId`, `memberId`, `status` (`WAITING`, `READY_FOR_PICKUP`, `FULFILLED`, `EXPIRED`, `CANCELLED`), `allocatedCopyId`, `queuedAt`, `allocatedAt`, `expiresAt`, `fulfilledAt`, `cancelledAt`, `notifiedReady`, `version` | Partial Unique: `{bookId: 1, branchId: 1, memberId: 1}` where `status in ["WAITING", "READY_FOR_PICKUP"]` (prevents duplicate active reservation); Compound FIFO: `{bookId: 1, branchId: 1, status: 1, queuedAt: 1}`; Expiry: `{status: 1, expiresAt: 1}` |
| 11 | `fines` | `_id`, `issueId`, `memberId`, `branchId`, `reason` (`OVERDUE`, `DAMAGE`, `LOST`), `currency` (`INR`), `amount` (`Decimal128`), `paidAmount` (`Decimal128`), `waivedAmount` (`Decimal128`), `status` (`PENDING`, `PARTIALLY_PAID`, `PAID`, `WAIVED`), `waivedByUserId`, `waiverReason`, `assessedAt`, `settledAt`, `version` | Compound: `{memberId: 1, status: 1}`, `{branchId: 1, status: 1}`, `{issueId: 1, reason: 1}` |
| 12 | `fine_payments` | `_id`, `receiptNumber`, `fineId`, `memberId`, `branchId`, `currency` (`INR`), `amount` (`Decimal128`), `paymentMethod` (`MOCK_UPI`, `MOCK_CARD`, `DESK_CASH`), `gatewayMode` (`MOCK_DEV`), `externalReference`, `status` (`COMPLETED`, `FAILED`, `REFUNDED`), `recordedByUserId`, `paidAt` | Unique: `{receiptNumber: 1}`; Compound: `{memberId: 1, paidAt: -1}`, `{fineId: 1}` |
| 13 | `notifications` | `_id`, `userId`, `branchId`, `type` (enum of 12 events), `title`, `message`, `referenceType`, `referenceId`, `read`, `readAt`, `emailStatus` (`SKIPPED_DEV`, `SENT`, `FAILED`), `idempotencyKey` | Partial Unique: `{idempotencyKey: 1}` where `idempotencyKey != null`; Compound: `{userId: 1, read: 1, createdAt: -1}` |
| 14 | `audit_logs` | `_id`, `actorUserId`, `actorRole`, `branchId`, `action`, `entityType`, `entityId`, `beforeSummary`, `afterSummary`, `ipAddress`, `userAgent`, `status` (`SUCCESS`, `DENIED`, `FAILURE`), `timestamp` | Compound: `{branchId: 1, timestamp: -1}`, `{actorUserId: 1, timestamp: -1}`, `{entityType: 1, entityId: 1}` |
| 15 | `library_policies` | `_id`, `scope` (`GLOBAL`, `BRANCH`), `branchId` (null for global), `currency` (`INR`), `rolePolicies` `{STUDENT: {maxBooks, borrowDays, maxRenewals}, FACULTY: {...}}`, `gracePeriodDays`, `finePerDay` (`Decimal128`), `maxFineAmount` (`Decimal128`), `reservationHoldHours`, `seatCheckInGraceMinutes`, `active` | Unique: `{scope: 1, branchId: 1}` |
| 16 | `book_transfers` | `_id`, `transferCode`, `copyId`, `bookId`, `fromBranchId`, `toBranchId`, `requestedByUserId`, `approvedByUserId`, `status` (`REQUESTED`, `APPROVED`, `IN_TRANSIT`, `RECEIVED`, `REJECTED`, `CANCELLED`), `reason`, `rejectionReason`, `shippedAt`, `receivedAt`, `version` | Unique: `{transferCode: 1}`; Compound: `{fromBranchId: 1, status: 1}`, `{toBranchId: 1, status: 1}` |
| 17 | `refresh_tokens` | `_id`, `userId`, `tokenFamilyId`, `tokenHash`, `expiresAt`, `revoked`, `revokedAt`, `replacedByTokenHash`, `deviceInfo` | Unique: `{tokenHash: 1}`; TTL: `{expiresAt: 1}` (`expireAfterSeconds: 0`); Compound: `{userId: 1, tokenFamilyId: 1}` |

### B. Innovation Collections (18–32)

| # | Collection | Key Fields & Embedded Structures | Critical Indexes |
|---|---|---|---|
| 18 | `reading_profiles` | `_id`, `userId`, `categoryAffinities[]` `{categoryId, categoryName, score, borrowCount}`, `favoriteAuthors[]` `{authorName, count}`, `topSubjects[]`, `monthlyActivity[]` `{yearMonth, borrowed, completed}`, `totalBorrowed`, `totalCompleted`, `avgReadingDays`, `currentStreakMonths`, `lastComputedAt` | Unique: `{userId: 1}` |
| 19 | `reading_history` | `_id`, `userId`, `bookId`, `issueId`, `categoryId`, `authorNames[]`, `borrowedAt`, `returnedAt`, `completionStatus` (`IN_PROGRESS`, `RETURNED_UNVERIFIED`, `COMPLETED_VERIFIED`), `readingDurationDays`, `rating` | Compound: `{userId: 1, borrowedAt: -1}`, `{userId: 1, categoryId: 1}`, `{issueId: 1}` (unique) |
| 20 | `seat_reservations` | `_id`, `seatId`, `branchId`, `userId`, `reservationDate` (`YYYY-MM-DD`), `startTime`, `endTime`, `status` (`CONFIRMED`, `CHECKED_IN`, `COMPLETED`, `CANCELLED`, `EXPIRED`, `NO_SHOW`), `checkInDeadline`, `checkedInAt`, `checkedOutAt`, `version` | Compound overlap check: `{seatId: 1, reservationDate: 1, status: 1, startTime: 1, endTime: 1}`; User conflict check: `{userId: 1, reservationDate: 1, status: 1, startTime: 1, endTime: 1}`; Expiry: `{status: 1, checkInDeadline: 1}` |
| 21 | `library_seats` | `_id`, `branchId`, `seatCode`, `floor`, `zone` (`QUIET_STUDY`, `COLLABORATIVE`, `COMPUTER_CARREL`, `ACCESSIBLE`), `row`, `column`, `amenities[]` (`POWER`, `LAMP`, `ACCESSIBLE_DESK`), `status` (`ACTIVE`, `MAINTENANCE`, `UNAVAILABLE`), `version` | Unique: `{branchId: 1, seatCode: 1}`; Compound: `{branchId: 1, floor: 1, zone: 1, status: 1}` |
| 22 | `reading_challenges` | `_id`, `scope` (`PERSONAL`, `CAMPUS`), `branchId`, `creatorUserId`, `title`, `description`, `targetBooks`, `targetCategoryId`, `startDate`, `endDate`, `participants[]` `{userId, verifiedCount, completedAt, status}`, `active` | Compound: `{scope: 1, active: 1, endDate: 1}`, `{"participants.userId": 1}` |
| 23 | `achievements` | `_id`, `userId`, `badgeCode` (`FIRST_BORROW`, `FIVE_COMPLETED`, `READING_EXPLORER`, `MONTHLY_CHAMPION`, `RESEARCH_ENTHUSIAST`), `title`, `description`, `earnedAt`, `evidenceType`, `evidenceRefIds[]` | Unique: `{userId: 1, badgeCode: 1}` |
| 24 | `book_exchange_listings` | `_id`, `ownerUserId`, `branchId`, `title`, `author`, `isbn`, `subject`, `condition` (`LIKE_NEW`, `GOOD`, `FAIR`, `ACCEPTABLE`), `listingType` (`EXCHANGE`, `DONATION`), `description`, `photoUrls[]`, `status` (`AVAILABLE`, `REQUESTED`, `COMPLETED`, `REMOVED_BY_MOD`, `ARCHIVED`), `reportCount`, `reports[]` `{reporterId, reason, reportedAt}`, `version` | Compound: `{status: 1, subject: 1, createdAt: -1}`, `{ownerUserId: 1, status: 1}` |
| 25 | `exchange_requests` | `_id`, `listingId`, `ownerUserId`, `requesterUserId`, `offeredBookTitle`, `message`, `status` (`PENDING`, `APPROVED`, `REJECTED`, `COMPLETED`, `CANCELLED`), `respondedAt`, `version` | Compound: `{listingId: 1, requesterUserId: 1, status: 1}`, `{ownerUserId: 1, status: 1}` |
| 26 | `reading_lists` | `_id`, `userId`, `title`, `subject`, `description`, `tags[]`, `items[]` `{bookId, addedAt, bookMetaSnapshot}` | Compound: `{userId: 1, subject: 1}` |
| 27 | `research_notes` | `_id`, `userId`, `readingListId`, `bookId`, `title`, `content`, `pageReference`, `tags[]` | Compound: `{userId: 1, readingListId: 1}`, `{userId: 1, bookId: 1}` |
| 28 | `course_reading_lists` | `_id`, `courseCode`, `courseTitle`, `department`, `semester`, `facultyUserId`, `branchId`, `enrolledStudentIds[]`, `materials[]` `{bookId, materialType, required, notes, alternativeBookIds[]}`, `published` | Unique: `{courseCode: 1, semester: 1}`; Compound: `{facultyUserId: 1}`, `{enrolledStudentIds: 1}` |
| 29 | `acquisition_suggestions` | `_id`, `bookId`, `branchId`, `currentCopies`, `availableCopies`, `rolling90dBorrows`, `activeReservations`, `demandToInventoryRatio`, `suggestedAdditionalCopies`, `priority` (`HIGH`, `MEDIUM`, `LOW`), `explanation`, `status` (`PENDING`, `APPROVED`, `REJECTED`), `reviewedByUserId`, `rejectionReason`, `reviewedAt` | Compound: `{branchId: 1, status: 1, priority: 1}`, `{bookId: 1, branchId: 1, status: 1}` |
| 30 | `demand_forecasts` | `_id`, `bookId`, `branchId`, `categoryId`, `forecastPeriod` (`YYYY-MM`), `historicalMonthlyBorrows[]` `{month, actualBorrows, actualReservations}`, `predictedBorrows`, `confidenceLow`, `confidenceHigh`, `examPeriodFactor`, `methodologyNote`, `generatedAt` | Unique: `{bookId: 1, branchId: 1, forecastPeriod: 1}`; Compound: `{branchId: 1, forecastPeriod: 1, predictedBorrows: -1}` |
| 31 | `kiosk_transactions` | `_id`, `kioskId`, `branchId`, `memberId`, `copyId`, `action` (`ISSUE`, `RETURN`, `RESERVATION_LOOKUP`, `AVAILABILITY_CHECK`), `linkedTransactionId`, `status` (`SUCCESS`, `DENIED`), `denialReason`, `timestamp` | Compound: `{branchId: 1, timestamp: -1}`, `{memberId: 1, timestamp: -1}` |
| 32 | `lost_found_reports` | `_id`, `incidentCode`, `copyId`, `bookId`, `branchId`, `relatedIssueId`, `reportedByUserId`, `memberId`, `incidentType` (`LOST`, `DAMAGED`, `RECOVERED`), `status` (`REPORTED`, `UNDER_REVIEW`, `VERIFIED_LOST`, `VERIFIED_DAMAGED`, `RECOVERED_VERIFIED`, `CLOSED`), `description`, `recoveryDetails`, `penaltyFineId`, `verifiedByLibrarianId`, `verifiedAt`, `version` | Unique: `{incidentCode: 1}`; Compound: `{branchId: 1, status: 1}`, `{copyId: 1, createdAt: -1}` |

---

## 4. Document Relationship & Reference Strategy

1. **Embed Closely-Coupled, Bounded Data**
   - `book_copies.location` (`floor`, `section`, `rack`, `shelf`) is embedded because shelf lookup always reads the physical copy and its coordinates together in one query.
   - `book_issues.bookSnapshot` embeds immutable display attributes (`title`, `isbn`, `copyCode`, `coverUrl`) so historical receipts and borrowing lists render without fan-out `$lookup` joins even if catalog metadata changes later.
   - `library_branches.operatingHours` and `users.accessibilityPrefs` are small bounded subdocuments embedded directly.
2. **Reference Independently Managed or Unbounded Collections via `ObjectId`**
   - `books` (1) -> `book_copies` (N): Separated strictly so title metadata is distinct from physical asset lifecycle, barcode/QR identity, branch ownership, and physical condition.
   - `reservations`, `book_issues`, `fines`, `seat_reservations`, and `audit_logs` grow unboundedly and are top-level collections referencing `userId`, `branchId`, `bookId`, `copyId`.
3. **Strict Domain Isolation**
   - `book_exchange_listings` and `exchange_requests` NEVER reference or mutate `book_copies`, guaranteeing student-owned books remain completely separate from institutional library inventory.
4. **Denormalized Counter Integrity**
   - `books.totalCopies` and `books.availableCopies` are maintained atomically inside the same MongoDB transaction that inserts/updates `book_copies` or issues/returns a copy, with `$inc` guarded by conditional checks.

---

## 5. Role & Permission Matrix

| Capability / Module | SUPER_ADMIN | BRANCH_ADMIN | LIBRARIAN | FACULTY | STUDENT |
|---|:---:|:---:|:---:|:---:|:---:|
| Organization Analytics & Global Settings | Full | - | - | - | - |
| Branch CRUD & Branch Admin Assignment | Full | Own Branch (Read/Edit Info) | Own Branch (Read) | Read | Read |
| Manage Institutional Users | Full | Own Branch Librarians | View/Verify Branch Members | Self Only | Self Only |
| Global Borrowing Policies | Full | Read | Read | Read | Read |
| Branch Policies | Full | Own Branch | Own Branch (Read) | Read | Read |
| Catalog Books & Physical Copies | Full | Own Branch | Own Branch (CRUD + CSV + QR) | Read | Read |
| Issue / Return / Renew Desk | Full | Own Branch | Own Branch | Self Renew | Self Renew |
| FIFO Reservations Management | Full | Own Branch | Own Branch | Self Reserve/Cancel | Self Reserve/Cancel |
| Fines & Payments | Full + Waive | Own Branch + Waive | Own Branch (Record/Waive per policy) | View/Pay Own | View/Pay Own |
| Inter-Library Transfers | Full | Request & Approve Own Branch | Request Own Branch | - | - |
| Study Seats Layout & Maintenance | Full | Own Branch | Own Branch | Reserve/Check-in | Reserve/Check-in |
| Demand Analytics & Acquisition Approval | Full | Own Branch (Approve/Reject) | Own Branch (View/Review) | - | - |
| Course-Based Reading Lists | Full | Own Branch | Read | Create/Manage Own Courses | View Enrolled Courses Only |
| Reading DNA, Recommendations, Research Companion | Self | Self | Self | Self | Self |
| Reading Challenges & Campus Book Exchange | Full + Moderate | Moderate Own Branch | Moderate Own Branch | Participate | Participate |
| Lost & Found Verification | Full | Own Branch | Own Branch (Verify) | Report Own | Report Own |
| Audit Logs | Org-Wide Read | Own Branch Read | - | - | - |

**Enforcement Guarantee:** Every controller uses `@PreAuthorize`, and every service validates `BranchAccessGuard.assertBranchAccess(currentUser, targetBranchId)` and ownership checks (`resource.userId.equals(currentUser.id)`) so branch isolation and personal privacy are enforced strictly on the backend.

---

## 6. Backend Module Structure (`backend/`)

```text
backend/
├── Dockerfile
├── pom.xml
├── src/main/resources/
│   ├── application.yml
│   ├── application-dev.yml
│   └── application-prod.yml
├── src/main/java/com/smartlib/
│   ├── SmartLibApplication.java
│   ├── config/          # MongoConfig, MongoTransactionConfig, OpenApiConfig, CorsConfig, SchedulingConfig
│   ├── security/        # SecurityConfig, JwtService, JwtAuthFilter, BranchScopeGuard, RateLimitFilter, UserPrincipal
│   ├── common/          # ApiResponse, PageResponse, BaseDocument, QrCodeService, MailAdapter, PaymentAdapter
│   ├── exception/       # GlobalExceptionHandler, ResourceNotFoundException, BusinessRuleException, ConflictException
│   ├── auth/            # AuthController, AuthService, RefreshTokenRepository, PasswordResetService
│   ├── user/            # UserController, UserService, UserRepository, UserDocument, DigitalCardService
│   ├── branch/          # BranchController, BranchService, BranchRepository, PolicyService, TransferService
│   ├── book/            # BookController, BookService, BookRepository, Author/Publisher/Category services, CsvImportService
│   ├── inventory/       # BookCopyController, BookCopyService, BookCopyRepository, LostFoundService
│   ├── circulation/     # CirculationController, CirculationService, BookIssueRepository, BookReturnRepository, OverdueScheduler
│   ├── reservation/     # ReservationController, ReservationService, ReservationRepository, ReservationExpiryScheduler
│   ├── seat/            # SeatController, SeatService, SeatReservationRepository, SeatExpiryScheduler
│   ├── fine/            # FineController, FineService, FinePaymentRepository, FineCalculationEngine
│   ├── notification/    # NotificationController, NotificationService, NotificationRepository, ReminderScheduler
│   ├── analytics/       # AnalyticsController, AnalyticsService (MongoTemplate Aggregation Pipelines), CsvExportService
│   ├── readingprofile/  # ReadingProfileController, ReadingProfileService, ReadingHistoryRepository
│   ├── recommendation/  # RecommendationController, ExplainableRecommendationEngine
│   ├── shelf/           # ShelfLocatorController, ShelfLocatorService
│   ├── demand/          # DemandAnalyticsController, DemandForecastService
│   ├── acquisition/     # AcquisitionController, AcquisitionIntelligenceService
│   ├── exchange/        # BookExchangeController, BookExchangeService, ModerationService
│   ├── research/        # ResearchController, ResearchService, BibliographyFormatter (APA 7 & IEEE)
│   ├── course/          # CourseController, CourseReadingListService
│   ├── challenge/       # ChallengeController, ChallengeService, AchievementEvaluator
│   ├── kiosk/           # KioskController, KioskService, KioskTransactionRepository
│   └── audit/           # AuditLogController, AuditLogService, AuditLogRepository
└── src/test/java/com/smartlib/
    ├── auth/            # Authentication & JWT rotation tests
    ├── security/        # RBAC & Branch isolation tests
    ├── circulation/     # Issue/Return/Renew/Fine & concurrency tests
    ├── reservation/     # FIFO priority & expiry cascade tests
    ├── seat/            # Overlap prevention & double-booking tests
    └── recommendation/  # Reading DNA & explanation determinism tests
```

---

## 7. Frontend Page Structure (`frontend/`)

Built with **React + Vite + JavaScript (strictly `.js`/`.jsx`) + Tailwind CSS + React Router + Axios + Recharts + Lucide React**.

```text
frontend/
├── vercel.json                  # SPA fallback rewrites to /index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx
    ├── App.jsx                  # Route definitions + RoleProtectedRoute + AccessibilityProvider
    ├── index.css                # Tailwind v4 + SmartLib semantic design tokens + high-contrast overrides
    ├── context/
    │   ├── AuthContext.jsx
    │   └── AccessibilityContext.jsx
    ├── services/                # apiClient.js (Axios + refresh interceptor) + domain API modules
    ├── components/ui/           # Button, Card, Input, Select, DataTable, Modal, Badge, StatCard, EmptyState, Toast
    ├── layouts/                 # PublicLayout, AppShellLayout (Role sidebar + topbar + Accessibility menu), KioskLayout
    ├── pages/public/            # LandingPage, AboutPage, LoginPage, RegisterPage, ForgotPasswordPage
    ├── pages/student/           # StudentDashboard, ExploreBooks, BookDetail, MyBorrowings, MyReservations,
    │                            # ReadingDna, Recommendations, ShelfLocator, SeatReservation, ReadingChallenges,
    │                            # ResearchCompanion, CourseReadingLists, BookExchange, DigitalLibraryCard,
    │                            # Notifications, Profile
    ├── pages/librarian/         # LibrarianDashboard, BookManagement, InventoryManagement, IssueReturnDesk,
    │                            # ReservationQueue, MemberManagement, FineManagement, SeatManagement,
    │                            # ShelfManagement, DemandAnalytics, AcquisitionSuggestions, LostFoundDesk, Reports
    ├── pages/branchAdmin/       # BranchAdminDashboard, BranchManagement, LibrarianManagement, BranchPolicies,
    │                            # TransferRequests, SeatAnalytics, BranchReports
    ├── pages/superAdmin/        # SuperAdminDashboard, OrganizationBranches, UserManagement, GlobalPolicies,
    │                            # OrganizationAnalytics, AuditLogs, SystemSettings
    └── pages/kiosk/             # SelfServiceKioskPage
```

---

## 8. API Development Roadmap

All APIs return `{ "success": true, "data": ..., "message": "...", "meta": { "page", "size", "totalElements", "totalPages" }, "timestamp": "..." }` and errors return `{ "success": false, "errorCode": "...", "message": "...", "fieldErrors": [...], "timestamp": "..." }`.

- **Phase 3 (Auth & Users)**: `/api/auth/{register,login,refresh,logout,forgot-password,reset-password}`, `/api/users/**`, `/api/users/me/digital-card`
- **Phase 4 (Catalog & Inventory)**: `/api/books/**`, `/api/books/import-csv`, `/api/copies/**`, `/api/authors`, `/api/publishers`, `/api/categories`
- **Phase 5 (Circulation, Fines, Reservations)**: `/api/circulation/{issue,return,renew,history,active,overdue}`, `/api/reservations/**`, `/api/fines/**`, `/api/fines/{id}/{pay,waive}`
- **Phase 6 (Reading DNA, Recommendations, Shelf)**: `/api/reading-profile/{me,history}`, `/api/recommendations/**`, `/api/shelf/{search,location/{copyId},verify}`
- **Phase 7 (Seats, Demand, Acquisition)**: `/api/seats/**`, `/api/seats/reservations/**`, `/api/seats/{check-in,check-out}`, `/api/analytics/demand`, `/api/acquisition/suggestions/**`
- **Phase 8 (Research, Courses, Challenges, Exchange, Lost & Found, Kiosk)**: `/api/research/{lists,notes,bibliography}`, `/api/courses/**`, `/api/challenges/**`, `/api/achievements/me`, `/api/exchange/{listings,requests}/**`, `/api/lost-found/**`, `/api/kiosk/**`
- **Phase 9 (Multi-Branch, Notifications, Analytics, Audit)**: `/api/branches/**`, `/api/policies/**`, `/api/transfers/**`, `/api/notifications/**`, `/api/analytics/{dashboard,borrowing-trends,popular-books,seat-occupancy}`, `/api/audit-logs`

---

## 9. Security Architecture

1. **Authentication & Token Lifecycle**:
   - Passwords hashed with BCrypt (strength 12). Never logged or returned in DTOs.
   - Short-lived JWT Access Token (HMAC-SHA256 via `JWT_SECRET`, 15 min TTL) carrying `sub`, `role`, `branchId`, `jti`.
   - Opaque 256-bit Refresh Token stored as SHA-256 hash in `refresh_tokens` with **Refresh Token Rotation & Replay Detection**: presenting an already-rotated token immediately revokes the entire `tokenFamilyId`.
2. **Authorization & Multi-Tenant Branch Isolation**:
   - Method-level `@PreAuthorize` combined with a mandatory `BranchScopeGuard`.
   - For `BRANCH_ADMIN` and `LIBRARIAN`, `branchId` filters are injected from the verified `UserPrincipal`, preventing cross-branch IDOR attacks.
   - For `STUDENT`/`FACULTY`, personal records (`book_issues`, `fines`, `reservations`, `reading_lists`, `seat_reservations`) strictly filter by `principal.userId`.
3. **Abuse & Privacy Protection**:
   - Token-bucket rate limiting on authentication, password reset, and kiosk endpoints.
   - QR payloads contain only opaque UUID tokens (`qrToken`), resolved server-side after authorization.
   - Strict CORS origins from `FRONTEND_URL`; production secrets injected strictly via environment variables.

---

## 10. Deployment Architecture

- **Frontend (Vercel)**: Connected to `/frontend`, build command `npm run build`, output `dist`, `vercel.json` rewriting all non-asset paths to `/index.html`, env `VITE_API_BASE_URL=https://<render-service>/api`.
- **Backend (Render)**: Multi-stage `Dockerfile` (Maven build with JDK 21 -> Eclipse Temurin 21 JRE Alpine runtime), `server.port=${PORT:8080}`, `SPRING_PROFILES_ACTIVE=prod`, health check on `/actuator/health`.
- **Database (MongoDB Atlas)**: Replica-set cluster enabling multi-document ACID transactions, `MONGODB_URI` + `MONGODB_DATABASE=smartlib`, TLS enforced, indexes registered via `@Indexed`/`@CompoundIndex` and a startup `MongoIndexInitializer`.
- **CI/CD (GitHub Actions)**: Automated test & build workflows for both `/backend` and `/frontend` on push/PR.

---

## 11. Innovation Module Implementation Strategy

1. **Smart Reading DNA**: Aggregated from real `book_issues` + `reading_history`. Computes normalized category affinity scores, top authors, monthly velocity, and completion rate (distinct from borrow count).
2. **Explainable Recommendation Engine**: Rule-based transparent scorer combining Category Affinity (40%), Author Affinity (25%), Co-Borrowing/Tag Overlap (20%), and Branch Popularity/Availability (15%). Each item returns structured `explanation` text derived directly from its winning score factors.
3. **Smart Seat Reservation**: Transactional interval conflict detection (`existing.startTime < req.endTime && existing.endTime > req.startTime`) checked for both the target seat and the requesting member, paired with scheduled no-show release after `seatCheckInGraceMinutes`.
4. **Smart Shelf Locator**: Copy-level `qrToken` + `{branch, floor, section, rack, shelf}` lookup + librarian scan verification updating `lastVerifiedAt` and reporting misplaced copies.
5. **Predictive Book Demand Analytics**: Transparent statistical forecast using weighted 6-month moving average + exam-period seasonal multiplier + unfulfilled reservation demand, explicitly distinguishing `actual` vs `forecast` series.
6. **Intelligent Book Acquisition**: Computes `demandToInventoryRatio` across rolling borrows and unmet reservations; creates explainable `PENDING` suggestions requiring explicit Librarian/Branch Admin approval or rejection with reason.
7. **Research Companion**: Lists, structured notes, tags, and deterministic APA 7th / IEEE bibliography exporter using only persisted catalog metadata (never fabricating missing fields).
8. **Course-Based Reading Lists**: Faculty-authored lists restricted to enrolled students (`enrolledStudentIds`), enriched with live branch copy availability and edition alternatives.
9. **Reading Challenges & Achievements**: Verified milestone evaluator triggered on confirmed reading completion/activity; badges stored idempotently via unique `{userId, badgeCode}`.
10. **Campus Book Exchange**: Isolated student-owned listings (`EXCHANGE`/`DONATION`), request approval workflow, and admin/librarian moderation queue.
11. **Accessibility-First Library**: Persistent font-size scale, high-contrast Warm Ivory/Charcoal theme, skip links, focus rings, semantic HTML, and ARIA announcements.
12. **Self-Service Kiosk**: Reuses the exact secured circulation/reservation services with audit logging in `kiosk_transactions`.
13. **Lost & Found Book Recovery**: Verified copy incident workflow updating copy status, optional penalty fine generation, and immutable audit entries.

---

## 12. Concurrency, Transactions, Scheduling & Special Indexes

| Feature | Technical Risk | Engineering Control |
|---|---|---|
| **Simultaneous Book Issuing** | Two librarians/kiosks issue the same physical copy concurrently | MongoDB `@Transactional` + atomic `findAndModify` requiring `status == AVAILABLE` + partial unique index on `book_issues(copyId)` for active issues + `@Version` |
| **FIFO Reservation Allocation** | Two returned copies or concurrent cancellations mis-assign queue order | Transactional allocation selecting earliest `WAITING` reservation ordered by `{queuedAt: 1}` using compound index `{bookId, branchId, status, queuedAt}` + optimistic locking |
| **Seat Double-Booking** | Two students book overlapping slots on the same seat, or one student books two seats at once | `@Transactional` overlap check on both `seatId` and `userId` with optimistic version bump on `library_seats` to serialize concurrent bookings per seat |
| **Idempotent Scheduled Jobs** | Duplicate overdue fines or duplicate reminder emails across runs | Unique `idempotencyKey` on `notifications` (e.g., `OVERDUE:{issueId}:{yyyy-MM-dd}`) and deterministic fine recalculation based on elapsed overdue days minus already-billed days |
| **Token Replay Attacks** | Stolen refresh token reused after rotation | `refresh_tokens` family tracking + TTL index + immediate family revocation on reuse |

---

## 13. Development Milestones (Phases 1–14)

- **Phase 1 (Current)**: System Architecture, 32-collection MongoDB schema, RBAC matrix, security & deployment design.
- **Phase 2**: Spring Boot 3.x + Maven foundation, MongoDB Atlas configuration, common DTOs, centralized exception handling, OpenAPI, structured logging.
- **Phase 3**: Authentication (JWT + Refresh Rotation + BCrypt + Reset), Spring Security, RBAC, Branch Scope Guard.
- **Phase 4**: Core Book Catalog (`books`, `book_copies`, authors/publishers/categories, CSV import, inventory history).
- **Phase 5**: Smart Circulation (issue, return, renew, policy engine, automatic fines, receipts) + FIFO Reservation Queue + Schedulers.
- **Phase 6**: Innovation Part 1 — Smart Reading DNA, Explainable Recommendation Engine, Smart Shelf Locator & QR generation.
- **Phase 7**: Innovation Part 2 — Smart Seat Reservation (with overlap concurrency control), Predictive Demand Analytics, Intelligent Acquisition.
- **Phase 8**: Innovation Part 3 — Research Companion (APA/IEEE), Course Reading Lists, Reading Challenges & Achievements, Campus Book Exchange, Lost & Found, Self-Service Kiosk.
- **Phase 9**: Multi-Branch Administration, Branch Policies, Inter-Library Transfers, Analytics Aggregation Pipelines, Audit Logs, Notification Center.
- **Phase 10**: Frontend Design System (Warm Ivory / Charcoal / Forest Green / Muted Olive), Institutional Landing Page, Auth, and all 4 Role Dashboards + Innovation UIs (React + Vite + JavaScript).
- **Phase 11**: End-to-End Frontend ↔ Backend API integration, protected routes, accessibility controls, loading/error states.
- **Phase 12**: Automated Backend (JUnit 5, Mockito, concurrency/security tests) & Frontend verification tests.
- **Phase 13**: Docker, `docker-compose.yml`, `vercel.json`, GitHub Actions CI/CD, Render + Vercel + MongoDB Atlas deployment configuration & documentation.
- **Phase 14**: Final end-to-end verification and production readiness sign-off.
