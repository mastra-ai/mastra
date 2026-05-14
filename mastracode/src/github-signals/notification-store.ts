import { createHash } from 'node:crypto';
import process from 'node:process';

import { createClient } from '@libsql/client';
import type { Client } from '@libsql/client';

import { getDatabasePath } from '../utils/project.js';

const VERSION = 1;
const MAX_NOTIFICATIONS_PER_PR = 50;
const MAX_NOTIFICATION_AGE_MS = 7 * 24 * 60 * 60_000;
const STALE_TOUCHED_AGE_MS = 14 * 24 * 60 * 60_000;

export interface GithubNotificationAccountState {
  version: 1;
  accountKey: string;
  etag?: string;
  checkedAt?: string;
  updatedAt?: string;
  rateLimitedUntil?: string;
  master?: {
    ownerId: string;
    pid: number;
    heartbeatAt: string;
    expiresAt: string;
  };
}

export interface GithubInboxNotification {
  id: string;
  repo: string;
  prNumber: number;
  title: string;
  subjectType?: string;
  reason?: string;
  url?: string;
  subjectUrl?: string;
  latestCommentUrl?: string;
  updatedAt: string;
  payload?: unknown;
}

interface GithubNotificationRow {
  notification_id: string;
  repo: string;
  pr_number: number;
  title: string;
  subject_type: string | null;
  reason: string | null;
  url: string | null;
  subject_url: string | null;
  latest_comment_url: string | null;
  updated_at: string;
  payload_json: string | null;
}

export function deriveGithubNotificationAccountKey(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 24);
}

export function parseGithubNotificationPr(input: unknown): { repo: string; prNumber: number } | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const record = input as Record<string, unknown>;
  const repository = record.repository;
  const repo =
    repository && typeof repository === 'object' && !Array.isArray(repository)
      ? (repository as Record<string, unknown>).full_name
      : undefined;
  if (typeof repo !== 'string' || !repo.includes('/')) return undefined;

  const subject = record.subject;
  const subjectUrl =
    subject && typeof subject === 'object' && !Array.isArray(subject)
      ? (subject as Record<string, unknown>).url
      : undefined;
  const latestCommentUrl = record.latest_comment_url;
  const prNumber = parsePrNumberFromUrl(subjectUrl) ?? parsePrNumberFromUrl(latestCommentUrl);
  if (!prNumber) return undefined;
  return { repo, prNumber };
}

