import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const STORAGE_KEYS = {
  accessToken: 'smartlib_access_token',
  refreshToken: 'smartlib_refresh_token',
  user: 'smartlib_user',
};

export function getStoredSession() {
  try {
    const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken);
    const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
    const rawUser = localStorage.getItem(STORAGE_KEYS.user);
    return {
      accessToken,
      refreshToken,
      user: rawUser ? JSON.parse(rawUser) : null,
    };
  } catch {
    return { accessToken: null, refreshToken: null, user: null };
  }
}

export function saveSession({ accessToken, refreshToken, user }) {
  if (accessToken) localStorage.setItem(STORAGE_KEYS.accessToken, accessToken);
  if (refreshToken) localStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken);
  if (user) localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.refreshToken);
  localStorage.removeItem(STORAGE_KEYS.user);
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const { accessToken } = getStoredSession();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original?._retry && !original?.url?.includes('/auth/')) {
      const { refreshToken } = getStoredSession();
      if (refreshToken) {
        original._retry = true;
        try {
          if (!refreshPromise) {
            refreshPromise = axios
              .post(`${API_BASE_URL}/auth/refresh`, { refreshToken })
              .then((res) => {
                saveSession(res.data.data);
                return res.data.data.accessToken;
              })
              .finally(() => {
                refreshPromise = null;
              });
          }
          const newAccess = await refreshPromise;
          original.headers.Authorization = `Bearer ${newAccess}`;
          return apiClient(original);
        } catch {
          clearSession();
        }
      }
    }
    return Promise.reject(error);
  }
);

export function extractErrorMessage(err, fallback = 'An unexpected error occurred.') {
  return err?.response?.data?.message || err?.message || fallback;
}

