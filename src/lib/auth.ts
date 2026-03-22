// Auth utilities — Web Crypto (Cloudflare Workers compatible)

import type { Context } from 'hono';
import type { Bindings, Variables } from '../types/index.js';

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'lri_hatch_2026');
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return (await hashPassword(password)) === hash;
}

export function createToken(payload: Record<string, unknown>): string {
  return btoa(JSON.stringify({ ...payload, iat: Date.now() }));
}

export function decodeToken(token: string): Record<string, unknown> | null {
  try { return JSON.parse(atob(token)); } catch { return null; }
}

export function getSession(c: Context): string | null {
  const cookie = c.req.header('cookie') ?? '';
  const m = cookie.match(/lri_session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function setSession(c: Context, token: string): void {
  c.header('Set-Cookie', `lri_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
}

export function clearSession(c: Context): void {
  c.header('Set-Cookie', 'lri_session=; Path=/; HttpOnly; Max-Age=0');
}

export async function requireAuth(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: () => Promise<void>
): Promise<Response | void> {
  const token = getSession(c);
  if (!token) return c.redirect('/login');

  const payload = decodeToken(token);
  if (!payload?.leaderId) return c.redirect('/login');
  if (Date.now() - (payload.iat as number) > 86_400_000) return c.redirect('/login');

  c.set('leaderId',   payload.leaderId  as number);
  c.set('orgId',      payload.orgId     as number);
  c.set('leaderRole', payload.role      as string);
  c.set('leaderName', payload.name      as string);
  await next();
}

export async function requireHatchAdmin(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: () => Promise<void>
): Promise<Response | void> {
  const token = getSession(c);
  if (!token) return c.redirect('/login');
  const payload = decodeToken(token);
  if (!payload?.leaderId) return c.redirect('/login');
  if (Date.now() - (payload.iat as number) > 86_400_000) return c.redirect('/login');
  if (payload.role !== 'hatch_admin') return c.redirect('/login?error=Access+denied');
  c.set('leaderId',   payload.leaderId  as number);
  c.set('orgId',      payload.orgId     as number);
  c.set('leaderRole', payload.role      as string);
  c.set('leaderName', payload.name      as string);
  await next();
}

export async function requireOrgAdmin(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: () => Promise<void>
): Promise<Response | void> {
  const token = getSession(c);
  if (!token) return c.redirect('/login');
  const payload = decodeToken(token);
  if (!payload?.leaderId) return c.redirect('/login');
  if (Date.now() - (payload.iat as number) > 86_400_000) return c.redirect('/login');
  if (payload.role !== 'admin' && payload.role !== 'hatch_admin') return c.redirect('/dashboard?error=Admin+access+required');
  c.set('leaderId',   payload.leaderId  as number);
  c.set('orgId',      payload.orgId     as number);
  c.set('leaderRole', payload.role      as string);
  c.set('leaderName', payload.name      as string);
  await next();
}
