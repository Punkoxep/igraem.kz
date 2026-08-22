const API_BASE_URL = '/api/v1';

export interface UserProfile {
  id: string;
  iin: string;
  phone_number: string;
  full_name: string;
  email?: string;
  role: string;
  birth_date?: string;
  gender?: string;
  notify_30min?: boolean;
  push_subscription?: string | null;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    token: string;
    user: UserProfile;
  };
}

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('token');
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  public getToken(): string | null {
    return this.token || localStorage.getItem('token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Ошибка сети');
    }

    return data as T;
  }

  // --- Auth APIs ---
  public async login(phoneOrIin: string | { phone_or_iin?: string; phoneOrIin?: string; password?: string }, password?: string): Promise<AuthResponse> {
    const payload = typeof phoneOrIin === 'string'
      ? { phone_or_iin: phoneOrIin, password: password || '123456' }
      : phoneOrIin;

    const res = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.data?.token) {
      this.setToken(res.data.token);
    }
    return res;
  }

  public async register(data: {
    iin?: string;
    phone?: string;
    phone_number?: string;
    full_name?: string;
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    [key: string]: any;
  }): Promise<AuthResponse> {
    const payload = {
      iin: data.iin,
      phone_number: data.phone_number || data.phone,
      full_name: data.full_name || data.fullName,
      email: data.email,
      password: data.password || '123456a',
      confirmPassword: data.confirmPassword || data.password || '123456a',
    };

    const res = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.data?.token) {
      this.setToken(res.data.token);
    }
    return res;
  }

  public async completeProfile(data: {
    fullName: string;
    iin: string;
    email: string;
    phone: string;
    password?: string;
  }): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/auth/complete-profile', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.data?.token) {
      this.setToken(res.data.token);
    }
    return res;
  }

  public async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  public async resetPassword(token: string, newPassword: string, confirmPassword?: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword, confirmPassword }),
    });
  }

  public async sendEmailVerification(email: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/user/send-email-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  public async verifyEmail(code: string): Promise<{ success: boolean; email?: string; message: string; data?: { user: UserProfile } }> {
    return this.request<{ success: boolean; email?: string; message: string; data?: { user: UserProfile } }>('/user/verify-email', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  public async getMe(): Promise<{ success: boolean; data: UserProfile }> {
    return this.request<{ success: boolean; data: UserProfile }>('/auth/me');
  }

  // --- Grounds APIs ---
  public async getGrounds(): Promise<{ success: boolean; data: any[] }> {
    return this.request('/grounds');
  }

  // --- Bookings APIs ---
  public async createBooking(payload: {
    ground_id: string;
    booking_date: string;
    start_time: string;
    end_time: string;
    is_looking_for_players?: boolean;
    needed_players_count?: number;
    auto_approve_players?: boolean;
  }): Promise<{ success: boolean; message?: string; data?: any }> {
    return this.request('/bookings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getMyBookings(): Promise<{ success: boolean; data: any }> {
    return this.request('/bookings/my');
  }

  public async cancelBooking(bookingId: string): Promise<{ success: boolean; message?: string }> {
    return this.request(`/bookings/${bookingId}/cancel`, {
      method: 'POST',
    });
  }

  public async completeBooking(bookingId: string): Promise<{ success: boolean; message?: string }> {
    return this.request(`/bookings/${bookingId}/complete`, {
      method: 'POST',
    });
  }

  public async extendBooking(bookingId: string): Promise<{ success: boolean; message?: string; data?: any }> {
    return this.request(`/bookings/${bookingId}/extend`, {
      method: 'POST',
    });
  }

  public async getGroundBookings(groundId: string, date: string): Promise<{ success: boolean; data: any[] }> {
    return this.request(`/bookings/occupied?groundId=${encodeURIComponent(groundId)}&date=${encodeURIComponent(date)}`, {
      method: 'GET',
    });
  }

  // --- Join Requests APIs ---
  public async getOpenMatchmaking(): Promise<{ success: boolean; data: any[] }> {
    return this.request('/bookings/open-matchmaking', { method: 'GET' });
  }

  public async getOpenMatchmakingGames(): Promise<{ success: boolean; data: any[] }> {
    return this.getOpenMatchmaking();
  }

  public async createJoinRequest(bookingId: string): Promise<{ success: boolean; message?: string; data?: any }> {
    return this.requestJoinSlot(bookingId);
  }

  public async requestJoinMatchmaking(bookingId: string): Promise<{ success: boolean; message?: string; data?: any }> {
    return this.requestJoinSlot(bookingId);
  }

  public async requestJoinSlot(bookingId: string): Promise<{ success: boolean; message?: string; data?: any }> {
    return this.request('/join-requests', {
      method: 'POST',
      body: JSON.stringify({ booking_id: bookingId, bookingId }),
    });
  }

  public async getMyJoinRequests(): Promise<{ success: boolean; data: any[] }> {
    return this.request('/join-requests/my', { method: 'GET' });
  }

  public async getHostRequests(): Promise<{ success: boolean; data: any[] }> {
    return this.request('/join-requests/incoming', { method: 'GET' });
  }

  public async approveJoinRequest(requestId: string): Promise<{ success: boolean; message?: string; data?: any }> {
    return this.request(`/join-requests/${requestId}/approve`, {
      method: 'PATCH',
    });
  }

  public async rejectJoinRequest(requestId: string): Promise<{ success: boolean; message?: string; data?: any }> {
    return this.request(`/join-requests/${requestId}/reject`, {
      method: 'PATCH',
    });
  }

  // --- Locks / Access Control APIs ---
  public async unlockDoor(payload: { bookingId?: string; qrCode?: string }): Promise<{ success: boolean; message?: string; data?: any }> {
    return this.request('/locks/unlock', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async adminForceUnlock(payload?: { groundId?: string }): Promise<{ success: boolean; message?: string; data?: any }> {
    return this.request('/admin/locks/force-unlock', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  }

  public async getLockStatus(lockId: string = '34275770'): Promise<{
    success: boolean;
    lockId: number | string;
    name: string;
    isOnline: boolean;
    electricQuantity: number;
    state: string;
    wifiGateway: string;
    lastSync: string;
    data?: any;
  }> {
    return this.request(`/admin/locks/${lockId}/status`);
  }

  // --- Notifications & Web Push APIs ---
  public async getVapidPublicKey(): Promise<{ success: boolean; publicKey: string }> {
    return this.request('/notifications/vapid-key');
  }

  public async getNotificationStatus(): Promise<{ success: boolean; data: { notify_30min: boolean; hasSubscription: boolean } }> {
    return this.request('/notifications/status');
  }

  public async subscribePushNotifications(payload: { subscription: any; notify30min?: boolean }): Promise<{ success: boolean; message?: string; data?: any }> {
    return this.request('/notifications/subscribe', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async toggleReminders(enabled: boolean): Promise<{ success: boolean; message?: string; data?: any }> {
    return this.request('/notifications/toggle-reminders', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  }

  public async sendTestPush(): Promise<{ success: boolean; message?: string; data?: any }> {
    return this.request('/notifications/test-push', {
      method: 'POST',
    });
  }

  // --- Issues & Complaints APIs ---
  public async createIssueReport(payload: {
    message: string;
    groundId?: string;
    ground_id?: string;
    bookingId?: string;
    booking_id?: string;
  }): Promise<{ success: boolean; message?: string; data?: any }> {
    return this.request('/issues', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getAdminIssues(filters?: {
    status?: string;
    ground_id?: string;
    search?: string;
  }): Promise<{ success: boolean; message?: string; data: any[]; metrics?: any }> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.ground_id) params.append('ground_id', filters.ground_id);
    if (filters?.search) params.append('search', filters.search);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/admin/issues${query}`);
  }

  public async updateAdminIssueStatus(
    issueId: string,
    status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED'
  ): Promise<{ success: boolean; message?: string; data?: any }> {
    return this.request(`/admin/issues/${issueId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }
}

export const api = new ApiService();
