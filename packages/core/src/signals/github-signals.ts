import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { z } from 'zod/v4';

import type { Agent } from '../agent';
import { createSignal, isMastraSignalMessage, mastraDBMessageToSignal } from '../agent/signals';
import type { CreatedAgentSignal } from '../agent/signals';
import { BaseProcessor } from '../processors';
import type { ProcessInputStepArgs, ProcessInputStepResult } from '../processors';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../request-context';
import { createTool } from '../tools';

const execFileAsync = promisify(execFile);

const GITHUB_SUBSCRIBE_SIGNAL = 'github-pr-subscribe';
const GITHUB_UNSUBSCRIBE_SIGNAL = 'github-pr-unsubscribe';
const GITHUB_CI_FAILURE_SIGNAL = 'github-ci-failure';
const GITHUB_COMMENT_SIGNAL = 'github-comment';
const GITHUB_REVIEW_SIGNAL = 'github-review';
const GITHUB_COMMAND_ERROR_SIGNAL = 'github-command-error';
const DEFAULT_POLL_INTERVAL_MS = 20_000;
const MAX_PROCESSED_SIGNAL_IDS = 200;

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
  includeTool?: boolean;
  commandRunner?: GithubCommandRunner;
  now?: () => Date;
  getStreamOptions?: GithubSignalStreamOptionsGetter;
}

type NormalizedGithubSignalsOptions = Required<
  Pick<GithubSignalsOptions, 'pollIntervalMs' | 'includeTool' | 'commandRunner' | 'now'>
> &
  Pick<GithubSignalsOptions, 'repo' | 'getStreamOptions'>;

export interface GithubSignalsAddAgentOptions {
  id?: string;
  getStreamOptions?: GithubSignalStreamOptionsGetter;
}

export interface GithubSignalsInitOptions {
  memory: {
    listThreads(args: { perPage?: number | false; page?: number; filter?: { resourceId?: string } }): Promise<{
      threads: Array<{ id: string; title?: string; metadata?: Record<string, unknown> }>;
      hasMore?: boolean;
      total?: number;
    }>;
    updateThread?(args: { id: string; title: string; metadata: Record<string, unknown> }): Promise<unknown>;
  };
  resourceId?: string;
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
  kind: 'ci-failure' | 'comment' | 'review' | 'command-error';
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
  lastErrorFingerprint?: string;
}

export interface GithubSignalsThreadMetadata {
  processedSignalIds: string[];
  subscriptions: Record<string, GithubPRSubscriptionMetadata>;
}

interface ActiveSubscription extends GithubPRSubscriptionMetadata {
  key: string;
}

