import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
});

// Attach JWT token and Content-Type to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (!(config.data instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  connectUrl: (platform: string) =>
    api.get(`/auth/${platform}/connect`),
  disconnect: (platform: string) =>
    api.delete(`/auth/${platform}/disconnect`),
};

// Content API
export const contentApi = {
  list: (params?: Record<string, string>) =>
    api.get('/content', { params }),
  calendar: (params?: Record<string, string>) =>
    api.get('/content/calendar', { params }),
  create: (data: Record<string, unknown>) =>
    api.post('/content', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/content/${id}`, data),
  approve: (id: string) =>
    api.post(`/content/${id}/approve`),
  publishNow: (id: string) =>
    api.post(`/content/${id}/publish-now`),
  delete: (id: string) =>
    api.delete(`/content/${id}`),
};

// Analytics API
export const analyticsApi = {
  dashboard: (days?: number) =>
    api.get('/analytics/dashboard', { params: { days } }),
  platform: (platform: string, days?: number) =>
    api.get(`/analytics/${platform}`, { params: { days } }),
  exportCsv: (params?: Record<string, string>) =>
    api.get('/analytics/export/csv', { params, responseType: 'blob' }),
  exportPdf: (params?: Record<string, string>) =>
    api.get('/analytics/export/pdf', { params, responseType: 'blob' }),
};

export default api;