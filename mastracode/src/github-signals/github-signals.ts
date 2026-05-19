import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { Agent } from '@mastra/core/agent';
import { BaseProcessor } from '@mastra/core/processors';
import type {
  ProcessInputStepArgs,
  ProcessInputStepResult,
  ProcessOutputResultArgs,
  ProcessOutputStepArgs,
} from '@mastra/core/processors';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '@mastra/core/request-context';
import type { CreatedAgentSignal } from '@mastra/core/signals';
import { createSignal, isMastraSignalMessage, mastraDBMessageToSignal } from '@mastra/core/signals';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod/v4';

import type { GithubNotificationPoller } from './notification-poller.js';
import type { GithubInboxNotification } from './notification-store.js';

const execFileAsync = promisify(execFile);

const GITHUB_SUBSCRIBE_SIGNAL = 'github-pr-subscribe';
const GITHUB_UNSUBSCRIBE_SIGNAL = 'github-pr-unsubscribe';
const GITHUB_CI_FAILURE_SIGNAL = 'github-ci-failure';
const GITHUB_COMMENT_SIGNAL = 'github-comment';
const GITHUB_REVIEW_SIGNAL = 'github-review';
const GITHUB_PR_MERGED_SIGNAL = 'github-pr-merged';
const GITHUB_PR_CLOSED_SIGNAL = 'github-pr-closed';
const GITHUB_PR_CONFLICT_SIGNAL = 'github-pr-conflict';
const GITHUB_COMMAND_ERROR_SIGNAL = 'github-command-error';
const GITHUB_SUBSCRIPTION_HINT_SIGNAL = 'github-subscription-hint';
const GITHUB_PENDING_NOTIFICATIONS_SIGNAL = 'github-pending-notifications';
const DEFAULT_POLL_INTERVAL_MS = 60_000;
const DEFAULT_PENDING_FLUSH_MS = 5 * 60_000;
const RATE_LIMIT_BACKOFF_MS = 60 * 60_000;
const MAX_PROCESSED_SIGNAL_IDS = 200;
const DEFAULT_AUTHORIZED_PERMISSIONS = ['admin', 'maintain', 'write'] as const;

export type GithubPermission = 'admin' | 'maintain' | 'write' | 'triage' | 'read' | 'none';

type MastraMetadata = Record<string, unknown> & {
  githubSignals?: GithubSignalsThreadMetadata;
};

type ThreadMetadata = Record<string, unknown> & {
  mastra?: MastraMetadata;
};

export type GithubSignalStreamOptions = Record<string, unknown>;

export interface GithubSignalStreamOptionsContext {
  agentId: string;
  resourceId: string;
  threadId: string;
  repo?: string;
  prNumber: number;
}

export type GithubSignalStreamOptionsGetter = (
  context: GithubSignalStreamOptionsContext,
) => GithubSignalStreamOptions | undefined | Promise<GithubSignalStreamOptions | undefined>;

export interface GithubSignalsOptions {
  repo?: string;
  pollIntervalMs?: number;
  pendingFlushMs?: number;
  includeTool?: boolean;
  commandRunner?: GithubCommandRunner;
  now?: () => Date;
  getStreamOptions?: GithubSignalStreamOptionsGetter;
  authorizedPermissions?: GithubPermission[];
  authorizedBots?: string[];
  notificationPoller?: GithubNotificationPoller;
}

type NormalizedGithubSignalsOptions = Required<
  Pick<
    GithubSignalsOptions,
    | 'pollIntervalMs'
    | 'pendingFlushMs'
    | 'includeTool'
    | 'commandRunner'
    | 'now'
    | 'authorizedPermissions'
    | 'authorizedBots'
  >
> &
  Pick<GithubSignalsOptions, 'repo' | 'getStreamOptions'>;

export interface GithubSignalsAddAgentOptions {
  id?: string;
  getStreamOptions?: GithubSignalStreamOptionsGetter;
}

export interface GithubSignalsInitOptions {
  memory: GithubSignalsMemory;
  resourceId?: string;
  threadId?: string;
}

interface GithubSignalsMemory {
  listThreads(args: { perPage?: number | false; page?: number; filter?: { resourceId?: string } }): Promise<{
    threads: Array<GithubSignalsThread>;
    hasMore?: boolean;
    total?: number;
  }>;
  getThreadById?(args: { threadId: string; resourceId: string }): Promise<GithubSignalsThread | null | undefined>;
  updateThread?(args: { id: string; title: string; metadata: Record<string, unknown> }): Promise<unknown>;
}