export function normalizeGithubInboxNotification(input: unknown): GithubInboxNotification | undefined {
  const match = parseGithubNotificationPr(input);
  if (!match || !input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const record = input as Record<string, unknown>;
  const subject = record.subject;
  const subjectRecord =
    subject && typeof subject === 'object' && !Array.isArray(subject)
      ? (subject as Record<string, unknown>)
      : undefined;
  const id = stringValue(record.id);
  const title = stringValue(subjectRecord?.title) ?? 'GitHub notification';
  const updatedAt = stringValue(record.updated_at) ?? new Date().toISOString();
  if (!id) return undefined;
  return {
    id,
    repo: match.repo,
    prNumber: match.prNumber,
    title,
    subjectType: stringValue(subjectRecord?.type),
    reason: stringValue(record.reason),
    url: stringValue(record.url),
    subjectUrl: stringValue(subjectRecord?.url),
    latestCommentUrl: stringValue(record.latest_comment_url),
    updatedAt,
    payload: input,
  };
}

export class GithubNotificationStore {
  readonly ownerId = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  #client: Client;
  #initPromise?: Promise<void>;
  #now: () => Date;

  constructor(options: { client?: Client; url?: string; now?: () => Date } = {}) {
    this.#client = options.client ?? createClient({ url: options.url ?? `file:${getDatabasePath()}` });
    this.#now = options.now ?? (() => new Date());
  }

  async init(): Promise<void> {
    if (!this.#initPromise) this.#initPromise = this.#init();
    await this.#initPromise;
  }

  async getAccountState(accountKey: string): Promise<GithubNotificationAccountState> {
    await this.init();
    await this.#ensureAccount(accountKey);
    const result = await this.#client.execute({
      sql: 'SELECT * FROM github_notification_accounts WHERE account_key = ?',
      args: [accountKey],
    });
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return this.#accountStateFromRow(accountKey, row);
  }

  async updateAccountState(
    accountKey: string,
    updates: Pick<GithubNotificationAccountState, 'etag' | 'checkedAt' | 'updatedAt' | 'rateLimitedUntil'>,
  ): Promise<void> {
    await this.init();
    await this.#ensureAccount(accountKey);
    await this.#client.execute({
      sql: `UPDATE github_notification_accounts
        SET etag = COALESCE(?, etag), checked_at = COALESCE(?, checked_at), updated_at = COALESCE(?, updated_at),
            rate_limited_until = ?, version = ?
        WHERE account_key = ?`,
      args: [
        updates.etag ?? null,
        updates.checkedAt ?? null,
        updates.updatedAt ?? null,
        updates.rateLimitedUntil ?? null,
        VERSION,
        accountKey,
      ],
    });
  }

  async acquireMasterLease(accountKey: string, ttlMs: number): Promise<boolean> {
    await this.init();
    await this.#ensureAccount(accountKey);
    const now = this.#now().toISOString();
    const expiresAt = new Date(this.#now().getTime() + ttlMs).toISOString();
    const result = await this.#client.execute({
      sql: `UPDATE github_notification_accounts
        SET master_owner_id = ?, master_pid = ?, master_heartbeat_at = ?, master_expires_at = ?
        WHERE account_key = ? AND (master_expires_at IS NULL OR master_expires_at <= ? OR master_owner_id = ?)`,
      args: [this.ownerId, process.pid, now, expiresAt, accountKey, now, this.ownerId],
    });
    return Number(result.rowsAffected) > 0;
  }

  async heartbeatMasterLease(accountKey: string, ttlMs: number): Promise<boolean> {
    await this.init();
    const now = this.#now().toISOString();
    const expiresAt = new Date(this.#now().getTime() + ttlMs).toISOString();
    const result = await this.#client.execute({
      sql: `UPDATE github_notification_accounts
        SET master_pid = ?, master_heartbeat_at = ?, master_expires_at = ?
        WHERE account_key = ? AND master_owner_id = ?`,
      args: [process.pid, now, expiresAt, accountKey, this.ownerId],
    });
    return Number(result.rowsAffected) > 0;
  }

  async releaseMasterLease(accountKey: string): Promise<void> {
    await this.init();
    await this.#client.execute({
      sql: `UPDATE github_notification_accounts
        SET master_owner_id = NULL, master_pid = NULL, master_heartbeat_at = NULL, master_expires_at = NULL
        WHERE account_key = ? AND master_owner_id = ?`,
      args: [accountKey, this.ownerId],
    });
  }

  async upsertNotifications(accountKey: string, notifications: GithubInboxNotification[]): Promise<void> {
    await this.init();
    await this.#ensureAccount(accountKey);
    const now = this.#now().toISOString();
    for (const notification of notifications) {
      await this.#client.execute({
        sql: `INSERT INTO github_notifications
          (account_key, notification_id, repo, pr_number, title, subject_type, reason, url, subject_url, latest_comment_url, updated_at, touched_at, payload_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(account_key, notification_id) DO UPDATE SET
            repo = excluded.repo,
            pr_number = excluded.pr_number,
            title = excluded.title,
            subject_type = excluded.subject_type,
            reason = excluded.reason,
            url = excluded.url,
            subject_url = excluded.subject_url,
            latest_comment_url = excluded.latest_comment_url,
            updated_at = excluded.updated_at,
            touched_at = excluded.touched_at,
            payload_json = excluded.payload_json`,
        args: [
          accountKey,
          notification.id,
          notification.repo,
          notification.prNumber,
          notification.title,
          notification.subjectType ?? null,
          notification.reason ?? null,
          notification.url ?? null,
          notification.subjectUrl ?? null,
          notification.latestCommentUrl ?? null,
          notification.updatedAt,
          now,
          JSON.stringify(notification.payload ?? notification),
        ],
      });
      await this.#prunePr(accountKey, notification.repo, notification.prNumber);
    }
    await this.pruneStaleNotifications();
  }

  async readPrNotifications(accountKey: string, repo: string, prNumber: number): Promise<GithubInboxNotification[]> {
    await this.init();
    const minUpdatedAt = new Date(this.#now().getTime() - MAX_NOTIFICATION_AGE_MS).toISOString();
    const result = await this.#client.execute({
      sql: `SELECT * FROM github_notifications
        WHERE account_key = ? AND repo = ? AND pr_number = ? AND updated_at >= ?
        ORDER BY updated_at DESC, notification_id DESC
        LIMIT ?`,
      args: [accountKey, repo, prNumber, minUpdatedAt, MAX_NOTIFICATIONS_PER_PR],
    });
    return (result.rows as unknown as GithubNotificationRow[]).map(rowToNotification).reverse();
  }

  async pruneStaleNotifications(): Promise<void> {
    await this.init();
    const minTouchedAt = new Date(this.#now().getTime() - STALE_TOUCHED_AGE_MS).toISOString();
    const minUpdatedAt = new Date(this.#now().getTime() - MAX_NOTIFICATION_AGE_MS).toISOString();
    await this.#client.execute({
      sql: 'DELETE FROM github_notifications WHERE touched_at < ? OR updated_at < ?',
      args: [minTouchedAt, minUpdatedAt],
    });
  }

  async #init(): Promise<void> {
    await this.#client.execute(`CREATE TABLE IF NOT EXISTS github_notification_accounts (
      account_key TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      etag TEXT,
      checked_at TEXT,
      updated_at TEXT,
      rate_limited_until TEXT,
      master_owner_id TEXT,
      master_pid INTEGER,
      master_heartbeat_at TEXT,
      master_expires_at TEXT
    )`);
    await this.#client.execute(`CREATE TABLE IF NOT EXISTS github_notifications (
      account_key TEXT NOT NULL,
      notification_id TEXT NOT NULL,
      repo TEXT NOT NULL,
      pr_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      subject_type TEXT,
      reason TEXT,
      url TEXT,
      subject_url TEXT,
      latest_comment_url TEXT,
      updated_at TEXT NOT NULL,
      touched_at TEXT NOT NULL,
      payload_json TEXT,
      PRIMARY KEY (account_key, notification_id)
    )`);
    await this.#client.execute(
      'CREATE INDEX IF NOT EXISTS idx_github_notifications_pr ON github_notifications(account_key, repo, pr_number, updated_at DESC)',
    );
    await this.#client.execute(
      'CREATE INDEX IF NOT EXISTS idx_github_notifications_touched ON github_notifications(touched_at)',
    );
  }

  async #ensureAccount(accountKey: string): Promise<void> {
    await this.#client.execute({
      sql: 'INSERT OR IGNORE INTO github_notification_accounts (account_key, version) VALUES (?, ?)',
      args: [accountKey, VERSION],
    });
  }

  async #prunePr(accountKey: string, repo: string, prNumber: number): Promise<void> {
    const minUpdatedAt = new Date(this.#now().getTime() - MAX_NOTIFICATION_AGE_MS).toISOString();
    await this.#client.execute({
      sql: `DELETE FROM github_notifications
        WHERE account_key = ? AND repo = ? AND pr_number = ? AND updated_at < ?`,
      args: [accountKey, repo, prNumber, minUpdatedAt],
    });
    await this.#client.execute({
      sql: `DELETE FROM github_notifications
        WHERE account_key = ? AND repo = ? AND pr_number = ? AND notification_id NOT IN (
          SELECT notification_id FROM github_notifications
          WHERE account_key = ? AND repo = ? AND pr_number = ?
          ORDER BY updated_at DESC, notification_id DESC
          LIMIT ?
        )`,
      args: [accountKey, repo, prNumber, accountKey, repo, prNumber, MAX_NOTIFICATIONS_PER_PR],
    });
  }

  #accountStateFromRow(accountKey: string, row?: Record<string, unknown>): GithubNotificationAccountState {
    return {
      version: VERSION,
      accountKey,
      etag: stringValue(row?.etag),
      checkedAt: stringValue(row?.checked_at),
      updatedAt: stringValue(row?.updated_at),
      rateLimitedUntil: stringValue(row?.rate_limited_until),
      master: stringValue(row?.master_owner_id)
        ? {
            ownerId: stringValue(row?.master_owner_id)!,
            pid: Number(row?.master_pid ?? 0),
            heartbeatAt: stringValue(row?.master_heartbeat_at) ?? '',
            expiresAt: stringValue(row?.master_expires_at) ?? '',
          }
        : undefined,
    };
  }
}

function rowToNotification(row: GithubNotificationRow): GithubInboxNotification {
  return {
    id: row.notification_id,
    repo: row.repo,
    prNumber: Number(row.pr_number),
    title: row.title,
    subjectType: row.subject_type ?? undefined,
    reason: row.reason ?? undefined,
    url: row.url ?? undefined,
    subjectUrl: row.subject_url ?? undefined,
    latestCommentUrl: row.latest_comment_url ?? undefined,
    updatedAt: row.updated_at,
    payload: parseJson(row.payload_json),
  };
}

function parsePrNumberFromUrl(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /\/(?:pulls|issues)\/(\d+)(?:$|[/?#])/.exec(value);
  if (!match?.[1]) return undefined;
  return Number(match[1]);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function parseJson(value: string | null): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
