export interface User { id: string; name: string; email: string }
export interface Booking { service?: string; date?: string; time?: string; notes?: string }
export interface Appointment {
  id: string; service: string; status: 'confirmed' | 'cancelled' | 'completed';
  source: 'chat' | 'form'; notes: string | null; date: string; time: string;
}
export interface ChatMessage { role: 'user' | 'assistant'; content: string; at: string }
export interface ChatReply {
  sessionId: string; reply: string; booking: Booking; appointment?: Appointment; requiresForm: boolean;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const BASE: string = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'hourglass.token';
let token: string | null = localStorage.getItem(TOKEN_KEY);
let onUnauthorized: (() => void) | null = null;

export const hasToken = () => token !== null;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };
export function setToken(next: string | null) {
  token = next;
  if (next) localStorage.setItem(TOKEN_KEY, next); else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // An expired token anywhere sends the person back to sign in; failed logins (no token yet) don't.
    if (res.status === 401 && token) onUnauthorized?.();
    const msg = body?.message;
    throw new ApiError(res.status, (Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Something went wrong. Please try again.');
  }
  return body as T;
}

const post = <T,>(path: string, data: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(data) });

export const api = {
  signup: (d: { name: string; email: string; password: string }) => post<{ accessToken: string; user: User }>('/auth/signup', d),
  login: (d: { email: string; password: string }) => post<{ accessToken: string; user: User }>('/auth/login', d),
  me: () => request<User>('/auth/me'),
  currentChat: () => request<{ sessionId: string; messages: ChatMessage[]; booking: Booking } | null>('/chat/sessions/current'),
  sendMessage: (d: { sessionId?: string; message: string }) => post<ChatReply>('/chat/messages', d),
  services: () => request<string[]>('/appointments/services'),
  availability: (date: string) => request<{ slots: string[] }>(`/appointments/availability?date=${date}`),
  appointments: () => request<Appointment[]>('/appointments'),
  book: (d: { service: string; date: string; time: string; notes?: string }) => post<Appointment>('/appointments', d),
  cancel: (id: string) => request<Appointment>(`/appointments/${id}/cancel`, { method: 'PATCH' }),
};
