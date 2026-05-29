const API_BASE = import.meta.env.VITE_API_URL || '';

function getToken(): string | null {
  return localStorage.getItem('pulsedesk_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    localStorage.removeItem('pulsedesk_token');
    localStorage.removeItem('pulsedesk_user');
    window.location.href = '/login';
    throw new Error('Authentication expired');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (data: { email: string; password: string; name: string; orgName: string; orgSlug: string }) =>
    request<{ token: string; user: any; org: any }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  me: () => request<any>('/api/auth/me'),

  // Teams
  getTeams: () => request<any[]>('/api/teams'),
  getTeam: (id: string) => request<any>(`/api/teams/${id}`),
  createTeam: (data: any) =>
    request<any>('/api/teams', { method: 'POST', body: JSON.stringify(data) }),
  scoreTeam: (id: string) =>
    request<any>(`/api/teams/${id}/score-now`, { method: 'POST' }),
  getTeamScores: (id: string) => request<any[]>(`/api/teams/${id}/scores`),
  getTeamReport: (id: string) => request<any>(`/api/teams/${id}/report`),

  // Dashboard
  getHeatmap: () => request<any[]>('/api/dashboard/heatmap'),
  getTrends: (teamId?: string) =>
    request<any[]>(`/api/dashboard/trends${teamId ? `?teamId=${teamId}` : ''}`),
  getSummary: () => request<any>('/api/dashboard/summary'),

  // Integrations
  getIntegrations: () => request<any[]>('/api/integrations'),
  deleteIntegration: (id: string) =>
    request<any>(`/api/integrations/${id}`, { method: 'DELETE' }),

  // Alerts
  getAlerts: (teamId?: string, unresolved?: boolean) => {
    const params = new URLSearchParams();
    if (teamId) params.set('teamId', teamId);
    if (unresolved) params.set('unresolved', 'true');
    return request<any[]>(`/api/alerts?${params}`);
  },
  resolveAlert: (id: string) =>
    request<any>(`/api/alerts/${id}/resolve`, { method: 'PATCH' }),

  // Reports
  getReports: (teamId?: string) => {
    const params = new URLSearchParams();
    if (teamId) params.set('teamId', teamId);
    return request<any[]>(`/api/reports?${params}`);
  },
  getLatestReports: () => request<any[]>('/api/reports/latest'),

  // Org
  getOrg: () => request<any>('/api/org'),

  // Config
  getConfig: () => request<{ apiUrl: string; slackClientId: string }>('/api/config'),
};

export function setToken(token: string) {
  localStorage.setItem('pulsedesk_token', token);
}

export function setUser(user: any) {
  localStorage.setItem('pulsedesk_user', JSON.stringify(user));
}

export function getUser(): any | null {
  const u = localStorage.getItem('pulsedesk_user');
  return u ? JSON.parse(u) : null;
}

export function logout() {
  localStorage.removeItem('pulsedesk_token');
  localStorage.removeItem('pulsedesk_user');
  window.location.href = '/login';
}
