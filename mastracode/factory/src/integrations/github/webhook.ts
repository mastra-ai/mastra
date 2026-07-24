import { createHmac, timingSafeEqual } from 'node:crypto';
import type { MountedMastraCode } from '@mastra/code-sdk';
import type { NotificationPriority } from '@mastra/core/notifications';
import type { Context } from 'hono';
import type { GithubIntegration } from './integration.js';
import type { GithubIssueTriageInput, GithubIssueTriageResult } from './issue-triage.js';
import { listPullRequestSubscriptionsForWebhook, retirePullRequestSubscription } from './subscriptions.js';
import type { GithubSignalSubscriptionRow, GithubWebhookPullRequestTarget } from './subscriptions.js';

export type GithubIssueTriageRunInput = GithubIssueTriageInput;
export type GithubIssueTriageRunResult = GithubIssueTriageResult;

export interface GithubWebhookHandlerOptions {
  /** Integration providing webhook-secret verification + collaborator permission checks. */
  github: GithubIntegration;
  runIssueTriage?: (input: GithubIssueTriageRunInput) => Promise<GithubIssueTriageRunResult>;
  ingestFactoryEvent?: (event: ParsedGithubWebhook) => Promise<unknown>;
}

const SUPPORTED_GITHUB_WEBHOOK_EVENTS = new Set([
  'issues',
  'issue_comment',
  'pull_request',
  'pull_request_review',
  'pull_request_review_comment',
]);

export interface GithubWebhookMetadata {
  event: string;
  action?: string;
  deliveryId: string;
  repository?: string;
  repositoryId?: number;
  issueNumber?: number;
  pullRequestNumber?: number;
  sender?: string;
  senderType?: string;
  installationId?: number;
}

export interface ParsedGithubWebhook {
  event: string;
  deliveryId: string;
  payload: Record<string, unknown>;
}

export type GithubWebhookResult =
  | { status: 202; body: { ok: true; ignored?: true } }
  | { status: 400; body: { error: 'bad_request'; message: string } }
  | { status: 401; body: { error: 'unauthorized'; message: string } };

export interface GithubWebhookNotification {
  action: string;
  kind: string;
  priority: NotificationPriority;
  summary: string;
  terminal: boolean;
  metadata: GithubWebhookMetadata & { pullRequestNumber: number; repositoryId: number; installationId: number };
  payload: Record<string, unknown>;
}

export interface GithubWebhookDispatchDependencies {
  controller: MountedMastraCode['controller'];
  /**
   * Integration used by the default sender-authorization check (collaborator
   * permission lookup). Author-gated notifications fail closed when neither
   * this nor an `isAuthorizedSender` override is supplied.
   */
  github?: GithubIntegration;
  listSubscriptions?: (
    target: GithubWebhookPullRequestTarget,
    options?: { includeTerminal?: boolean },
  ) => Promise<GithubSignalSubscriptionRow[]>;
  retireSubscription?: (id: string, status: 'open' | 'closed' | 'merged') => Promise<void>;
  isAuthorizedSender?: (notification: GithubWebhookNotification) => Promise<boolean>;
  onTargetError?: (subscription: GithubSignalSubscriptionRow, error: unknown) => void;
}

function normalizeHeader(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  if (!signature.startsWith('sha256=')) return false;
  const signatureHex = signature.slice('sha256='.length);
  if (!/^[a-fA-F0-9]{64}$/.test(signatureHex)) return false;

  const expectedHex = createHmac('sha256', secret).update(rawBody).digest('hex');
  const received = Buffer.from(signatureHex, 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

async function parseGithubWebhook(
  c: Context,
  secret: string | undefined,
): Promise<ParsedGithubWebhook | GithubWebhookResult> {
  if (!secret) {
    return { status: 401, body: { error: 'unauthorized', message: 'GitHub webhook secret is not configured' } };
  }

  const event = normalizeHeader(c.req.header('x-github-event'));
  const deliveryId = normalizeHeader(c.req.header('x-github-delivery'));
  const signature = normalizeHeader(c.req.header('x-hub-signature-256'));

  if (!event) return { status: 400, body: { error: 'bad_request', message: 'Missing x-github-event header' } };
  if (!deliveryId) return { status: 400, body: { error: 'bad_request', message: 'Missing x-github-delivery header' } };
  if (!signature)
    return { status: 401, body: { error: 'unauthorized', message: 'Missing x-hub-signature-256 header' } };

  const rawBody = await c.req.text();
  if (!verifySignature(rawBody, signature, secret)) {
    return { status: 401, body: { error: 'unauthorized', message: 'Invalid GitHub webhook signature' } };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: 'bad_request', message: 'Malformed JSON payload' } };
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { status: 400, body: { error: 'bad_request', message: 'Payload must be a JSON object' } };
  }

  return { event, deliveryId, payload: payload as Record<string, unknown> };
}

function getObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function getLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(label => (typeof label === 'string' ? label : getString(getObject(label)?.name)))
    .filter((label): label is string => Boolean(label));
}

function getIssueTriageRunInput(parsed: ParsedGithubWebhook): GithubIssueTriageRunInput | null {
  if (parsed.event !== 'issues' || getString(parsed.payload.action) !== 'opened') return null;
  const repository = getString(getObject(parsed.payload.repository)?.full_name);
  const issue = getObject(parsed.payload.issue);
  const sender = getString(getObject(parsed.payload.sender)?.login);
  const installationId = getNumber(getObject(parsed.payload.installation)?.id);
  const issueNumber = getNumber(issue?.number);
  const issueTitle = getString(issue?.title);
  const issueUrl = getString(issue?.html_url);
  if (!repository || !installationId || !issueNumber || !issueTitle || !issueUrl) return null;
  return {
    repository,
    issueNumber,
    issueTitle,
    issueUrl,
    labels: getLabels(issue?.labels),
    sender,
    installationId,
  };
}

export function normalizeGithubWebhookMetadata(parsed: ParsedGithubWebhook): GithubWebhookMetadata {
  const { event, deliveryId, payload } = parsed;
  const repository = getObject(payload.repository);
  const issue = getObject(payload.issue);
  const pullRequest = getObject(payload.pull_request);
  const sender = getObject(payload.sender);
  const installation = getObject(payload.installation);
  const issuePullRequest = getObject(issue?.pull_request);

  return {
    event,
    action: getString(payload.action),
    deliveryId,
    repository: getString(repository?.full_name),
    repositoryId: getNumber(repository?.id),
    issueNumber: getNumber(issue?.number),
    pullRequestNumber:
      getNumber(pullRequest?.number) ??
      (event === 'issue_comment' && issuePullRequest ? getNumber(issue?.number) : undefined),
    sender: getString(sender?.login),
    senderType: getString(sender?.type),
    installationId: getNumber(installation?.id),
  };
}

function notificationSummary(metadata: GithubWebhookMetadata, label: string): string {
  const actor = metadata.sender ? `${metadata.sender} ` : '';
  return `${actor}${label} on ${metadata.repository}#${metadata.pullRequestNumber}`;
}

function notificationTargetUrl(event: string, payload: Record<string, unknown>): string | undefined {
  if (event === 'issue_comment' || event === 'pull_request_review_comment') {
    return getString(getObject(payload.comment)?.html_url);
  }
  if (event === 'pull_request_review') {
    return getString(getObject(payload.review)?.html_url);
  }
  return getString(getObject(payload.pull_request)?.html_url);
}