interface GithubSignalsThread {
  id: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

interface GithubSubscriptionPersistence {
  update(subscription: GithubPRSubscriptionMetadata): Promise<void>;
}

export interface GithubCommandResult {
  stdout: string;
  stderr?: string;
}

export type GithubCommandRunner = (args: string[]) => Promise<GithubCommandResult>;

export interface GithubPRSignalInput {
  prNumber: number;
  repo?: string;
}

export interface GithubPRNotificationInput extends GithubPRSignalInput {
  kind: 'ci-failure' | 'comment' | 'review' | 'pr-merged' | 'pr-closed' | 'pr-conflict' | 'command-error';
  title: string;
  details: string;
  url?: string;
  user?: string;
  reviewState?: string;
  checkCount?: number;
}

export interface GithubPRSubscriptionMetadata {
  agentId: string;
  resourceId: string;
  threadId: string;
  repo?: string;
  prNumber: number;
  createdAt: string;
  updatedAt: string;
  lastCheckFingerprint?: string;
  lastCommentTimestamp?: string;
  lastReviewTimestamp?: string;
  lastNotificationUpdatedAt?: string;
  seenNotificationIds?: string[];
  lastErrorFingerprint?: string;
  nextPollAt?: string;
}

export interface GithubSignalsThreadMetadata {
  processedSignalIds: string[];
  subscriptions: Record<string, GithubPRSubscriptionMetadata>;
  subscriptionHintShown?: boolean;
}

interface ActiveThreadContext {
  agentId: string;
  resourceId: string;
  threadId: string;
}

interface ActiveSubscription extends GithubPRSubscriptionMetadata {
  key: string;
  persistence?: GithubSubscriptionPersistence;
}

interface RegisteredGithubAgent {
  agent: Agent<any, any, any, any>;
  getStreamOptions?: GithubSignalStreamOptionsGetter;
}

interface PendingGithubNotification {
  notification: Omit<GithubPRNotificationInput, 'repo' | 'prNumber'>;
  queuedAt: string;
}

interface PendingGithubNotificationBucket {
  subscription: ActiveSubscription;
  notifications: PendingGithubNotification[];
  firstQueuedAt: string;
  lastQueuedAt: string;
  noticeSent: boolean;
  acknowledgeAfterDelivery?: ActiveSubscription;
}

interface GithubPRSnapshot {
  failedChecks: Array<{ name: string; status: string; url?: string }>;
  comments: Array<{ id: string; body?: string; author?: string; createdAt?: string; url?: string }>;
  reviews: Array<{ id: string; body?: string; author?: string; submittedAt?: string; state?: string; url?: string }>;
}

export const ghSignals = {
  prSubscribe(input: GithubPRSignalInput): CreatedAgentSignal {
    return createGithubSignal(
      GITHUB_SUBSCRIBE_SIGNAL,
      input,
      `You are now subscribed to Github PR #${input.prNumber}. You will automatically receive CI failure and review comment notifications.`,
    );
  },

  prUnsubscribe(input: GithubPRSignalInput): CreatedAgentSignal {
    return createGithubSignal(
      GITHUB_UNSUBSCRIBE_SIGNAL,
      input,
      `You are now unsubscribed from Github PR #${input.prNumber}.`,
    );
  },

  prNotification(input: GithubPRNotificationInput): CreatedAgentSignal {
    return createSignal({
      type: 'system-reminder',
      contents: input.details,
      attributes: {
        type: getGithubReminderType(input.kind),
        kind: input.kind,
        pr: input.prNumber,
        repo: input.repo,
        title: input.title,
        url: input.url,
        user: input.user,
        reviewState: input.reviewState,
        checkCount: input.checkCount,
      },
      metadata: { ...input },
    });
  },
};

function createGithubSignal(type: string, input: GithubPRSignalInput, contents: string): CreatedAgentSignal {
  return createSignal({
    type: 'system-reminder',
    contents,
    attributes: {
      type,
      prNumber: input.prNumber,
      repo: input.repo,
    },
    metadata: { ...input },
  });
}

export function defaultGithubCommandRunner(args: string[]): Promise<GithubCommandResult> {
  const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1', CLICOLOR: '0' };
  delete env.GH_FORCE_TTY;
  return execFileAsync('gh', args, {
    encoding: 'utf8',
    env,
  });
}

function activeThreadKey(input: ActiveThreadContext) {
  return [input.agentId, input.resourceId, input.threadId].join(':');
}

function subscriptionKey(
  input: Pick<GithubPRSubscriptionMetadata, 'agentId' | 'resourceId' | 'threadId' | 'repo' | 'prNumber'>,
) {
  return [activeThreadKey(input), input.repo ?? '', input.prNumber].join(':');
}

function threadSubscriptionKey(input: Pick<GithubPRSubscriptionMetadata, 'repo' | 'prNumber'>) {
  return [input.repo ?? '', input.prNumber].join(':');
}

function parsePrNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

function parseSignalPayload(signal: ReturnType<typeof mastraDBMessageToSignal>): GithubPRSignalInput | undefined {
  const prNumber = parsePrNumber(signal.attributes?.prNumber ?? signal.attributes?.pr ?? signal.metadata?.prNumber);
  if (!prNumber) return undefined;

  const repo = signal.attributes?.repo ?? signal.metadata?.repo;
  return {
    prNumber,
    ...(typeof repo === 'string' && repo.length > 0 ? { repo } : {}),
  };
}

function getGithubSignalsMetadata(metadata: ThreadMetadata | undefined): GithubSignalsThreadMetadata {
  const mastra = metadata?.mastra;
  const githubSignals = mastra?.githubSignals;

  return {
    processedSignalIds: Array.isArray(githubSignals?.processedSignalIds)
      ? githubSignals.processedSignalIds.filter((id): id is string => typeof id === 'string')
      : [],
    subscriptions:
      githubSignals?.subscriptions &&
      typeof githubSignals.subscriptions === 'object' &&
      !Array.isArray(githubSignals.subscriptions)
        ? ({ ...githubSignals.subscriptions } as Record<string, GithubPRSubscriptionMetadata>)
        : {},
    subscriptionHintShown: githubSignals?.subscriptionHintShown === true,
  };
}

function setGithubSignalsMetadata(
  metadata: ThreadMetadata | undefined,
  githubSignals: GithubSignalsThreadMetadata,
): ThreadMetadata {
  return {
    ...(metadata ?? {}),
    mastra: {
      ...((metadata?.mastra as MastraMetadata | undefined) ?? {}),
      githubSignals,
    },
  };
}

function getGithubSignalType(signal: CreatedAgentSignal): string {
  return typeof signal.attributes?.type === 'string' ? signal.attributes.type : signal.type;
}

function getGithubReminderType(kind: GithubPRNotificationInput['kind']): string {
  if (kind === 'ci-failure') return GITHUB_CI_FAILURE_SIGNAL;
  if (kind === 'comment') return GITHUB_COMMENT_SIGNAL;
  if (kind === 'review') return GITHUB_REVIEW_SIGNAL;
  if (kind === 'pr-merged') return GITHUB_PR_MERGED_SIGNAL;
  if (kind === 'pr-closed') return GITHUB_PR_CLOSED_SIGNAL;
  if (kind === 'pr-conflict') return GITHUB_PR_CONFLICT_SIGNAL;
  return GITHUB_COMMAND_ERROR_SIGNAL;
}

function isGithubSignalType(type: string): type is typeof GITHUB_SUBSCRIBE_SIGNAL | typeof GITHUB_UNSUBSCRIBE_SIGNAL {
  return type === GITHUB_SUBSCRIBE_SIGNAL || type === GITHUB_UNSUBSCRIBE_SIGNAL;
}

function truncateProcessedSignalIds(ids: string[]) {
  return ids.slice(Math.max(0, ids.length - MAX_PROCESSED_SIGNAL_IDS));
}

function stableFingerprint(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
}

function getCommandErrorMessage(error: unknown) {
  return stripAnsi(error instanceof Error ? error.message : String(error));
}

function isGithubRateLimitError(message: string) {
  return /API rate limit exceeded|rate limit exceeded|HTTP 403/i.test(message);
}

function isGithubTransientNetworkError(message: string) {
  return /connection reset by peer|ECONNRESET|socket hang up|TLS handshake timeout|i\/o timeout|network is unreachable/i.test(
    message,
  );
}

function isSqliteBusyError(error: unknown): boolean {
  const message = getCommandErrorMessage(error);
  return /SQLITE_BUSY|database is locked|database table is locked/i.test(message);
}

function getCommandErrorFingerprint(message: string) {
  return stableFingerprint({ message: isGithubRateLimitError(message) ? 'github-rate-limit' : message });
}

function stripAnsi(value: string) {
  return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
}

function parseGithubJson(value: string, fallback: unknown) {
  const normalized = stripAnsi(value || '').trim();
  if (!normalized) return fallback;
  return JSON.parse(normalized) as unknown;
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function parseGithubJsonArray(value: string): unknown[] {
  const parsed = parseGithubJson(value, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.every(item => Array.isArray(item)) ? parsed.flatMap(item => item as unknown[]) : parsed;
}

function getStringFromPath(value: unknown, path: string[]): string | undefined {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : undefined;
}

function normalizeTimestamp(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function isAfterTimestamp(value: string | undefined, watermark: string | undefined) {
  if (!value) return false;
  if (!watermark) return true;
  return new Date(value).getTime() > new Date(watermark).getTime();
}

function getFailedChecksFingerprint(failedChecks: GithubPRSnapshot['failedChecks']) {
  return JSON.stringify(
    [...failedChecks].sort((a, b) => a.name.localeCompare(b.name)).map(check => [check.name, check.status]),
  );
}

function getLatestTimestamp<T>(items: T[], getTimestamp: (item: T) => string | undefined) {
  return items
    .map(getTimestamp)
    .filter((value): value is string => !!value)
    .sort()
    .at(-1);
}

function getCachedNotificationDeliveryKey(notification: GithubInboxNotification) {
  return notification.latestCommentUrl ?? notification.updatedAt;
}

function getCachedCheckDeliveryKey(notification: GithubInboxNotification, checkFingerprint: string) {
  return `checks:${checkFingerprint}:${notification.updatedAt}`;
}

function getCachedPrStateDeliveryKey(notification: GithubInboxNotification) {
  const state = notification.prMerged ? 'merged' : notification.prState?.toLowerCase();
  return `pr-state:${state}:${notification.prMergedAt ?? notification.prClosedAt ?? notification.updatedAt}`;
}

function getCachedPrConflictDeliveryKey(notification: GithubInboxNotification) {
  return `pr-conflict:${notification.prMergeableState ?? 'conflict'}:${notification.prHeadSha ?? notification.updatedAt}`;
}

function hasNewFailedCheckFingerprint(notification: GithubInboxNotification, subscription: ActiveSubscription) {
  if (!notification.failedChecks) return false;
  return getFailedChecksFingerprint(notification.failedChecks) !== subscription.lastCheckFingerprint;
}

function hasClosedPrState(notification: GithubInboxNotification) {
  return notification.prState?.toLowerCase() === 'closed';
}

function hasMergeConflict(notification: GithubInboxNotification) {
  if (hasClosedPrState(notification)) return false;
  return notification.prMergeable === false || notification.prMergeableState?.toLowerCase() === 'dirty';
}

function summarizeText(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;
  return normalized.length > 280 ? `${normalized.slice(0, 277)}...` : normalized;
}

function isBotLogin(user: string) {
  return user.toLowerCase().endsWith('[bot]');
}

function normalizePermission(value: string): GithubPermission | undefined {
  return ['admin', 'maintain', 'write', 'triage', 'read', 'none'].includes(value)
    ? (value as GithubPermission)
    : undefined;
}

export class GithubSignals {
  readonly processor: GithubSignalsProcessor;

  #agents = new Map<string, RegisteredGithubAgent>();
  #activeSubscriptions = new Map<string, ActiveSubscription>();
  #activeThreads = new Set<string>();
  #timer?: ReturnType<typeof setInterval>;
  #polling = false;
  #options: NormalizedGithubSignalsOptions;
  #notificationPoller?: GithubNotificationPoller;
  #pendingNotifications = new Map<string, PendingGithubNotificationBucket>();
  #permissionCache = new Map<string, GithubPermission | undefined>();

  constructor(options: GithubSignalsOptions = {}) {
    this.#options = {
      repo: options.repo,
      pollIntervalMs: options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      pendingFlushMs: options.pendingFlushMs ?? DEFAULT_PENDING_FLUSH_MS,
      includeTool: options.includeTool ?? true,
      commandRunner: options.commandRunner ?? defaultGithubCommandRunner,
      now: options.now ?? (() => new Date()),
      getStreamOptions: options.getStreamOptions,
      authorizedPermissions: options.authorizedPermissions ?? [...DEFAULT_AUTHORIZED_PERMISSIONS],
      authorizedBots: options.authorizedBots ?? [],
    };
    this.#notificationPoller = options.notificationPoller;
    this.processor = new GithubSignalsProcessor(this, this.#options);
  }

  addAgent(agent: Agent<any, any, any, any>, options: GithubSignalsAddAgentOptions = {}) {
    this.#agents.set(options.id ?? agent.id, { agent, getStreamOptions: options.getStreamOptions });
    return this;
  }

  start(subscriptions: GithubPRSubscriptionMetadata[] = []) {
    for (const subscription of subscriptions) {
      this.addSubscription(subscription);
    }
    return this;
  }

  async init(options: GithubSignalsInitOptions) {
    const subscriptions: GithubPRSubscriptionMetadata[] = [];
    const hydrateThread = async (thread: GithubSignalsThread) => {
      const metadata = getGithubSignalsMetadata(thread.metadata as ThreadMetadata | undefined);
      const baselinedSubscriptions = await Promise.all(
        Object.entries(metadata.subscriptions).map(async ([key, subscription]) => [
          key,
          await this.baselineSubscription(subscription),
        ]),
      );
      if (baselinedSubscriptions.length === 0) return;

      metadata.subscriptions = Object.fromEntries(baselinedSubscriptions);
      const persistence = this.#createSubscriptionPersistence(options.memory, thread);
      for (const subscription of Object.values(metadata.subscriptions)) {
        subscriptions.push(subscription);
        this.addSubscription(subscription, persistence);
      }

      await this.#persistThreadSubscriptions(options.memory, thread, metadata.subscriptions);
    };

    if (options.threadId) {
      const thread = options.memory.getThreadById
        ? await options.memory.getThreadById({ threadId: options.threadId, resourceId: options.resourceId ?? '' })
        : undefined;
      if (thread) await hydrateThread(thread);
      return subscriptions;
    }

    let page = 0;

    do {
      const result = await options.memory.listThreads({
        page,
        perPage: 100,
        filter: options.resourceId ? { resourceId: options.resourceId } : undefined,
      });

      for (const thread of result.threads) {
        await hydrateThread(thread);
      }

      page += 1;
      if (result.hasMore === false || result.threads.length === 0) break;
      if (typeof result.total === 'number' && page * 100 >= result.total) break;
    } while (true);

    return subscriptions;
  }

  #createSubscriptionPersistence(
    memory: GithubSignalsMemory,
    thread: GithubSignalsThread,
  ): GithubSubscriptionPersistence | undefined {
    if (!memory.updateThread) return undefined;
    return {
      update: subscription => this.#persistSubscription(memory, thread, subscription),
    };
  }

  async #persistSubscription(
    memory: GithubSignalsMemory,
    fallbackThread: GithubSignalsThread,
    subscription: GithubPRSubscriptionMetadata,
  ) {
    const thread =
      (await memory.getThreadById?.({ threadId: subscription.threadId, resourceId: subscription.resourceId })) ??
      fallbackThread;
    const metadata = getGithubSignalsMetadata(thread.metadata as ThreadMetadata | undefined);
    const key = threadSubscriptionKey(subscription);
    if (!metadata.subscriptions[key]) return;

    metadata.subscriptions[key] = { ...subscription };
    await this.#persistThreadSubscriptions(memory, thread, metadata.subscriptions);
  }

  async #persistThreadSubscriptions(
    memory: GithubSignalsMemory,
    thread: GithubSignalsThread,
    subscriptions: Record<string, GithubPRSubscriptionMetadata>,
  ) {
    if (!memory.updateThread) return;
    const metadata = getGithubSignalsMetadata(thread.metadata as ThreadMetadata | undefined);
    metadata.subscriptions = subscriptions;
    await memory.updateThread({
      id: thread.id,
      title: thread.title ?? '',
      metadata: setGithubSignalsMetadata(thread.metadata as ThreadMetadata | undefined, metadata),
    });
  }

  getAgentId(agentId?: string) {
    if (agentId) return agentId;
    if (this.#agents.size === 1) return this.#agents.keys().next().value as string;
    return 'default';
  }

  removeAgent(agentOrId: Agent<any, any, any, any> | string) {
    const agentId = typeof agentOrId === 'string' ? agentOrId : agentOrId.id;
    this.#agents.delete(agentId);
    for (const [key, subscription] of this.#activeSubscriptions) {
      if (subscription.agentId === agentId) {
        this.#activeSubscriptions.delete(key);
      }
    }
    this.#ensureTimer();
  }

  getDefaultAgentId() {
    return this.#agents.keys().next().value as string | undefined;
  }

  addSubscription(subscription: GithubPRSubscriptionMetadata, persistence?: GithubSubscriptionPersistence) {
    const key = subscriptionKey(subscription);
    this.#activeSubscriptions.set(key, { ...subscription, key, persistence });
    this.#ensureTimer();
  }

  async baselineSubscription(
    subscription: GithubPRSubscriptionMetadata,
    options: { force?: boolean } = {},
  ): Promise<GithubPRSubscriptionMetadata> {
    if (
      !options.force &&
      (subscription.lastCheckFingerprint ||
        subscription.lastCommentTimestamp ||
        subscription.lastReviewTimestamp ||
        subscription.lastNotificationUpdatedAt ||
        (subscription.seenNotificationIds?.length ?? 0) > 0)
    ) {
      return subscription;
    }

    try {
      if (this.#notificationPoller && subscription.repo) {
        await this.#notificationPoller.poll();
        const notifications = await this.#notificationPoller.store.readPrNotifications(
          this.#notificationPoller.accountKey,
          subscription.repo,
          subscription.prNumber,
        );
        return {
          ...subscription,
          lastNotificationUpdatedAt: getLatestTimestamp(notifications, notification => notification.updatedAt),
          seenNotificationIds: notifications.map(notification => notification.id).slice(-MAX_PROCESSED_SIGNAL_IDS),
          lastErrorFingerprint: undefined,
          updatedAt: this.#options.now().toISOString(),
        };
      }

      const snapshot = await this.#loadPullRequestSnapshot(subscription);
      return {
        ...subscription,
        lastCheckFingerprint: getFailedChecksFingerprint(snapshot.failedChecks),
        lastCommentTimestamp: getLatestTimestamp(snapshot.comments, comment => comment.createdAt),
        lastReviewTimestamp: getLatestTimestamp(snapshot.reviews, review => review.submittedAt),
        lastErrorFingerprint: undefined,
        updatedAt: this.#options.now().toISOString(),
      };
    } catch {
      return subscription;
    }
  }

  removeSubscription(
    subscription: Pick<GithubPRSubscriptionMetadata, 'agentId' | 'resourceId' | 'threadId' | 'repo' | 'prNumber'>,
  ) {
    this.#pendingNotifications.delete(subscriptionKey(subscription));
    this.#activeSubscriptions.delete(subscriptionKey(subscription));
    this.#ensureTimer();
  }

  markActive(context: ActiveThreadContext) {
    this.#activeThreads.add(activeThreadKey(context));
  }

  async markIdle(context: ActiveThreadContext) {
    this.#activeThreads.delete(activeThreadKey(context));
    await this.poll(context);
  }

  async poll(context?: ActiveThreadContext) {
    if (this.#polling) return;
    this.#polling = true;
    try {
      let sharedInboxError: unknown;
      if (this.#notificationPoller) {
        try {
          await this.#notificationPoller.poll();
        } catch (error) {
          if (!isSqliteBusyError(error)) sharedInboxError = error;
        }
      }

      for (const subscription of this.#activeSubscriptions.values()) {
        if (context && activeThreadKey(subscription) !== activeThreadKey(context)) continue;
        if (sharedInboxError) {
          const registeredAgent = this.#agents.get(subscription.agentId);
          if (registeredAgent) await this.#emitCommandError(registeredAgent, subscription, sharedInboxError);
          continue;
        }
        await this.#pollSubscription(subscription);
      }
      await this.#flushExpiredPendingNotifications();
    } finally {
      this.#polling = false;
    }
  }

  destroy() {
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = undefined;
    }
    this.#activeSubscriptions.clear();
    this.#pendingNotifications.clear();
    this.#activeThreads.clear();
    this.#agents.clear();
  }

  #ensureTimer() {
    if (this.#activeSubscriptions.size === 0) {
      if (this.#timer) {
        clearInterval(this.#timer);
        this.#timer = undefined;
      }
      return;
    }

    if (this.#timer) return;
    this.#timer = setInterval(() => {
      void this.poll();
    }, this.#options.pollIntervalMs);
    this.#timer.unref?.();
  }

  async #pollSubscription(subscription: ActiveSubscription) {
    const registeredAgent = this.#agents.get(subscription.agentId);
    if (!registeredAgent) return;

    if (subscription.nextPollAt && new Date(subscription.nextPollAt).getTime() > this.#options.now().getTime()) return;

    try {
      if (this.#notificationPoller && subscription.repo) {
        const notifications = await this.#notificationPoller.store.readPrNotifications(
          this.#notificationPoller.accountKey,
          subscription.repo,
          subscription.prNumber,
        );
        await this.#emitCachedNotifications(registeredAgent, subscription, notifications);
        return;
      }

      const snapshot = await this.#loadPullRequestSnapshot(subscription);
      await this.#emitSnapshotNotifications(registeredAgent, subscription, snapshot);
    } catch (error) {
      if (!isSqliteBusyError(error)) await this.#emitCommandError(registeredAgent, subscription, error);
    }
  }

