import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import type { AgentSignalInput, Agent, AgentSignalIfIdleOptions } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { Mastra } from '@mastra/core/mastra';
import type { StorageThreadType } from '@mastra/core/memory';
import type {
  InputProcessorOrWorkflow,
  OutputProcessorOrWorkflow,
  ProcessInputStepArgs,
  ProcessInputStepResult,
  ProcessOutputStepArgs,
} from '@mastra/core/processors';
import { SignalProvider } from '@mastra/core/signals';
import { createTool } from '@mastra/core/tools';
import z from 'zod';

// Lazy-init execFileAsync to avoid vitest mock issues when only
// constants/types are imported from this module.
let _execFileAsync: ((...a: any[]) => Promise<{ stdout: string; stderr: string }>) | undefined;
async function execFileAsync(
  file: string,
  args: readonly string[],
  options?: { cwd?: string; signal?: AbortSignal; maxBuffer?: number },
): Promise<{ stdout: string; stderr: string }> {
  if (!_execFileAsync) {
    const cp = await import('node:child_process');
    _execFileAsync = promisify(cp.execFile);
  }
  return _execFileAsync!(file, args, options);
}

export const GITHUB_SUBSCRIBE_PR_TAG = 'github-subscribe-pr';
export const GITHUB_UNSUBSCRIBE_PR_TAG = 'github-unsubscribe-pr';
export const GITHUB_SYNC_STATUS_TAG = 'github-sync-status';
export const GITHUB_SIGNALS_METADATA_KEY = 'githubSignals';

export type GithubPermission = 'admin' | 'maintain' | 'write' | 'triage' | 'read' | 'none';
const DEFAULT_AUTHORIZED_PERMISSIONS: GithubPermission[] = ['admin', 'maintain', 'write'];
const DEFAULT_AUTHORIZED_BOTS = ['coderabbitai[bot]', 'devin-ai-integration[bot]'];
const PERMISSION_CACHE_TTL_MS = 5 * 60 * 1000;

/** Notification kinds driven by comment/review activity that should be gated by author permission. */
const AUTHOR_GATED_NOTIFICATION_KINDS = new Set(['pull-request-activity', 'pull-request-review-activity']);

export type GithubPRSubscription = {
  owner: string;
  repo: string;
  number: number;
  subscribedAt: string;
  updatedAt: string;
  lastSubscribeSignalId: string;
  lastSyncAt?: string;
  lastSyncStatus?: 'success' | 'error' | 'skipped';
  lastSyncError?: string;
  lastObservedGithubUpdatedAt?: string;
  lastObservedContentHash?: string;
  lastObservedThreadContentHash?: string;
  lastObservedHeadSha?: string;
  lastObservedState?: string;
  lastObservedMergeableState?: string;
  lastObservedCiState?: string;
  lastObservedReviewStateHash?: string;
  lastNotificationAt?: string;
  lastNotificationKind?: string;
  lastNotificationPriority?: 'medium' | 'high';
  lastNotificationSummary?: string;
};

export type GithubSignalsThreadMetadata = {
  subscriptions: GithubPRSubscription[];
  subscriptionHintShown?: boolean;
};

export type GithubPRSignalInput = number | { owner?: string; repo?: string; number: number };
export type GithubSubscribePRSignalInput = GithubPRSignalInput;
export type GithubUnsubscribePRSignalInput = GithubPRSignalInput;

export type GithubSignalsSyncInput = {
  owner: string;
  repo: string;
  number: number;
  cwd?: string;
  abortSignal?: AbortSignal;
  includeComments?: boolean;
};

export type GithubSignalsSyncResult = {
  ok: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
};

export type GithubPullRequestCheckSnapshot = {
  name: string;
  status?: string;
  conclusion?: string;
  workflowName?: string;
  detailsUrl?: string;
  updatedAt?: string;
};

export type GithubPullRequestCommentSnapshot = {
  author?: string;
  authorType?: string;
  isBot?: boolean;
  body?: string;
  url?: string;
  updatedAt?: string;
};

type GithubPullRequestCheckInput = GithubPullRequestCheckSnapshot & {
  source: 'check' | 'workflow';
};

export type GithubPullRequestSnapshot = {
  title?: string;
  state?: string;
  htmlUrl?: string;
  githubUpdatedAt?: string;
  contentHash?: string;
  threadContentHash?: string;
  headSha?: string;
  headRef?: string;
  mergeableState?: string;
  closedAt?: string;
  mergedAt?: string;
  checks?: GithubPullRequestCheckSnapshot[];
  ciState?: 'success' | 'failure' | 'pending' | 'unknown';
  unresolvedReviewThreads?: number;
  reviewStateHash?: string;
  latestReviewThreadAt?: string;
  latestCommentAuthor?: string;
  latestCommentAuthorType?: string;
  latestCommentIsBot?: boolean;
  latestCommentBody?: string;
  latestCommentUrl?: string;
  latestCommentUpdatedAt?: string;
  /** Recent comments newest-first, used to fall back when the latest comment is unauthorized noise. */
  latestComments?: GithubPullRequestCommentSnapshot[];
};

export type GithubSignalsSyncClient = {
  syncPullRequest(input: GithubSignalsSyncInput): Promise<GithubSignalsSyncResult>;
  getPullRequestSnapshot?(input: GithubSignalsSyncInput): Promise<GithubPullRequestSnapshot | undefined>;
};

export type GithubRepository = {
  owner: string;
  repo: string;
};

export type GithubRepositoryResolver = {
  resolveRepository(input: { cwd?: string; abortSignal?: AbortSignal }): Promise<GithubRepository | undefined>;
};

export type GithubSignalsThreadStore = {
  getThreadById(input: { threadId: string; resourceId?: string }): Promise<StorageThreadType | null>;
  saveThread(input: { thread: StorageThreadType }): Promise<StorageThreadType>;
};

export type GithubPermissionResolver = {
  getPermission(owner: string, repo: string, user: string): Promise<GithubPermission | undefined>;
};

export type GithubSignalsOptions = {
  owner?: string;
  repo?: string;
  cwd?: string;
  syncOnSubscribe?: boolean;
  pollIntervalMs?: number;
  agentId?: string;
  gitcrawlCommand?: string;
  syncClient?: GithubSignalsSyncClient;
  repositoryResolver?: GithubRepositoryResolver;
  threadStore?: GithubSignalsThreadStore;
  getNotificationStreamOptions?: GithubSignalAgentOptions['getNotificationStreamOptions'];
  /** Permissions that authorize a human commenter to trigger notifications (default: admin, maintain, write). */
  authorizedPermissions?: GithubPermission[];
  /** Bot logins authorized to trigger notifications (default: coderabbitai[bot], devin-ai-integration[bot]). */
  authorizedBots?: string[];
  /** Bot logins whose comments should be ignored and NOT trigger notifications. */
  ignoredBots?: string[];
  /** Custom resolver for looking up collaborator permissions (default: gh api). */
  permissionResolver?: GithubPermissionResolver;
};

export type GithubSubscriptionsChangedEvent = {
  threadId: string;
  resourceId: string;
  subscriptions: GithubPRSubscription[];
};

export type GithubPollingChangedEvent = {
  threadId: string;
  resourceId: string;
  running: boolean;
};

type GithubSubscriptionsChangedHandler = (event: GithubSubscriptionsChangedEvent) => void;
type GithubPollingChangedHandler = (event: GithubPollingChangedEvent) => void;

type GithubPRSignal = {
  id: string;
  owner?: string;
  repo?: string;
  number: number;
};

type GithubSignalAgent = {
  sendSignal(signal: AgentSignalInput, target: unknown): { accepted: unknown };
  sendNotificationSignal?(
    notification: unknown | unknown[],
    target: unknown,
  ): { accepted?: unknown } | Promise<unknown>;
};

type GithubNotificationStreamOptions = Record<string, unknown>;

type GithubSignalAgentOptions = {
  getNotificationStreamOptions?: (target: {
    resourceId: string;
    threadId: string;
  }) => GithubNotificationStreamOptions | Promise<GithubNotificationStreamOptions>;
};

type GithubSignalsMastra = {
  getStorage?: () => { getStore?: (name: 'memory') => Promise<unknown> } | undefined;
  getAgentById?: (id: string) => GithubSignalAgent;
};

type GithubToolExecuteContext = {
  agent?: {
    agentId?: string;
    threadId?: string;
    resourceId?: string;
  };
};

type GithubToolFactory = (definition: {
  id: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  execute: (
    input: { owner?: string; repo?: string; number: number },
    context?: GithubToolExecuteContext,
  ) => Promise<unknown>;
}) => unknown;

const createGithubTool = createTool as unknown as GithubToolFactory;

type GithubOperationResult = {
  owner: string;
  repo: string;
  number: number;
  subscription?: GithubPRSubscription;
  syncResult?: GithubSignalsSyncResult;
  removed?: boolean;
  remainingSubscriptions?: number;
  alreadyProcessed?: boolean;
};

type GithubPollingThread = {
  threadId: string;
  resourceId: string;
  agentId?: string;
  ifIdle?: AgentSignalIfIdleOptions<unknown>;
};