export function classifyGithubWebhook(parsed: ParsedGithubWebhook): GithubWebhookNotification | undefined {
  const metadata = normalizeGithubWebhookMetadata(parsed);
  const { event, payload } = parsed;
  const action = metadata.action;
  if (
    !action ||
    !metadata.repositoryId ||
    !metadata.installationId ||
    !metadata.pullRequestNumber ||
    !metadata.repository
  ) {
    return undefined;
  }

  let priority: NotificationPriority;
  let kind: string;
  let label: string;
  let terminal = false;

  if (event === 'pull_request_review' && action === 'submitted') {
    const state = getString(getObject(payload.review)?.state)?.toLowerCase().replaceAll('_', '-');
    priority = state === 'approved' || state === 'changes-requested' ? 'urgent' : 'high';
    kind =
      state === 'approved'
        ? 'review-approved'
        : state === 'changes-requested'
          ? 'review-changes-requested'
          : 'review-submitted';
    label =
      state === 'approved'
        ? 'approved the pull request'
        : state === 'changes-requested'
          ? 'requested changes'
          : 'submitted a review';
  } else if (event === 'pull_request' && action === 'closed') {
    const merged = getBoolean(getObject(payload.pull_request)?.merged) === true;
    priority = 'urgent';
    kind = merged ? 'pull-request-merged' : 'pull-request-closed';
    label = merged ? 'merged the pull request' : 'closed the pull request';
    terminal = true;
  } else if (event === 'issue_comment' && action === 'created') {
    priority = 'high';
    kind = 'issue-comment-created';
    label = 'commented';
  } else if (event === 'pull_request_review_comment' && action === 'created') {
    priority = 'high';
    kind = 'review-comment-created';
    label = 'left a review comment';
  } else if (event === 'pull_request' && action === 'reopened') {
    priority = 'high';
    kind = 'pull-request-reopened';
    label = 'reopened the pull request';
  } else if (event === 'pull_request_review' && action === 'dismissed') {
    priority = 'high';
    kind = 'review-dismissed';
    label = 'dismissed a review';
  } else if (
    event === 'pull_request' &&
    [
      'synchronize',
      'ready_for_review',
      'converted_to_draft',
      'assigned',
      'unassigned',
      'review_requested',
      'review_request_removed',
    ].includes(action)
  ) {
    priority = 'medium';
    kind = `pull-request-${action.replaceAll('_', '-')}`;
    label = action.replaceAll('_', ' ');
  } else if (
    event === 'pull_request' &&
    ['edited', 'labeled', 'unlabeled', 'milestoned', 'demilestoned'].includes(action)
  ) {
    priority = 'low';
    kind = `pull-request-${action.replaceAll('_', '-')}`;
    label = action.replaceAll('_', ' ');
  } else {
    return undefined;
  }

  return {
    action,
    kind,
    priority,
    summary: notificationSummary(metadata, label),
    terminal,
    metadata: {
      ...metadata,
      pullRequestNumber: metadata.pullRequestNumber,
      repositoryId: metadata.repositoryId,
      installationId: metadata.installationId,
    },
    payload,
  };
}

async function resolveSubscriptionSession(
  controller: MountedMastraCode['controller'],
  subscription: GithubSignalSubscriptionRow,
) {
  const { sessionId, resourceId, threadId } = subscription;
  if (!sessionId || !resourceId || !threadId) {
    throw new Error(`GitHub subscription ${subscription.id} is missing its session binding.`);
  }
  const scope = subscription.sessionScope || undefined;
  let session = await controller.getSessionByResource(resourceId, scope);
  if (!session) {
    const tags = {
      factoryProjectId: resourceId,
      projectRepositoryId: subscription.data.projectRepositoryId,
      ...(scope ? { worktreePath: scope } : {}),
    };
    session = await controller.createSession({
      id: sessionId,
      ownerId: subscription.data.ownerId,
      resourceId,
      scope,
      tags,
    });
  }
  if (session.thread.getId() !== threadId) {
    await session.thread.switch({ threadId, emitEvent: false });
  }
  if (session.thread.getId() !== threadId) {
    throw new Error(`Session ${sessionId} did not bind thread ${threadId}.`);
  }
  return session;
}

const AUTHORIZED_BOTS = new Set(['coderabbitai[bot]', 'devin-ai-integration[bot]']);
const AUTHORIZED_PERMISSIONS = new Set(['admin', 'maintain', 'write']);
const PERMISSION_CHECK_TIMEOUT_MS = 5_000;
const AUTHOR_GATED_KINDS = new Set([
  'issue-comment-created',
  'review-comment-created',
  'review-submitted',
  'review-approved',
  'review-changes-requested',
  'review-dismissed',
]);