  async #loadPullRequestSnapshot(subscription: GithubPRSubscriptionMetadata): Promise<GithubPRSnapshot> {
    if (!subscription.repo) {
      throw new Error('GitHub repository is required for PR polling.');
    }

    const pr = await this.#loadJson(['api', `repos/${subscription.repo}/pulls/${subscription.prNumber}`]);
    const headSha = getStringFromPath(pr, ['head', 'sha']);
    const [comments, reviews, checks] = await Promise.all([
      this.#loadPaginatedJsonArray([
        'api',
        `repos/${subscription.repo}/issues/${subscription.prNumber}/comments`,
        '--paginate',
      ]),
      this.#loadPaginatedJsonArray([
        'api',
        `repos/${subscription.repo}/pulls/${subscription.prNumber}/reviews`,
        '--paginate',
      ]),
      headSha
        ? this.#loadJson(['api', `repos/${subscription.repo}/commits/${headSha}/check-runs`])
        : Promise.resolve({ check_runs: [] }),
    ]);

    const checkRuns = getArray((checks as Record<string, unknown>).check_runs);
    return {
      failedChecks: checkRuns
        .map(check => normalizeCheck(check))
        .filter(
          (check): check is { name: string; status: string; url?: string } =>
            !!check && isFailedCheckStatus(check.status),
        ),
      comments: comments
        .map(normalizeComment)
        .filter((comment): comment is GithubPRSnapshot['comments'][number] => !!comment),
      reviews: reviews.map(normalizeReview).filter((review): review is GithubPRSnapshot['reviews'][number] => !!review),
    };
  }

  async #loadJson(args: string[]): Promise<unknown> {
    const { stdout } = await this.#options.commandRunner(args);
    return parseGithubJson(stdout, {});
  }

  async #loadPaginatedJsonArray(args: string[]): Promise<unknown[]> {
    const { stdout } = await this.#options.commandRunner([...args, '--slurp']);
    return parseGithubJsonArray(stdout);
  }

  async #emitCachedNotifications(
    registeredAgent: RegisteredGithubAgent,
    subscription: ActiveSubscription,
    notifications: GithubInboxNotification[],
  ) {
    const seenIds = new Set(subscription.seenNotificationIds ?? []);
    const unseen = notifications.filter(notification => {
      if (hasNewFailedCheckFingerprint(notification, subscription)) return true;
      if (hasClosedPrState(notification)) return true;
      if (hasMergeConflict(notification)) return true;
      if (!subscription.lastNotificationUpdatedAt) return true;
      return new Date(notification.updatedAt).getTime() > new Date(subscription.lastNotificationUpdatedAt).getTime();
    });

    let queuedDelivery = false;
    for (const notification of unseen) {
      if (notification.failedChecks) {
        const delivery = await this.#emitCachedCheckNotification(registeredAgent, subscription, notification);
        if (delivery === 'queued') queuedDelivery = true;
      }

      const stateDelivery = await this.#emitCachedPrStateNotification(registeredAgent, subscription, notification);
      if (stateDelivery === 'queued') queuedDelivery = true;
      if (stateDelivery !== 'skipped') continue;

      const conflictDelivery = await this.#emitCachedPrConflictNotification(
        registeredAgent,
        subscription,
        notification,
      );
      if (conflictDelivery === 'queued') queuedDelivery = true;
      if (conflictDelivery !== 'skipped') continue;

      if (!isActionableCachedNotification(notification)) continue;

      const claimed = await this.#notificationPoller?.store.claimNotificationDelivery({
        accountKey: this.#notificationPoller.accountKey,
        resourceId: subscription.resourceId,
        threadId: subscription.threadId,
        repo: notification.repo,
        prNumber: notification.prNumber,
        notificationId: notification.id,
        notificationUpdatedAt: getCachedNotificationDeliveryKey(notification),
      });
      if (claimed === false) continue;

      await this.#handleNotification(registeredAgent, subscription, {
        kind: 'comment',
        title: notification.title,
        details: summarizeText(
          notification.commentBody,
          notification.reason
            ? `GitHub notification (${notification.reason}): ${notification.title}`
            : `GitHub notification: ${notification.title}`,
        ),
        url:
          notification.commentHtmlUrl ?? notification.latestCommentUrl ?? notification.subjectUrl ?? notification.url,
        user: notification.commentAuthor,
      });
    }

    if (notifications.length > 0 && !queuedDelivery) {
      subscription.lastNotificationUpdatedAt = getLatestTimestamp(
        notifications,
        notification => notification.updatedAt,
      );
      subscription.seenNotificationIds = [...seenIds, ...notifications.map(notification => notification.id)].slice(
        -MAX_PROCESSED_SIGNAL_IDS,
      );
      subscription.lastErrorFingerprint = undefined;
      subscription.nextPollAt = undefined;
      subscription.updatedAt = this.#options.now().toISOString();
      this.#activeSubscriptions.set(subscription.key, subscription);
      await subscription.persistence?.update(subscription);
    }
  }

  async #emitCachedPrStateNotification(
    registeredAgent: RegisteredGithubAgent,
    subscription: ActiveSubscription,
    notification: GithubInboxNotification,
  ): Promise<'sent' | 'queued' | 'skipped'> {
    if (notification.prState?.toLowerCase() !== 'closed') return 'skipped';

    const kind = notification.prMerged ? 'pr-merged' : 'pr-closed';
    const claimed = await this.#notificationPoller?.store.claimNotificationDelivery({
      accountKey: this.#notificationPoller.accountKey,
      resourceId: subscription.resourceId,
      threadId: subscription.threadId,
      repo: notification.repo,
      prNumber: notification.prNumber,
      notificationId: notification.id,
      notificationUpdatedAt: getCachedPrStateDeliveryKey(notification),
    });
    if (claimed === false) return 'skipped';

    const delivery = await this.#handleNotification(registeredAgent, subscription, {
      kind,
      title: notification.prMerged ? 'GitHub PR merged' : 'GitHub PR closed',
      details: notification.prMerged
        ? `PR #${notification.prNumber} was merged: ${notification.title}`
        : `PR #${notification.prNumber} was closed without merge: ${notification.title}`,
      url: notification.prHtmlUrl ?? notification.subjectUrl ?? notification.url,
    });
    return delivery === 'queued' ? 'queued' : 'sent';
  }

  async #emitCachedPrConflictNotification(
    registeredAgent: RegisteredGithubAgent,
    subscription: ActiveSubscription,
    notification: GithubInboxNotification,
  ): Promise<'sent' | 'queued' | 'skipped'> {
    if (!hasMergeConflict(notification)) return 'skipped';

    const claimed = await this.#notificationPoller?.store.claimNotificationDelivery({
      accountKey: this.#notificationPoller.accountKey,
      resourceId: subscription.resourceId,
      threadId: subscription.threadId,
      repo: notification.repo,
      prNumber: notification.prNumber,
      notificationId: notification.id,
      notificationUpdatedAt: getCachedPrConflictDeliveryKey(notification),
    });
    if (claimed === false) return 'skipped';

    const delivery = await this.#handleNotification(registeredAgent, subscription, {
      kind: 'pr-conflict',
      title: 'GitHub PR merge conflict',
      details: `PR #${notification.prNumber} has merge conflicts: ${notification.title}`,
      url: notification.prHtmlUrl ?? notification.subjectUrl ?? notification.url,
    });
    return delivery === 'queued' ? 'queued' : 'sent';
  }

  async #emitCachedCheckNotification(
    registeredAgent: RegisteredGithubAgent,
    subscription: ActiveSubscription,
    notification: GithubInboxNotification,
  ): Promise<'sent' | 'queued' | 'skipped'> {
    const sortedChecks = [...(notification.failedChecks ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    const checkFingerprint = getFailedChecksFingerprint(sortedChecks);
    if (checkFingerprint === subscription.lastCheckFingerprint) return 'skipped';

    const acknowledgedSubscription: ActiveSubscription = {
      ...subscription,
      lastCheckFingerprint: checkFingerprint,
      lastErrorFingerprint: undefined,
      updatedAt: this.#options.now().toISOString(),
    };

    if (sortedChecks.length === 0) {
      Object.assign(subscription, acknowledgedSubscription);
      this.#activeSubscriptions.set(subscription.key, acknowledgedSubscription);
      await subscription.persistence?.update(acknowledgedSubscription);
      return 'skipped';
    }

    if (!this.#activeThreads.has(activeThreadKey(subscription))) {
      const claimed = await this.#notificationPoller?.store.claimNotificationDelivery({
        accountKey: this.#notificationPoller.accountKey,
        resourceId: subscription.resourceId,
        threadId: subscription.threadId,
        repo: notification.repo,
        prNumber: notification.prNumber,
        notificationId: notification.id,
        notificationUpdatedAt: getCachedCheckDeliveryKey(notification, checkFingerprint),
      });
      if (claimed === false) return 'skipped';
    }

    const delivery = await this.#handleNotification(
      registeredAgent,
      subscription,
      {
        kind: 'ci-failure',
        title: `GitHub CI failure`,
        details: sortedChecks
          .map(check => `- ${check.name}: ${check.status}${check.url ? ` (${check.url})` : ''}`)
          .join('\n'),
        url: sortedChecks.find(check => check.url)?.url,
        checkCount: sortedChecks.length,
      },
      acknowledgedSubscription,
    );
    if (delivery === 'queued') return 'queued';

    Object.assign(subscription, acknowledgedSubscription);
    this.#activeSubscriptions.set(subscription.key, acknowledgedSubscription);
    await subscription.persistence?.update(acknowledgedSubscription);
    return 'sent';
  }

  async #emitCheckNotifications(
    registeredAgent: RegisteredGithubAgent,
    subscription: ActiveSubscription,
    failedChecks: GithubPRSnapshot['failedChecks'],
  ) {
    const sortedChecks = failedChecks.sort((a, b) => a.name.localeCompare(b.name));
    const checkFingerprint = getFailedChecksFingerprint(sortedChecks);
    if (checkFingerprint === subscription.lastCheckFingerprint) return 'skipped';

    const acknowledgedSubscription: ActiveSubscription = {
      ...subscription,
      lastCheckFingerprint: checkFingerprint,
      lastErrorFingerprint: undefined,
      updatedAt: this.#options.now().toISOString(),
    };

    if (sortedChecks.length === 0) {
      Object.assign(subscription, acknowledgedSubscription);
      this.#activeSubscriptions.set(subscription.key, acknowledgedSubscription);
      await subscription.persistence?.update(acknowledgedSubscription);
      return 'skipped';
    }

    const delivery = await this.#handleNotification(
      registeredAgent,
      subscription,
      {
        kind: 'ci-failure',
        title: `GitHub CI failure`,
        details: sortedChecks
          .map(check => `- ${check.name}: ${check.status}${check.url ? ` (${check.url})` : ''}`)
          .join('\n'),
        url: sortedChecks.find(check => check.url)?.url,
        checkCount: sortedChecks.length,
      },
      acknowledgedSubscription,
    );
    if (delivery === 'queued') return;

    Object.assign(subscription, acknowledgedSubscription);
    this.#activeSubscriptions.set(subscription.key, acknowledgedSubscription);
    await subscription.persistence?.update(acknowledgedSubscription);
  }

  async #emitSnapshotNotifications(
    registeredAgent: RegisteredGithubAgent,
    subscription: ActiveSubscription,
    snapshot: GithubPRSnapshot,
  ) {
    await this.#emitCheckNotifications(registeredAgent, subscription, snapshot.failedChecks);

    const newComments = snapshot.comments.filter(comment =>
      isAfterTimestamp(comment.createdAt, subscription.lastCommentTimestamp),
    );
    for (const comment of newComments) {
      if (!(await this.#isAuthorizedAuthor(subscription, comment.author))) continue;
      await this.#handleNotification(registeredAgent, subscription, {
        kind: 'comment',
        title: `GitHub comment`,
        details: summarizeText(comment.body, 'No comment body.'),
        url: comment.url,
        user: comment.author,
      });
    }
    const latestCommentTimestamp = getLatestTimestamp(newComments, comment => comment.createdAt);
    if (latestCommentTimestamp) subscription.lastCommentTimestamp = latestCommentTimestamp;

    const newReviews = snapshot.reviews.filter(review =>
      isAfterTimestamp(review.submittedAt, subscription.lastReviewTimestamp),
    );
    for (const review of newReviews) {
      if (!(await this.#isAuthorizedAuthor(subscription, review.author))) continue;
      await this.#handleNotification(registeredAgent, subscription, {
        kind: 'review',
        title: `GitHub review`,
        details: summarizeText(review.body, 'No review body.'),
        url: review.url,
        user: review.author,
        reviewState: review.state,
      });
    }
    const latestReviewTimestamp = getLatestTimestamp(newReviews, review => review.submittedAt);
    if (latestReviewTimestamp) subscription.lastReviewTimestamp = latestReviewTimestamp;

    subscription.lastErrorFingerprint = undefined;
    subscription.nextPollAt = undefined;
    subscription.updatedAt = this.#options.now().toISOString();
    this.#activeSubscriptions.set(subscription.key, subscription);
    await subscription.persistence?.update(subscription);
  }

  async #emitCommandError(registeredAgent: RegisteredGithubAgent, subscription: ActiveSubscription, error: unknown) {
    const message = getCommandErrorMessage(error);
    if (isGithubTransientNetworkError(message)) return;

    const fingerprint = getCommandErrorFingerprint(message);
    const isRateLimit = isGithubRateLimitError(message);
    if (isRateLimit) {
      subscription.nextPollAt = new Date(this.#options.now().getTime() + RATE_LIMIT_BACKOFF_MS).toISOString();
    }

    const shouldNotify = fingerprint !== subscription.lastErrorFingerprint;
    subscription.lastErrorFingerprint = fingerprint;
    subscription.updatedAt = this.#options.now().toISOString();
    this.#activeSubscriptions.set(subscription.key, subscription);
    await subscription.persistence?.update(subscription);

    if (!shouldNotify) return;

    await this.#handleNotification(registeredAgent, subscription, {
      kind: 'command-error',
      title: isRateLimit ? `GitHub polling paused` : `GitHub polling error`,
      details: isRateLimit
        ? `GitHub API rate limit exceeded. Polling is paused for this PR until ${subscription.nextPollAt}.`
        : message,
    });
  }

  async #isAuthorizedAuthor(subscription: GithubPRSubscriptionMetadata, user: string | undefined) {
    if (!user) return false;
    if (isBotLogin(user)) return this.#options.authorizedBots.some(bot => bot.toLowerCase() === user.toLowerCase());

    const permission = await this.#loadAuthorPermission(subscription, user);
    return !!permission && this.#options.authorizedPermissions.includes(permission);
  }

  async #loadAuthorPermission(subscription: GithubPRSubscriptionMetadata, user: string) {
    if (!subscription.repo) return undefined;

    const cacheKey = `${subscription.repo}:${user.toLowerCase()}`;
    if (this.#permissionCache.has(cacheKey)) return this.#permissionCache.get(cacheKey);

    try {
      const result = await this.#options.commandRunner([
        'api',
        `repos/${subscription.repo}/collaborators/${user}/permission`,
        '--jq',
        '.permission',
      ]);
      const permission = normalizePermission(stripAnsi(result.stdout).trim());
      this.#permissionCache.set(cacheKey, permission);
      return permission;
    } catch {
      this.#permissionCache.set(cacheKey, undefined);
      return undefined;
    }
  }

  async #handleNotification(
    registeredAgent: RegisteredGithubAgent,
    subscription: ActiveSubscription,
    notification: Omit<GithubPRNotificationInput, 'repo' | 'prNumber'>,
    acknowledgeAfterDelivery?: ActiveSubscription,
  ): Promise<'sent' | 'queued'> {
    if (!this.#activeThreads.has(activeThreadKey(subscription))) {
      await this.#sendNotification(registeredAgent, subscription, notification);
      return 'sent';
    }

    await this.#queuePendingNotification(registeredAgent, subscription, notification, acknowledgeAfterDelivery);
    return 'queued';
  }

  async #queuePendingNotification(
    registeredAgent: RegisteredGithubAgent,
    subscription: ActiveSubscription,
    notification: Omit<GithubPRNotificationInput, 'repo' | 'prNumber'>,
    acknowledgeAfterDelivery?: ActiveSubscription,
  ) {
    const key = subscription.key;
    const queuedAt = this.#options.now().toISOString();
    const existing = this.#pendingNotifications.get(key);
    const bucket: PendingGithubNotificationBucket = existing ?? {
      subscription: { ...subscription },
      notifications: [],
      firstQueuedAt: queuedAt,
      lastQueuedAt: queuedAt,
      noticeSent: false,
    };

    bucket.subscription = { ...subscription };
    if (acknowledgeAfterDelivery) bucket.acknowledgeAfterDelivery = { ...acknowledgeAfterDelivery };
    bucket.notifications.push({ notification, queuedAt });
    bucket.lastQueuedAt = queuedAt;
    this.#pendingNotifications.set(key, bucket);

    if (!bucket.noticeSent) {
      bucket.noticeSent = true;
      await this.#sendPendingNotice(registeredAgent, subscription, bucket.notifications.length);
    }
  }

  async #sendPendingNotice(
    registeredAgent: RegisteredGithubAgent,
    subscription: GithubPRSubscriptionMetadata,
    count: number,
  ) {
    const result = registeredAgent.agent.sendSignal(
      createSignal({
        type: 'system-reminder',
        contents: `${count} new GitHub ${count === 1 ? 'notification is' : 'notifications are'} pending. Call the github tool with action: "pending" to deliver them.`,
        attributes: {
          type: GITHUB_PENDING_NOTIFICATIONS_SIGNAL,
          pr: subscription.prNumber,
          repo: subscription.repo,
          count,
        },
        metadata: {
          prNumber: subscription.prNumber,
          repo: subscription.repo,
          count,
        },
      }),
      {
        resourceId: subscription.resourceId,
        threadId: subscription.threadId,
        ifIdle: { behavior: 'persist' },
        ifActive: { behavior: 'deliver' },
      },
    );
    await result.persisted;
    await result.started;
  }

  countPendingNotifications(filter: ActiveThreadContext & { repo?: string; prNumber?: number }) {
    return this.#getPendingNotificationBuckets(filter).reduce(
      (count, [, bucket]) => count + bucket.notifications.length,
      0,
    );
  }

  async deliverPendingNotifications(filter: ActiveThreadContext & { repo?: string; prNumber?: number }) {
    const buckets = this.#getPendingNotificationBuckets(filter);

    for (const [key, bucket] of buckets) {
      const registeredAgent = this.#agents.get(bucket.subscription.agentId);
      if (!registeredAgent) continue;
      for (const pending of bucket.notifications) {
        await this.#sendNotification(registeredAgent, bucket.subscription, pending.notification);
      }
      await this.#acknowledgePendingDelivery(bucket);
      this.#pendingNotifications.delete(key);
    }

    return buckets.reduce((count, [, bucket]) => count + bucket.notifications.length, 0);
  }

  #getPendingNotificationBuckets(filter: ActiveThreadContext & { repo?: string; prNumber?: number }) {
    return [...this.#pendingNotifications.entries()].filter(([, bucket]) => {
      const subscription = bucket.subscription;
      if (activeThreadKey(subscription) !== activeThreadKey(filter)) return false;
      if (filter.repo && subscription.repo !== filter.repo) return false;
      if (filter.prNumber && subscription.prNumber !== filter.prNumber) return false;
      return bucket.notifications.length > 0;
    });
  }

  async #acknowledgePendingDelivery(bucket: PendingGithubNotificationBucket) {
    const acknowledgedSubscription = bucket.acknowledgeAfterDelivery;
    if (!acknowledgedSubscription) return;

    this.#activeSubscriptions.set(acknowledgedSubscription.key, acknowledgedSubscription);
    bucket.subscription = { ...acknowledgedSubscription };
    await acknowledgedSubscription.persistence?.update(acknowledgedSubscription);
  }

  async #flushExpiredPendingNotifications() {
    const now = this.#options.now().getTime();
    const expired = [...this.#pendingNotifications.entries()].filter(([, bucket]) => {
      return now - new Date(bucket.firstQueuedAt).getTime() >= this.#options.pendingFlushMs;
    });

    for (const [key, bucket] of expired) {
      const registeredAgent = this.#agents.get(bucket.subscription.agentId);
      if (!registeredAgent) continue;
      for (const pending of bucket.notifications) {
        await this.#sendNotification(registeredAgent, bucket.subscription, pending.notification);
      }
      await this.#acknowledgePendingDelivery(bucket);
      this.#pendingNotifications.delete(key);
    }
  }

  async sendSubscriptionHint(context: ActiveThreadContext) {
    const registeredAgent = this.#agents.get(context.agentId);
    if (!registeredAgent) return false;

    const result = registeredAgent.agent.sendSignal(
      createSignal({
        type: 'system-reminder',
        contents:
          'The system detected you may be working on a PR. Subscribe to updates using the github subscribe tool.',
        attributes: { type: GITHUB_SUBSCRIPTION_HINT_SIGNAL },
      }),
      {
        resourceId: context.resourceId,
        threadId: context.threadId,
        ifIdle: { behavior: 'persist' },
        ifActive: { behavior: 'deliver' },
      },
    );
    await result.persisted;
    await result.started;
    return true;
  }

  async sendSubscriptionChangeSignal(context: ActiveThreadContext, signal: CreatedAgentSignal) {
    const registeredAgent = this.#agents.get(context.agentId);
    if (!registeredAgent) return undefined;

    const result = registeredAgent.agent.sendSignal(signal, {
      resourceId: context.resourceId,
      threadId: context.threadId,
      ifIdle: { behavior: 'persist' },
      ifActive: { behavior: 'deliver' },
    });
    await result.persisted;
    await result.started;
    return signal;
  }

  async #sendNotification(
    registeredAgent: RegisteredGithubAgent,
    subscription: GithubPRSubscriptionMetadata,
    notification: Omit<GithubPRNotificationInput, 'repo' | 'prNumber'>,
  ) {
    const streamOptions = await (registeredAgent.getStreamOptions ?? this.#options.getStreamOptions)?.({
      agentId: subscription.agentId,
      resourceId: subscription.resourceId,
      threadId: subscription.threadId,
      repo: subscription.repo,
      prNumber: subscription.prNumber,
    });
    const result = registeredAgent.agent.sendSignal(
      ghSignals.prNotification({
        ...notification,
        repo: subscription.repo,
        prNumber: subscription.prNumber,
      }),
      {
        resourceId: subscription.resourceId,
        threadId: subscription.threadId,
        ifIdle: { behavior: 'wake', ...(streamOptions ? { streamOptions: streamOptions as any } : {}) },
        ifActive: { behavior: 'deliver' },
      },
    );
    await result.persisted;
    await result.started;
  }
}

