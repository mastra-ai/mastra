import { createHash } from 'node:crypto';
import process from 'node:process';

import { createClient } from '@libsql/client';
import type { Client } from '@libsql/client';

import { getDatabasePath } from '../utils/project.js';

const VERSION = 1;
const MAX_NOTIFICATIONS_PER_PR = 50;
const MAX_NOTIFICATION_AGE_MS = 7 * 24 * 60 * 60_000;
const STALE_TOUCHED_AGE_MS = 14 * 24 * 60 * 60_000;
const SQLITE_BUSY_RETRIES = 5;
const SQLITE_BUSY_RETRY_MS = 50;

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

export interface GithubPrSnapshotCache {
  repo: string;
  prNumber: number;
  title?: string;
  url?: string;
  state?: string;
  merged?: boolean;
  closedAt?: string;
  mergedAt?: string;
  mergeable?: boolean | string | null;
  mergeableState?: string;
  headSha?: string;
  failedChecks?: Array<{ name: string; status: string; url?: string }>;
  reviews?: Array<{ id: string; body?: string; author?: string; submittedAt?: string; state?: string; url?: string }>;
  checkedAt: string;
  checksCheckedAt?: string;
  heavyCheckedAt?: string;
  updatedAt: string;
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
  commentAuthor?: string;
  commentBody?: string;
  commentCreatedAt?: string;
  commentUpdatedAt?: string;
  commentHtmlUrl?: string;
  failedChecks?: Array<{ name: string; status: string; url?: string }>;
  prState?: string;
  prMerged?: boolean;
  prClosedAt?: string;
  prMergedAt?: string;
  prHtmlUrl?: string;
  prMergeable?: boolean | null;
  prMergeableState?: string;
  prHeadSha?: string;
  prMergeabilityCheckedAt?: string;
  updatedAt: string;
  payload?: unknown;
}

type SqlStatement = string | { sql: string; args?: Array<string | number | null> };

interface GithubPrSnapshotRow {
  repo: string;
  pr_number: number;
  title: string | null;
  url: string | null;
  state: string | null;
  merged: number | null;
  closed_at: string | null;
  merged_at: string | null;
  mergeable_json: string | null;
  mergeable_state: string | null;
  head_sha: string | null;
  failed_checks_json: string | null;
  reviews_json: string | null;
  checked_at: string;
  checks_checked_at: string | null;
  heavy_checked_at: string | null;
  updated_at: string;
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
  comment_author: string | null;
  comment_body: string | null;
  comment_created_at: string | null;
  comment_updated_at: string | null;
  comment_html_url: string | null;
  failed_checks_json: string | null;
  pr_state: string | null;
  pr_merged: number | null;
  pr_closed_at: string | null;
  pr_merged_at: string | null;
  pr_html_url: string | null;
  pr_mergeable: number | null;
  pr_mergeable_state: string | null;
  pr_head_sha: string | null;
  pr_mergeability_checked_at: string | null;
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
  const latestCommentUrl =
    subject && typeof subject === 'object' && !Array.isArray(subject)
      ? (subject as Record<string, unknown>).latest_comment_url
      : undefined;
  const prNumber =
    parsePrNumberFromUrl(subjectUrl) ??
    parsePrNumberFromUrl(record.latest_comment_url) ??
    parsePrNumberFromUrl(latestCommentUrl);
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
    latestCommentUrl: stringValue(subjectRecord?.latest_comment_url) ?? stringValue(record.latest_comment_url),
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
    const result = await this.#execute({
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
    await this.#execute({
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