async function isAuthorizedGithubSender(
  notification: GithubWebhookNotification,
  github: GithubIntegration | undefined,
): Promise<boolean> {
  if (!AUTHOR_GATED_KINDS.has(notification.kind)) return true;
  const sender = notification.metadata.sender;
  const repository = notification.metadata.repository;
  if (!sender || !repository) return false;
  const normalizedSender = sender.toLowerCase();
  if (notification.metadata.senderType?.toLowerCase() === 'bot' || normalizedSender.endsWith('[bot]')) {
    return AUTHORIZED_BOTS.has(normalizedSender);
  }
  if (!github) return false;
  const abortController = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const permission = await Promise.race([
      github.getRepositoryCollaboratorPermission(
        notification.metadata.installationId,
        repository,
        sender,
        abortController.signal,
      ),
      new Promise<undefined>(resolve => {
        timeout = setTimeout(() => {
          abortController.abort();
          resolve(undefined);
        }, PERMISSION_CHECK_TIMEOUT_MS);
      }),
    ]);
    return permission !== undefined && AUTHORIZED_PERMISSIONS.has(permission);
  } catch {
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function dispatchGithubWebhook(
  parsed: ParsedGithubWebhook,
  dependencies: GithubWebhookDispatchDependencies,
): Promise<{ delivered: number; failed: number; ignored: boolean }> {
  const notification = classifyGithubWebhook(parsed);
  if (!notification) return { delivered: 0, failed: 0, ignored: true };
  const isAuthorizedSender =
    dependencies.isAuthorizedSender ??
    ((n: GithubWebhookNotification) => isAuthorizedGithubSender(n, dependencies.github));
  if (!(await isAuthorizedSender(notification))) {
    return { delivered: 0, failed: 0, ignored: true };
  }

  const target = {
    installationExternalId: notification.metadata.installationId.toString(),
    repositoryExternalId: notification.metadata.repositoryId.toString(),
    changeRequestId: notification.metadata.pullRequestNumber.toString(),
  };
  const listSubscriptions =
    dependencies.listSubscriptions ??
    ((subscriptionTarget: GithubWebhookPullRequestTarget, options?: { includeTerminal?: boolean }) => {
      if (!dependencies.github) throw new Error('GitHub integration is required to load webhook subscriptions.');
      return listPullRequestSubscriptionsForWebhook(
        subscriptionTarget,
        options,
        dependencies.github.integrationStorage,
      );
    });
  const retireSubscription =
    dependencies.retireSubscription ??
    ((id: string, status: 'open' | 'closed' | 'merged') => {
      if (!dependencies.github) throw new Error('GitHub integration is required to retire webhook subscriptions.');
      return retirePullRequestSubscription(id, status, dependencies.github.integrationStorage);
    });
  const subscriptions = await listSubscriptions(target, { includeTerminal: notification.action === 'reopened' });
  let delivered = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      const session = await resolveSubscriptionSession(dependencies.controller, subscription);
      const result = await session.sendNotificationSignal({
        source: 'github',
        kind: notification.kind,
        summary: notification.summary,
        priority: notification.priority,
        payload: notification.payload,
        sourceId: parsed.deliveryId,
        dedupeKey: `${parsed.deliveryId}:${subscription.sessionId}:${subscription.threadId}`,
        coalesceKey: `github:${subscription.data.repositoryExternalId}:pull-request:${subscription.data.changeRequestId}`,
        metadata: {
          event: notification.metadata.event,
          action: notification.action,
          repository: notification.metadata.repository,
          issueNumber: notification.metadata.issueNumber,
          pullRequestNumber: notification.metadata.pullRequestNumber,
          targetUrl: notificationTargetUrl(parsed.event, parsed.payload),
          deliveryId: parsed.deliveryId,
        },
      });
      await Promise.all([result.persisted, result.accepted].filter(Boolean));
      if (notification.terminal) {
        await retireSubscription(subscription.id, notification.kind === 'pull-request-merged' ? 'merged' : 'closed');
      } else if (notification.action === 'reopened') {
        await retireSubscription(subscription.id, 'open');
      }
      delivered += 1;
    } catch (error) {
      failed += 1;
      dependencies.onTargetError?.(subscription, error);
    }
  }

  return { delivered, failed, ignored: false };
}

export async function handleGithubWebhook(
  c: Context,
  options: GithubWebhookHandlerOptions & Partial<Omit<GithubWebhookDispatchDependencies, 'github'>>,
): Promise<GithubWebhookResult> {
  const parsed = await parseGithubWebhook(c, options.github.webhookSecret);
  if ('status' in parsed) return parsed;

  if (!SUPPORTED_GITHUB_WEBHOOK_EVENTS.has(parsed.event)) {
    return { status: 202, body: { ok: true, ignored: true } };
  }

  const metadata = normalizeGithubWebhookMetadata(parsed);
  console.info('[GitHub Webhook]', metadata);

  if (options.ingestFactoryEvent) {
    await options.ingestFactoryEvent(parsed);
  } else {
    const issueTriageRun = getIssueTriageRunInput(parsed);
    if (issueTriageRun && options.runIssueTriage) {
      void options.runIssueTriage(issueTriageRun).catch((error: unknown) => {
        console.error('[GitHub Webhook] Failed to run issue triage', {
          deliveryId: metadata.deliveryId,
          repository: metadata.repository,
          issueNumber: metadata.issueNumber,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  if (!options.controller) {
    return { status: 202, body: { ok: true } };
  }

  const result = await dispatchGithubWebhook(parsed, options as GithubWebhookDispatchDependencies);
  if (result.failed > 0) {
    console.warn(`[GitHub Webhook] ${result.failed} subscribed target(s) failed for delivery ${parsed.deliveryId}.`);
  }
  return { status: 202, body: { ok: true, ...(result.ignored ? { ignored: true as const } : {}) } };
}
