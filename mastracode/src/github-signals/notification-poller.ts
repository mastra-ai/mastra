import { EventEmitter } from 'node:events';

import type { GithubCommandRunner } from './github-signals.js';
import {
  deriveGithubNotificationAccountKey,
  GithubNotificationStore,
  normalizeGithubInboxNotification,
} from './notification-store.js';
import type { GithubInboxNotification } from './notification-store.js';

const MASTER_LEASE_MS = 45_000;
const RATE_LIMIT_BACKOFF_MS = 60 * 60_000;

export interface GithubNotificationPollerOptions {
  store?: GithubNotificationStore;
  commandRunner: GithubCommandRunner;
  accountKey?: string;
  accountKeySeed?: string;
  now?: () => Date;
}

export interface GithubNotificationPollResult {
  role: 'master' | 'client';
  updated: boolean;
  notifications: GithubInboxNotification[];
  rateLimitedUntil?: string;
}

export type GithubNotificationPollerEvents = {
  'cache-updated': [{ accountKey: string; notifications: GithubInboxNotification[] }];
  'rate-limited': [{ accountKey: string; until: string }];
};

export class GithubNotificationPoller extends EventEmitter<GithubNotificationPollerEvents> {
  readonly store: GithubNotificationStore;
  readonly accountKey: string;
  #commandRunner: GithubCommandRunner;
  #now: () => Date;

  constructor(options: GithubNotificationPollerOptions) {
    super();
    this.store = options.store ?? new GithubNotificationStore({ now: options.now });
    this.accountKey =
      options.accountKey ?? deriveGithubNotificationAccountKey(options.accountKeySeed ?? 'gh-cli-default');
    this.#commandRunner = options.commandRunner;
    this.#now = options.now ?? (() => new Date());
  }

  async poll(): Promise<GithubNotificationPollResult> {
    const state = await this.store.getAccountState(this.accountKey);
    if (state.rateLimitedUntil && Date.parse(state.rateLimitedUntil) > this.#now().getTime()) {
      return { role: 'client', updated: false, notifications: [], rateLimitedUntil: state.rateLimitedUntil };
    }

    const isMaster = await this.store.acquireMasterLease(this.accountKey, MASTER_LEASE_MS);
    if (!isMaster) {
      return { role: 'client', updated: false, notifications: [] };
    }

    try {
      await this.store.heartbeatMasterLease(this.accountKey, MASTER_LEASE_MS);
      const freshState = await this.store.getAccountState(this.accountKey);
      const response = await this.#fetchNotifications(freshState.etag);
      const checkedAt = this.#now().toISOString();

      if (response.status === 304) {
        await this.store.updateAccountState(this.accountKey, {
          checkedAt,
          updatedAt: freshState.updatedAt,
          etag: response.etag,
        });
        return { role: 'master', updated: false, notifications: [] };
      }

      const notifications = response.items
        .map(normalizeGithubInboxNotification)
        .filter(Boolean) as GithubInboxNotification[];
      await this.store.upsertNotifications(this.accountKey, notifications);
      await this.store.updateAccountState(this.accountKey, {
        checkedAt,
        updatedAt: checkedAt,
        etag: response.etag,
        rateLimitedUntil: undefined,
      });
      if (notifications.length > 0) this.emit('cache-updated', { accountKey: this.accountKey, notifications });
      return { role: 'master', updated: notifications.length > 0, notifications };
    } catch (error) {
      if (isRateLimitError(error)) {
        const until = getRateLimitedUntil(error, this.#now);
        await this.store.updateAccountState(this.accountKey, {
          checkedAt: this.#now().toISOString(),
          rateLimitedUntil: until,
        });
        this.emit('rate-limited', { accountKey: this.accountKey, until });
        return { role: 'master', updated: false, notifications: [], rateLimitedUntil: until };
      }
      throw error;
    }
  }

  async #fetchNotifications(etag?: string): Promise<{ status: number; etag?: string; items: unknown[] }> {
    const args = ['api', '/notifications', '-i', '-F', 'participating=true', '-F', 'all=false', '-F', 'per_page=100'];
    if (etag) args.push('-H', `If-None-Match: ${etag}`);
    const { stdout } = await this.#commandRunner(args);
    return parseGhApiResponse(stdout);
  }
}

function parseGhApiResponse(stdout: string): { status: number; etag?: string; items: unknown[] } {
  const normalized = stdout.replace(/\r\n/g, '\n');
  const headerEnd = normalized.indexOf('\n\n');
  if (headerEnd === -1) {
    return { status: 200, items: parseJsonArray(normalized) };
  }
  const headerText = normalized.slice(0, headerEnd);
  const bodyText = normalized.slice(headerEnd + 2).trim();
  const status = Number(/^HTTP\/\S+\s+(\d+)/m.exec(headerText)?.[1] ?? 200);
  const etag = /^etag:\s*(.+)$/im.exec(headerText)?.[1]?.trim();
  return { status, etag, items: status === 304 ? [] : parseJsonArray(bodyText) };
}

function parseJsonArray(value: string): unknown[] {
  if (!value.trim()) return [];
  const parsed = JSON.parse(value) as unknown;
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray((parsed as Record<string, unknown>)?.items))
    return (parsed as Record<string, unknown>).items as unknown[];
  return [];
}

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b403\b/.test(message) && /rate limit|api rate limit|secondary rate/i.test(message);
}

function getRateLimitedUntil(error: unknown, now: () => Date): string {
  const message = error instanceof Error ? error.message : String(error);
  const resetEpoch = /x-ratelimit-reset:\s*(\d+)/i.exec(message)?.[1];
  if (resetEpoch) return new Date(Number(resetEpoch) * 1000).toISOString();
  return new Date(now().getTime() + RATE_LIMIT_BACKOFF_MS).toISOString();
}

export const testExports = { parseGhApiResponse, isRateLimitError, getRateLimitedUntil };
