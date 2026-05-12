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
const GITHUB_NOTIFICATION_SIGNAL = 'github-pr-notification';
const DEFAULT_POLL_INTERVAL_MS = 60_000;
const MAX_PROCESSED_SIGNAL_IDS = 200;

type MastraMetadata = Record<string, unknown> & {
  githubSignals?: GithubSignalsThreadMetadata;
};

type ThreadMetadata = Record<string, unknown> & {
  mastra?: MastraMetadata;
};

export interface GithubSignalsOptions {
  repo?: string;
  pollIntervalMs?: number;
  includeTool?: boolean;
  commandRunner?: GithubCommandRunner;
  now?: () => Date;
}

type NormalizedGithubSignalsOptions = Required<
  Pick<GithubSignalsOptions, 'pollIntervalMs' | 'includeTool' | 'commandRunner' | 'now'>
> &
  Pick<GithubSignalsOptions, 'repo'>;

export interface GithubSignalsAddAgentOptions {
  id?: string;
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
  kind: 'ci-failure' | 'review-comment' | 'command-error';
  title: string;
  details: string;
  url?: string;
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
      type: GITHUB_NOTIFICATION_SIGNAL,
      contents: input.details,
      attributes: {
        kind: input.kind,
        prNumber: input.prNumber,
        repo: input.repo,
        title: input.title,
        url: input.url,
      },
      metadata: { ...input },
    });
  },
};

function createGithubSignal(type: string, input: GithubPRSignalInput, contents: string): CreatedAgentSignal {
  return createSignal({
    type,
    contents,
    attributes: {
      prNumber: input.prNumber,
      repo: input.repo,
    },
    metadata: { ...input },
  });
}

