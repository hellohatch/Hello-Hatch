// Authentication utilities — simple session-based auth for Cloudflare Workers

import type { Context } from 'hono';
import type { Bindings, Variables } from '../types/index.js';

// Simple hash using Web Crypto API (available in Cloudflare Workers)
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'lsi_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

// Simple JWT-like token (base64 encoded JSON + signature)
export function createToken(payload: Record<string, unknown>): string {
  const data = JSON.stringify({ ...payload, iat: Date.now() });
  return btoa(data);
}

export function decodeToken(token: string): Record<string, unknown> | null {
  try {
    const decoded = atob(token);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function getSessionCookie(c: Context): string | null {
  const cookie = c.req.header('cookie') ?? '';
  const match = cookie.match(/lsi_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function setSessionCookie(c: Context, token: string): void {
  c.header('Set-Cookie', `lsi_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
}

export function clearSessionCookie(c: Context): void {
  c.header('Set-Cookie', 'lsi_session=; Path=/; HttpOnly; Max-Age=0');
}

export async function requireAuth(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: () => Promise<void>
): Promise<Response | void> {
  const token = getSessionCookie(c);
  if (!token) {
    return c.redirect('/login');
  }

  const payload = decodeToken(token);
  if (!payload || !payload.userId) {
    return c.redirect('/login');
  }

  // 24hr expiry
  const iat = payload.iat as number;
  if (Date.now() - iat > 86400000) {
    return c.redirect('/login');
  }

  c.set('userId', payload.userId as number);
  c.set('orgId', payload.orgId as number);
  c.set('userRole', payload.role as string);
  c.set('userName', payload.name as string);

  await next();
}