function isActionableCachedNotification(notification: GithubInboxNotification) {
  if (notification.commentBody || notification.commentAuthor || notification.commentHtmlUrl) {
    return true;
  }

  const subjectType = notification.subjectType?.toLowerCase();
  if (subjectType === 'pullrequest') return false;

  return true;
}

class GithubSignalsProcessor extends BaseProcessor<'github-signals'> {
  readonly id = 'github-signals';
  readonly name = 'Github Signals';

  #owner: GithubSignals;
  #options: NormalizedGithubSignalsOptions;

  constructor(owner: GithubSignals, options: NormalizedGithubSignalsOptions) {
    super();
    this.#owner = owner;
    this.#options = options;
  }

  async processInputStep(args: ProcessInputStepArgs): Promise<ProcessInputStepResult | undefined> {
    const context = this.#getThreadContext(args);
    if (context) this.#owner.markActive(context);

    if (args.stepNumber === 0) {
      await this.#processSignals(args);
    }
    return this.#toolResult(args);
  }

  async processOutputStep(args: ProcessOutputStepArgs) {
    await this.#maybeSendSubscriptionHint(args, [args.toolCalls, args.text]);
    return args.messages;
  }

  async processOutputResult(args: ProcessOutputResultArgs) {
    const context = this.#getThreadContext(args);
    if (context) await this.#owner.markIdle(context);
    return args.messages;
  }