export const SmartLibApi = {
  // Public
  getPublicOverview: () => apiClient.get('/public/overview').then((r) => r.data.data),

  // Auth
  login: (payload) => apiClient.post('/auth/login', payload).then((r) => r.data.data),
  register: (payload) => apiClient.post('/auth/register', payload).then((r) => r.data.data),
  logout: (refreshToken) => apiClient.post('/auth/logout', { refreshToken }).then((r) => r.data),
  forgotPassword: (email) => apiClient.post('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (payload) => apiClient.post('/auth/reset-password', payload).then((r) => r.data),
  getMe: () => apiClient.get('/auth/me').then((r) => r.data.data),

  // Profile & Users
  updateProfile: (payload) => apiClient.put('/users/me/profile', payload).then((r) => r.data.data),
  getDigitalCard: () => apiClient.get('/users/me/digital-card').then((r) => r.data.data),
  getUsers: (params) => apiClient.get('/users', { params }).then((r) => r.data.data),
  createUser: (payload) => apiClient.post('/users', payload).then((r) => r.data.data),
  updateUserStatus: (id, payload) => apiClient.put(`/users/${id}/status`, payload).then((r) => r.data.data),

  // Books & Copies
  getBooks: (params) => apiClient.get('/books', { params }).then((r) => r.data.data),
  getBookDetail: (id) => apiClient.get(`/books/${id}`).then((r) => r.data.data),
  createBook: (payload) => apiClient.post('/books', payload).then((r) => r.data.data),
  updateBook: (id, payload) => apiClient.put(`/books/${id}`, payload).then((r) => r.data.data),
  archiveBook: (id) => apiClient.delete(`/books/${id}`).then((r) => r.data),
  importBooksCsv: (csvText) => apiClient.post('/books/import-csv', { csvText }).then((r) => r.data),
  getCopies: (params) => apiClient.get('/copies', { params }).then((r) => r.data.data),
  createCopy: (payload) => apiClient.post('/copies', payload).then((r) => r.data.data),
  updateCopy: (id, payload) => apiClient.put(`/copies/${id}`, payload).then((r) => r.data.data),

  // Circulation
  issueBook: (payload) => apiClient.post('/circulation/issue', payload).then((r) => r.data),
  returnBook: (payload) => apiClient.post('/circulation/return', payload).then((r) => r.data),
  renewBook: (issueId) => apiClient.post('/circulation/renew', { issueId }).then((r) => r.data),
  confirmCompletion: (issueId) =>
    apiClient.post('/circulation/confirm-completion', { issueId }).then((r) => r.data),
  getCirculationHistory: (params) =>
    apiClient.get('/circulation/history', { params }).then((r) => r.data.data),

  // Reservations
  createReservation: (payload) => apiClient.post('/reservations', payload).then((r) => r.data),
  getMyReservations: () => apiClient.get('/reservations/my').then((r) => r.data.data),
  getAllReservations: () => apiClient.get('/reservations').then((r) => r.data.data),
  cancelReservation: (id) => apiClient.delete(`/reservations/${id}`).then((r) => r.data),

  // Fines
  getFines: (params) => apiClient.get('/fines', { params }).then((r) => r.data.data),
  payFine: (id, payload) => apiClient.post(`/fines/${id}/pay`, payload).then((r) => r.data),
  waiveFine: (id, reason) => apiClient.post(`/fines/${id}/waive`, { reason }).then((r) => r.data),

  // Reading DNA & Recommendations
  getReadingDna: () => apiClient.get('/reading-profile/me').then((r) => r.data.data),
  getRecommendations: () => apiClient.get('/recommendations').then((r) => r.data.data),

  // Shelf Locator
  searchShelf: (q) => apiClient.get('/shelf/search', { params: { q } }).then((r) => r.data.data),
  verifyShelfCopy: (payload) => apiClient.post('/shelf/verify', payload).then((r) => r.data),

  // Study Seats
  getSeats: (params) => apiClient.get('/seats', { params }).then((r) => r.data.data),
  createSeat: (payload) => apiClient.post('/seats', payload).then((r) => r.data.data),
  updateSeat: (id, payload) => apiClient.put(`/seats/${id}`, payload).then((r) => r.data.data),
  reserveSeat: (payload) => apiClient.post('/seats/reservations', payload).then((r) => r.data),
  getMySeatReservations: () => apiClient.get('/seats/reservations/my').then((r) => r.data.data),
  checkInSeat: (reservationId) => apiClient.post('/seats/check-in', { reservationId }).then((r) => r.data),
  checkOutSeat: (reservationId) => apiClient.post('/seats/check-out', { reservationId }).then((r) => r.data),
  cancelSeatReservation: (id) => apiClient.delete(`/seats/reservations/${id}`).then((r) => r.data),

  // Demand Analytics & Acquisition
  getDemandAnalytics: () => apiClient.get('/analytics/demand').then((r) => r.data.data),
  getAcquisitionSuggestions: () => apiClient.get('/acquisition/suggestions').then((r) => r.data.data),
  approveAcquisition: (id) => apiClient.put(`/acquisition/suggestions/${id}/approve`).then((r) => r.data),
  rejectAcquisition: (id, reason) =>
    apiClient.put(`/acquisition/suggestions/${id}/reject`, { reason }).then((r) => r.data),

  // Research Companion
  getResearchLists: () => apiClient.get('/research/lists').then((r) => r.data.data),
  createResearchList: (payload) => apiClient.post('/research/lists', payload).then((r) => r.data.data),
  addBookToResearchList: (listId, bookId) =>
    apiClient.post(`/research/lists/${listId}/books`, { bookId }).then((r) => r.data),
  createResearchNote: (payload) => apiClient.post('/research/notes', payload).then((r) => r.data.data),
  exportBibliography: (listId, style) =>
    apiClient.get('/research/bibliography', { params: { listId, style } }).then((r) => r.data.data),

  // Courses
  getCourses: () => apiClient.get('/courses').then((r) => r.data.data),
  createCourse: (payload) => apiClient.post('/courses', payload).then((r) => r.data.data),
  addCourseMaterial: (courseId, payload) =>
    apiClient.post(`/courses/${courseId}/reading-lists`, payload).then((r) => r.data),

  // Challenges & Achievements
  getChallenges: () => apiClient.get('/challenges').then((r) => r.data.data),
  createChallenge: (payload) => apiClient.post('/challenges', payload).then((r) => r.data.data),
  joinChallenge: (id) => apiClient.post(`/challenges/${id}/join`).then((r) => r.data),

  // Campus Book Exchange
  getExchangeListings: (params) => apiClient.get('/exchange/listings', { params }).then((r) => r.data.data),
  createExchangeListing: (payload) => apiClient.post('/exchange/listings', payload).then((r) => r.data.data),
  requestExchange: (payload) => apiClient.post('/exchange/requests', payload).then((r) => r.data),
  approveExchangeRequest: (id) => apiClient.put(`/exchange/requests/${id}/approve`).then((r) => r.data),
  rejectExchangeRequest: (id) => apiClient.put(`/exchange/requests/${id}/reject`).then((r) => r.data),
  reportExchangeListing: (id, reason) =>
    apiClient.post(`/exchange/listings/${id}/report`, { reason }).then((r) => r.data),

  // Lost & Found
  getLostFoundReports: () => apiClient.get('/lost-found').then((r) => r.data.data),
  createLostFoundReport: (payload) => apiClient.post('/lost-found', payload).then((r) => r.data),
  verifyLostFoundReport: (id, payload) => apiClient.put(`/lost-found/${id}/verify`, payload).then((r) => r.data),

  // Kiosk
  kioskLookup: (payload) => apiClient.post('/kiosk/lookup', payload).then((r) => r.data.data),

  // Branches, Policies, Transfers, Notifications, Analytics, Audit
  getBranches: () => apiClient.get('/branches').then((r) => r.data.data),
  createBranch: (payload) => apiClient.post('/branches', payload).then((r) => r.data.data),
  getPolicies: () => apiClient.get('/policies').then((r) => r.data.data),
  updatePolicy: (id, payload) => apiClient.put(`/policies/${id}`, payload).then((r) => r.data.data),
  getTransfers: () => apiClient.get('/transfers').then((r) => r.data.data),
  createTransfer: (payload) => apiClient.post('/transfers', payload).then((r) => r.data),
  updateTransferStatus: (id, status) =>
    apiClient.put(`/transfers/${id}/status`, { status }).then((r) => r.data),
  getNotifications: () => apiClient.get('/notifications').then((r) => r.data.data),
  markNotificationRead: (id) => apiClient.put(`/notifications/${id}/read`).then((r) => r.data),
  getDashboardAnalytics: (params) =>
    apiClient.get('/analytics/dashboard', { params }).then((r) => r.data.data),
  exportCirculationCsv: () =>
    apiClient.get('/analytics/export-csv', { responseType: 'blob' }).then((r) => r.data),
  getAuditLogs: () => apiClient.get('/audit-logs').then((r) => r.data.data),
};
