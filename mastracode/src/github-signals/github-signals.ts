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
import type { GithubInboxNotification, GithubPrSnapshotCache } from './notification-store.js';

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
const DEFAULT_PR_STATE_POLL_INTERVAL_MS = 60_000;
const DEFAULT_SNAPSHOT_POLL_INTERVAL_MS = 5 * 60_000;
const DEFAULT_PENDING_FLUSH_MS = 5 * 60_000;
const DEFAULT_GH_COMMAND_TIMEOUT_MS = 30_000;
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

export interface GithubAutoUnsubscribeEvent {
  resourceId: string;
  threadId: string;
  repo?: string;
  prNumber: number;
}

export type GithubAutoUnsubscribeHandler = (event: GithubAutoUnsubscribeEvent) => void | Promise<void>;

export interface GithubSignalsOptions {
  repo?: string;
  pollIntervalMs?: number;
  prStatePollIntervalMs?: number;
  snapshotPollIntervalMs?: number;
  pendingFlushMs?: number;
  includeTool?: boolean;
  commandRunner?: GithubCommandRunner;
  now?: () => Date;
  getStreamOptions?: GithubSignalStreamOptionsGetter;
  authorizedPermissions?: GithubPermission[];
  authorizedBots?: string[];
  notificationPoller?: GithubNotificationPoller;
  onAutoUnsubscribe?: GithubAutoUnsubscribeHandler;
}

type NormalizedGithubSignalsOptions = Required<
  Pick<
    GithubSignalsOptions,
    | 'pollIntervalMs'
    | 'prStatePollIntervalMs'
    | 'snapshotPollIntervalMs'
    | 'pendingFlushMs'
    | 'includeTool'
    | 'commandRunner'
    | 'now'
    | 'authorizedPermissions'
    | 'authorizedBots'
  >
> &
  Pick<GithubSignalsOptions, 'repo' | 'getStreamOptions' | 'onAutoUnsubscribe'>;

export interface GithubSignalsAddAgentOptions {
  id?: string;
  getStreamOptions?: GithubSignalStreamOptionsGetter;
}

export interface GithubSignalsInitOptions {
  memory: GithubSignalsMemory;
  resourceId?: string;
  threadId?: string;
}

export interface GithubSignalsMemory {
  listThreads?(args: { perPage?: number | false; page?: number; filter?: { resourceId?: string } }): Promise<{
    threads: Array<GithubSignalsThread>;
    hasMore?: boolean;
    total?: number;
  }>;
  getThreadById?(args: { threadId: string; resourceId: string }): Promise<GithubSignalsThread | null | undefined>;
  updateThread?(args: { id: string; title: string; metadata: Record<string, unknown> }): Promise<unknown>;
}