  #getThreadContext(args: Pick<ProcessInputStepArgs, 'messages' | 'requestContext'>): ActiveThreadContext | undefined {
    const contextThreadId = args.requestContext?.get(MASTRA_THREAD_ID_KEY);
    const contextResourceId = args.requestContext?.get(MASTRA_RESOURCE_ID_KEY);
    const threadId =
      typeof contextThreadId === 'string' ? contextThreadId : args.messages.find(message => message.threadId)?.threadId;
    const resourceId =
      typeof contextResourceId === 'string'
        ? contextResourceId
        : args.messages.find(message => message.resourceId)?.resourceId;
    if (!threadId || !resourceId) return undefined;
    return { agentId: this.#owner.getAgentId(), resourceId, threadId };
  }

  async #processSignals(args: ProcessInputStepArgs) {
    for (const message of args.messages) {
      if (!isMastraSignalMessage(message)) continue;
      await this.#applyGithubSignal(args, mastraDBMessageToSignal(message));
    }
  }

  async #maybeSendSubscriptionHint(
    args: Pick<ProcessInputStepArgs, 'messages' | 'requestContext' | 'sendSignal'>,
    evidence: unknown[] = args.messages,
  ) {
    const context = this.#getThreadContext(args);
    if (!context) return;

    const memory = await this.mastra?.getStorage()?.getStore('memory');
    if (!memory) return;

    const thread = await memory.getThreadById({ threadId: context.threadId, resourceId: context.resourceId });
    if (!thread) return;

    const githubMetadata = getGithubSignalsMetadata(thread.metadata as ThreadMetadata | undefined);
    const subscriptionCount = Object.keys(githubMetadata.subscriptions).length;
    const hasExistingHint = hasGithubSubscriptionHint(evidence);
    const hasEvidence = hasPrWorkEvidence(evidence);
    if (githubMetadata.subscriptionHintShown || subscriptionCount > 0) return;
    if (hasExistingHint) return;
    if (!hasEvidence) return;

    const sent = await this.#owner.sendSubscriptionHint(context);
    if (!sent) return;
    githubMetadata.subscriptionHintShown = true;
    await memory.updateThread({
      id: thread.id,
      title: thread.title ?? '',
      metadata: setGithubSignalsMetadata(thread.metadata as ThreadMetadata | undefined, githubMetadata),
    });
  }

  async #applyGithubSignal(args: ProcessInputStepArgs, signal: CreatedAgentSignal) {
    const signalType = getGithubSignalType(signal);
    if (!isGithubSignalType(signalType)) return;

    const payload = parseSignalPayload(signal);
    if (!payload) return;

    const contextThreadId = args.requestContext?.get(MASTRA_THREAD_ID_KEY);
    const contextResourceId = args.requestContext?.get(MASTRA_RESOURCE_ID_KEY);
    const threadId =
      typeof contextThreadId === 'string' ? contextThreadId : args.messages.find(message => message.threadId)?.threadId;
    const resourceId =
      typeof contextResourceId === 'string'
        ? contextResourceId
        : args.messages.find(message => message.resourceId)?.resourceId;
    if (!threadId || !resourceId) return;

    const memory = await this.mastra?.getStorage()?.getStore('memory');
    if (!memory) return;

    const thread = await memory.getThreadById({ threadId, resourceId });
    if (!thread) return;

    const githubMetadata = getGithubSignalsMetadata(thread.metadata as ThreadMetadata | undefined);
    const processedSignalIds = new Set(githubMetadata.processedSignalIds);
    if (processedSignalIds.has(signal.id)) return;

    const repo = payload.repo ?? this.#options.repo;
    const now = this.#options.now().toISOString();
    const agentId = this.#owner.getAgentId(
      signal.metadata?.agentId && typeof signal.metadata.agentId === 'string' ? signal.metadata.agentId : undefined,
    );
    const baseSubscription = {
      agentId,
      resourceId,
      threadId,
      repo,
      prNumber: payload.prNumber,
    };
    const key = threadSubscriptionKey(baseSubscription);

    if (signalType === GITHUB_SUBSCRIBE_SIGNAL) {
      const existing = githubMetadata.subscriptions[key];
      const subscription = await this.#owner.baselineSubscription({
        ...existing,
        ...baseSubscription,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      githubMetadata.subscriptions[key] = subscription;
      this.#owner.addSubscription(subscription, {
        update: async updated => {
          const currentThread =
            (await memory.getThreadById?.({ threadId: updated.threadId, resourceId: updated.resourceId })) ?? thread;
          const currentMetadata = getGithubSignalsMetadata(currentThread.metadata as ThreadMetadata | undefined);
          const currentKey = threadSubscriptionKey(updated);
          if (!currentMetadata.subscriptions[currentKey]) return;

          currentMetadata.subscriptions[currentKey] = { ...updated };
          await memory.updateThread({
            id: currentThread.id,
            title: currentThread.title ?? '',
            metadata: setGithubSignalsMetadata(currentThread.metadata as ThreadMetadata | undefined, currentMetadata),
          });
        },
      });
    } else {
      const existing = githubMetadata.subscriptions[key];
      delete githubMetadata.subscriptions[key];
      if (existing) githubMetadata.subscriptionHintShown = false;
      this.#owner.removeSubscription(existing ?? { ...baseSubscription });
    }

    processedSignalIds.add(signal.id);
    githubMetadata.processedSignalIds = truncateProcessedSignalIds([...processedSignalIds]);
    const metadata = setGithubSignalsMetadata(thread.metadata as ThreadMetadata | undefined, githubMetadata);
    await memory.updateThread({ id: thread.id, title: thread.title ?? '', metadata });
  }

  #toolResult(args: ProcessInputStepArgs): ProcessInputStepResult | undefined {
    if (!this.#options.includeTool) return undefined;

    args.messageList.addSystem(
      'You can manage Github PR subscriptions with the github tool. Subscribe to receive automatic CI failure and review/comment notifications for a PR. Unsubscribe when notifications are no longer needed.',
    );

    return {
      tools: {
        ...(args.tools ?? {}),
        github: createTool({
          id: 'github',
          description:
            'Subscribe or unsubscribe this thread from Github PR CI failure and review/comment notifications.',
          inputSchema: z.object({
            action: z.enum(['subscribe', 'unsubscribe', 'pending']),
            prNumber: z.number().int().positive().optional(),
            repo: z.string().optional(),
          }),
          outputSchema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
          execute: async ({ action, prNumber, repo }) => {
            const context = this.#getThreadContext(args);
            if (action === 'pending') {
              const pendingCount = context ? this.#owner.countPendingNotifications({ ...context, repo, prNumber }) : 0;
              if (pendingCount === 0) {
                return { success: true, message: 'No pending GitHub notifications.' };
              }

              if (context) {
                const timeout = setTimeout(() => {
                  void this.#owner.deliverPendingNotifications({ ...context, repo, prNumber });
                }, 0);
                timeout.unref?.();
              }
              return { success: true, message: 'notifications will now be delivered' };
            }

            if (!prNumber) {
              return { success: false, message: 'prNumber is required.' };
            }

            const signal =
              action === 'subscribe'
                ? ghSignals.prSubscribe({ prNumber, repo })
                : ghSignals.prUnsubscribe({ prNumber, repo });
            const persistedSignal =
              (await args.sendSignal?.(signal)) ??
              (context ? await this.#owner.sendSubscriptionChangeSignal(context, signal) : undefined);
            await this.#applyGithubSignal(args, persistedSignal ?? signal);
            return {
              success: true,
              message:
                action === 'subscribe'
                  ? `Subscribed to Github PR #${prNumber}.`
                  : `Unsubscribed from Github PR #${prNumber}.`,
            };
          },
        }),
      },
    };
  }
}

