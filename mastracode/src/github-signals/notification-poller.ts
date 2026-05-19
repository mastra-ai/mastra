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
      await this.store.clearInvalidAccountEtag(this.accountKey);
      const freshState = await this.store.getAccountState(this.accountKey);
      const response = await this.#fetchNotifications(freshState.etag);
      const checkedAt = this.#now().toISOString();

      if (response.status === 304) {
        const backfilledNotifications = await this.#backfillMissingEnrichment();
        await this.store.updateAccountState(this.accountKey, {
          checkedAt,
          updatedAt: backfilledNotifications.length > 0 ? checkedAt : freshState.updatedAt,
          etag: response.etag,
        });
        return { role: 'master', updated: backfilledNotifications.length > 0, notifications: backfilledNotifications };
      }

      const notifications = response.items
        .map(normalizeGithubInboxNotification)
        .filter(Boolean) as GithubInboxNotification[];
      await this.#enrichNotifications(notifications);
      await this.store.upsertNotifications(this.accountKey, notifications);
      const backfilledNotifications = await this.#backfillMissingEnrichment();
      const updatedNotifications = [...notifications, ...backfilledNotifications];
      await this.store.updateAccountState(this.accountKey, {
        checkedAt,
        updatedAt: checkedAt,
        etag: response.etag,
        rateLimitedUntil: undefined,
      });
      if (updatedNotifications.length > 0) {
        this.emit('cache-updated', { accountKey: this.accountKey, notifications: updatedNotifications });
      }
      return { role: 'master', updated: updatedNotifications.length > 0, notifications: updatedNotifications };
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

  async #backfillMissingEnrichment(): Promise<GithubInboxNotification[]> {
    const notifications = await this.store.readPullRequestNotificationsMissingEnrichment(this.accountKey);
    if (notifications.length === 0) return [];
    const before = new Map(
      notifications.map(notification => [notification.id, getEnrichmentFingerprint(notification)]),
    );
    await this.#enrichNotifications(notifications);
    const enrichedNotifications = notifications.filter(
      notification => before.get(notification.id) !== getEnrichmentFingerprint(notification),
    );
    if (enrichedNotifications.length === 0) return [];
    await this.store.upsertNotifications(this.accountKey, enrichedNotifications);
    return enrichedNotifications;
  }

  async #enrichNotifications(notifications: GithubInboxNotification[]): Promise<void> {
    await Promise.all([this.#enrichComments(notifications), this.#enrichFailedChecks(notifications)]);
  }

  async #enrichComments(notifications: GithubInboxNotification[]): Promise<void> {
    const latestCommentUrls = [
      ...new Set(
        notifications
          .map(notification => notification.latestCommentUrl)
          .filter((latestCommentUrl): latestCommentUrl is string => !!latestCommentUrl),
      ),
    ];
    await Promise.all(
      latestCommentUrls.map(async latestCommentUrl => {
        try {
          const { stdout } = await this.#commandRunner(['api', latestCommentUrl]);
          const comment = parseJsonObject(stdout);
          const matchingNotifications = notifications.filter(
            notification => notification.latestCommentUrl === latestCommentUrl,
          );
          for (const notification of matchingNotifications) {
            notification.commentAuthor = getString(comment, ['user', 'login']);
            notification.commentBody = getString(comment, ['body']);
            notification.commentCreatedAt = getString(comment, ['created_at']);
            notification.commentHtmlUrl = getString(comment, ['html_url']);
          }
        } catch {
          // Enrichment is best-effort; the inbox notification itself is still useful.
        }
      }),
    );
  }

  async #enrichFailedChecks(notifications: GithubInboxNotification[]): Promise<void> {
    const pullRequestUrls = [
      ...new Set(
        notifications
          .filter(notification => notification.subjectType?.toLowerCase() === 'pullrequest')
          .map(notification => notification.subjectUrl)
          .filter((subjectUrl): subjectUrl is string => !!subjectUrl),
      ),
    ];

    await Promise.all(
      pullRequestUrls.map(async pullRequestUrl => {
        try {
          const { stdout: pullRequestStdout } = await this.#commandRunner(['api', pullRequestUrl]);
          const pullRequest = parseJsonObject(pullRequestStdout);
          const matchingNotifications = notifications.filter(
            notification => notification.subjectUrl === pullRequestUrl,
          );
          const headSha = getString(pullRequest, ['head', 'sha']);
          for (const notification of matchingNotifications) {
            notification.prState = getString(pullRequest, ['state']);
            notification.prMerged = getBoolean(pullRequest, ['merged']);
            notification.prClosedAt = getString(pullRequest, ['closed_at']);
            notification.prMergedAt = getString(pullRequest, ['merged_at']);
            notification.prHtmlUrl = getString(pullRequest, ['html_url']);
            notification.prMergeable = getNullableBoolean(pullRequest, ['mergeable']);
            notification.prMergeableState = getString(pullRequest, ['mergeable_state']);
            notification.prHeadSha = headSha;
          }

          const repoUrl = pullRequestUrl.replace(/\/pulls\/\d+(?:$|[?#].*)/, '');
          if (!headSha || repoUrl === pullRequestUrl) return;

          const { stdout: checksStdout } = await this.#commandRunner([
            'api',
            `${repoUrl}/commits/${headSha}/check-runs`,
          ]);
          const checks = getArray(parseJsonObject(checksStdout).check_runs)
            .map(normalizeCheck)
            .filter((check): check is { name: string; status: string; url?: string } => {
              return !!check && isFailedCheckStatus(check.status);
            });

          for (const notification of notifications.filter(notification => notification.subjectUrl === pullRequestUrl)) {
            notification.failedChecks = checks;
          }
        } catch {
          // Enrichment is best-effort; the inbox notification itself is still useful.
        }
      }),
    );
  }

  async #fetchNotifications(etag?: string): Promise<{ status: number; etag?: string; items: unknown[] }> {
    const args = [
      'api',
      '--method',
      'GET',
      '/notifications',
      '-i',
      '-F',
      'participating=true',
      '-F',
      'all=false',
      '-F',
      'per_page=100',
    ];
    const conditionalEtag = normalizeEtag(etag);
    if (conditionalEtag) args.push('-H', `If-None-Match: ${conditionalEtag}`);
    try {
      const { stdout } = await this.#commandRunner(args);
      return parseGhApiResponse(stdout);
    } catch (error) {
      if (isNotModifiedError(error)) return { status: 304, items: [] };
      throw error;
    }
  }
}