type GithubPollingState = GithubPollingThread & {
  timer: ReturnType<typeof setInterval>;
  running: boolean;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return undefined;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function snapshotHash(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function resolveHomePath(path: string): string {
  return path.startsWith('~/') ? join(homedir(), path.slice(2)) : path;
}

async function getGitcrawlDbPath(): Promise<string> {
  if (process.env.GITCRAWL_DB_PATH) return resolveHomePath(process.env.GITCRAWL_DB_PATH);
  const configPath = process.env.GITCRAWL_CONFIG_PATH ?? join(homedir(), '.config', 'gitcrawl', 'config.toml');
  try {
    const config = await readFile(resolveHomePath(configPath), 'utf8');
    const match = /^\s*db_path\s*=\s*['\"]([^'\"]+)['\"]/m.exec(config);
    if (match?.[1]) return resolveHomePath(match[1]);
  } catch {
    // fall back to gitcrawl's default config location
  }
  return join(homedir(), '.config', 'gitcrawl', 'gitcrawl.db');
}

async function queryGitcrawlDb<T>(sql: string): Promise<T[]> {
  const dbPath = await getGitcrawlDbPath();
  const { stdout } = await execFileAsync('sqlite3', ['-json', dbPath, sql], { maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(stdout || '[]') as T[];
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function getSignalMetadata(message: MastraDBMessage): Record<string, unknown> | undefined {
  if (message.role !== 'signal') return undefined;
  const signal = message.content.metadata?.signal;
  return isPlainObject(signal) ? signal : undefined;
}

function getGithubMetadata(threadMetadata: Record<string, unknown> | undefined): GithubSignalsThreadMetadata {
  const mastra = isPlainObject(threadMetadata?.mastra) ? threadMetadata.mastra : {};
  const githubSignals = isPlainObject(mastra[GITHUB_SIGNALS_METADATA_KEY]) ? mastra[GITHUB_SIGNALS_METADATA_KEY] : {};
  const rawSubscriptions = Array.isArray(githubSignals.subscriptions) ? githubSignals.subscriptions : [];
  const subscriptions: GithubPRSubscription[] = [];

  for (const rawSubscription of rawSubscriptions) {
    if (!isPlainObject(rawSubscription)) continue;
    const owner = readString(rawSubscription.owner);
    const repo = readString(rawSubscription.repo);
    const number = readNumber(rawSubscription.number);
    const subscribedAt = readString(rawSubscription.subscribedAt);
    const updatedAt = readString(rawSubscription.updatedAt);
    const lastSubscribeSignalId = readString(rawSubscription.lastSubscribeSignalId);
    if (!owner || !repo || !number || !subscribedAt || !updatedAt || !lastSubscribeSignalId) continue;
    subscriptions.push({
      owner,
      repo,
      number,
      subscribedAt,
      updatedAt,
      lastSubscribeSignalId,
      ...(readString(rawSubscription.lastSyncAt) ? { lastSyncAt: readString(rawSubscription.lastSyncAt)! } : {}),
      ...(rawSubscription.lastSyncStatus === 'success' ||
      rawSubscription.lastSyncStatus === 'error' ||
      rawSubscription.lastSyncStatus === 'skipped'
        ? { lastSyncStatus: rawSubscription.lastSyncStatus }
        : {}),
      ...(readString(rawSubscription.lastSyncError)
        ? { lastSyncError: readString(rawSubscription.lastSyncError)! }
        : {}),
      ...(readString(rawSubscription.lastObservedGithubUpdatedAt)
        ? { lastObservedGithubUpdatedAt: readString(rawSubscription.lastObservedGithubUpdatedAt)! }
        : {}),
      ...(readString(rawSubscription.lastObservedContentHash)
        ? { lastObservedContentHash: readString(rawSubscription.lastObservedContentHash)! }
        : {}),
      ...(readString(rawSubscription.lastObservedThreadContentHash)
        ? { lastObservedThreadContentHash: readString(rawSubscription.lastObservedThreadContentHash)! }
        : {}),
      ...(readString(rawSubscription.lastObservedHeadSha)
        ? { lastObservedHeadSha: readString(rawSubscription.lastObservedHeadSha)! }
        : {}),
      ...(readString(rawSubscription.lastObservedState)
        ? { lastObservedState: readString(rawSubscription.lastObservedState)! }
        : {}),
      ...(readString(rawSubscription.lastObservedMergeableState)
        ? { lastObservedMergeableState: readString(rawSubscription.lastObservedMergeableState)! }
        : {}),
      ...(readString(rawSubscription.lastObservedCiState)
        ? { lastObservedCiState: readString(rawSubscription.lastObservedCiState)! }
        : {}),
      ...(readString(rawSubscription.lastObservedReviewStateHash)
        ? { lastObservedReviewStateHash: readString(rawSubscription.lastObservedReviewStateHash)! }
        : {}),
      ...(readString(rawSubscription.lastNotificationAt)
        ? { lastNotificationAt: readString(rawSubscription.lastNotificationAt)! }
        : {}),
      ...(readString(rawSubscription.lastNotificationKind)
        ? { lastNotificationKind: readString(rawSubscription.lastNotificationKind)! }
        : {}),
      ...(rawSubscription.lastNotificationPriority === 'medium' || rawSubscription.lastNotificationPriority === 'high'
        ? { lastNotificationPriority: rawSubscription.lastNotificationPriority }
        : {}),
      ...(readString(rawSubscription.lastNotificationSummary)
        ? { lastNotificationSummary: readString(rawSubscription.lastNotificationSummary)! }
        : {}),
    });
  }

  return {
    subscriptions,
    ...(githubSignals.subscriptionHintShown === true ? { subscriptionHintShown: true } : {}),
  };
}

function setGithubMetadata(
  threadMetadata: Record<string, unknown> | undefined,
  githubSignals: GithubSignalsThreadMetadata,
): Record<string, unknown> {
  const existing = threadMetadata ?? {};
  const mastra = isPlainObject(existing.mastra) ? existing.mastra : {};
  const existingGithubSignals = isPlainObject(mastra[GITHUB_SIGNALS_METADATA_KEY])
    ? mastra[GITHUB_SIGNALS_METADATA_KEY]
    : {};

  return {
    ...existing,
    mastra: {
      ...mastra,
      [GITHUB_SIGNALS_METADATA_KEY]: {
        ...existingGithubSignals,
        ...githubSignals,
      },
    },
  };
}

function getFailingChecks(snapshot: GithubPullRequestSnapshot): GithubPullRequestCheckSnapshot[] {
  return (snapshot.checks ?? []).filter(check => check.conclusion === 'failure' || check.conclusion === 'timed_out');
}

function getPendingChecks(snapshot: GithubPullRequestSnapshot): GithubPullRequestCheckSnapshot[] {
  return (snapshot.checks ?? []).filter(check => check.status && check.status !== 'completed');
}

function getPrLabel(subscription: GithubPRSubscription, snapshot?: GithubPullRequestSnapshot): string {
  const pr = `${subscription.owner}/${subscription.repo}#${subscription.number}`;
  return snapshot?.title ? `${pr}: ${snapshot.title}` : pr;
}

function getMergedNotificationSummary(label: string): string {
  return `${label} was merged. This thread has been automatically unsubscribed from this PR. Resubscribe if you still need updates.`;
}

/**
 * Removes a hidden block (its delimiters *and* its content) starting at every `open` marker.
 *
 * For each `open` occurrence the whole region up to and including the matching `close` is dropped.
 * When `close` is missing the block is treated as unterminated and removed through end-of-string,
 * so large payloads can't survive by omitting their closing marker. Matching is case-insensitive on
 * the markers and uses plain `indexOf` scanning, so there is no regex backtracking (ReDoS-safe).
 */
function stripBlocks(text: string, open: string, close: string): string {
  const haystack = text.toLowerCase();
  const openLower = open.toLowerCase();
  const closeLower = close.toLowerCase();
  let result = '';
  let cursor = 0;

  for (;;) {
    const start = haystack.indexOf(openLower, cursor);
    if (start === -1) {
      result += text.slice(cursor);
      return result;
    }
    result += text.slice(cursor, start);
    const end = haystack.indexOf(closeLower, start + openLower.length);
    if (end === -1) return result; // unterminated: drop through EOF
    cursor = end + closeLower.length;
  }
}

/** Sentinel marker wrapping a stashed Markdown code region; `\u0000` cannot appear in GitHub text. */
const CODE_TOKEN_PREFIX = '\u0000CODE';
const CODE_TOKEN_SUFFIX = '\u0000';

/**
 * Temporarily removes Markdown code spans and fenced code blocks so tag stripping can't damage
 * human-authored code examples.
 *
 * GitHub renders Markdown, so legitimate code like `` `<Component>` ``, generic type examples, or
 * fenced JSX/TSX must survive sanitization. Each code region is replaced with an opaque token and
 * pushed onto a stash; {@link restore} swaps the tokens back after the surrounding prose has been
 * stripped of markup. Fenced blocks are matched before inline spans so backtick runs inside a fence
 * are not mistaken for inline code.
 */
function preserveMarkdownCode(text: string): { text: string; restore: (sanitized: string) => string } {
  const preserved: string[] = [];
  const stash = (match: string): string => {
    const token = `${CODE_TOKEN_PREFIX}${preserved.length}${CODE_TOKEN_SUFFIX}`;
    preserved.push(match);
    return token;
  };

  const protectedText = text
    // Fenced code blocks first so inline-code matching does not touch their contents.
    .replace(/```[\s\S]*?```/g, stash)
    // Multi-backtick inline spans (e.g. ``code with ` inside``) before the single-backtick pass.
    .replace(/(`{2,})(?!`)[\s\S]*?[^`]\1(?!`)/g, stash)
    // Single-backtick inline code spans.
    .replace(/`[^`\n]*`/g, stash);

  return {
    text: protectedText,
    restore: sanitized =>
      sanitized.replace(/\u0000CODE(\d+)\u0000/g, (_, index: string) => preserved[Number(index)] ?? ''),
  };
}

/**
 * Removes XML/HTML-like markup — and the content it hides — from a PR comment body, leaving only
 * human-readable text while preserving Markdown code examples.
 *
 * Review bots (e.g. CodeRabbit) embed large machine-only payloads in comments: base64 state blobs
 * inside `<!-- ... -->` comments (often >100KB) and verbose collapsed `<details>` sections. Rather
 * than targeting specific bot markers, we strip hidden blocks and tags generically, since none of
 * that markup is useful to downstream consumers and persisting it balloons notification payloads and
 * can overflow agent context windows.
 *
 * Markdown code spans/fenced blocks are stashed first and restored last, so legitimate code such as
 * `` `<Component>` `` or fenced JSX is kept intact while bot markup elsewhere is removed. Block
 * removal (comments, `<details>`) drops the *entire* section including its inner content, and any
 * unterminated block is removed through end-of-string so a missing closing marker can't smuggle the
 * payload through. All scanning is `indexOf`-based and the only regex used is a non-backtracking
 * single-tag matcher, so adversarial input cannot trigger catastrophic backtracking (ReDoS). Any
 * unterminated markup fragment (e.g. a dangling `<script` with no `>`) is dropped through end-of-
 * string, and finally every remaining lone `<` is removed so no partial markup survives — while
 * ordinary prose like `coverage < 80%` keeps its text intact.
 */
export function sanitizeCommentText(body: string): string {
  // Protect Markdown code regions before any stripping touches the text.
  const { text: protectedBody, restore } = preserveMarkdownCode(body);
  // Remove whole hidden sections (delimiters + content) before touching individual tags.
  let text = stripBlocks(protectedBody, '<!--', '-->');
  text = stripBlocks(text, '<details', '</details>');
  const stripped = text
    // Remaining standalone tags, e.g. <summary>, </p>, <br/>. `[^<>]*` cannot backtrack.
    .replace(/<\/?[a-zA-Z][^<>]*>/g, '')
    // Drop an unterminated markup fragment (`<!--`, `</`, `<tag`...) from its start through EOF.
    .replace(/<[!/a-zA-Z][\s\S]*$/g, '')
    // Strip any lone `<` left over, but keep surrounding prose (e.g. `coverage < 80%`).
    .replace(/</g, '')
    // Normalize prose whitespace *before* restoring code, so stashed blocks are never mutated.
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return restore(stripped);
}

/** Applies {@link sanitizeCommentText} to an optional comment body, preserving `undefined`. */
function sanitizeCommentBody(body: string | undefined): string | undefined {
  if (body === undefined) return undefined;
  const sanitized = sanitizeCommentText(body);
  return sanitized.length > 0 ? sanitized : undefined;
}

function getCommentExcerpt(body: string): string {
  const excerpt = sanitizeCommentText(body).replace(/\s+/g, ' ').trim();
  return excerpt.length > 240 ? `${excerpt.slice(0, 237)}...` : excerpt;
}

function getCommentNotificationSummary(pr: string, snapshot: GithubPullRequestSnapshot): string | undefined {
  if (!snapshot.latestCommentAuthor || !snapshot.latestCommentBody) return undefined;
  return `${snapshot.latestCommentAuthor} commented on ${pr}: ${getCommentExcerpt(snapshot.latestCommentBody)}`;
}

type GithubActivityNotificationPlan = { kind: string; priority: 'medium' | 'high'; summary: string };

const githubActivityNotificationPriority: Record<GithubActivityNotificationPlan['priority'], number> = {
  high: 0,
  medium: 1,
};

function getGithubActivityNotificationRank(notification: GithubActivityNotificationPlan): number {
  return notification.kind === 'pull-request-activity' ? 0 : 1;
}

function compareGithubActivityNotifications(
  a: GithubActivityNotificationPlan | undefined,
  b: GithubActivityNotificationPlan | undefined,
): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const priorityComparison =
    githubActivityNotificationPriority[a.priority] - githubActivityNotificationPriority[b.priority];
  if (priorityComparison !== 0) return priorityComparison;
  return getGithubActivityNotificationRank(a) - getGithubActivityNotificationRank(b);
}

function classifyGithubCommentActivityNotification(input: {
  subscription: GithubPRSubscription;
  snapshot: GithubPullRequestSnapshot;
}): GithubActivityNotificationPlan | undefined {
  if (isBotOnlyActivity(input.snapshot)) return undefined;
  const pr = `${input.subscription.owner}/${input.subscription.repo}#${input.subscription.number}`;
  const summary = getCommentNotificationSummary(pr, input.snapshot);
  if (!summary) return undefined;
  return { kind: 'pull-request-activity', priority: 'high', summary };
}

function getCheckUpdatedTime(check: { updatedAt?: string }): number {
  const value = check.updatedAt ? Date.parse(check.updatedAt) : Number.NaN;
  return Number.isFinite(value) ? value : 0;
}

function getCheckKey(check: GithubPullRequestCheckSnapshot): string {
  return `${check.name || 'check'}:${check.detailsUrl || check.workflowName || ''}`;
}

export function normalizeGithubChecksForSnapshot(input: {
  checkRows: GithubPullRequestCheckInput[];
  workflowRows: GithubPullRequestCheckInput[];
}): GithubPullRequestCheckSnapshot[] {
  const latestCheckUpdatedAt = input.checkRows.reduce(
    (latest, check) => Math.max(latest, getCheckUpdatedTime(check)),
    0,
  );
  const rows = [
    ...input.checkRows,
    ...input.workflowRows.filter(
      workflow => input.checkRows.length === 0 || getCheckUpdatedTime(workflow) >= latestCheckUpdatedAt,
    ),
  ];
  const byKey = new Map<string, GithubPullRequestCheckInput>();

  for (const row of rows) {
    const key = getCheckKey(row);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }

    const rowTime = getCheckUpdatedTime(row);
    const existingTime = getCheckUpdatedTime(existing);
    if (
      rowTime > existingTime ||
      (rowTime === existingTime && existing.source === 'workflow' && row.source === 'check')
    ) {
      byKey.set(key, row);
    }
  }

  return [...byKey.values()]
    .map(({ source: _source, ...check }) => check)
    .sort((a, b) => `${a.name}:${a.detailsUrl ?? ''}`.localeCompare(`${b.name}:${b.detailsUrl ?? ''}`));
}

function isBotOnlyActivity(snapshot: GithubPullRequestSnapshot): boolean {
  return snapshot.latestCommentIsBot === true && (!snapshot.ciState || snapshot.ciState === 'unknown');
}

function stringifyEvidence(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function detectPrWorkEvidence(input: {
  text?: string;
  toolCalls?: Array<{ toolName: string; args: unknown }>;
}): { owner?: string; repo?: string; number: number } | undefined {
  const evidence = [
    input.text ?? '',
    ...(input.toolCalls ?? []).map(toolCall => `${toolCall.toolName} ${stringifyEvidence(toolCall.args)}`),
  ].join('\n');
  if (!evidence.trim()) return undefined;

  const url = /github\.com\/([^\s/#]+)\/([^\s/#]+)\/pull\/(\d+)/i.exec(evidence);
  if (url?.[1] && url[2] && url[3]) return { owner: url[1], repo: url[2], number: Number(url[3]) };

  const repoRef = /\b([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)#(\d+)\b/.exec(evidence);
  if (repoRef?.[1] && repoRef[2] && repoRef[3])
    return { owner: repoRef[1], repo: repoRef[2], number: Number(repoRef[3]) };

  const ghCommand = /\bgh\s+(?:pr\s+(?:view|checks|status|comment|diff|checkout)|run\s+(?:rerun|view))\b/i.test(
    evidence,
  );
  if (!ghCommand) return undefined;
  const numberMatch = /(?:^|\s)#?(\d{2,})(?:\s|$)/.exec(evidence);
  return numberMatch?.[1] ? { number: Number(numberMatch[1]) } : undefined;
}

function classifyGithubActivityNotification(input: {
  subscription: GithubPRSubscription;
  snapshot: GithubPullRequestSnapshot;
}): { kind: string; priority: 'medium' | 'high'; summary: string } | undefined {
  const pr = `${input.subscription.owner}/${input.subscription.repo}#${input.subscription.number}`;
  const label = getPrLabel(input.subscription, input.snapshot);
  if (input.snapshot.state && input.subscription.lastObservedState !== input.snapshot.state) {
    if (input.snapshot.state === 'merged')
      return {
        kind: 'pull-request-merged',
        priority: 'high',
        summary: getMergedNotificationSummary(label),
      };
    if (input.snapshot.state === 'closed')
      return { kind: 'pull-request-closed', priority: 'high', summary: `${label} was closed` };
    if (input.subscription.lastObservedState && input.snapshot.state === 'open')
      return { kind: 'pull-request-reopened', priority: 'medium', summary: `${label} was reopened` };
  }

  const failingChecks = getFailingChecks(input.snapshot);
  if (input.snapshot.ciState === 'failure' && input.subscription.lastObservedCiState !== 'failure') {
    const names = failingChecks
      .slice(0, 3)
      .map(check => check.name)
      .join(', ');
    return {
      kind: 'pull-request-ci-failure',
      priority: 'high',
      summary: `${pr} has failing CI${names ? `: ${names}` : ''}`,
    };
  }
  if (input.snapshot.mergeableState === 'dirty' && input.subscription.lastObservedMergeableState !== 'dirty') {
    return {
      kind: 'pull-request-conflict',
      priority: 'high',
      summary: `${pr} has merge conflicts${input.snapshot.title ? `: ${input.snapshot.title}` : ''}`,
    };
  }
  if (
    input.snapshot.mergeableState &&
    input.subscription.lastObservedMergeableState === 'dirty' &&
    input.snapshot.mergeableState !== 'dirty'
  ) {
    return {
      kind: 'pull-request-conflict-resolved',
      priority: 'medium',
      summary: `${pr} merge conflicts were resolved`,
    };
  }
  if (input.snapshot.mergeableState === 'dirty') return undefined;
  if (
    input.snapshot.ciState === 'success' &&
    input.subscription.lastObservedCiState &&
    input.subscription.lastObservedCiState !== 'success'
  ) {
    return { kind: 'pull-request-ci-recovered', priority: 'medium', summary: `${pr} CI recovered` };
  }
  if (
    input.snapshot.reviewStateHash &&
    input.subscription.lastObservedReviewStateHash &&
    input.snapshot.reviewStateHash !== input.subscription.lastObservedReviewStateHash &&
    (input.snapshot.unresolvedReviewThreads ?? 0) > 0
  ) {
    return {
      kind: 'pull-request-review-activity',
      priority: 'medium',
      summary: `${pr} has ${input.snapshot.unresolvedReviewThreads} unresolved review thread${input.snapshot.unresolvedReviewThreads === 1 ? '' : 's'}`,
    };
  }
  const pendingChecks = getPendingChecks(input.snapshot);
  if (
    input.snapshot.ciState === 'pending' &&
    input.subscription.lastObservedCiState !== 'pending' &&
    pendingChecks.length > 0
  ) {
    const names = pendingChecks
      .slice(0, 3)
      .map(check => check.name)
      .join(', ');
    return {
      kind: 'pull-request-ci-pending',
      priority: 'medium',
      summary: `${pr} has CI still running${names ? `: ${names}` : ''}`,
    };
  }
  if (input.snapshot.ciState === 'pending' && input.subscription.lastObservedCiState === 'pending') return undefined;
  if (isBotOnlyActivity(input.snapshot)) return undefined;
  const commentSummary = getCommentNotificationSummary(pr, input.snapshot);
  return {
    kind: 'pull-request-activity',
    priority: commentSummary ? 'high' : 'medium',
    summary: commentSummary ?? `${pr} has new activity${input.snapshot.title ? `: ${input.snapshot.title}` : ''}`,
  };
}

function classifyGithubBaselineNotification(input: {
  subscription: GithubPRSubscription;
  snapshot: GithubPullRequestSnapshot;
}): { kind: string; priority: 'medium' | 'high'; summary: string } {
  const pr = `${input.subscription.owner}/${input.subscription.repo}#${input.subscription.number}`;
  const failingChecks = getFailingChecks(input.snapshot);
  const reviewCount = input.snapshot.unresolvedReviewThreads ?? 0;
  const high = input.snapshot.ciState === 'failure' || input.snapshot.mergeableState === 'dirty';
  const details = [
    input.snapshot.state ? `state: ${input.snapshot.state}` : undefined,
    input.snapshot.ciState && input.snapshot.ciState !== 'unknown' ? `CI: ${input.snapshot.ciState}` : undefined,
    input.snapshot.mergeableState ? `mergeability: ${input.snapshot.mergeableState}` : undefined,
    reviewCount > 0 ? `${reviewCount} unresolved review thread${reviewCount === 1 ? '' : 's'}` : undefined,
    failingChecks.length > 0
      ? `failing: ${failingChecks
          .slice(0, 3)
          .map(check => check.name)
          .join(', ')}`
      : undefined,
  ].filter(Boolean);
  return {
    kind: 'pull-request-baseline',
    priority: high ? 'high' : 'medium',
    summary: `${pr} subscribed${input.snapshot.title ? `: ${input.snapshot.title}` : ''}${details.length ? ` (${details.join('; ')})` : ''}`,
  };
}

function applySnapshotCursor(subscription: GithubPRSubscription, snapshot: GithubPullRequestSnapshot): void {
  if (snapshot.githubUpdatedAt) subscription.lastObservedGithubUpdatedAt = snapshot.githubUpdatedAt;
  if (snapshot.contentHash) subscription.lastObservedContentHash = snapshot.contentHash;
  if (snapshot.threadContentHash) subscription.lastObservedThreadContentHash = snapshot.threadContentHash;
  if (snapshot.headSha) subscription.lastObservedHeadSha = snapshot.headSha;
  if (snapshot.state) subscription.lastObservedState = snapshot.state;
  if (snapshot.mergeableState) subscription.lastObservedMergeableState = snapshot.mergeableState;
  if (snapshot.ciState) subscription.lastObservedCiState = snapshot.ciState;
  if (snapshot.reviewStateHash) subscription.lastObservedReviewStateHash = snapshot.reviewStateHash;
}

function parseGitHubRemoteUrl(remoteUrl: string): GithubRepository | undefined {
  const trimmed = remoteUrl.trim().replace(/\.git$/, '');
  const httpsMatch = /^https:\/\/github\.com\/([^/]+)\/([^/]+)$/.exec(trimmed);
  if (httpsMatch?.[1] && httpsMatch[2]) return { owner: httpsMatch[1], repo: httpsMatch[2] };
  const sshMatch = /^git@github\.com:([^/]+)\/([^/]+)$/.exec(trimmed);
  if (sshMatch?.[1] && sshMatch[2]) return { owner: sshMatch[1], repo: sshMatch[2] };
  return undefined;
}

export class GitRemoteRepositoryResolver implements GithubRepositoryResolver {
  async resolveRepository(input: { cwd?: string; abortSignal?: AbortSignal }): Promise<GithubRepository | undefined> {
    try {
      const { stdout } = await execFileAsync('git', ['remote', 'get-url', 'origin'], {
        cwd: input.cwd,
        signal: input.abortSignal,
      });
      return parseGitHubRemoteUrl(stdout);
    } catch {
      return undefined;
    }
  }
}

export class GitcrawlSyncClient implements GithubSignalsSyncClient {
  readonly #command: string;

  constructor(options: { command?: string } = {}) {
    this.#command = options.command ?? 'gitcrawl';
  }

  async syncPullRequest(input: GithubSignalsSyncInput): Promise<GithubSignalsSyncResult> {
    try {
      const args = [
        'sync',
        `${input.owner}/${input.repo}`,
        '--numbers',
        String(input.number),
        ...(input.includeComments === false ? [] : ['--include-comments']),
        '--with',
        'pr-details',
        '--json',
      ];
      const { stdout, stderr } = await execFileAsync(this.#command, args, {
        cwd: input.cwd,
        signal: input.abortSignal,
        maxBuffer: 10 * 1024 * 1024,
      });
      return { ok: true, stdout, stderr };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async getPullRequestSnapshot(input: GithubSignalsSyncInput): Promise<GithubPullRequestSnapshot | undefined> {
    try {
      const { stdout } = await execFileAsync(
        this.#command,
        ['threads', `${input.owner}/${input.repo}`, '--numbers', String(input.number), '--json'],
        {
          cwd: input.cwd,
          signal: input.abortSignal,
          maxBuffer: 10 * 1024 * 1024,
        },
      );
      const parsed = JSON.parse(stdout) as { threads?: Array<Record<string, unknown>> };
      const thread = parsed.threads?.find(item => readNumber(item.number) === input.number);
      if (!thread) return undefined;

      const owner = sqlString(input.owner);
      const repo = sqlString(input.repo);
      const number = input.number;
      const [threadDetails] = await queryGitcrawlDb<{
        state?: string;
        closed_at_gh?: string;
        merged_at_gh?: string;
      }>(`select t.state, t.closed_at_gh, t.merged_at_gh
          from threads t
          join repositories r on r.id=t.repo_id
         where r.owner=${owner} and r.name=${repo} and t.number=${number}
         limit 1`);
      const [details] = await queryGitcrawlDb<{
        head_sha?: string;
        head_ref?: string;
        mergeable_state?: string;
        merged_at?: string;
      }>(`select d.head_sha, d.head_ref, d.mergeable_state,
                 json_extract(d.raw_json, '$.merged_at') as merged_at
          from pull_request_details d
          join threads t on t.id=d.thread_id
          join repositories r on r.id=t.repo_id
         where r.owner=${owner} and r.name=${repo} and t.number=${number}
         limit 1`);

      const headSha = readString(details?.head_sha);
      const checkRows = await queryGitcrawlDb<{
        name?: string;
        status?: string;
        conclusion?: string;
        workflow_name?: string;
        details_url?: string;
        updated_at?: string;
      }>(`select c.name, c.status, c.conclusion, c.workflow_name, c.details_url,
                 coalesce(c.completed_at, c.started_at, c.fetched_at) as updated_at
            from pull_request_checks c
            join threads t on t.id=c.thread_id
            join repositories r on r.id=t.repo_id
           where r.owner=${owner} and r.name=${repo} and t.number=${number}${headSha ? ` and json_extract(c.raw_json, '$.head_sha')=${sqlString(headSha)}` : ''}`);

      const workflowRows = details?.head_sha
        ? await queryGitcrawlDb<{
            workflow_name?: string;
            status?: string;
            conclusion?: string;
            html_url?: string;
            updated_at_gh?: string;
          }>(`select workflow_name, status, conclusion, html_url, updated_at_gh
                from github_workflow_runs w
                join repositories r on r.id=w.repo_id
               where r.owner=${owner} and r.name=${repo} and w.head_sha=${sqlString(details.head_sha)}`)
        : [];
      const [reviewState] = await queryGitcrawlDb<{
        unresolved_count?: number;
        latest_review_thread_at?: string;
      }>(`select count(*) as unresolved_count,
                 max(coalesce(first_comment_updated_at, first_comment_created_at, fetched_at)) as latest_review_thread_at
            from pull_request_review_threads rt
            join threads t on t.id=rt.thread_id
            join repositories r on r.id=t.repo_id
           where r.owner=${owner} and r.name=${repo} and t.number=${number} and rt.is_resolved=0`);
      const latestComments = await queryGitcrawlDb<{
        author_login?: string;
        author_type?: string;
        is_bot?: number;
        body?: string;
        html_url?: string;
        updated_at?: string;
      }>(`select c.author_login, c.author_type, c.is_bot, c.body, json_extract(c.raw_json, '$.html_url') as html_url,
                 coalesce(c.updated_at_gh, c.created_at_gh) as updated_at
            from comments c
            join threads t on t.id=c.thread_id
            join repositories r on r.id=t.repo_id
           where r.owner=${owner} and r.name=${repo} and t.number=${number}
           order by coalesce(c.updated_at_gh, c.created_at_gh) desc
           limit 20`);
      const latestComment = latestComments[0];

      const checks = normalizeGithubChecksForSnapshot({
        checkRows: checkRows.map(row => ({
          source: 'check',
          name: readString(row.name) ?? 'check',
          status: readString(row.status),
          conclusion: readString(row.conclusion),
          workflowName: readString(row.workflow_name),
          detailsUrl: readString(row.details_url),
          updatedAt: readString(row.updated_at),
        })),
        workflowRows: workflowRows.map(row => ({
          source: 'workflow',
          name: readString(row.workflow_name) ?? 'workflow',
          status: readString(row.status),
          conclusion: readString(row.conclusion),
          workflowName: readString(row.workflow_name),
          detailsUrl: readString(row.html_url),
          updatedAt: readString(row.updated_at_gh),
        })),
      });
      const ciState = checks.some(check => check.conclusion === 'failure' || check.conclusion === 'timed_out')
        ? 'failure'
        : checks.some(check => check.status && check.status !== 'completed')
          ? 'pending'
          : checks.length > 0
            ? 'success'
            : 'unknown';
      const threadContentHash = readString(thread.content_hash);
      const unresolvedReviewThreads = Number(reviewState?.unresolved_count ?? 0);
      const reviewStateHash = snapshotHash({
        unresolvedReviewThreads,
        latestReviewThreadAt: reviewState?.latest_review_thread_at,
      });
      const contentHash = snapshotHash({
        threadContentHash,
        state: thread.state,
        headSha: details?.head_sha,
        mergeableState: details?.mergeable_state,
        ciState,
        reviewStateHash,
        checks: checks.map(check => ({
          name: check.name,
          status: check.status,
          conclusion: check.conclusion,
          detailsUrl: check.detailsUrl,
          updatedAt: check.updatedAt,
        })),
      });
      return {
        title: readString(thread.title),
        state:
          readString(details?.merged_at) || readString(threadDetails?.merged_at_gh)
            ? 'merged'
            : (readString(threadDetails?.state) ?? readString(thread.state)),
        htmlUrl: readString(thread.html_url),
        githubUpdatedAt: readString(thread.updated_at_gh),
        closedAt: readString(threadDetails?.closed_at_gh),
        mergedAt: readString(details?.merged_at) ?? readString(threadDetails?.merged_at_gh),
        threadContentHash,
        contentHash,
        headSha: readString(details?.head_sha),
        headRef: readString(details?.head_ref),
        mergeableState: readString(details?.mergeable_state),
        checks,
        ciState,
        unresolvedReviewThreads,
        reviewStateHash,
        latestReviewThreadAt: readString(reviewState?.latest_review_thread_at),
        latestCommentAuthor: readString(latestComment?.author_login),
        latestCommentAuthorType: readString(latestComment?.author_type),
        latestCommentIsBot: latestComment?.is_bot === 1,
        latestCommentBody: sanitizeCommentBody(readString(latestComment?.body)),
        latestCommentUrl: readString(latestComment?.html_url),
        latestCommentUpdatedAt: readString(latestComment?.updated_at),
        latestComments: latestComments.map(comment => ({
          author: readString(comment.author_login),
          authorType: readString(comment.author_type),
          isBot: comment.is_bot === 1,
          body: sanitizeCommentBody(readString(comment.body)),
          url: readString(comment.html_url),
          updatedAt: readString(comment.updated_at),
        })),
      };
    } catch {
      return undefined;
    }
  }
}

export class GithubSignals extends SignalProvider<'github-signals'> {
  readonly id = 'github-signals' as const;
  override readonly name = 'GitHub Signals';
  #ghMastra?: GithubSignalsMastra;

  static signals = {
    subscribeToPR(input: GithubSubscribePRSignalInput): AgentSignalInput {
      const normalized = typeof input === 'number' ? { number: input } : input;
      return {
        type: 'reactive',
        tagName: GITHUB_SUBSCRIBE_PR_TAG,
        contents: `Subscribe to GitHub PR #${normalized.number}`,
        attributes: {
          ...(normalized.owner ? { owner: normalized.owner } : {}),
          ...(normalized.repo ? { repo: normalized.repo } : {}),
          number: normalized.number,
        },
        metadata: {
          github: {
            action: 'subscribeToPR',
            ...normalized,
          },
        },
      };
    },
    unsubscribeFromPR(input: GithubUnsubscribePRSignalInput): AgentSignalInput {
      const normalized = typeof input === 'number' ? { number: input } : input;
      return {
        type: 'reactive',
        tagName: GITHUB_UNSUBSCRIBE_PR_TAG,
        contents: `Unsubscribe from GitHub PR #${normalized.number}`,
        attributes: {
          ...(normalized.owner ? { owner: normalized.owner } : {}),
          ...(normalized.repo ? { repo: normalized.repo } : {}),
          number: normalized.number,
        },
        metadata: {
          github: {
            action: 'unsubscribeFromPR',
            ...normalized,
          },
        },
      };
    },
  };

  readonly #options: GithubSignalsOptions;
  readonly #syncClient: GithubSignalsSyncClient;
  readonly #repositoryResolver: GithubRepositoryResolver;
  readonly #polling = new Map<string, GithubPollingState>();
  readonly #permissionCache = new Map<string, { permission: GithubPermission; expiresAt: number }>();
  #agent?: GithubSignalAgent;
  #agentOptions: GithubSignalAgentOptions = {};
  #subscriptionsChangedHandler?: GithubSubscriptionsChangedHandler;
  #pollingChangedHandler?: GithubPollingChangedHandler;

  constructor(options: GithubSignalsOptions = {}) {
    super();
    this.#options = options;
    this.#syncClient = options.syncClient ?? new GitcrawlSyncClient({ command: options.gitcrawlCommand });
    this.#repositoryResolver = options.repositoryResolver ?? new GitRemoteRepositoryResolver();
    if (options.getNotificationStreamOptions) {
      this.#agentOptions = { getNotificationStreamOptions: options.getNotificationStreamOptions };
    }
  }

  /**
   * @deprecated Use `Agent({ signals: [githubSignals] })` instead.
   * Kept for backward compatibility.
   */
  addAgent(agent: GithubSignalAgent, options: GithubSignalAgentOptions = {}): void {
    this.#agent = agent;
    this.#agentOptions = options;
  }

  /**
   * Called by the Agent constructor when this provider is passed via `signals: [...]`.
   * Sets the bidirectional link so the provider can send signals back to the agent.
   */
  override connect(agent: Agent<any, any, any, any>): void {
    super.connect(agent);
    this.#agent = agent as unknown as GithubSignalAgent;
  }

  getInputProcessors(): InputProcessorOrWorkflow[] {
    return [this as unknown as InputProcessorOrWorkflow];
  }

  getOutputProcessors(): OutputProcessorOrWorkflow[] {
    return [this as unknown as OutputProcessorOrWorkflow];
  }

  onSubscriptionsChanged(handler: GithubSubscriptionsChangedHandler): void {
    this.#subscriptionsChangedHandler = handler;
  }

  onPollingChanged(handler: GithubPollingChangedHandler): void {
    this.#pollingChangedHandler = handler;
  }

  override __registerMastra(mastra: Mastra<any, any, any, any, any, any, any, any, any, any>): void {
    super.__registerMastra(mastra);
    this.#ghMastra = mastra as unknown as GithubSignalsMastra;
  }

  async syncThreadNow(input: GithubPollingThread): Promise<number> {
    return this.#pollThread(input, { includeComments: true });
  }

  async subscribeThreadToPR(input: GithubPollingThread & { pr: GithubPRSignalInput }): Promise<GithubOperationResult> {
    const pr = typeof input.pr === 'number' ? { number: input.pr } : input.pr;
    return this.#subscribe({
      id: `github-command-subscribe-${randomUUID()}`,
      ...pr,
      threadId: input.threadId,
      resourceId: input.resourceId,
    });
  }

  async unsubscribeThreadFromPR(
    input: GithubPollingThread & { pr: GithubPRSignalInput },
  ): Promise<GithubOperationResult> {
    const pr = typeof input.pr === 'number' ? { number: input.pr } : input.pr;
    return this.#unsubscribe({
      id: `github-command-unsubscribe-${randomUUID()}`,
      ...pr,
      threadId: input.threadId,
      resourceId: input.resourceId,
    });
  }

  async startPollingForThread(
    input: GithubPollingThread,
    options: { pollImmediately?: boolean } = {},
  ): Promise<boolean> {
    const subscriptions = await this.#getThreadSubscriptions(input);
    if (subscriptions.length === 0) {
      this.stopPollingForThread(input);
      return false;
    }

    const key = this.#pollingKey(input);
    for (const [pollingKey, state] of this.#polling.entries()) {
      if (pollingKey === key) continue;
      clearInterval(state.timer);
      this.#polling.delete(pollingKey);
    }

    if (this.#polling.has(key)) return true;

    const runPoll = (pollOptions: { includeComments?: boolean } = {}) => {
      void this.#pollThread(input, pollOptions).catch(error => {
        console.warn('GitHub PR polling failed:', error);
      });
    };
    const timer = setInterval(() => {
      runPoll({ includeComments: true });
    }, this.#options.pollIntervalMs ?? 300_000);
    if (options.pollImmediately) runPoll({ includeComments: true });
    timer.unref?.();
    this.#polling.set(key, { ...input, timer, running: false });
    return true;
  }

  stopPollingForThread(input: GithubPollingThread): void {
    const key = this.#pollingKey(input);
    const state = this.#polling.get(key);
    if (!state) return;
    clearInterval(state.timer);
    this.#polling.delete(key);
  }

  isPollingThread(input: GithubPollingThread): boolean {
    return this.#polling.has(this.#pollingKey(input));
  }

  isPollingThreadRunning(input: GithubPollingThread): boolean {
    return this.#polling.get(this.#pollingKey(input))?.running ?? false;
  }

  getPollIntervalMs(): number {
    return this.#options.pollIntervalMs ?? 300_000;
  }

  stopAllPolling(): void {
    for (const state of this.#polling.values()) clearInterval(state.timer);
    this.#polling.clear();
  }

  async pollThreadNow(input: GithubPollingThread): Promise<number> {
    return this.#pollThread(input, { includeComments: true });
  }

  async processInputStep(args: ProcessInputStepArgs): Promise<ProcessInputStepResult> {
    const tools = this.#createTools(args);
    if (args.stepNumber !== 0) return { tools };

    const signal = this.#findLatestGithubSignal(args.messages);
    if (!signal) return { tools };

    const threadContext = this.#getThreadContext(args);

    if (signal.tagName === GITHUB_UNSUBSCRIBE_PR_TAG) {
      const result = await this.#unsubscribe({ ...signal, ...threadContext, abortSignal: args.abortSignal });
      await this.#sendStatus(args, result, {
        status: result.removed ? 'unsubscribed' : 'not_subscribed',
        action: 'unsubscribeFromPR',
        message: result.removed
          ? `Unsubscribed from ${result.owner}/${result.repo}#${result.number}.`
          : `No GitHub subscription found for ${result.owner}/${result.repo}#${result.number}.`,
      });
      return { tools };
    }

    const result = await this.#subscribe({ ...signal, ...threadContext, abortSignal: args.abortSignal });
    if (result.alreadyProcessed) return { tools };
    await this.#sendStatus(args, result, {
      status: result.syncResult?.ok === false ? 'sync_error' : 'subscribed',
      action: 'subscribeToPR',
      message:
        result.syncResult?.ok === false
          ? `Subscribed to ${result.owner}/${result.repo}#${result.number}, but gitcrawl sync failed: ${result.syncResult.error}`
          : `Subscribed to ${result.owner}/${result.repo}#${result.number}.`,
    });
    return { tools };
  }

  async processOutputStep(args: ProcessOutputStepArgs): Promise<void> {
    const evidence = detectPrWorkEvidence({ text: args.text, toolCalls: args.toolCalls });
    if (!evidence) return;

    const threadContext = this.#getThreadContext(args);
    if (!threadContext.threadId || !threadContext.resourceId) return;

    const { threadStore, loadedThread } = await this.#loadThread(threadContext);
    const githubMetadata = getGithubMetadata(loadedThread.metadata);
    if (githubMetadata.subscriptionHintShown || githubMetadata.subscriptions.length > 0) return;

    let repository: GithubRepository;
    try {
      repository = await this.#resolveRepository({
        id: 'github-subscription-hint',
        owner: evidence.owner,
        repo: evidence.repo,
        number: evidence.number,
      });
    } catch {
      return;
    }

    await threadStore.saveThread({
      thread: {
        ...loadedThread,
        id: threadContext.threadId,
        resourceId: threadContext.resourceId,
        createdAt: loadedThread.createdAt ?? new Date(),
        updatedAt: new Date(),
        metadata: setGithubMetadata(loadedThread.metadata, { ...githubMetadata, subscriptionHintShown: true }),
      },
    });

    await args.sendSignal?.({
      type: 'reactive',
      tagName: 'system-reminder',
      contents: `Looks like you're working with ${repository.owner}/${repository.repo}#${evidence.number}. Use /github subscribe ${evidence.number} or the github_subscribe_pr tool to follow updates.`,
      attributes: { type: 'github-subscription-hint' },
      metadata: {
        github: {
          action: 'subscriptionHint',
          owner: repository.owner,
          repo: repository.repo,
          number: evidence.number,
        },
      },
    });
  }

  async #resolveThreadStore(): Promise<GithubSignalsThreadStore | undefined> {
    if (this.#options.threadStore) return this.#options.threadStore;
    const storage = this.#ghMastra?.getStorage?.();
    const memoryStore = storage?.getStore ? await storage.getStore('memory') : undefined;
    return memoryStore as GithubSignalsThreadStore | undefined;
  }

  #getThreadContext(args: { requestContext?: ProcessInputStepArgs['requestContext'] }): {
    threadId?: string;
    resourceId?: string;
  } {
    const memoryContext = args.requestContext?.get('MastraMemory') as
      { thread?: { id?: string }; resourceId?: string } | undefined;
    return { threadId: memoryContext?.thread?.id, resourceId: memoryContext?.resourceId };
  }

  #createTools(args: ProcessInputStepArgs): Record<string, unknown> {
    const threadContext = this.#getThreadContext(args);
    const getExecutionThreadContext = (context?: GithubToolExecuteContext) => ({
      threadId: context?.agent?.threadId ?? threadContext.threadId,
      resourceId: context?.agent?.resourceId ?? threadContext.resourceId,
    });
    return {
      ...args.tools,
      github_subscribe_pr: createGithubTool({
        id: 'github_subscribe_pr',
        description:
          'Subscribe this thread to a GitHub pull request. Syncs only the requested PR with gitcrawl and stores the subscription on the thread.',
        inputSchema: z.object({
          number: z.number().int().positive(),
          owner: z.string().optional(),
          repo: z.string().optional(),
        }),
        execute: async (input, context) => {
          const executionThreadContext = getExecutionThreadContext(context);
          const result = await this.#subscribe({
            id: `github-tool-subscribe-${randomUUID()}`,
            owner: input.owner,
            repo: input.repo,
            number: input.number,
            threadId: executionThreadContext.threadId,
            resourceId: executionThreadContext.resourceId,
          });
          return {
            subscribed: true,
            owner: result.owner,
            repo: result.repo,
            number: result.number,
            syncStatus: result.syncResult?.ok === false ? 'error' : result.syncResult ? 'success' : undefined,
            message:
              result.syncResult?.ok === false
                ? `Subscribed to ${result.owner}/${result.repo}#${result.number}, but gitcrawl sync failed: ${result.syncResult.error}`
                : `Subscribed to ${result.owner}/${result.repo}#${result.number}.`,
          };
        },
      }),
      github_unsubscribe_pr: createGithubTool({
        id: 'github_unsubscribe_pr',
        description: 'Unsubscribe this thread from a GitHub pull request.',
        inputSchema: z.object({
          number: z.number().int().positive(),
          owner: z.string().optional(),
          repo: z.string().optional(),
        }),
        execute: async (input, context) => {
          const executionThreadContext = getExecutionThreadContext(context);
          const result = await this.#unsubscribe({
            id: `github-tool-unsubscribe-${randomUUID()}`,
            owner: input.owner,
            repo: input.repo,
            number: input.number,
            threadId: executionThreadContext.threadId,
            resourceId: executionThreadContext.resourceId,
          });
          return {
            unsubscribed: result.removed ?? false,
            owner: result.owner,
            repo: result.repo,
            number: result.number,
            remainingSubscriptions: result.remainingSubscriptions,
            message: result.removed
              ? `Unsubscribed from ${result.owner}/${result.repo}#${result.number}.`
              : `No GitHub subscription found for ${result.owner}/${result.repo}#${result.number}.`,
          };
        },
      }),
    };
  }

  async #resolveRepository(input: GithubPRSignal & { abortSignal?: AbortSignal }): Promise<GithubRepository> {
    const resolvedRepository =
      input.owner && input.repo
        ? { owner: input.owner, repo: input.repo }
        : this.#options.owner && this.#options.repo
          ? { owner: this.#options.owner, repo: this.#options.repo }
          : await this.#repositoryResolver.resolveRepository({
              cwd: this.#options.cwd,
              abortSignal: input.abortSignal,
            });

    if (!resolvedRepository?.owner || !resolvedRepository.repo) {
      throw new Error(
        'GitHub PR subscription requires owner and repo. Run inside a GitHub repo or pass owner and repo.',
      );
    }

    return resolvedRepository;
  }

  async #loadThread(input: { threadId?: string; resourceId?: string }) {
    const threadStore = await this.#resolveThreadStore();
    if (!threadStore) throw new Error('GitHub PR subscription requires memory-backed thread storage.');
    if (!input.threadId || !input.resourceId)
      throw new Error('GitHub PR subscription requires threadId and resourceId.');
    const loadedThread =
      (await threadStore.getThreadById({ threadId: input.threadId, resourceId: input.resourceId })) ?? undefined;
    if (!loadedThread) throw new Error(`Could not load thread ${input.threadId}.`);
    return { threadStore, loadedThread };
  }

  #pollingKey(input: GithubPollingThread): string {
    return `${input.resourceId}:${input.threadId}`;
  }

  #getNotificationAgent(_input?: { agentId?: string }): GithubSignalAgent | undefined {
    if (this.#agent) return this.#agent;
    const agentId = _input?.agentId ?? this.#options.agentId;
    return agentId ? this.#ghMastra?.getAgentById?.(agentId) : undefined;
  }

  async #getThreadSubscriptions(input: GithubPollingThread): Promise<GithubPRSubscription[]> {
    const { loadedThread } = await this.#loadThread(input);
    return getGithubMetadata(loadedThread.metadata).subscriptions;
  }

  #notifySubscriptionsChanged(input: GithubSubscriptionsChangedEvent): void {
    this.#subscriptionsChangedHandler?.(input);
  }

  #notifyPollingChanged(input: GithubPollingChangedEvent): void {
    this.#pollingChangedHandler?.(input);
  }

  async #pollThread(input: GithubPollingThread, options: { includeComments?: boolean } = {}): Promise<number> {
    const key = this.#pollingKey(input);
    const state = this.#polling.get(key);
    if (state?.running) {
      return 0;
    }
    if (state) state.running = true;
    this.#notifyPollingChanged({ threadId: input.threadId, resourceId: input.resourceId, running: true });

    try {
      const { threadStore, loadedThread } = await this.#loadThread(input);
      const githubMetadata = getGithubMetadata(loadedThread.metadata);
      if (githubMetadata.subscriptions.length === 0) {
        this.stopPollingForThread(input);
        return 0;
      }

      const now = new Date().toISOString();
      const subscriptions: GithubPRSubscription[] = [];
      for (const subscription of githubMetadata.subscriptions) {
        const syncInput = {
          owner: subscription.owner,
          repo: subscription.repo,
          number: subscription.number,
          cwd: this.#options.cwd,
          includeComments: options.includeComments,
        };
        const syncResult = await this.#syncClient.syncPullRequest(syncInput);
        let snapshot = syncResult.ok ? await this.#syncClient.getPullRequestSnapshot?.(syncInput) : undefined;
        if (snapshot)
          snapshot = await this.#filterUnauthorizedLatestComment(subscription.owner, subscription.repo, snapshot);
        const nextSubscription: GithubPRSubscription = {
          ...subscription,
          updatedAt: now,
          lastSyncAt: now,
          lastSyncStatus: syncResult.ok ? 'success' : 'error',
        };
        if (syncResult.error) nextSubscription.lastSyncError = syncResult.error;
        else delete nextSubscription.lastSyncError;

        const previousGithubUpdatedAt = subscription.lastObservedGithubUpdatedAt;
        const previousContentHash = subscription.lastObservedContentHash;
        const previousThreadContentHash = subscription.lastObservedThreadContentHash;
        const previousHeadSha = subscription.lastObservedHeadSha;
        const latestCommentChanged =
          !!previousGithubUpdatedAt &&
          !!snapshot?.latestCommentUpdatedAt &&
          Date.parse(snapshot.latestCommentUpdatedAt) > Date.parse(previousGithubUpdatedAt);
        if (snapshot) applySnapshotCursor(nextSubscription, snapshot);

        // First observation (no previous cursor) always counts as changed so we
        // emit a baseline notification with the PR's current state.
        const isFirstObservation = syncResult.ok && snapshot && !previousGithubUpdatedAt && !previousContentHash;

        const legacyAggregateChanged =
          previousContentHash &&
          snapshot?.contentHash &&
          previousContentHash !== snapshot.contentHash &&
          !previousThreadContentHash &&
          !previousHeadSha;
        const changed =
          isFirstObservation ||
          (syncResult.ok &&
            snapshot &&
            (legacyAggregateChanged ||
              latestCommentChanged ||
              (previousThreadContentHash &&
                snapshot.threadContentHash &&
                previousThreadContentHash !== snapshot.threadContentHash) ||
              (previousHeadSha && snapshot.headSha && previousHeadSha !== snapshot.headSha) ||
              (subscription.lastObservedState && snapshot.state && subscription.lastObservedState !== snapshot.state) ||
              (subscription.lastObservedMergeableState &&
                snapshot.mergeableState &&
                subscription.lastObservedMergeableState !== snapshot.mergeableState) ||
              (subscription.lastObservedCiState &&
                snapshot.ciState &&
                subscription.lastObservedCiState !== snapshot.ciState) ||
              (subscription.lastObservedReviewStateHash &&
                snapshot.reviewStateHash &&
                subscription.lastObservedReviewStateHash !== snapshot.reviewStateHash)));
        let shouldKeepSubscription = true;
        if (changed && snapshot) {
          const notifications = await this.#sendActivityNotifications({
            polling: input,
            subscription,
            snapshot,
            previousGithubUpdatedAt,
            previousContentHash,
            latestCommentChanged,
          });
          const primaryNotification = notifications[0];
          if (primaryNotification) {
            nextSubscription.lastNotificationAt = now;
            nextSubscription.lastNotificationKind = primaryNotification.kind;
            nextSubscription.lastNotificationPriority = primaryNotification.priority;
            nextSubscription.lastNotificationSummary = primaryNotification.summary;
            shouldKeepSubscription = notifications.every(notification => notification.kind !== 'pull-request-merged');
          }
        }

        if (shouldKeepSubscription) subscriptions.push(nextSubscription);
      }

      await threadStore.saveThread({
        thread: {
          ...loadedThread,
          id: input.threadId,
          resourceId: input.resourceId,
          createdAt: loadedThread.createdAt ?? new Date(),
          updatedAt: new Date(),
          metadata: setGithubMetadata(loadedThread.metadata, { subscriptions }),
        },
      });
      this.#notifySubscriptionsChanged({ threadId: input.threadId, resourceId: input.resourceId, subscriptions });
      if (subscriptions.length === 0) this.stopPollingForThread(input);
      return subscriptions.length;
    } catch (error) {
      throw error;
    } finally {
      const latestState = this.#polling.get(key);
      if (latestState) latestState.running = false;
      this.#notifyPollingChanged({ threadId: input.threadId, resourceId: input.resourceId, running: false });
    }
  }

  #createGithubNotificationInput(input: {
    subscription: GithubPRSubscription;
    snapshot: GithubPullRequestSnapshot;
    notification: { kind: string; priority: 'medium' | 'high'; summary: string };
    dedupeSuffix: string;
    previousGithubUpdatedAt?: string;
    previousContentHash?: string;
  }) {
    const failingChecks = getFailingChecks(input.snapshot);
    const pendingChecks = getPendingChecks(input.snapshot);
    const latestCommentExcerpt = input.snapshot.latestCommentBody
      ? getCommentExcerpt(input.snapshot.latestCommentBody)
      : undefined;
    const latestCommentDedupeSuffix =
      input.notification.kind === 'pull-request-activity' && input.snapshot.latestCommentUrl
        ? `comment:${input.snapshot.latestCommentUrl}:${input.snapshot.latestCommentUpdatedAt ?? ''}`
        : input.dedupeSuffix;
    const notificationInput = {
      source: 'github',
      kind: input.notification.kind,
      priority: input.notification.priority,
      summary: input.notification.summary,
      dedupeKey: `github:${input.subscription.owner}/${input.subscription.repo}#${input.subscription.number}:${latestCommentDedupeSuffix}`,
      coalesceKey: `github:${input.subscription.owner}/${input.subscription.repo}#${input.subscription.number}:${input.notification.kind}`,
      attributes: {
        owner: input.subscription.owner,
        repo: input.subscription.repo,
        number: input.subscription.number,
        ...(input.snapshot.title ? { title: input.snapshot.title } : {}),
        ...(input.snapshot.state ? { state: input.snapshot.state } : {}),
        ...(input.snapshot.htmlUrl ? { url: input.snapshot.htmlUrl } : {}),
        ...(input.snapshot.githubUpdatedAt ? { githubUpdatedAt: input.snapshot.githubUpdatedAt } : {}),
        ...(input.previousGithubUpdatedAt ? { previousGithubUpdatedAt: input.previousGithubUpdatedAt } : {}),
        ...(input.snapshot.mergeableState ? { mergeableState: input.snapshot.mergeableState } : {}),
        ...(input.snapshot.ciState ? { ciState: input.snapshot.ciState } : {}),
        ...(input.snapshot.unresolvedReviewThreads !== undefined
          ? { unresolvedReviewThreads: input.snapshot.unresolvedReviewThreads }
          : {}),
        ...(input.snapshot.latestCommentAuthor ? { latestCommentAuthor: input.snapshot.latestCommentAuthor } : {}),
        ...(latestCommentExcerpt ? { latestCommentExcerpt } : {}),
        ...(input.snapshot.latestCommentUrl ? { latestCommentUrl: input.snapshot.latestCommentUrl } : {}),
        ...(input.snapshot.latestCommentUpdatedAt
          ? { latestCommentUpdatedAt: input.snapshot.latestCommentUpdatedAt }
          : {}),
        ...(failingChecks.length > 0 ? { failingChecks: failingChecks.map(check => check.name).join(', ') } : {}),
        ...(pendingChecks.length > 0 ? { pendingChecks: pendingChecks.map(check => check.name).join(', ') } : {}),
      },
      metadata: {
        github: {
          owner: input.subscription.owner,
          repo: input.subscription.repo,
          number: input.subscription.number,
          title: input.snapshot.title,
          state: input.snapshot.state,
          htmlUrl: input.snapshot.htmlUrl,
          githubUpdatedAt: input.snapshot.githubUpdatedAt,
          previousGithubUpdatedAt: input.previousGithubUpdatedAt,
          contentHash: input.snapshot.contentHash,
          previousContentHash: input.previousContentHash,
          threadContentHash: input.snapshot.threadContentHash,
          headSha: input.snapshot.headSha,
          headRef: input.snapshot.headRef,
          mergeableState: input.snapshot.mergeableState,
          ciState: input.snapshot.ciState,
          closedAt: input.snapshot.closedAt,
          mergedAt: input.snapshot.mergedAt,
          unresolvedReviewThreads: input.snapshot.unresolvedReviewThreads,
          reviewStateHash: input.snapshot.reviewStateHash,
          latestReviewThreadAt: input.snapshot.latestReviewThreadAt,
          latestCommentAuthor: input.snapshot.latestCommentAuthor,
          latestCommentAuthorType: input.snapshot.latestCommentAuthorType,
          latestCommentIsBot: input.snapshot.latestCommentIsBot,
          // Intentionally omit the full latestCommentBody here: persisting it verbatim bloats
          // notification payloads (a single CodeRabbit comment can exceed 100KB) and can overflow
          // agent context windows when listed. The 240-char latestCommentExcerpt is stored instead.
          latestCommentExcerpt,
          latestCommentUrl: input.snapshot.latestCommentUrl,
          latestCommentUpdatedAt: input.snapshot.latestCommentUpdatedAt,
          failingChecks,
          pendingChecks,
        },
      },
    };
    return notificationInput;
  }

  async #sendGithubNotification(input: {
    agent?: GithubSignalAgent;
    subscription: GithubPRSubscription;
    snapshot: GithubPullRequestSnapshot;
    notification: GithubActivityNotificationPlan;
    target: { resourceId: string; threadId: string };
    dedupeSuffix: string;
    previousGithubUpdatedAt?: string;
    previousContentHash?: string;
  }): Promise<void> {
    const notificationInput = this.#createGithubNotificationInput(input);
    const streamOptions = await this.#agentOptions.getNotificationStreamOptions?.(input.target);
    await input.agent?.sendNotificationSignal?.(
      notificationInput,
      streamOptions ? { ...input.target, ifIdle: { streamOptions } } : input.target,
    );
  }

  async #sendBaselineNotification(input: {
    threadId: string;
    resourceId: string;
    subscription: GithubPRSubscription;
    snapshot: GithubPullRequestSnapshot;
  }): Promise<void> {
    const agent = this.#getNotificationAgent({});
    if (!agent?.sendNotificationSignal) return;
    await this.#sendGithubNotification({
      agent,
      subscription: input.subscription,
      snapshot: input.snapshot,
      notification: classifyGithubBaselineNotification({ subscription: input.subscription, snapshot: input.snapshot }),
      target: { resourceId: input.resourceId, threadId: input.threadId },
      dedupeSuffix: `baseline:${input.subscription.lastSubscribeSignalId}`,
    });
  }

  async #isAuthorizedAuthor(
    owner: string,
    repo: string,
    user: string | undefined,
    metadata: { authorType?: string; isBot?: boolean } = {},
  ): Promise<boolean> {
    if (!user) return false;
    const normalizedUser = user.toLowerCase();
    const isBot =
      metadata.isBot === true || metadata.authorType?.toLowerCase() === 'bot' || normalizedUser.endsWith('[bot]');
    if (isBot) {
      const ignoredBots = this.#options.ignoredBots ?? [];
      if (ignoredBots.some(bot => bot.toLowerCase() === normalizedUser)) return false;
      const authorizedBots = this.#options.authorizedBots ?? DEFAULT_AUTHORIZED_BOTS;
      return authorizedBots.some(bot => bot.toLowerCase() === normalizedUser);
    }
    const permission = await this.#loadAuthorPermission(owner, repo, user);
    const authorizedPermissions = this.#options.authorizedPermissions ?? DEFAULT_AUTHORIZED_PERMISSIONS;
    return !!permission && authorizedPermissions.includes(permission);
  }

  async #filterUnauthorizedLatestComment(
    owner: string,
    repo: string,
    snapshot: GithubPullRequestSnapshot,
  ): Promise<GithubPullRequestSnapshot> {
    const comments = snapshot.latestComments?.length
      ? snapshot.latestComments
      : [
          {
            author: snapshot.latestCommentAuthor,
            authorType: snapshot.latestCommentAuthorType,
            isBot: snapshot.latestCommentIsBot,
            body: snapshot.latestCommentBody,
            url: snapshot.latestCommentUrl,
            updatedAt: snapshot.latestCommentUpdatedAt,
          },
        ];
    if (!comments.some(comment => comment.author)) return snapshot;
    if (!comments.some(comment => comment.body || comment.url || comment.updatedAt)) return snapshot;

    for (const comment of comments) {
      if (
        !(await this.#isAuthorizedAuthor(owner, repo, comment.author, {
          authorType: comment.authorType,
          isBot: comment.isBot,
        }))
      ) {
        continue;
      }
      return {
        ...snapshot,
        latestCommentAuthor: comment.author,
        latestCommentAuthorType: comment.authorType,
        latestCommentIsBot: comment.isBot,
        latestCommentBody: comment.body,
        latestCommentUrl: comment.url,
        latestCommentUpdatedAt: comment.updatedAt,
      };
    }

    return {
      ...snapshot,
      latestCommentAuthor: undefined,
      latestCommentAuthorType: undefined,
      latestCommentIsBot: undefined,
      latestCommentBody: undefined,
      latestCommentUrl: undefined,
      latestCommentUpdatedAt: undefined,
    };
  }

  async #loadAuthorPermission(owner: string, repo: string, user: string): Promise<GithubPermission | undefined> {
    const cacheKey = `${owner}/${repo}:${user.toLowerCase()}`;
    const cached = this.#permissionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.permission;
    if (cached) this.#permissionCache.delete(cacheKey);

    try {
      let permission: GithubPermission | undefined;
      if (this.#options.permissionResolver) {
        permission = await this.#options.permissionResolver.getPermission(owner, repo, user);
      } else {
        const { stdout } = await execFileAsync('gh', [
          'api',
          `repos/${owner}/${repo}/collaborators/${user}/permission`,
          '--jq',
          '.permission',
        ]);
        const raw = stdout.trim();
        permission = (['admin', 'maintain', 'write', 'triage', 'read', 'none'] as const).includes(
          raw as GithubPermission,
        )
          ? (raw as GithubPermission)
          : undefined;
      }
      if (permission) {
        this.#permissionCache.set(cacheKey, { permission, expiresAt: Date.now() + PERMISSION_CACHE_TTL_MS });
      }
      return permission;
    } catch {
      this.#permissionCache.delete(cacheKey);
      return undefined;
    }
  }

  async #sendActivityNotifications(input: {
    polling: GithubPollingThread;
    subscription: GithubPRSubscription;
    snapshot: GithubPullRequestSnapshot;
    previousGithubUpdatedAt?: string;
    previousContentHash?: string;
    latestCommentChanged?: boolean;
  }): Promise<Array<{ kind: string; priority: 'medium' | 'high'; summary: string }>> {
    const agent = this.#getNotificationAgent(input.polling);
    if (!agent?.sendNotificationSignal) return [];
    const notifications = [
      classifyGithubActivityNotification({
        subscription: input.subscription,
        snapshot: input.snapshot,
      }),
    ];
    if (input.latestCommentChanged && notifications[0]?.kind !== 'pull-request-activity') {
      notifications.push(
        classifyGithubCommentActivityNotification({
          subscription: input.subscription,
          snapshot: input.snapshot,
        }),
      );
    }

    const sent: GithubActivityNotificationPlan[] = [];
    const notificationInputs = [];
    for (const notification of notifications.sort(compareGithubActivityNotifications)) {
      if (!notification) continue;
      if (AUTHOR_GATED_NOTIFICATION_KINDS.has(notification.kind)) {
        const authorized = await this.#isAuthorizedAuthor(
          input.subscription.owner,
          input.subscription.repo,
          input.snapshot.latestCommentAuthor,
          {
            authorType: input.snapshot.latestCommentAuthorType,
            isBot: input.snapshot.latestCommentIsBot,
          },
        );
        if (!authorized) continue;
      }
      notificationInputs.push(
        this.#createGithubNotificationInput({
          subscription: input.subscription,
          snapshot: input.snapshot,
          notification,
          dedupeSuffix: input.snapshot.contentHash ?? input.snapshot.githubUpdatedAt ?? String(Date.now()),
          previousGithubUpdatedAt: input.previousGithubUpdatedAt,
          previousContentHash: input.previousContentHash,
        }),
      );
      sent.push(notification);
    }
    if (notificationInputs.length > 0) {
      const target = { resourceId: input.polling.resourceId, threadId: input.polling.threadId };
      const streamOptions = await this.#agentOptions.getNotificationStreamOptions?.(target);
      await agent.sendNotificationSignal(
        notificationInputs,
        streamOptions ? { ...target, ifIdle: { streamOptions } } : target,
      );
    }
    return sent;
  }

  async #subscribe(
    input: GithubPRSignal & { threadId?: string; resourceId?: string; abortSignal?: AbortSignal },
  ): Promise<GithubOperationResult> {
    const { owner, repo } = await this.#resolveRepository(input);
    const { threadStore, loadedThread } = await this.#loadThread(input);
    const githubMetadata = getGithubMetadata(loadedThread.metadata);
    const existingIndex = githubMetadata.subscriptions.findIndex(
      subscription =>
        subscription.owner === owner && subscription.repo === repo && subscription.number === input.number,
    );
    const existing = existingIndex >= 0 ? githubMetadata.subscriptions[existingIndex] : undefined;
    if (existing?.lastSubscribeSignalId === input.id) {
      return { owner, repo, number: input.number, subscription: existing, alreadyProcessed: true };
    }

    const now = new Date().toISOString();
    const subscription: GithubPRSubscription = {
      owner,
      repo,
      number: input.number,
      subscribedAt: existing?.subscribedAt ?? now,
      updatedAt: now,
      lastSubscribeSignalId: input.id,
      ...(existing?.lastSyncAt ? { lastSyncAt: existing.lastSyncAt } : {}),
      ...(existing?.lastSyncStatus ? { lastSyncStatus: existing.lastSyncStatus } : {}),
      ...(existing?.lastSyncError ? { lastSyncError: existing.lastSyncError } : {}),
      ...(existing?.lastObservedGithubUpdatedAt
        ? { lastObservedGithubUpdatedAt: existing.lastObservedGithubUpdatedAt }
        : {}),
      ...(existing?.lastObservedContentHash ? { lastObservedContentHash: existing.lastObservedContentHash } : {}),
      ...(existing?.lastObservedThreadContentHash
        ? { lastObservedThreadContentHash: existing.lastObservedThreadContentHash }
        : {}),
      ...(existing?.lastObservedHeadSha ? { lastObservedHeadSha: existing.lastObservedHeadSha } : {}),
      ...(existing?.lastObservedState ? { lastObservedState: existing.lastObservedState } : {}),
      ...(existing?.lastObservedMergeableState
        ? { lastObservedMergeableState: existing.lastObservedMergeableState }
        : {}),
      ...(existing?.lastObservedCiState ? { lastObservedCiState: existing.lastObservedCiState } : {}),
      ...(existing?.lastObservedReviewStateHash
        ? { lastObservedReviewStateHash: existing.lastObservedReviewStateHash }
        : {}),
    };

    let syncResult: GithubSignalsSyncResult | undefined;
    let baselineSnapshot: GithubPullRequestSnapshot | undefined;
    if (this.#options.syncOnSubscribe !== false) {
      const syncInput = {
        owner,
        repo,
        number: input.number,
        cwd: this.#options.cwd,
        abortSignal: input.abortSignal,
      };
      syncResult = await this.#syncClient.syncPullRequest(syncInput);
      subscription.lastSyncAt = new Date().toISOString();
      subscription.lastSyncStatus = syncResult.ok ? 'success' : 'error';
      if (syncResult.error) subscription.lastSyncError = syncResult.error;
      else delete subscription.lastSyncError;
      const snapshot = syncResult.ok ? await this.#syncClient.getPullRequestSnapshot?.(syncInput) : undefined;
      baselineSnapshot = snapshot;
      if (snapshot) applySnapshotCursor(subscription, snapshot);
    } else {
      subscription.lastSyncStatus = 'skipped';
    }

    const subscriptions = [subscription];

    await threadStore.saveThread({
      thread: {
        ...loadedThread,
        id: input.threadId!,
        resourceId: input.resourceId!,
        createdAt: loadedThread.createdAt ?? new Date(),
        updatedAt: new Date(),
        metadata: setGithubMetadata(loadedThread.metadata, { subscriptions }),
      },
    });
    this.#notifySubscriptionsChanged({ threadId: input.threadId!, resourceId: input.resourceId!, subscriptions });
    if (baselineSnapshot) {
      await this.#sendBaselineNotification({
        threadId: input.threadId!,
        resourceId: input.resourceId!,
        subscription,
        snapshot: baselineSnapshot,
      });
    }
    await this.startPollingForThread({ threadId: input.threadId!, resourceId: input.resourceId! });

    return { owner, repo, number: input.number, subscription, syncResult };
  }

  async #unsubscribe(
    input: GithubPRSignal & { threadId?: string; resourceId?: string; abortSignal?: AbortSignal },
  ): Promise<GithubOperationResult> {
    const { owner, repo } = await this.#resolveRepository(input);
    const { threadStore, loadedThread } = await this.#loadThread(input);
    const githubMetadata = getGithubMetadata(loadedThread.metadata);
    const subscriptions = githubMetadata.subscriptions.filter(
      subscription =>
        !(subscription.owner === owner && subscription.repo === repo && subscription.number === input.number),
    );
    const removed = subscriptions.length !== githubMetadata.subscriptions.length;
    if (removed) {
      await threadStore.saveThread({
        thread: {
          ...loadedThread,
          id: input.threadId!,
          resourceId: input.resourceId!,
          createdAt: loadedThread.createdAt ?? new Date(),
          updatedAt: new Date(),
          metadata: setGithubMetadata(loadedThread.metadata, { subscriptions }),
        },
      });
      this.#notifySubscriptionsChanged({ threadId: input.threadId!, resourceId: input.resourceId!, subscriptions });
      if (subscriptions.length === 0)
        this.stopPollingForThread({ threadId: input.threadId!, resourceId: input.resourceId! });
    }
    return { owner, repo, number: input.number, removed, remainingSubscriptions: subscriptions.length };
  }

  #findLatestGithubSignal(messages: MastraDBMessage[]): (GithubPRSignal & { tagName: string }) | undefined {
    const message = messages.at(-1);
    if (!message) return undefined;

    const signal = getSignalMetadata(message);
    if (!signal || (signal.tagName !== GITHUB_SUBSCRIBE_PR_TAG && signal.tagName !== GITHUB_UNSUBSCRIBE_PR_TAG)) {
      return undefined;
    }

    const attributes = isPlainObject(signal.attributes) ? signal.attributes : {};
    const metadata = isPlainObject(signal.metadata) ? signal.metadata : {};
    const github = isPlainObject(metadata.github) ? metadata.github : {};
    const number = readNumber(attributes.number) ?? readNumber(github.number);
    if (!number) return undefined;

    return {
      tagName: String(signal.tagName),
      id: readString(signal.id) ?? message.id,
      owner: readString(attributes.owner) ?? readString(github.owner),
      repo: readString(attributes.repo) ?? readString(github.repo),
      number,
    };
  }

  async #sendStatus(
    args: ProcessInputStepArgs,
    signal: GithubOperationResult,
    status: {
      status: 'subscribed' | 'sync_error' | 'error' | 'unsubscribed' | 'not_subscribed';
      action: 'subscribeToPR' | 'unsubscribeFromPR';
      message: string;
    },
  ) {
    await args.sendSignal?.({
      type: 'reactive',
      tagName: GITHUB_SYNC_STATUS_TAG,
      contents: status.message,
      attributes: {
        status: status.status,
        owner: signal.owner,
        repo: signal.repo,
        number: signal.number,
      },
      metadata: {
        github: {
          action: status.action,
          status: status.status,
          owner: signal.owner,
          repo: signal.repo,
          number: signal.number,
        },
      },
    });
  }
}