function hasGithubSubscriptionHint(messages: unknown[]) {
  return messages.some(message => messageContains(message, GITHUB_SUBSCRIPTION_HINT_SIGNAL));
}

function hasPrWorkEvidence(messages: unknown[]) {
  return messages.some(message =>
    messageContains(
      message,
      /\bgh\s+pr\b|\bgh\s+pr\s+(view|checkout|create|status|checks)\b|\bgit\s+push\b|github\.com\/[^\s/]+\/[^\s/]+\/pull\/\d+/i,
    ),
  );
}

function messageContains(value: unknown, pattern: string | RegExp): boolean {
  if (typeof value === 'string') return typeof pattern === 'string' ? value.includes(pattern) : pattern.test(value);
  if (!value || typeof value !== 'object') return false;
  try {
    const serialized = JSON.stringify(value);
    return typeof pattern === 'string' ? serialized.includes(pattern) : pattern.test(serialized);
  } catch {
    return false;
  }
}

function normalizeCheck(value: unknown): { name: string; status: string; url?: string } | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const name = record.name ?? record.context ?? record.workflowName;
  const status = record.conclusion ?? record.state ?? record.status;
  const url = record.detailsUrl ?? record.url ?? record.link;
  if (typeof name !== 'string' || typeof status !== 'string') return undefined;
  return {
    name,
    status,
    ...(typeof url === 'string' ? { url } : {}),
  };
}

