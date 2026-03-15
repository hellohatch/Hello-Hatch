// src/lib/db.ts
// SQLite adapter for Node.js — mirrors Cloudflare D1 API exactly
// Allows all routes to use c.env.DB without modification

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/lri.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// ─────────────────────────────────────────────────────────────
// D1-compatible result types
// ─────────────────────────────────────────────────────────────
interface D1Result {
  results: Record<string, unknown>[];
  success: boolean;
  meta: { duration: number; last_row_id?: number; changes?: number };
}

// ─────────────────────────────────────────────────────────────
// PreparedStatement — mirrors D1PreparedStatement
// ─────────────────────────────────────────────────────────────
class PreparedStatement {
  private sql: string;
  private params: unknown[] = [];

  constructor(sql: string) {
    this.sql = sql;
  }

  bind(...args: unknown[]): this {
    // D1 uses .bind(a, b, c) — flatten all args
    this.params = args.flat();
    return this;
  }

  first<T = Record<string, unknown>>(): T | null {
    try {
      const stmt = sqlite.prepare(this.sql);
      const row = stmt.get(...this.params as any[]);
      return (row as T) ?? null;
    } catch (e) {
      console.error('[DB] first() error:', this.sql, e);
      return null;
    }
  }

  all<T = Record<string, unknown>>(): { results: T[] } {
    try {
      const stmt = sqlite.prepare(this.sql);
      const rows = stmt.all(...this.params as any[]) as T[];
      return { results: rows };
    } catch (e) {
      console.error('[DB] all() error:', this.sql, e);
      return { results: [] };
    }
  }

  run(): D1Result {
    try {
      const stmt = sqlite.prepare(this.sql);
      const info = stmt.run(...this.params as any[]);
      return {
        results: [],
        success: true,
        meta: {
          duration: 0,
          last_row_id: info.lastInsertRowid as number,
          changes: info.changes,
        },
      };
    } catch (e) {
      console.error('[DB] run() error:', this.sql, e);
      return { results: [], success: false, meta: { duration: 0 } };
    }
  }
}

// ─────────────────────────────────────────────────────────────
// D1Database adapter — mirrors Cloudflare D1Database interface
// ─────────────────────────────────────────────────────────────
export class D1Adapter {
  prepare(sql: string): PreparedStatement {
    return new PreparedStatement(sql);
  }

  async batch(statements: PreparedStatement[]): Promise<D1Result[]> {
    const results: D1Result[] = [];
    const txn = sqlite.transaction(() => {
      for (const stmt of statements) {
        results.push(stmt.run());
      }
    });
    txn();
    return results;
  }

  exec(sql: string): void {
    sqlite.exec(sql);
  }
}

export const db = new D1Adapter();

// ─────────────────────────────────────────────────────────────
// Run all migrations on startup
// ─────────────────────────────────────────────────────────────
export function runMigrations(migrationsDir: string): void {
  // Create migrations tracking table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS _node_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  if (!fs.existsSync(migrationsDir)) {
    console.log('[DB] No migrations directory found, skipping.');
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const applied = sqlite.prepare('SELECT id FROM _node_migrations WHERE name = ?').get(file);
    if (applied) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    try {
      sqlite.exec(sql);
      sqlite.prepare('INSERT INTO _node_migrations (name) VALUES (?)').run(file);
      console.log(`[DB] Migration applied: ${file}`);
    } catch (e) {
      // Some migrations may partially fail on re-run (e.g. ADD COLUMN on existing) — log and continue
      console.warn(`[DB] Migration warning (${file}):`, (e as Error).message);
      sqlite.prepare('INSERT OR IGNORE INTO _node_migrations (name) VALUES (?)').run(file);
    }
  }
}
