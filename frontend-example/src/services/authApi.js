import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const TOKEN_KEY = 'customer_jwt';

export const authApi = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

authApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export async function sendOtp(phone: string) {
  return authApi.post('/auth/send-otp', { phone });
}

export async function verifyOtp(phone: string, otp: string) {
  return authApi.post('/auth/verify-otp', { phone, otp });
}

export async function fetchMe() {
  return authApi.get('/auth/me');
}

export async function logout() {
  return authApi.post('/auth/logout');
}