interface RegisteredGithubAgent {
  agent: Agent<any, any, any, any>;
  getStreamOptions?: GithubSignalStreamOptionsGetter;
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

function defaultCommandRunner(args: string[]): Promise<GithubCommandResult> {
  return execFileAsync('gh', args, {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', CLICOLOR: '0', GH_FORCE_TTY: undefined },
  });
}

function subscriptionKey(
  input: Pick<GithubPRSubscriptionMetadata, 'agentId' | 'resourceId' | 'threadId' | 'repo' | 'prNumber'>,
) {
  return [input.agentId, input.resourceId, input.threadId, input.repo ?? '', input.prNumber].join(':');
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

function stripAnsi(value: string) {
  return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
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

function summarizeText(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;
  return normalized.length > 280 ? `${normalized.slice(0, 277)}...` : normalized;
}

export class GithubSignals {
  readonly processor: GithubSignalsProcessor;

  #agents = new Map<string, RegisteredGithubAgent>();
  #activeSubscriptions = new Map<string, ActiveSubscription>();
  #timer?: ReturnType<typeof setInterval>;
  #polling = false;
  #options: NormalizedGithubSignalsOptions;

  constructor(options: GithubSignalsOptions = {}) {
    this.#options = {
      repo: options.repo,
      pollIntervalMs: options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      includeTool: options.includeTool ?? true,
      commandRunner: options.commandRunner ?? defaultCommandRunner,
      now: options.now ?? (() => new Date()),
      getStreamOptions: options.getStreamOptions,
    };
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
    let page = 0;

    do {
      const result = await options.memory.listThreads({
        page,
        perPage: 100,
        filter: options.resourceId ? { resourceId: options.resourceId } : undefined,
      });

      for (const thread of result.threads) {
        const metadata = getGithubSignalsMetadata(thread.metadata as ThreadMetadata | undefined);
        const baselinedSubscriptions = await Promise.all(
          Object.entries(metadata.subscriptions).map(async ([key, subscription]) => [
            key,
            await this.baselineSubscription(subscription, { force: true }),
          ]),
        );
        if (baselinedSubscriptions.length === 0) continue;

        metadata.subscriptions = Object.fromEntries(baselinedSubscriptions);
        subscriptions.push(...Object.values(metadata.subscriptions));

        if (options.memory.updateThread) {
          await options.memory.updateThread({
            id: thread.id,
            title: thread.title ?? '',
            metadata: setGithubSignalsMetadata(thread.metadata as ThreadMetadata | undefined, metadata),
          });
        }
      }

      page += 1;
      if (result.hasMore === false || result.threads.length === 0) break;
      if (typeof result.total === 'number' && page * 100 >= result.total) break;
    } while (true);

    this.start(subscriptions);
    return subscriptions;
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

  addSubscription(subscription: GithubPRSubscriptionMetadata) {
    const key = subscriptionKey(subscription);
    this.#activeSubscriptions.set(key, { ...subscription, key });
    this.#ensureTimer();
  }

  async baselineSubscription(
    subscription: GithubPRSubscriptionMetadata,
    options: { force?: boolean } = {},
  ): Promise<GithubPRSubscriptionMetadata> {
    if (
      !options.force &&
      (subscription.lastCheckFingerprint || subscription.lastCommentTimestamp || subscription.lastReviewTimestamp)
    ) {
      return subscription;
    }

    try {
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
    this.#activeSubscriptions.delete(subscriptionKey(subscription));
    this.#ensureTimer();
  }

  async poll() {
    if (this.#polling) return;
    this.#polling = true;
    try {
      for (const subscription of this.#activeSubscriptions.values()) {
        await this.#pollSubscription(subscription);
      }
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
    this.#agents.clear();
  }

  #ensureTimer() {
    if (this.#activeSubscriptions.size > 0 && !this.#timer) {
      this.#timer = setInterval(() => {
        void this.poll();
      }, this.#options.pollIntervalMs);
      return;
    }

    if (this.#activeSubscriptions.size === 0 && this.#timer) {
      clearInterval(this.#timer);
      this.#timer = undefined;
    }
  }

  async #pollSubscription(subscription: ActiveSubscription) {
    const registeredAgent = this.#agents.get(subscription.agentId);
    if (!registeredAgent) return;

    try {
      const snapshot = await this.#loadPullRequestSnapshot(subscription);
      await this.#emitSnapshotNotifications(registeredAgent, subscription, snapshot);
    } catch (error) {
      await this.#emitCommandError(registeredAgent, subscription, error);
    }
  }

  async #loadPullRequestSnapshot(subscription: GithubPRSubscriptionMetadata): Promise<GithubPRSnapshot> {
    const args = ['pr', 'view', String(subscription.prNumber), '--json', 'statusCheckRollup,comments,reviews'];
    if (subscription.repo) args.push('--repo', subscription.repo);

    const { stdout } = await this.#options.commandRunner(args);
    const data = JSON.parse(stripAnsi(stdout || '{}')) as Record<string, unknown>;

    const checks = Array.isArray(data.statusCheckRollup) ? data.statusCheckRollup : [];
    const comments = Array.isArray(data.comments) ? data.comments : [];
    const reviews = Array.isArray(data.reviews) ? data.reviews : [];

    return {
      failedChecks: checks
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

  async #emitSnapshotNotifications(
    registeredAgent: RegisteredGithubAgent,
    subscription: ActiveSubscription,
    snapshot: GithubPRSnapshot,
  ) {
    const failedChecks = snapshot.failedChecks.sort((a, b) => a.name.localeCompare(b.name));
    const checkFingerprint = getFailedChecksFingerprint(failedChecks);
    if (failedChecks.length > 0 && checkFingerprint !== subscription.lastCheckFingerprint) {
      await this.#sendNotification(registeredAgent, subscription, {
        kind: 'ci-failure',
        title: `GitHub CI failure`,
        details: failedChecks
          .map(check => `- ${check.name}: ${check.status}${check.url ? ` (${check.url})` : ''}`)
          .join('\n'),
        url: failedChecks.find(check => check.url)?.url,
        checkCount: failedChecks.length,
      });
      subscription.lastCheckFingerprint = checkFingerprint;
      subscription.lastErrorFingerprint = undefined;
    }

    const newComments = snapshot.comments.filter(comment =>
      isAfterTimestamp(comment.createdAt, subscription.lastCommentTimestamp),
    );
    for (const comment of newComments) {
      await this.#sendNotification(registeredAgent, subscription, {
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
      await this.#sendNotification(registeredAgent, subscription, {
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

    subscription.updatedAt = this.#options.now().toISOString();
    this.#activeSubscriptions.set(subscription.key, subscription);
  }

  async #emitCommandError(registeredAgent: RegisteredGithubAgent, subscription: ActiveSubscription, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const fingerprint = stableFingerprint({ message });
    if (fingerprint === subscription.lastErrorFingerprint) return;

    await this.#sendNotification(registeredAgent, subscription, {
      kind: 'command-error',
      title: `GitHub polling error`,
      details: message,
    });
    subscription.lastErrorFingerprint = fingerprint;
    subscription.updatedAt = this.#options.now().toISOString();
    this.#activeSubscriptions.set(subscription.key, subscription);
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
    if (args.stepNumber !== 0) return this.#toolResult(args);

    await this.#processSignals(args);
    return this.#toolResult(args);
  }

  async #processSignals(args: ProcessInputStepArgs) {
    for (const message of args.messages) {
      if (!isMastraSignalMessage(message)) continue;
      await this.#applyGithubSignal(args, mastraDBMessageToSignal(message));
    }
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
      this.#owner.addSubscription(subscription);
    } else {
      const existing = githubMetadata.subscriptions[key];
      delete githubMetadata.subscriptions[key];
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
            action: z.enum(['subscribe', 'unsubscribe']),
            prNumber: z.number().int().positive(),
            repo: z.string().optional(),
          }),
          outputSchema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
          execute: async ({ action, prNumber, repo }) => {
            const signal =
              action === 'subscribe'
                ? ghSignals.prSubscribe({ prNumber, repo })
                : ghSignals.prUnsubscribe({ prNumber, repo });
            const persistedSignal = await args.sendSignal?.(signal);
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
