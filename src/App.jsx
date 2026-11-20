import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, getDefaultRouteForRole, useAuth } from './context/AuthContext';
import { AccessibilityProvider } from './context/AccessibilityContext';
import { ToastProvider } from './context/ToastContext';
import { AppShellLayout, PublicLayout } from './layouts/AppLayouts';
import {
  AboutPage,
  ForgotPasswordPage,
  LandingPage,
  LoginPage,
  RegisterPage,
} from './pages/PublicPages';
import {
  DigitalLibraryCardPage,
  ExploreBooksPage,
  MyBorrowingsPage,
  MyReservationsPage,
  ProfilePage,
  StudentDashboard,
} from './pages/StudentCorePages';
import {
  BookExchangePage,
  ChallengesPage,
  CourseReadingListsPage,
  ReadingDnaPage,
  RecommendationsPage,
  ResearchCompanionPage,
  SeatReservationPage,
  ShelfLocatorPage,
} from './pages/StudentInnovationPages';
import {
  AcquisitionSuggestionsPage,
  BookManagementPage,
  DemandAnalyticsPage,
  FineManagementPage,
  IssueReturnDeskPage,
  LibrarianDashboard,
  LibrarianReservationsPage,
  MemberDirectoryPage,
  PhysicalInventoryPage,
  SeatManagementPage,
  ShelfAndLostFoundPage,
} from './pages/LibrarianPages';
import {
  AuditLogsPage,
  BranchAdminDashboard,
  BranchesManagementPage,
  PoliciesManagementPage,
  SelfServiceKioskPage,
  StaffUsersPage,
  SuperAdminDashboard,
  SystemSettingsPage,
  TransfersPage,
} from './pages/AdminAndKioskPages';

function ProtectedRoute({ allowedRoles, children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F5EF] text-sm text-[#666860]">
        Verifying institutional session...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
  }
  return children;
}

export default function App() {
  return (
    <AccessibilityProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
            {/* Public Institutional Routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            </Route>

            {/* Student & Faculty Workspace */}
            <Route
              path="/student"
              element={
                <ProtectedRoute allowedRoles={['STUDENT', 'FACULTY', 'LIBRARIAN', 'BRANCH_ADMIN', 'SUPER_ADMIN']}>
                  <AppShellLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<StudentDashboard />} />
              <Route path="explore" element={<ExploreBooksPage />} />
              <Route path="borrowings" element={<MyBorrowingsPage />} />
              <Route path="reservations" element={<MyReservationsPage />} />
              <Route path="reading-dna" element={<ReadingDnaPage />} />
              <Route path="recommendations" element={<RecommendationsPage />} />
              <Route path="shelf-locator" element={<ShelfLocatorPage />} />
              <Route path="seats" element={<SeatReservationPage />} />
              <Route path="challenges" element={<ChallengesPage />} />
              <Route path="research" element={<ResearchCompanionPage />} />
              <Route path="courses" element={<CourseReadingListsPage />} />
              <Route path="exchange" element={<BookExchangePage />} />
              <Route path="card" element={<DigitalLibraryCardPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            {/* Librarian Workspace */}
            <Route
              path="/librarian"
              element={
                <ProtectedRoute allowedRoles={['LIBRARIAN', 'BRANCH_ADMIN', 'SUPER_ADMIN']}>
                  <AppShellLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<LibrarianDashboard />} />
              <Route path="books" element={<BookManagementPage />} />
              <Route path="inventory" element={<PhysicalInventoryPage />} />
              <Route path="circulation" element={<IssueReturnDeskPage />} />
              <Route path="reservations" element={<LibrarianReservationsPage />} />
              <Route path="members" element={<MemberDirectoryPage />} />
              <Route path="fines" element={<FineManagementPage />} />
              <Route path="seats" element={<SeatManagementPage />} />
              <Route path="shelf" element={<ShelfAndLostFoundPage />} />
              <Route path="demand" element={<DemandAnalyticsPage />} />
              <Route path="acquisitions" element={<AcquisitionSuggestionsPage />} />
            </Route>

            {/* Branch Admin Workspace */}
            <Route
              path="/branch-admin"
              element={
                <ProtectedRoute allowedRoles={['BRANCH_ADMIN', 'SUPER_ADMIN']}>
                  <AppShellLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<BranchAdminDashboard />} />
              <Route path="librarians" element={<StaffUsersPage />} />
              <Route path="policies" element={<PoliciesManagementPage />} />
              <Route path="transfers" element={<TransfersPage />} />
              <Route path="audit" element={<AuditLogsPage />} />
            </Route>

            {/* Super Admin Workspace */}
            <Route
              path="/super-admin"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <AppShellLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<SuperAdminDashboard />} />
              <Route path="branches" element={<BranchesManagementPage />} />
              <Route path="users" element={<StaffUsersPage />} />
              <Route path="policies" element={<PoliciesManagementPage />} />
              <Route path="audit" element={<AuditLogsPage />} />
              <Route path="settings" element={<SystemSettingsPage />} />
            </Route>

            {/* Self-Service Kiosk */}
            <Route
              path="/kiosk"
              element={
                <ProtectedRoute allowedRoles={['STUDENT', 'FACULTY', 'LIBRARIAN', 'BRANCH_ADMIN', 'SUPER_ADMIN']}>
                  <AppShellLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<SelfServiceKioskPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      </ToastProvider>
    </AccessibilityProvider>
  );
}