function isFailedCheckStatus(status: string) {
  return ['failure', 'failed', 'error', 'timed_out', 'action_required', 'cancelled'].includes(status.toLowerCase());
}

function normalizeAuthor(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const login = (value as Record<string, unknown>).login;
    if (typeof login === 'string') return login;
  }
  return undefined;
}

function normalizeComment(value: unknown): GithubPRSnapshot['comments'][number] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const id = record.id ?? record.databaseId ?? record.nodeId;
  const createdAt = normalizeTimestamp(record.createdAt ?? record.created_at);
  if ((typeof id !== 'string' && typeof id !== 'number') || !createdAt) return undefined;
  return {
    id: String(id),
    body: typeof record.body === 'string' ? record.body : undefined,
    author: normalizeAuthor(record.author ?? record.user),
    createdAt,
    url:
      typeof record.url === 'string' ? record.url : typeof record.html_url === 'string' ? record.html_url : undefined,
  };
}

function normalizeReview(value: unknown): GithubPRSnapshot['reviews'][number] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const id = record.id ?? record.databaseId ?? record.nodeId;
  const submittedAt = normalizeTimestamp(record.submittedAt ?? record.submitted_at);
  if ((typeof id !== 'string' && typeof id !== 'number') || !submittedAt) return undefined;
  return {
    id: String(id),
    body: typeof record.body === 'string' ? record.body : undefined,
    author: normalizeAuthor(record.author ?? record.user),
    submittedAt,
    state: typeof record.state === 'string' ? record.state : undefined,
    url:
      typeof record.url === 'string' ? record.url : typeof record.html_url === 'string' ? record.html_url : undefined,
  };
}

export type { GithubSignalsProcessor };