function getEnrichmentFingerprint(notification: GithubInboxNotification): string {
  return JSON.stringify({
    commentAuthor: notification.commentAuthor,
    commentBody: notification.commentBody,
    commentCreatedAt: notification.commentCreatedAt,
    commentHtmlUrl: notification.commentHtmlUrl,
    failedChecks: notification.failedChecks,
    prState: notification.prState,
    prMerged: notification.prMerged,
    prClosedAt: notification.prClosedAt,
    prMergedAt: notification.prMergedAt,
    prHtmlUrl: notification.prHtmlUrl,
    prMergeable: notification.prMergeable,
    prMergeableState: notification.prMergeableState,
    prHeadSha: notification.prHeadSha,
  });
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
  const etag = normalizeEtag(/^etag:\s*(.+)$/im.exec(headerText)?.[1]);
  return { status, etag, items: status === 304 ? [] : parseJsonArray(bodyText) };
}

function normalizeEtag(etag?: string): string | undefined {
  const normalized = etag?.trim();
  if (!normalized) return undefined;
  if (/^(?:W\/)?""$/i.test(normalized)) return undefined;
  if (/^(?:null|undefined)$/i.test(normalized)) return undefined;
  return normalized;
}

function parseJsonArray(value: string): unknown[] {
  if (!value.trim()) return [];
  const parsed = JSON.parse(value) as unknown;
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray((parsed as Record<string, unknown>)?.items))
    return (parsed as Record<string, unknown>).items as unknown[];
  return [];
}

function parseJsonObject(value: string): Record<string, unknown> {
  if (!value.trim()) return {};
  const parsed = JSON.parse(value) as unknown;
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
}

function getString(value: unknown, path: string[]): string | undefined {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' && current.length > 0 ? current : undefined;
}

function getBoolean(value: unknown, path: string[]): boolean | undefined {
  const current = getPath(value, path);
  return typeof current === 'boolean' ? current : undefined;
}

function getNullableBoolean(value: unknown, path: string[]): boolean | null | undefined {
  const current = getPath(value, path);
  return current === null || typeof current === 'boolean' ? current : undefined;
}

function getPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function isNotModifiedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b304\b/.test(message) && /not modified|HTTP 304/i.test(message);
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeCheck(input: unknown): { name: string; status: string; url?: string } | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const record = input as Record<string, unknown>;
  const name = getString(record, ['name']);
  const status = getString(record, ['conclusion']) ?? getString(record, ['status']);
  if (!name || !status) return undefined;
  return { name, status, url: getString(record, ['html_url']) ?? getString(record, ['details_url']) };
}

function isFailedCheckStatus(status: string) {
  return ['failure', 'timed_out', 'cancelled', 'action_required'].includes(status.toLowerCase());
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

export const testExports = {
  parseGhApiResponse,
  normalizeEtag,
  isNotModifiedError,
  isRateLimitError,
  getRateLimitedUntil,
};