  async clearInvalidAccountEtag(accountKey: string): Promise<void> {
    await this.init();
    await this.#ensureAccount(accountKey);
    await this.#execute({
      sql: `UPDATE github_notification_accounts
        SET etag = NULL
        WHERE account_key = ? AND (trim(etag) = '' OR lower(trim(etag)) IN ('w/""', '""', 'null', 'undefined'))`,
      args: [accountKey],
    });
  }

  async acquireMasterLease(accountKey: string, ttlMs: number): Promise<boolean> {
    await this.init();
    await this.#ensureAccount(accountKey);
    const now = this.#now().toISOString();
    const expiresAt = new Date(this.#now().getTime() + ttlMs).toISOString();
    const result = await this.#execute({
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
    const result = await this.#execute({
      sql: `UPDATE github_notification_accounts
        SET master_pid = ?, master_heartbeat_at = ?, master_expires_at = ?
        WHERE account_key = ? AND master_owner_id = ?`,
      args: [process.pid, now, expiresAt, accountKey, this.ownerId],
    });
    return Number(result.rowsAffected) > 0;
  }

  async releaseMasterLease(accountKey: string): Promise<void> {
    await this.init();
    await this.#execute({
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
      await this.#execute({
        sql: `INSERT INTO github_notifications
          (account_key, notification_id, repo, pr_number, title, subject_type, reason, url, subject_url, latest_comment_url, comment_author, comment_body, comment_created_at, comment_updated_at, comment_html_url, failed_checks_json, pr_state, pr_merged, pr_closed_at, pr_merged_at, pr_html_url, pr_mergeable, pr_mergeable_state, pr_head_sha, pr_mergeability_checked_at, updated_at, touched_at, payload_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(account_key, notification_id) DO UPDATE SET
            repo = excluded.repo,
            pr_number = excluded.pr_number,
            title = excluded.title,
            subject_type = excluded.subject_type,
            reason = excluded.reason,
            url = excluded.url,
            subject_url = excluded.subject_url,
            latest_comment_url = excluded.latest_comment_url,
            comment_author = excluded.comment_author,
            comment_body = excluded.comment_body,
            comment_created_at = excluded.comment_created_at,
            comment_updated_at = excluded.comment_updated_at,
            comment_html_url = excluded.comment_html_url,
            failed_checks_json = excluded.failed_checks_json,
            pr_state = excluded.pr_state,
            pr_merged = excluded.pr_merged,
            pr_closed_at = excluded.pr_closed_at,
            pr_merged_at = excluded.pr_merged_at,
            pr_html_url = excluded.pr_html_url,
            pr_mergeable = excluded.pr_mergeable,
            pr_mergeable_state = excluded.pr_mergeable_state,
            pr_head_sha = excluded.pr_head_sha,
            pr_mergeability_checked_at = excluded.pr_mergeability_checked_at,
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
          notification.commentAuthor ?? null,
          notification.commentBody ?? null,
          notification.commentCreatedAt ?? null,
          notification.commentUpdatedAt ?? null,
          notification.commentHtmlUrl ?? null,
          notification.failedChecks ? JSON.stringify(notification.failedChecks) : null,
          notification.prState ?? null,
          notification.prMerged === undefined ? null : notification.prMerged ? 1 : 0,
          notification.prClosedAt ?? null,
          notification.prMergedAt ?? null,
          notification.prHtmlUrl ?? null,
          notification.prMergeable === undefined || notification.prMergeable === null
            ? null
            : notification.prMergeable
              ? 1
              : 0,
          notification.prMergeableState ?? null,
          notification.prHeadSha ?? null,
          notification.prMergeabilityCheckedAt ?? null,
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
    const result = await this.#execute({
      sql: `SELECT * FROM github_notifications
        WHERE account_key = ? AND repo = ? AND pr_number = ? AND updated_at >= ?
        ORDER BY updated_at DESC, notification_id DESC
        LIMIT ?`,
      args: [accountKey, repo, prNumber, minUpdatedAt, MAX_NOTIFICATIONS_PER_PR],
    });
    return (result.rows as unknown as GithubNotificationRow[]).map(rowToNotification).reverse();
  }

  async readPullRequestNotificationsMissingEnrichment(accountKey: string): Promise<GithubInboxNotification[]> {
    await this.init();
    const minUpdatedAt = new Date(this.#now().getTime() - MAX_NOTIFICATION_AGE_MS).toISOString();
    const result = await this.#execute({
      sql: `SELECT * FROM github_notifications
        WHERE account_key = ?
          AND lower(subject_type) = 'pullrequest'
          AND (failed_checks_json IS NULL OR pr_mergeable_state IS NULL OR pr_head_sha IS NULL)
          AND updated_at >= ?
        ORDER BY updated_at DESC, notification_id DESC
        LIMIT ?`,
      args: [accountKey, minUpdatedAt, MAX_NOTIFICATIONS_PER_PR],
    });
    return (result.rows as unknown as GithubNotificationRow[]).map(rowToNotification).reverse();
  }

  async readPrNotificationsNeedingMergeabilityRefresh(
    accountKey: string,
    repo: string,
    prNumber: number,
    staleBefore: string,
  ): Promise<GithubInboxNotification[]> {
    await this.init();
    const minUpdatedAt = new Date(this.#now().getTime() - MAX_NOTIFICATION_AGE_MS).toISOString();
    const result = await this.#execute({
      sql: `SELECT * FROM github_notifications
        WHERE account_key = ?
          AND repo = ?
          AND pr_number = ?
          AND lower(subject_type) = 'pullrequest'
          AND updated_at >= ?
          AND (pr_mergeability_checked_at IS NULL OR pr_mergeability_checked_at <= ?)
        ORDER BY updated_at DESC, notification_id DESC
        LIMIT ?`,
      args: [accountKey, repo, prNumber, minUpdatedAt, staleBefore, MAX_NOTIFICATIONS_PER_PR],
    });
    return (result.rows as unknown as GithubNotificationRow[]).map(rowToNotification).reverse();
  }

  async readPrSnapshot(accountKey: string, repo: string, prNumber: number): Promise<GithubPrSnapshotCache | undefined> {
    await this.init();
    const result = await this.#execute({
      sql: `SELECT * FROM github_pr_snapshots WHERE account_key = ? AND repo = ? AND pr_number = ?`,
      args: [accountKey, repo, prNumber],
    });
    const row = result.rows[0] as unknown as GithubPrSnapshotRow | undefined;
    return row ? rowToPrSnapshot(row) : undefined;
  }

  async readFreshPrSnapshot(
    accountKey: string,
    repo: string,
    prNumber: number,
    staleBefore: string,
  ): Promise<GithubPrSnapshotCache | undefined> {
    const snapshot = await this.readPrSnapshot(accountKey, repo, prNumber);
    if (!snapshot) return undefined;
    return Date.parse(snapshot.checkedAt) > Date.parse(staleBefore) ? snapshot : undefined;
  }

  async upsertPrSnapshot(accountKey: string, snapshot: GithubPrSnapshotCache): Promise<void> {
    await this.init();
    await this.#ensureAccount(accountKey);
    await this.#execute({
      sql: `INSERT INTO github_pr_snapshots (
          account_key, repo, pr_number, title, url, state, merged, closed_at, merged_at, mergeable_json,
          mergeable_state, head_sha, failed_checks_json, reviews_json, checked_at, checks_checked_at, heavy_checked_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(account_key, repo, pr_number) DO UPDATE SET
          title = excluded.title,
          url = excluded.url,
          state = excluded.state,
          merged = excluded.merged,
          closed_at = excluded.closed_at,
          merged_at = excluded.merged_at,
          mergeable_json = excluded.mergeable_json,
          mergeable_state = excluded.mergeable_state,
          head_sha = excluded.head_sha,
          failed_checks_json = excluded.failed_checks_json,
          reviews_json = excluded.reviews_json,
          checked_at = excluded.checked_at,
          checks_checked_at = excluded.checks_checked_at,
          heavy_checked_at = excluded.heavy_checked_at,
          updated_at = excluded.updated_at`,
      args: [
        accountKey,
        snapshot.repo,
        snapshot.prNumber,
        snapshot.title ?? null,
        snapshot.url ?? null,
        snapshot.state ?? null,
        snapshot.merged === undefined ? null : snapshot.merged ? 1 : 0,
        snapshot.closedAt ?? null,
        snapshot.mergedAt ?? null,
        JSON.stringify(snapshot.mergeable ?? null),
        snapshot.mergeableState ?? null,
        snapshot.headSha ?? null,
        JSON.stringify(snapshot.failedChecks ?? []),
        JSON.stringify(snapshot.reviews ?? []),
        snapshot.checkedAt,
        snapshot.checksCheckedAt ?? null,
        snapshot.heavyCheckedAt ?? null,
        snapshot.updatedAt,
      ],
    });
  }

  async hasNotificationDelivery(input: {
    accountKey: string;
    resourceId: string;
    threadId: string;
    repo: string;
    prNumber: number;
    notificationId: string;
    notificationUpdatedAt: string;
  }): Promise<boolean> {
    await this.init();
    const result = await this.#execute({
      sql: `SELECT 1 FROM github_notification_deliveries
        WHERE account_key = ?
          AND resource_id = ?
          AND thread_id = ?
          AND repo = ?
          AND pr_number = ?
          AND notification_id = ?
          AND notification_updated_at = ?
        LIMIT 1`,
      args: [
        input.accountKey,
        input.resourceId,
        input.threadId,
        input.repo,
        input.prNumber,
        input.notificationId,
        input.notificationUpdatedAt,
      ],
    });
    return result.rows.length > 0;
  }

  async claimNotificationDelivery(input: {
    accountKey: string;
    resourceId: string;
    threadId: string;
    repo: string;
    prNumber: number;
    notificationId: string;
    notificationUpdatedAt: string;
  }): Promise<boolean> {
    await this.init();
    const result = await this.#execute({
      sql: `INSERT OR IGNORE INTO github_notification_deliveries
        (account_key, resource_id, thread_id, repo, pr_number, notification_id, notification_updated_at, delivered_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        input.accountKey,
        input.resourceId,
        input.threadId,
        input.repo,
        input.prNumber,
        input.notificationId,
        input.notificationUpdatedAt,
        this.#now().toISOString(),
      ],
    });
    return Number(result.rowsAffected) > 0;
  }

  async pruneStaleNotifications(): Promise<void> {
    await this.init();
    const minTouchedAt = new Date(this.#now().getTime() - STALE_TOUCHED_AGE_MS).toISOString();
    const minUpdatedAt = new Date(this.#now().getTime() - MAX_NOTIFICATION_AGE_MS).toISOString();
    await this.#execute({
      sql: 'DELETE FROM github_notifications WHERE touched_at < ? OR updated_at < ?',
      args: [minTouchedAt, minUpdatedAt],
    });
    await this.#execute({
      sql: 'DELETE FROM github_notification_deliveries WHERE delivered_at < ?',
      args: [minTouchedAt],
    });
  }

  async #execute(statement: SqlStatement): Promise<Awaited<ReturnType<Client['execute']>>> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.#client.execute(statement as Parameters<Client['execute']>[0]);
      } catch (error) {
        if (!isSqliteBusyError(error) || attempt >= SQLITE_BUSY_RETRIES) throw error;
        await sleep(SQLITE_BUSY_RETRY_MS * (attempt + 1));
      }
    }
  }

  async #init(): Promise<void> {
    await this.#execute('PRAGMA busy_timeout = 5000');
    await this.#execute('PRAGMA journal_mode = WAL');
    await this.#execute(`CREATE TABLE IF NOT EXISTS github_notification_accounts (
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
    await this.#execute(`CREATE TABLE IF NOT EXISTS github_notifications (
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
      comment_author TEXT,
      comment_body TEXT,
      comment_created_at TEXT,
      comment_updated_at TEXT,
      comment_html_url TEXT,
      failed_checks_json TEXT,
      pr_state TEXT,
      pr_merged INTEGER,
      pr_closed_at TEXT,
      pr_merged_at TEXT,
      pr_html_url TEXT,
      pr_mergeable INTEGER,
      pr_mergeable_state TEXT,
      pr_head_sha TEXT,
      pr_mergeability_checked_at TEXT,
      updated_at TEXT NOT NULL,
      touched_at TEXT NOT NULL,
      payload_json TEXT,
      PRIMARY KEY (account_key, notification_id)
    )`);
    await this.#addColumnIfMissing('github_notifications', 'comment_author', 'TEXT');
    await this.#addColumnIfMissing('github_notifications', 'comment_body', 'TEXT');
    await this.#addColumnIfMissing('github_notifications', 'comment_created_at', 'TEXT');
    await this.#addColumnIfMissing('github_notifications', 'comment_updated_at', 'TEXT');
    await this.#addColumnIfMissing('github_notifications', 'comment_html_url', 'TEXT');
    await this.#addColumnIfMissing('github_notifications', 'failed_checks_json', 'TEXT');
    await this.#addColumnIfMissing('github_notifications', 'pr_state', 'TEXT');
    await this.#addColumnIfMissing('github_notifications', 'pr_merged', 'INTEGER');
    await this.#addColumnIfMissing('github_notifications', 'pr_closed_at', 'TEXT');
    await this.#addColumnIfMissing('github_notifications', 'pr_merged_at', 'TEXT');
    await this.#addColumnIfMissing('github_notifications', 'pr_html_url', 'TEXT');
    await this.#addColumnIfMissing('github_notifications', 'pr_mergeable', 'INTEGER');
    await this.#addColumnIfMissing('github_notifications', 'pr_mergeable_state', 'TEXT');
    await this.#addColumnIfMissing('github_notifications', 'pr_head_sha', 'TEXT');
    await this.#addColumnIfMissing('github_notifications', 'pr_mergeability_checked_at', 'TEXT');
    await this.#execute(
      'CREATE INDEX IF NOT EXISTS idx_github_notifications_pr ON github_notifications(account_key, repo, pr_number, updated_at DESC)',
    );
    await this.#execute(
      'CREATE INDEX IF NOT EXISTS idx_github_notifications_touched ON github_notifications(touched_at)',
    );

    await this.#execute(`CREATE TABLE IF NOT EXISTS github_pr_snapshots (
      account_key TEXT NOT NULL,
      repo TEXT NOT NULL,
      pr_number INTEGER NOT NULL,
      title TEXT,
      url TEXT,
      state TEXT,
      merged INTEGER,
      closed_at TEXT,
      merged_at TEXT,
      mergeable_json TEXT,
      mergeable_state TEXT,
      head_sha TEXT,
      failed_checks_json TEXT,
      reviews_json TEXT,
      checked_at TEXT NOT NULL,
      checks_checked_at TEXT,
      heavy_checked_at TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (account_key, repo, pr_number)
    )`);
    await this.#addColumnIfMissing('github_pr_snapshots', 'checks_checked_at', 'TEXT');
    await this.#addColumnIfMissing('github_pr_snapshots', 'heavy_checked_at', 'TEXT');
    await this.#execute(
      'CREATE INDEX IF NOT EXISTS idx_github_pr_snapshots_checked ON github_pr_snapshots(account_key, repo, pr_number, checked_at)',
    );
    await this.#execute(`CREATE TABLE IF NOT EXISTS github_notification_deliveries (
      account_key TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      repo TEXT NOT NULL,
      pr_number INTEGER NOT NULL,
      notification_id TEXT NOT NULL,
      notification_updated_at TEXT NOT NULL,
      delivered_at TEXT NOT NULL,
      PRIMARY KEY (account_key, resource_id, thread_id, repo, pr_number, notification_id, notification_updated_at)
    )`);
    await this.#execute(
      'CREATE INDEX IF NOT EXISTS idx_github_notification_deliveries_delivered ON github_notification_deliveries(delivered_at)',
    );
  }

  async #ensureAccount(accountKey: string): Promise<void> {
    await this.#execute({
      sql: 'INSERT OR IGNORE INTO github_notification_accounts (account_key, version) VALUES (?, ?)',
      args: [accountKey, VERSION],
    });
  }

  async #addColumnIfMissing(table: string, column: string, type: string): Promise<void> {
    const result = await this.#execute(`PRAGMA table_info(${table})`);
    if (result.rows.some(row => (row as Record<string, unknown>).name === column)) return;
    await this.#execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }

  async #prunePr(accountKey: string, repo: string, prNumber: number): Promise<void> {
    const minUpdatedAt = new Date(this.#now().getTime() - MAX_NOTIFICATION_AGE_MS).toISOString();
    await this.#execute({
      sql: `DELETE FROM github_notifications
        WHERE account_key = ? AND repo = ? AND pr_number = ? AND updated_at < ?`,
      args: [accountKey, repo, prNumber, minUpdatedAt],
    });
    await this.#execute({
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
      etag: etagValue(row?.etag),
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

function rowToPrSnapshot(row: GithubPrSnapshotRow): GithubPrSnapshotCache {
  return {
    repo: row.repo,
    prNumber: Number(row.pr_number),
    title: row.title ?? undefined,
    url: row.url ?? undefined,
    state: row.state ?? undefined,
    merged: row.merged === null ? undefined : Number(row.merged) === 1,
    closedAt: row.closed_at ?? undefined,
    mergedAt: row.merged_at ?? undefined,
    mergeable: parseJson(row.mergeable_json) as boolean | string | null | undefined,
    mergeableState: row.mergeable_state ?? undefined,
    headSha: row.head_sha ?? undefined,
    failedChecks: parseFailedChecks(row.failed_checks_json) ?? [],
    reviews: parseReviews(row.reviews_json) ?? [],
    checkedAt: row.checked_at,
    checksCheckedAt: row.checks_checked_at ?? row.heavy_checked_at ?? row.checked_at,
    heavyCheckedAt: row.heavy_checked_at ?? row.checked_at,
    updatedAt: row.updated_at,
  };
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
    commentAuthor: row.comment_author ?? undefined,
    commentBody: row.comment_body ?? undefined,
    commentCreatedAt: row.comment_created_at ?? undefined,
    commentUpdatedAt: row.comment_updated_at ?? undefined,
    commentHtmlUrl: row.comment_html_url ?? undefined,
    failedChecks: parseFailedChecks(row.failed_checks_json),
    prState: row.pr_state ?? undefined,
    prMerged: row.pr_merged === null ? undefined : Number(row.pr_merged) === 1,
    prClosedAt: row.pr_closed_at ?? undefined,
    prMergedAt: row.pr_merged_at ?? undefined,
    prHtmlUrl: row.pr_html_url ?? undefined,
    prMergeable: row.pr_mergeable === null ? undefined : Number(row.pr_mergeable) === 1,
    prMergeableState: row.pr_mergeable_state ?? undefined,
    prHeadSha: row.pr_head_sha ?? undefined,
    prMergeabilityCheckedAt: row.pr_mergeability_checked_at ?? undefined,
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

function etagValue(value: unknown): string | undefined {
  const etag = stringValue(value)?.trim();
  if (!etag) return undefined;
  if (/^(?:W\/)?""$/i.test(etag)) return undefined;
  if (/^(?:null|undefined)$/i.test(etag)) return undefined;
  return etag;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function parseFailedChecks(value: string | null): Array<{ name: string; status: string; url?: string }> | undefined {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) return undefined;
  const checks = parsed.filter((check): check is { name: string; status: string; url?: string } => {
    return (
      !!check &&
      typeof check === 'object' &&
      typeof (check as Record<string, unknown>).name === 'string' &&
      typeof (check as Record<string, unknown>).status === 'string'
    );
  });
  return checks;
}

function parseReviews(
  value: string | null,
):
  | Array<{ id: string; body?: string; author?: string; submittedAt?: string; state?: string; url?: string }>
  | undefined {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) return undefined;
  return parsed.filter(
    (
      review,
    ): review is { id: string; body?: string; author?: string; submittedAt?: string; state?: string; url?: string } =>
      !!review && typeof review === 'object' && typeof (review as Record<string, unknown>).id === 'string',
  );
}

function parseJson(value: string | null): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function isSqliteBusyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /SQLITE_BUSY|database is locked|database table is locked/i.test(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