function defaultCommandRunner(args: string[]): Promise<GithubCommandResult> {
  return execFileAsync('gh', args, { encoding: 'utf8' });
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
  const prNumber = parsePrNumber(signal.attributes?.prNumber ?? signal.metadata?.prNumber);
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

function isGithubSignalType(type: string): type is typeof GITHUB_SUBSCRIBE_SIGNAL | typeof GITHUB_UNSUBSCRIBE_SIGNAL {
  return type === GITHUB_SUBSCRIBE_SIGNAL || type === GITHUB_UNSUBSCRIBE_SIGNAL;
}

function truncateProcessedSignalIds(ids: string[]) {
  return ids.slice(Math.max(0, ids.length - MAX_PROCESSED_SIGNAL_IDS));
}

function stableFingerprint(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
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

function summarizeText(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;
  return normalized.length > 280 ? `${normalized.slice(0, 277)}...` : normalized;
}

export class GithubSignals {
  readonly processor: GithubSignalsProcessor;

  #agents = new Map<string, Agent<any, any, any, any>>();
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
    };
    this.processor = new GithubSignalsProcessor(this, this.#options);
  }

  addAgent(agent: Agent<any, any, any, any>, options: GithubSignalsAddAgentOptions = {}) {
    this.#agents.set(options.id ?? agent.id, agent);
    return this;
  }

  start(subscriptions: GithubPRSubscriptionMetadata[] = []) {
    for (const subscription of subscriptions) {
      this.addSubscription(subscription);
    }
    return this;
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
    const agent = this.#agents.get(subscription.agentId);
    if (!agent) return;

    try {
      const snapshot = await this.#loadPullRequestSnapshot(subscription);
      await this.#emitSnapshotNotifications(agent, subscription, snapshot);
    } catch (error) {
      await this.#emitCommandError(agent, subscription, error);
    }
  }

  async #loadPullRequestSnapshot(subscription: GithubPRSubscriptionMetadata): Promise<GithubPRSnapshot> {
    const args = ['pr', 'view', String(subscription.prNumber), '--json', 'statusCheckRollup,comments,reviews'];
    if (subscription.repo) args.push('--repo', subscription.repo);

    const { stdout } = await this.#options.commandRunner(args);
    const data = JSON.parse(stdout || '{}') as Record<string, unknown>;

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
    agent: Agent<any, any, any, any>,
    subscription: ActiveSubscription,
    snapshot: GithubPRSnapshot,
  ) {
    const failedChecks = snapshot.failedChecks.sort((a, b) => a.name.localeCompare(b.name));
    const checkFingerprint = JSON.stringify(failedChecks.map(check => [check.name, check.status]));
    if (failedChecks.length > 0 && checkFingerprint !== subscription.lastCheckFingerprint) {
      await this.#sendNotification(agent, subscription, {
        kind: 'ci-failure',
        title: `Github PR #${subscription.prNumber} has failing checks`,
        details: `Github PR #${subscription.prNumber} has failing checks:\n${failedChecks
          .map(check => `- ${check.name}: ${check.status}${check.url ? ` (${check.url})` : ''}`)
          .join('\n')}`,
        url: failedChecks.find(check => check.url)?.url,
      });
      subscription.lastCheckFingerprint = checkFingerprint;
      subscription.lastErrorFingerprint = undefined;
    }

    const newComments = snapshot.comments.filter(comment =>
      isAfterTimestamp(comment.createdAt, subscription.lastCommentTimestamp),
    );
    for (const comment of newComments) {
      await this.#sendNotification(agent, subscription, {
        kind: 'review-comment',
        title: `New Github PR #${subscription.prNumber} comment`,
        details: `New Github PR #${subscription.prNumber} comment${comment.author ? ` from ${comment.author}` : ''}: ${summarizeText(comment.body, 'No comment body.')}`,
        url: comment.url,
      });
    }
    const latestCommentTimestamp = newComments
      .map(comment => comment.createdAt)
      .filter((value): value is string => !!value)
      .sort()
      .at(-1);
    if (latestCommentTimestamp) subscription.lastCommentTimestamp = latestCommentTimestamp;

    const newReviews = snapshot.reviews.filter(review =>
      isAfterTimestamp(review.submittedAt, subscription.lastReviewTimestamp),
    );
    for (const review of newReviews) {
      await this.#sendNotification(agent, subscription, {
        kind: 'review-comment',
        title: `New Github PR #${subscription.prNumber} review`,
        details: `New Github PR #${subscription.prNumber} review${review.author ? ` from ${review.author}` : ''}${review.state ? ` (${review.state})` : ''}: ${summarizeText(review.body, 'No review body.')}`,
        url: review.url,
      });
    }
    const latestReviewTimestamp = newReviews
      .map(review => review.submittedAt)
      .filter((value): value is string => !!value)
      .sort()
      .at(-1);
    if (latestReviewTimestamp) subscription.lastReviewTimestamp = latestReviewTimestamp;

    subscription.updatedAt = this.#options.now().toISOString();
    this.#activeSubscriptions.set(subscription.key, subscription);
  }

  async #emitCommandError(agent: Agent<any, any, any, any>, subscription: ActiveSubscription, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const fingerprint = stableFingerprint({ message });
    if (fingerprint === subscription.lastErrorFingerprint) return;

    await this.#sendNotification(agent, subscription, {
      kind: 'command-error',
      title: `Github PR #${subscription.prNumber} polling failed`,
      details: `Github PR #${subscription.prNumber} polling failed: ${message}`,
    });
    subscription.lastErrorFingerprint = fingerprint;
    subscription.updatedAt = this.#options.now().toISOString();
    this.#activeSubscriptions.set(subscription.key, subscription);
  }

  async #sendNotification(
    agent: Agent<any, any, any, any>,
    subscription: GithubPRSubscriptionMetadata,
    notification: Omit<GithubPRNotificationInput, 'repo' | 'prNumber'>,
  ) {
    const result = agent.sendSignal(
      ghSignals.prNotification({
        ...notification,
        repo: subscription.repo,
        prNumber: subscription.prNumber,
      }),
      {
        resourceId: subscription.resourceId,
        threadId: subscription.threadId,
        ifIdle: { behavior: 'wake' },
        ifActive: { behavior: 'deliver' },
      },
    );
    await result.persisted;
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
    let changed = false;

    for (const message of args.messages) {
      if (!isMastraSignalMessage(message)) continue;
      const signal = mastraDBMessageToSignal(message);
      if (!isGithubSignalType(signal.type) || processedSignalIds.has(signal.id)) continue;

      const payload = parseSignalPayload(signal);
      if (!payload) continue;

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

      if (signal.type === GITHUB_SUBSCRIBE_SIGNAL) {
        const existing = githubMetadata.subscriptions[key];
        const subscription: GithubPRSubscriptionMetadata = {
          ...existing,
          ...baseSubscription,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        githubMetadata.subscriptions[key] = subscription;
        this.#owner.addSubscription(subscription);
      } else {
        const existing = githubMetadata.subscriptions[key];
        delete githubMetadata.subscriptions[key];
        this.#owner.removeSubscription(existing ?? { ...baseSubscription });
      }

      processedSignalIds.add(signal.id);
      changed = true;
    }

    if (!changed) return;

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
            await args.sendSignal?.(signal);
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