export interface GithubSignalsThread {
  id: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface GithubSignalsThreadOptions {
  memory: GithubSignalsMemory;
  resourceId: string;
  threadId: string;
  agentId?: string;
  repo?: string;
  prNumber: number;
  processedSignalId?: string;
}

export interface GithubSignalsSyncThreadOptions {
  agentId?: string;
  resourceId: string;
  threadId: string;
  repo?: string;
  prNumber?: number;
}

interface GithubSubscriptionPersistence {
  update(subscription: GithubPRSubscriptionMetadata): Promise<void>;
  remove?(subscription: GithubPRSubscriptionMetadata): Promise<void>;
}

export interface GithubCommandResult {
  stdout: string;
  stderr?: string;
}

export type GithubCommandRunner = (args: string[]) => Promise<GithubCommandResult>;
type GithubSignalSender = NonNullable<ProcessOutputResultArgs['sendSignal']>;

export interface GithubPRSignalInput {
  prNumber: number;
  repo?: string;
  summary?: string;
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
  lastCommentFingerprints?: Record<string, { updatedAt: string; bodyFingerprint: string }>;
  lastReviewTimestamp?: string;
  lastPrStateFingerprint?: string;
  lastMergeConflictFingerprint?: string;
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
  repo?: string;
  prNumber?: number;
}

interface ActiveSubscription extends GithubPRSubscriptionMetadata {
  key: string;
  persistence?: GithubSubscriptionPersistence;
}

interface RegisteredGithubAgent {
  agent: Agent<any, any, any, any>;
  getStreamOptions?: GithubSignalStreamOptionsGetter;
}

interface PendingGithubDeliveryClaim {
  accountKey: string;
  resourceId: string;
  threadId: string;
  repo: string;
  prNumber: number;
  notificationId: string;
  notificationUpdatedAt: string;
}

interface PendingGithubNotification {
  notification: Omit<GithubPRNotificationInput, 'repo' | 'prNumber'>;
  queuedAt: string;
  deliveryClaim?: PendingGithubDeliveryClaim;
}

interface PendingGithubNotificationBucket {
  subscription: ActiveSubscription;
  notifications: PendingGithubNotification[];
  firstQueuedAt: string;
  lastQueuedAt: string;
  noticeSent: boolean;
  acknowledgeAfterDelivery?: ActiveSubscription;
  unsubscribeAfterDelivery?: ActiveSubscription;
}

interface GithubPRSnapshot {
  title?: string;
  url?: string;
  state?: string;
  merged?: boolean;
  closedAt?: string;
  mergedAt?: string;
  mergeable?: boolean | string | null;
  mergeableState?: string;
  headSha?: string;
  failedChecks: Array<{ name: string; status: string; url?: string }>;
  comments: Array<{ id: string; body?: string; author?: string; createdAt?: string; updatedAt?: string; url?: string }>;
  reviews: Array<{ id: string; body?: string; author?: string; submittedAt?: string; state?: string; url?: string }>;
}

function prSnapshotCacheToSnapshot(snapshot: GithubPrSnapshotCache): GithubPRSnapshot {
  return {
    title: snapshot.title,
    url: snapshot.url,
    state: snapshot.state,
    merged: snapshot.merged,
    closedAt: snapshot.closedAt,
    mergedAt: snapshot.mergedAt,
    mergeable: snapshot.mergeable,
    mergeableState: snapshot.mergeableState,
    headSha: snapshot.headSha,
    failedChecks: snapshot.failedChecks ?? [],
    comments: [],
    reviews: snapshot.reviews ?? [],
  };
}

export const ghSignals = {
  prSubscribe(input: GithubPRSignalInput): CreatedAgentSignal {
    return createGithubSignal(
      GITHUB_SUBSCRIBE_SIGNAL,
      input,
      [
        `You are now subscribed to Github PR #${input.prNumber}. You will automatically receive CI failure, review, approval, and PR state notifications.`,
        input.summary,
      ]
        .filter(Boolean)
        .join('\n\n'),
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
    timeout: DEFAULT_GH_COMMAND_TIMEOUT_MS,
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

function getCommentBodyFingerprint(body: string | undefined): string {
  return stableFingerprint({ body: body ?? '' });
}

function getSnapshotCommentUpdatedAt(comment: GithubPRSnapshot['comments'][number]): string | undefined {
  return comment.updatedAt ?? comment.createdAt;
}

function getSnapshotCommentState(comments: GithubPRSnapshot['comments']) {
  return Object.fromEntries(
    comments
      .map(comment => {
        const updatedAt = getSnapshotCommentUpdatedAt(comment);
        if (!updatedAt) return undefined;
        return [comment.id, { updatedAt, bodyFingerprint: getCommentBodyFingerprint(comment.body) }] as const;
      })
      .filter((entry): entry is readonly [string, { updatedAt: string; bodyFingerprint: string }] => !!entry),
  );
}

function getCachedCommentKey(notification: GithubInboxNotification): string | undefined {
  return notification.latestCommentUrl ?? notification.commentHtmlUrl ?? notification.subjectUrl;
}

function getCachedCommentUpdatedAt(notification: GithubInboxNotification): string | undefined {
  return notification.commentUpdatedAt ?? notification.commentCreatedAt ?? notification.updatedAt;
}

function getUpdatedCommentDetails(body: string | undefined): string {
  return `Updated comment:\n\n${summarizeText(body, 'No comment body.')}`;
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

function getBooleanFromPath(value: unknown, path: string[]): boolean | undefined {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'boolean' ? current : undefined;
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

function getCachedDeliveryClaim(
  notificationPoller: GithubNotificationPoller | undefined,
  subscription: ActiveSubscription,
  notification: GithubInboxNotification,
  notificationUpdatedAt: string,
): PendingGithubDeliveryClaim | undefined {
  if (!notificationPoller) return undefined;
  return {
    accountKey: notificationPoller.accountKey,
    resourceId: subscription.resourceId,
    threadId: subscription.threadId,
    repo: notification.repo,
    prNumber: notification.prNumber,
    notificationId: notification.id,
    notificationUpdatedAt,
  };
}

function getCachedPrStateDeliveryKey(notification: GithubInboxNotification) {
  const state = notification.prMerged ? 'merged' : notification.prState?.toLowerCase();
  return `pr-state:${state}:${notification.prMergedAt ?? notification.prClosedAt ?? notification.updatedAt}`;
}

function getCachedPrStateFingerprint(notification: GithubInboxNotification) {
  if (!hasClosedPrState(notification)) return undefined;
  return getCachedPrStateDeliveryKey(notification);
}

function getSnapshotPrStateFingerprint(snapshot: GithubPRSnapshot) {
  if (snapshot.state?.toLowerCase() !== 'closed') return undefined;
  const state = snapshot.merged ? 'merged' : 'closed';
  return `pr-state:${state}:${snapshot.mergedAt ?? snapshot.closedAt ?? ''}`;
}

function getSnapshotPrStateTimestamp(snapshot: GithubPRSnapshot) {
  return snapshot.merged ? snapshot.mergedAt : snapshot.closedAt;
}

function getCachedPrConflictDeliveryKey(notification: GithubInboxNotification) {
  return `pr-conflict:${notification.prMergeableState ?? 'conflict'}:${notification.prHeadSha ?? notification.updatedAt}`;
}

function getSnapshotPrConflictFingerprint(snapshot: GithubPRSnapshot) {
  if (!hasSnapshotMergeConflict(snapshot)) return undefined;
  return `pr-conflict:${snapshot.mergeableState ?? snapshot.mergeable ?? 'conflict'}:${snapshot.headSha ?? ''}`;
}

function hasNewFailedCheckFingerprint(notification: GithubInboxNotification, subscription: ActiveSubscription) {
  if (!notification.failedChecks) return false;
  return getFailedChecksFingerprint(notification.failedChecks) !== subscription.lastCheckFingerprint;
}

function hasClosedPrState(notification: GithubInboxNotification) {
  return notification.prState?.toLowerCase() === 'closed';
}

function isMergeConflictState(value: unknown) {
  if (value === false) return true;
  if (typeof value !== 'string') return false;
  return ['conflicting', 'dirty'].includes(value.toLowerCase());
}

function hasMergeConflict(notification: GithubInboxNotification) {
  if (hasClosedPrState(notification)) return false;
  return isMergeConflictState(notification.prMergeable) || isMergeConflictState(notification.prMergeableState);
}

function hasSnapshotMergeConflict(snapshot: GithubPRSnapshot) {
  if (snapshot.state?.toLowerCase() === 'closed') return false;
  return isMergeConflictState(snapshot.mergeable) || isMergeConflictState(snapshot.mergeableState);
}

function formatReviewState(state: string | undefined) {
  const normalized = state?.toLowerCase();
  if (normalized === 'approved') return 'approved';
  if (normalized === 'changes_requested') return 'requested changes on';
  if (normalized === 'commented') return 'reviewed';
  return 'reviewed';
}

function formatSubscribeSnapshotSummary(snapshot: GithubPRSnapshot): string {
  const lines = ['Current PR snapshot:'];
  lines.push(
    `- State: ${snapshot.state ?? 'unknown'}${snapshot.mergedAt ? ` at ${snapshot.mergedAt}` : ''}${snapshot.title ? ` — ${snapshot.title}` : ''}`,
  );

  const latestReview = snapshot.reviews
    .filter(review => review.submittedAt)
    .sort((left, right) => new Date(left.submittedAt!).getTime() - new Date(right.submittedAt!).getTime())
    .at(-1);
  if (latestReview) {
    lines.push(
      `- Latest review: ${latestReview.state ?? 'unknown'}${latestReview.author ? ` by ${latestReview.author}` : ''}${latestReview.submittedAt ? ` at ${latestReview.submittedAt}` : ''}`,
    );
  } else {
    lines.push('- Review: none yet');
  }

  lines.push(
    `- CI: ${
      snapshot.failedChecks.length === 0
        ? 'no failing checks reported'
        : `${snapshot.failedChecks.length} failed: ${snapshot.failedChecks
            .slice(0, 3)
            .map(check => check.name)
            .join(', ')}`
    }`,
  );
  return lines.join('\n');
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
  #lastAutomaticPollAt?: number;
  #options: NormalizedGithubSignalsOptions;
  #notificationPoller?: GithubNotificationPoller;
  #pendingNotifications = new Map<string, PendingGithubNotificationBucket>();
  #permissionCache = new Map<string, GithubPermission | undefined>();
  #currentGithubLogin?: Promise<string | undefined>;

  constructor(options: GithubSignalsOptions = {}) {
    this.#options = {
      repo: options.repo,
      pollIntervalMs: options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      prStatePollIntervalMs: options.prStatePollIntervalMs ?? DEFAULT_PR_STATE_POLL_INTERVAL_MS,
      snapshotPollIntervalMs: options.snapshotPollIntervalMs ?? DEFAULT_SNAPSHOT_POLL_INTERVAL_MS,
      pendingFlushMs: options.pendingFlushMs ?? DEFAULT_PENDING_FLUSH_MS,
      includeTool: options.includeTool ?? true,
      commandRunner: options.commandRunner ?? defaultGithubCommandRunner,
      now: options.now ?? (() => new Date()),
      getStreamOptions: options.getStreamOptions,
      authorizedPermissions: options.authorizedPermissions ?? [...DEFAULT_AUTHORIZED_PERMISSIONS],
      authorizedBots: options.authorizedBots ?? [],
      onAutoUnsubscribe: options.onAutoUnsubscribe,
    };
    this.#notificationPoller = options.notificationPoller;
    this.processor = new GithubSignalsProcessor(this, this.#options);
  }

  addAgent(agent: Agent<any, any, any, any>, options: GithubSignalsAddAgentOptions = {}) {
    this.#agents.set(options.id ?? agent.id, { agent, getStreamOptions: options.getStreamOptions });
    return this;
  }

  onAutoUnsubscribe(handler: GithubAutoUnsubscribeHandler | undefined) {
    this.#options.onAutoUnsubscribe = handler;
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
          await this.baselineSubscription(subscription, { baselineMergeConflict: false }),
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

    if (!options.memory.listThreads) return subscriptions;

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

  async subscribeThread(options: GithubSignalsThreadOptions): Promise<GithubPRSubscriptionMetadata | undefined> {
    const thread = await this.#getThread(options.memory, options.resourceId, options.threadId);
    if (!thread) return undefined;

    const githubMetadata = getGithubSignalsMetadata(thread.metadata as ThreadMetadata | undefined);
    const processedSignalIds = new Set(githubMetadata.processedSignalIds);
    if (options.processedSignalId && processedSignalIds.has(options.processedSignalId)) {
      const key = threadSubscriptionKey({ repo: options.repo ?? this.#options.repo, prNumber: options.prNumber });
      return githubMetadata.subscriptions[key];
    }

    const now = this.#options.now().toISOString();
    const baseSubscription = {
      agentId: this.getAgentId(options.agentId),
      resourceId: options.resourceId,
      threadId: options.threadId,
      repo: options.repo ?? this.#options.repo,
      prNumber: options.prNumber,
    };
    const key = threadSubscriptionKey(baseSubscription);
    const existing = githubMetadata.subscriptions[key];
    const subscription = await this.baselineSubscription({
      ...existing,
      ...baseSubscription,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    githubMetadata.subscriptions[key] = subscription;
    if (options.processedSignalId) {
      processedSignalIds.add(options.processedSignalId);
      githubMetadata.processedSignalIds = truncateProcessedSignalIds([...processedSignalIds]);
    }

    this.addSubscription(subscription, this.#createSubscriptionPersistence(options.memory, thread));
    await this.#persistGithubMetadata(options.memory, thread, githubMetadata);
    return subscription;
  }

  async unsubscribeThread(options: GithubSignalsThreadOptions): Promise<GithubPRSubscriptionMetadata | undefined> {
    const thread = await this.#getThread(options.memory, options.resourceId, options.threadId);
    if (!thread) return undefined;

    const githubMetadata = getGithubSignalsMetadata(thread.metadata as ThreadMetadata | undefined);
    const processedSignalIds = new Set(githubMetadata.processedSignalIds);
    if (options.processedSignalId && processedSignalIds.has(options.processedSignalId)) {
      const key = threadSubscriptionKey({ repo: options.repo ?? this.#options.repo, prNumber: options.prNumber });
      return githubMetadata.subscriptions[key];
    }

    const baseSubscription = {
      agentId: this.getAgentId(options.agentId),
      resourceId: options.resourceId,
      threadId: options.threadId,
      repo: options.repo ?? this.#options.repo,
      prNumber: options.prNumber,
    };
    const key = threadSubscriptionKey(baseSubscription);
    const existing = githubMetadata.subscriptions[key];
    delete githubMetadata.subscriptions[key];
    if (existing) githubMetadata.subscriptionHintShown = false;
    if (options.processedSignalId) {
      processedSignalIds.add(options.processedSignalId);
      githubMetadata.processedSignalIds = truncateProcessedSignalIds([...processedSignalIds]);
    }

    this.removeSubscription(existing ?? baseSubscription);
    await this.#persistGithubMetadata(options.memory, thread, githubMetadata);
    return existing;
  }

  async syncThread(options: GithubSignalsSyncThreadOptions): Promise<{ pendingDelivered: number }> {
    const context = {
      agentId: this.getAgentId(options.agentId),
      resourceId: options.resourceId,
      threadId: options.threadId,
      repo: options.repo,
      prNumber: options.prNumber,
    };
    await this.poll(context, { forceSnapshot: true });
    const pendingDelivered = await this.deliverPendingNotifications({
      ...context,
      repo: options.repo,
      prNumber: options.prNumber,
    });
    return { pendingDelivered };
  }

  async #getThread(memory: GithubSignalsMemory, resourceId: string, threadId: string) {
    if (memory.getThreadById) return memory.getThreadById({ threadId, resourceId });
    if (!memory.listThreads) return undefined;
    let page = 0;
    do {
      const result = await memory.listThreads({ page, perPage: 100, filter: { resourceId } });
      const thread = result.threads.find(candidate => candidate.id === threadId);
      if (thread) return thread;
      page += 1;
      if (result.hasMore === false || result.threads.length === 0) break;
      if (typeof result.total === 'number' && page * 100 >= result.total) break;
    } while (true);
    return undefined;
  }

  async #persistGithubMetadata(
    memory: GithubSignalsMemory,
    thread: GithubSignalsThread,
    githubMetadata: GithubSignalsThreadMetadata,
  ) {
    if (!memory.updateThread) return;
    await memory.updateThread({
      id: thread.id,
      title: thread.title ?? '',
      metadata: setGithubSignalsMetadata(thread.metadata as ThreadMetadata | undefined, githubMetadata),
    });
  }

  #createSubscriptionPersistence(
    memory: GithubSignalsMemory,
    thread: GithubSignalsThread,
  ): GithubSubscriptionPersistence | undefined {
    if (!memory.updateThread) return undefined;
    return {
      update: subscription => this.#persistSubscription(memory, thread, subscription),
      remove: subscription => this.#persistSubscriptionRemoval(memory, thread, subscription),
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

  async #persistSubscriptionRemoval(
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

    delete metadata.subscriptions[key];
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

  getAgentIdForThread(resourceId: string, threadId: string) {
    const agentIds = new Set<string>();
    for (const subscription of this.#activeSubscriptions.values()) {
      if (subscription.resourceId === resourceId && subscription.threadId === threadId) {
        agentIds.add(subscription.agentId);
      }
    }
    if (agentIds.size === 1) return agentIds.values().next().value as string;
    return this.getAgentId();
  }

  removeAgent(agentOrId: Agent<any, any, any, any> | string) {
    const agentId = typeof agentOrId === 'string' ? agentOrId : agentOrId.id;
    this.#agents.delete(agentId);
    for (const [key, subscription] of this.#activeSubscriptions) {
      if (subscription.agentId === agentId) {
        this.#activeSubscriptions.delete(key);
      }
    }
    for (const [key, bucket] of this.#pendingNotifications) {
      if (bucket.subscription.agentId === agentId) {
        this.#pendingNotifications.delete(key);
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
    options: { force?: boolean; baselineMergeConflict?: boolean } = {},
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
        const snapshot = await this.#loadPullRequestSnapshot(subscription);
        return {
          ...subscription,
          lastNotificationUpdatedAt: getLatestTimestamp(notifications, notification => notification.updatedAt),
          seenNotificationIds: notifications.map(notification => notification.id).slice(-MAX_PROCESSED_SIGNAL_IDS),
          lastCheckFingerprint: getFailedChecksFingerprint(snapshot.failedChecks),
          lastCommentTimestamp: getLatestTimestamp(snapshot.comments, comment => comment.createdAt),
          lastCommentFingerprints: getSnapshotCommentState(snapshot.comments),
          lastReviewTimestamp: getLatestTimestamp(snapshot.reviews, review => review.submittedAt),
          lastPrStateFingerprint: getSnapshotPrStateFingerprint(snapshot),
          lastMergeConflictFingerprint:
            options.baselineMergeConflict === false
              ? subscription.lastMergeConflictFingerprint
              : getSnapshotPrConflictFingerprint(snapshot),
          lastErrorFingerprint: undefined,
          updatedAt: this.#options.now().toISOString(),
        };
      }

      const snapshot = await this.#loadPullRequestSnapshot(subscription);
      return {
        ...subscription,
        lastCheckFingerprint: getFailedChecksFingerprint(snapshot.failedChecks),
        lastCommentTimestamp: getLatestTimestamp(snapshot.comments, comment => comment.createdAt),
        lastCommentFingerprints: getSnapshotCommentState(snapshot.comments),
        lastReviewTimestamp: getLatestTimestamp(snapshot.reviews, review => review.submittedAt),
        lastPrStateFingerprint: getSnapshotPrStateFingerprint(snapshot),
        lastMergeConflictFingerprint:
          options.baselineMergeConflict === false
            ? subscription.lastMergeConflictFingerprint
            : getSnapshotPrConflictFingerprint(snapshot),
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
    await this.deliverPendingNotifications(context);
    await this.#pollIfDue(context);
  }

  markIdleAfterOutput(context: ActiveThreadContext) {
    this.#activeThreads.delete(activeThreadKey(context));
    setTimeout(() => void this.markIdle(context), 0);
  }

  async poll(context?: ActiveThreadContext, options: { forceSnapshot?: boolean } = {}) {
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
        if (context?.repo && subscription.repo !== context.repo) continue;
        if (context?.prNumber && subscription.prNumber !== context.prNumber) continue;
        if (sharedInboxError) {
          const registeredAgent = this.#agents.get(subscription.agentId);
          if (registeredAgent) await this.#emitCommandError(registeredAgent, subscription, sharedInboxError);
          continue;
        }
        await this.#pollSubscription(subscription, options);
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
      void this.#pollIfDue();
    }, this.#options.pollIntervalMs);
    this.#timer.unref?.();
  }

  async #pollIfDue(context?: ActiveThreadContext) {
    const now = this.#options.now().getTime();
    if (this.#lastAutomaticPollAt && now - this.#lastAutomaticPollAt < this.#options.pollIntervalMs) return;
    this.#lastAutomaticPollAt = now;
    await this.poll(context);
  }

  async #pollSubscription(subscription: ActiveSubscription, options: { forceSnapshot?: boolean } = {}) {
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
        try {
          const snapshot = await this.#refreshSharedSnapshot(subscription, options.forceSnapshot === true);
          if (snapshot) {
            await this.#emitCheckNotifications(registeredAgent, subscription, snapshot.failedChecks);
            await this.#emitSnapshotReviewAndStateNotifications(registeredAgent, subscription, snapshot);
          }
        } catch {
          // Shared inbox delivery still works without the fallback snapshot poll.
        }
        return;
      }

      const snapshot = await this.#loadPullRequestSnapshot(subscription);
      await this.#emitSnapshotNotifications(registeredAgent, subscription, snapshot);
    } catch (error) {
      if (!isSqliteBusyError(error)) await this.#emitCommandError(registeredAgent, subscription, error);
    }
  }

  async #refreshSharedSnapshot(
    subscription: ActiveSubscription,
    force: boolean,
  ): Promise<GithubPRSnapshot | undefined> {
    if (!this.#notificationPoller || !subscription.repo) return undefined;
    const now = this.#options.now().getTime();
    const staleBefore = new Date(now - this.#options.prStatePollIntervalMs).toISOString();
    const heavyStaleBefore = new Date(now - this.#options.snapshotPollIntervalMs).toISOString();
    const cachedSnapshot = await this.#notificationPoller.refreshPullRequestSnapshot(
      subscription.repo,
      subscription.prNumber,
      {
        staleBefore,
        checksStaleBefore: staleBefore,
        heavyStaleBefore,
        force,
      },
    );
    return cachedSnapshot ? prSnapshotCacheToSnapshot(cachedSnapshot) : undefined;
  }

  async getSubscribeSummary(subscription: GithubPRSubscriptionMetadata): Promise<string | undefined> {
    try {
      if (this.#notificationPoller && subscription.repo) {
        const snapshot = await this.#notificationPoller.refreshPullRequestSnapshot(
          subscription.repo,
          subscription.prNumber,
          {
            force: true,
          },
        );
        if (snapshot) return formatSubscribeSnapshotSummary(prSnapshotCacheToSnapshot(snapshot));
      }
      return formatSubscribeSnapshotSummary(await this.#loadPullRequestSnapshot(subscription));
    } catch {
      return undefined;
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
      title: getStringFromPath(pr, ['title']),
      url: getStringFromPath(pr, ['html_url']),
      state: getStringFromPath(pr, ['state']),
      merged: getBooleanFromPath(pr, ['merged']),
      closedAt: getStringFromPath(pr, ['closed_at']),
      mergedAt: getStringFromPath(pr, ['merged_at']),
      mergeable: getBooleanFromPath(pr, ['mergeable']) ?? getStringFromPath(pr, ['mergeable']),
      mergeableState: getStringFromPath(pr, ['mergeable_state']) ?? getStringFromPath(pr, ['mergeStateStatus']),
      headSha,
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

    const acknowledgedCachedDelivery: ActiveSubscription | undefined =
      notifications.length > 0
        ? {
            ...subscription,
            lastNotificationUpdatedAt: getLatestTimestamp(notifications, notification => notification.updatedAt),
            seenNotificationIds: [...seenIds, ...notifications.map(notification => notification.id)].slice(
              -MAX_PROCESSED_SIGNAL_IDS,
            ),
            lastErrorFingerprint: undefined,
            nextPollAt: undefined,
            updatedAt: this.#options.now().toISOString(),
          }
        : undefined;

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

      const currentGithubLogin = notification.commentAuthor ? await this.#getCurrentGithubLogin() : undefined;
      if (!isActionableCachedNotification(notification, currentGithubLogin)) continue;

      const cachedCommentKey = getCachedCommentKey(notification);
      const cachedCommentUpdatedAt = getCachedCommentUpdatedAt(notification);
      const previousCachedComment = cachedCommentKey
        ? subscription.lastCommentFingerprints?.[cachedCommentKey]
        : undefined;
      const cachedCommentBodyFingerprint = getCommentBodyFingerprint(notification.commentBody);
      const isUpdatedCachedComment =
        !!cachedCommentKey &&
        !!cachedCommentUpdatedAt &&
        !!previousCachedComment &&
        cachedCommentUpdatedAt !== previousCachedComment.updatedAt &&
        cachedCommentBodyFingerprint !== previousCachedComment.bodyFingerprint;
      const deliveryClaim = getCachedDeliveryClaim(
        this.#notificationPoller,
        subscription,
        notification,
        isUpdatedCachedComment && cachedCommentUpdatedAt
          ? `${getCachedNotificationDeliveryKey(notification)}:comment-updated:${cachedCommentUpdatedAt}:${cachedCommentBodyFingerprint}`
          : getCachedNotificationDeliveryKey(notification),
      );
      if (!this.#activeThreads.has(activeThreadKey(subscription))) {
        const claimed = await this.#claimNotificationDelivery(deliveryClaim);
        if (!claimed) continue;
      }

      const delivery = await this.#handleNotification(
        registeredAgent,
        subscription,
        {
          kind: 'comment',
          title: isUpdatedCachedComment ? `Updated GitHub comment` : notification.title,
          details: isUpdatedCachedComment
            ? getUpdatedCommentDetails(notification.commentBody)
            : summarizeText(
                notification.commentBody,
                notification.reason
                  ? `GitHub notification (${notification.reason}): ${notification.title}`
                  : `GitHub notification: ${notification.title}`,
              ),
          url:
            notification.commentHtmlUrl ?? notification.latestCommentUrl ?? notification.subjectUrl ?? notification.url,
          user: notification.commentAuthor,
        },
        { acknowledgeAfterDelivery: acknowledgedCachedDelivery, deliveryClaim },
      );
      if (delivery === 'queued') queuedDelivery = true;
    }

    const latestCommentFingerprints = { ...(subscription.lastCommentFingerprints ?? {}) };
    for (const notification of notifications) {
      const cachedCommentKey = getCachedCommentKey(notification);
      const cachedCommentUpdatedAt = getCachedCommentUpdatedAt(notification);
      if (!cachedCommentKey || !cachedCommentUpdatedAt || !notification.commentBody) continue;
      latestCommentFingerprints[cachedCommentKey] = {
        updatedAt: cachedCommentUpdatedAt,
        bodyFingerprint: getCommentBodyFingerprint(notification.commentBody),
      };
    }

    if (acknowledgedCachedDelivery && !queuedDelivery) {
      const finalSubscription = {
        ...subscription,
        ...acknowledgedCachedDelivery,
        lastCommentFingerprints: latestCommentFingerprints,
      };
      Object.assign(subscription, finalSubscription);
      this.#activeSubscriptions.set(subscription.key, finalSubscription);
      await subscription.persistence?.update(finalSubscription);
    }
  }

  async #emitCachedPrStateNotification(
    registeredAgent: RegisteredGithubAgent,
    subscription: ActiveSubscription,
    notification: GithubInboxNotification,
  ): Promise<'sent' | 'queued' | 'skipped'> {
    if (notification.prState?.toLowerCase() !== 'closed') return 'skipped';

    const kind = notification.prMerged ? 'pr-merged' : 'pr-closed';
    const deliveryClaim = getCachedDeliveryClaim(
      this.#notificationPoller,
      subscription,
      notification,
      getCachedPrStateDeliveryKey(notification),
    );
    if (!this.#activeThreads.has(activeThreadKey(subscription))) {
      const claimed = await this.#claimNotificationDelivery(deliveryClaim);
      if (!claimed) return 'skipped';
    }

    const acknowledgedSubscription: ActiveSubscription = {
      ...subscription,
      lastPrStateFingerprint: getCachedPrStateFingerprint(notification),
      lastErrorFingerprint: undefined,
      updatedAt: this.#options.now().toISOString(),
    };

    const delivery = await this.#handleNotification(
      registeredAgent,
      subscription,
      {
        kind,
        title: notification.prMerged ? 'GitHub PR merged' : 'GitHub PR closed',
        details: notification.prMerged
          ? getMergedNotificationDetails(notification.prNumber, notification.title)
          : `PR #${notification.prNumber} was closed without merge: ${notification.title}`,
        url: notification.prHtmlUrl ?? notification.subjectUrl ?? notification.url,
      },
      {
        acknowledgeAfterDelivery: acknowledgedSubscription,
        deliveryClaim,
        ...(notification.prMerged ? { unsubscribeAfterDelivery: acknowledgedSubscription } : {}),
      },
    );
    if (delivery === 'queued') return 'queued';

    if (notification.prMerged) {
      await this.#autoUnsubscribeMergedSubscription(acknowledgedSubscription);
      return 'sent';
    }

    Object.assign(subscription, acknowledgedSubscription);
    this.#activeSubscriptions.set(subscription.key, acknowledgedSubscription);
    await subscription.persistence?.update(acknowledgedSubscription);
    return 'sent';
  }

  async #emitCachedPrConflictNotification(
    registeredAgent: RegisteredGithubAgent,
    subscription: ActiveSubscription,
    notification: GithubInboxNotification,
  ): Promise<'sent' | 'queued' | 'skipped'> {
    if (!hasMergeConflict(notification)) return 'skipped';

    const deliveryClaim = getCachedDeliveryClaim(
      this.#notificationPoller,
      subscription,
      notification,
      getCachedPrConflictDeliveryKey(notification),
    );
    if (!this.#activeThreads.has(activeThreadKey(subscription))) {
      const claimed = await this.#claimNotificationDelivery(deliveryClaim);
      if (!claimed) return 'skipped';
    }

    const delivery = await this.#handleNotification(
      registeredAgent,
      subscription,
      {
        kind: 'pr-conflict',
        title: 'GitHub PR merge conflict',
        details: `PR #${notification.prNumber} has merge conflicts: ${notification.title}`,
        url: notification.prHtmlUrl ?? notification.subjectUrl ?? notification.url,
      },
      { deliveryClaim },
    );
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
      { acknowledgeAfterDelivery: acknowledgedSubscription },
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
      { acknowledgeAfterDelivery: acknowledgedSubscription },
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

    const previousCommentFingerprints = subscription.lastCommentFingerprints ?? {};
    const changedComments = snapshot.comments
      .map(comment => {
        const updatedAt = getSnapshotCommentUpdatedAt(comment);
        const previous = previousCommentFingerprints[comment.id];
        const bodyFingerprint = getCommentBodyFingerprint(comment.body);
        const isNew = isAfterTimestamp(comment.createdAt, subscription.lastCommentTimestamp ?? subscription.createdAt);
        const isUpdated =
          !!updatedAt && !!previous && updatedAt !== previous.updatedAt && bodyFingerprint !== previous.bodyFingerprint;
        return isNew || isUpdated ? { comment, isUpdated, updatedAt, bodyFingerprint } : undefined;
      })
      .filter(
        (
          entry,
        ): entry is {
          comment: GithubPRSnapshot['comments'][number];
          isUpdated: boolean;
          updatedAt: string | undefined;
          bodyFingerprint: string;
        } => !!entry,
      );
    const latestCommentTimestamp = getLatestTimestamp(snapshot.comments, comment => comment.createdAt);
    const commentAcknowledgement = latestCommentTimestamp
      ? {
          ...subscription,
          lastCommentTimestamp: latestCommentTimestamp,
          lastCommentFingerprints: getSnapshotCommentState(snapshot.comments),
          lastErrorFingerprint: undefined,
          nextPollAt: undefined,
          updatedAt: this.#options.now().toISOString(),
        }
      : undefined;
    const currentGithubLogin = changedComments.some(({ comment }) => comment.author)
      ? await this.#getCurrentGithubLogin()
      : undefined;
    let queuedCommentDelivery = false;
    let deliveredComment = false;
    for (const { comment, isUpdated } of changedComments) {
      if (isCurrentGithubUser(comment.author, currentGithubLogin)) continue;
      if (!(await this.#isAuthorizedAuthor(subscription, comment.author))) continue;
      const delivery = await this.#handleNotification(
        registeredAgent,
        subscription,
        {
          kind: 'comment',
          title: isUpdated ? `Updated GitHub comment` : `GitHub comment`,
          details: isUpdated ? getUpdatedCommentDetails(comment.body) : summarizeText(comment.body, 'No comment body.'),
          url: comment.url,
          user: comment.author,
        },
        commentAcknowledgement ? { acknowledgeAfterDelivery: commentAcknowledgement } : {},
      );
      queuedCommentDelivery ||= delivery === 'queued';
      deliveredComment ||= delivery === 'sent';
    }
    if (commentAcknowledgement && !queuedCommentDelivery && (changedComments.length > 0 || deliveredComment)) {
      Object.assign(subscription, commentAcknowledgement);
      this.#activeSubscriptions.set(subscription.key, commentAcknowledgement);
      await subscription.persistence?.update(commentAcknowledgement);
    }

    await this.#emitSnapshotReviewAndStateNotifications(registeredAgent, subscription, snapshot);
  }

  async #emitSnapshotReviewAndStateNotifications(
    registeredAgent: RegisteredGithubAgent,
    subscription: ActiveSubscription,
    snapshot: GithubPRSnapshot,
  ) {
    const newReviews = snapshot.reviews.filter(review =>
      isAfterTimestamp(review.submittedAt, subscription.lastReviewTimestamp ?? subscription.createdAt),
    );
    const latestReviewTimestamp = getLatestTimestamp(newReviews, review => review.submittedAt);
    const reviewAcknowledgement = latestReviewTimestamp
      ? {
          ...subscription,
          lastReviewTimestamp: latestReviewTimestamp,
          lastErrorFingerprint: undefined,
          nextPollAt: undefined,
          updatedAt: this.#options.now().toISOString(),
        }
      : undefined;
    let queuedReviewDelivery = false;
    let deliveredReview = false;
    for (const review of newReviews) {
      if (!(await this.#isAuthorizedAuthor(subscription, review.author))) continue;
      const delivery = await this.#handleNotification(
        registeredAgent,
        subscription,
        {
          kind: 'review',
          title: review.state?.toLowerCase() === 'approved' ? `GitHub PR approved` : `GitHub review`,
          details: summarizeText(
            review.body,
            `${review.author ?? 'Someone'} ${formatReviewState(review.state)} this PR.`,
          ),
          url: review.url,
          user: review.author,
          reviewState: review.state,
        },
        reviewAcknowledgement ? { acknowledgeAfterDelivery: reviewAcknowledgement } : {},
      );
      queuedReviewDelivery ||= delivery === 'queued';
      deliveredReview ||= delivery === 'sent';
    }
    if (reviewAcknowledgement && !queuedReviewDelivery && (newReviews.length > 0 || deliveredReview)) {
      Object.assign(subscription, reviewAcknowledgement);
      this.#activeSubscriptions.set(subscription.key, reviewAcknowledgement);
      await subscription.persistence?.update(reviewAcknowledgement);
    }

    const mergeConflictFingerprint = getSnapshotPrConflictFingerprint(snapshot);
    if (mergeConflictFingerprint !== subscription.lastMergeConflictFingerprint) {
      const acknowledgedSubscription: ActiveSubscription = {
        ...subscription,
        lastMergeConflictFingerprint: mergeConflictFingerprint,
        lastErrorFingerprint: undefined,
        nextPollAt: undefined,
        updatedAt: this.#options.now().toISOString(),
      };
      if (mergeConflictFingerprint) {
        const delivery = await this.#handleNotification(
          registeredAgent,
          subscription,
          {
            kind: 'pr-conflict',
            title: 'GitHub PR merge conflict',
            details: `PR #${subscription.prNumber} has merge conflicts: ${snapshot.title ?? 'GitHub PR'}`,
            url: snapshot.url,
          },
          { acknowledgeAfterDelivery: acknowledgedSubscription },
        );
        if (delivery === 'queued') return;
      }
      Object.assign(subscription, acknowledgedSubscription);
    }

    const prStateFingerprint = getSnapshotPrStateFingerprint(snapshot);
    const prStateTimestamp = getSnapshotPrStateTimestamp(snapshot);
    if (
      prStateFingerprint &&
      prStateFingerprint !== subscription.lastPrStateFingerprint &&
      isAfterTimestamp(prStateTimestamp, subscription.createdAt)
    ) {
      const acknowledgedSubscription: ActiveSubscription = {
        ...subscription,
        lastPrStateFingerprint: prStateFingerprint,
        lastErrorFingerprint: undefined,
        nextPollAt: undefined,
        updatedAt: this.#options.now().toISOString(),
      };
      const delivery = await this.#handleNotification(
        registeredAgent,
        subscription,
        {
          kind: snapshot.merged ? 'pr-merged' : 'pr-closed',
          title: snapshot.merged ? 'GitHub PR merged' : 'GitHub PR closed',
          details: snapshot.merged
            ? getMergedNotificationDetails(subscription.prNumber, snapshot.title ?? 'GitHub PR')
            : `PR #${subscription.prNumber} was closed without merge: ${snapshot.title ?? 'GitHub PR'}`,
          url: snapshot.url,
        },
        {
          acknowledgeAfterDelivery: acknowledgedSubscription,
          ...(snapshot.merged ? { unsubscribeAfterDelivery: acknowledgedSubscription } : {}),
        },
      );
      if (delivery === 'queued') return;
      if (snapshot.merged) {
        await this.#autoUnsubscribeMergedSubscription(acknowledgedSubscription);
        return;
      }
      Object.assign(subscription, acknowledgedSubscription);
    }

    if (queuedReviewDelivery) return;

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

  async #getCurrentGithubLogin() {
    this.#currentGithubLogin ??= this.#options
      .commandRunner(['api', 'user', '--jq', '.login'])
      .then(result => stripAnsi(result.stdout).trim() || undefined)
      .catch(() => undefined);
    return this.#currentGithubLogin;
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
    options: {
      acknowledgeAfterDelivery?: ActiveSubscription;
      deliveryClaim?: PendingGithubDeliveryClaim;
      unsubscribeAfterDelivery?: ActiveSubscription;
    } = {},
  ): Promise<'sent' | 'queued'> {
    if (!this.#activeThreads.has(activeThreadKey(subscription))) {
      await this.#sendNotification(registeredAgent, subscription, notification);
      return 'sent';
    }

    await this.#queuePendingNotification(registeredAgent, subscription, notification, options);
    return 'queued';
  }

  async #queuePendingNotification(
    registeredAgent: RegisteredGithubAgent,
    subscription: ActiveSubscription,
    notification: Omit<GithubPRNotificationInput, 'repo' | 'prNumber'>,
    options: {
      acknowledgeAfterDelivery?: ActiveSubscription;
      deliveryClaim?: PendingGithubDeliveryClaim;
      unsubscribeAfterDelivery?: ActiveSubscription;
    } = {},
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
    if (options.acknowledgeAfterDelivery) {
      const existingAcknowledgement = bucket.acknowledgeAfterDelivery;
      bucket.acknowledgeAfterDelivery = {
        ...(existingAcknowledgement ?? subscription),
        ...options.acknowledgeAfterDelivery,
        lastNotificationUpdatedAt:
          options.acknowledgeAfterDelivery.lastNotificationUpdatedAt ??
          existingAcknowledgement?.lastNotificationUpdatedAt ??
          subscription.lastNotificationUpdatedAt,
        seenNotificationIds:
          options.acknowledgeAfterDelivery.seenNotificationIds ??
          existingAcknowledgement?.seenNotificationIds ??
          subscription.seenNotificationIds,
        lastCheckFingerprint:
          options.acknowledgeAfterDelivery.lastCheckFingerprint ??
          existingAcknowledgement?.lastCheckFingerprint ??
          subscription.lastCheckFingerprint,
        lastCommentTimestamp:
          options.acknowledgeAfterDelivery.lastCommentTimestamp ??
          existingAcknowledgement?.lastCommentTimestamp ??
          subscription.lastCommentTimestamp,
        lastCommentFingerprints:
          options.acknowledgeAfterDelivery.lastCommentFingerprints ??
          existingAcknowledgement?.lastCommentFingerprints ??
          subscription.lastCommentFingerprints,
        lastReviewTimestamp:
          options.acknowledgeAfterDelivery.lastReviewTimestamp ??
          existingAcknowledgement?.lastReviewTimestamp ??
          subscription.lastReviewTimestamp,
        lastPrStateFingerprint:
          options.acknowledgeAfterDelivery.lastPrStateFingerprint ??
          existingAcknowledgement?.lastPrStateFingerprint ??
          subscription.lastPrStateFingerprint,
        lastMergeConflictFingerprint:
          options.acknowledgeAfterDelivery.lastMergeConflictFingerprint ??
          existingAcknowledgement?.lastMergeConflictFingerprint ??
          subscription.lastMergeConflictFingerprint,
      };
    }
    if (options.unsubscribeAfterDelivery) {
      bucket.unsubscribeAfterDelivery = options.unsubscribeAfterDelivery;
    }
    if (
      bucket.notifications.some(pending => {
        const isSameDeliveryClaim =
          options.deliveryClaim &&
          pending.deliveryClaim?.notificationId === options.deliveryClaim.notificationId &&
          pending.deliveryClaim?.notificationUpdatedAt === options.deliveryClaim.notificationUpdatedAt;
        const isSameNotification =
          pending.notification.kind === notification.kind &&
          pending.notification.title === notification.title &&
          pending.notification.details === notification.details;
        return isSameDeliveryClaim || isSameNotification;
      })
    ) {
      return;
    }
    bucket.notifications.push({ notification, queuedAt, deliveryClaim: options.deliveryClaim });
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
        contents: `${count} new GitHub ${count === 1 ? 'notification is' : 'notifications are'} pending. If you're busy, keep working; when you're done, call the github tool with action: "pending" to review them.`,
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
        ifActive: { behavior: 'persist' },
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

  async deliverPendingNotifications(
    filter: ActiveThreadContext & { repo?: string; prNumber?: number },
    sendSignal?: GithubSignalSender,
  ) {
    const buckets = this.#getPendingNotificationBuckets(filter);
    let deliveredCount = 0;

    for (const [key, bucket] of buckets) {
      const registeredAgent = this.#agents.get(bucket.subscription.agentId);
      if (!registeredAgent) continue;
      const delivered = await this.#sendPendingNotifications(registeredAgent, bucket, sendSignal);
      deliveredCount += delivered.length;
      await this.#acknowledgePendingDelivery(bucket, delivered);
      this.#pendingNotifications.delete(key);
    }

    return deliveredCount;
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

  async #sendPendingNotifications(
    registeredAgent: RegisteredGithubAgent,
    bucket: PendingGithubNotificationBucket,
    sendSignal?: GithubSignalSender,
  ) {
    const delivered: PendingGithubNotification[] = [];
    for (const pending of bucket.notifications) {
      if (await this.#hasNotificationDelivery(pending.deliveryClaim)) continue;
      await this.#sendNotification(registeredAgent, bucket.subscription, pending.notification, sendSignal);
      delivered.push(pending);
    }
    return delivered;
  }

  async #acknowledgePendingDelivery(
    bucket: PendingGithubNotificationBucket,
    deliveredNotifications: PendingGithubNotification[],
  ) {
    for (const pending of deliveredNotifications) {
      await this.#claimNotificationDelivery(pending.deliveryClaim);
    }

    const unsubscribeAfterDelivery = bucket.unsubscribeAfterDelivery;
    if (unsubscribeAfterDelivery && deliveredNotifications.length > 0) {
      await this.#autoUnsubscribeMergedSubscription(unsubscribeAfterDelivery);
      return;
    }

    const acknowledgedSubscription = bucket.acknowledgeAfterDelivery;
    if (!acknowledgedSubscription) return;

    this.#activeSubscriptions.set(acknowledgedSubscription.key, acknowledgedSubscription);
    bucket.subscription = { ...acknowledgedSubscription };
    await acknowledgedSubscription.persistence?.update(acknowledgedSubscription);
  }

  async #hasNotificationDelivery(deliveryClaim: PendingGithubDeliveryClaim | undefined) {
    if (!deliveryClaim) return false;
    return (await this.#notificationPoller?.store.hasNotificationDelivery(deliveryClaim)) ?? false;
  }

  async #autoUnsubscribeMergedSubscription(subscription: ActiveSubscription) {
    this.#activeSubscriptions.delete(subscription.key);
    await subscription.persistence?.remove?.(subscription);
    this.#ensureTimer();
    await this.#options.onAutoUnsubscribe?.({
      resourceId: subscription.resourceId,
      threadId: subscription.threadId,
      ...(subscription.repo ? { repo: subscription.repo } : {}),
      prNumber: subscription.prNumber,
    });
  }

  async #claimNotificationDelivery(deliveryClaim: PendingGithubDeliveryClaim | undefined) {
    if (!deliveryClaim) return true;
    return (await this.#notificationPoller?.store.claimNotificationDelivery(deliveryClaim)) ?? true;
  }

  async #flushExpiredPendingNotifications() {
    const now = this.#options.now().getTime();
    const expired = [...this.#pendingNotifications.entries()].filter(([, bucket]) => {
      return now - new Date(bucket.firstQueuedAt).getTime() >= this.#options.pendingFlushMs;
    });

    for (const [key, bucket] of expired) {
      const registeredAgent = this.#agents.get(bucket.subscription.agentId);
      if (!registeredAgent) continue;
      const delivered = await this.#sendPendingNotifications(registeredAgent, bucket);
      await this.#acknowledgePendingDelivery(bucket, delivered);
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
    sendSignal?: GithubSignalSender,
  ) {
    const signal = ghSignals.prNotification({
      ...notification,
      repo: subscription.repo,
      prNumber: subscription.prNumber,
    });

    if (sendSignal) {
      await sendSignal(signal);
      return;
    }

    const streamOptions = await (registeredAgent.getStreamOptions ?? this.#options.getStreamOptions)?.({
      agentId: subscription.agentId,
      resourceId: subscription.resourceId,
      threadId: subscription.threadId,
      repo: subscription.repo,
      prNumber: subscription.prNumber,
    });
    const result = registeredAgent.agent.sendSignal(signal, {
      resourceId: subscription.resourceId,
      threadId: subscription.threadId,
      ifIdle: { behavior: 'wake', ...(streamOptions ? { streamOptions: streamOptions as any } : {}) },
      ifActive: { behavior: 'deliver' },
    });
    await result.persisted;
    await result.started;
  }
}

function getMergedNotificationDetails(prNumber: number, title: string) {
  return `PR #${prNumber} was merged: ${title}\n\nThis thread has been automatically unsubscribed from this PR. If you still need updates, resubscribe with the github tool.`;
}

function isCurrentGithubUser(author: string | undefined, currentGithubLogin: string | undefined) {
  return !!currentGithubLogin && !!author && author.toLowerCase() === currentGithubLogin.toLowerCase();
}

function isActionableCachedNotification(notification: GithubInboxNotification, currentGithubLogin?: string) {
  if (isCurrentGithubUser(notification.commentAuthor, currentGithubLogin)) {
    return false;
  }

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
    if (context) this.#owner.markIdleAfterOutput(context);
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
    return { agentId: this.#owner.getAgentIdForThread(resourceId, threadId), resourceId, threadId };
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

    const agentId = this.#owner.getAgentId(
      signal.metadata?.agentId && typeof signal.metadata.agentId === 'string' ? signal.metadata.agentId : undefined,
    );
    const options = {
      memory,
      resourceId,
      threadId,
      agentId,
      repo: payload.repo,
      prNumber: payload.prNumber,
      processedSignalId: signal.id,
    };

    if (signalType === GITHUB_SUBSCRIBE_SIGNAL) {
      await this.#owner.subscribeThread(options);
    } else {
      await this.#owner.unsubscribeThread(options);
    }
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

            const resolvedRepo = repo ?? this.#options.repo;
            const summary =
              action === 'subscribe'
                ? await this.#owner.getSubscribeSummary({
                    agentId: this.#owner.getAgentId(),
                    resourceId: context?.resourceId ?? '',
                    threadId: context?.threadId ?? '',
                    repo: resolvedRepo,
                    prNumber,
                    createdAt: this.#options.now().toISOString(),
                    updatedAt: this.#options.now().toISOString(),
                  })
                : undefined;
            const signal =
              action === 'subscribe'
                ? ghSignals.prSubscribe({ prNumber, repo, ...(summary ? { summary } : {}) })
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
      /(?:\bgh\s+pr\s+(?:view|checkout|create|status|checks)\b|\/github\s+subscribe\b|github\.com\/[^\s/]+\/[^\s/]+\/pull\/\d+|(?:\b(?:PR\s*#?\d+|pull request)\b.{0,80}\b(?:review|approved|approval|ci|checks?|merge|conflict|comment)\b)|(?:\b(?:review|approved|approval|ci|checks?|merge|conflict|comment)\b.{0,80}\b(?:PR\s*#?\d+|pull request)\b))/i,
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
    updatedAt: normalizeTimestamp(record.updatedAt ?? record.updated_at),
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
