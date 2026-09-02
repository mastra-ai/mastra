import { createHmac, timingSafeEqual } from 'node:crypto';
import type { MountedMastraCode } from '@mastra/code-sdk';
import type { NotificationPriority } from '@mastra/core/notifications';
import { RequestContext } from '@mastra/core/request-context';
import type { Context } from 'hono';
import { hasResolvedOrg, seedSessionOrg } from '../../session/org-seed.js';
import { GithubAppIdentity } from './app-identity.js';
import type { GithubIntegration, GithubRepositoryPermission } from './integration.js';
import { listPullRequestSubscriptionsForWebhook, retirePullRequestSubscription } from './subscriptions.js';
import type {
  GithubSignalSubscriptionRow,
  GithubSubscriptionStorage,
  GithubWebhookPullRequestTarget,
} from './subscriptions.js';

export interface GithubWebhookHandlerOptions {
  /** Integration providing webhook-secret verification + collaborator permission checks. */
  github: GithubIntegration;
  ingestFactoryEvent?: (event: ParsedGithubWebhook) => Promise<unknown>;
}

const SUPPORTED_GITHUB_WEBHOOK_EVENTS = new Set([
  'issues',
  'issue_comment',
  'pull_request',
  'pull_request_review',
  'pull_request_review_comment',
  // Direct pushes to the default branch drive base-checkpoint rebuilds. The
  // rules engine and subscription dispatcher both ignore push events.
  'push',
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

/** The Factory session row fields a woken session has to run as. */
export type FactorySessionOwner = { userId: string; orgId: string };

/**
 * The integration surface this dispatch uses. Narrow on purpose: the GitHub App
 * integration and the platform-backed one are unrelated classes, and only this
 * much is common to both.
 */
export interface GithubWebhookDispatchIntegration {
  /** App slug, used to recognize Factory's own bot identity. */
  readonly slug?: string;
  /**
   * Resolved identity of the App this integration posts as. Preferred over
   * {@link slug}, which names the deployment's own self-hosted App and is unset
   * on deployments that run against Platform's App.
   */
  readonly identity?: GithubAppIdentity;
  readonly integrationStorage: GithubSubscriptionStorage;
  /**
   * Extra bot logins this deployment authorizes to trigger author-gated
   * notifications, merged over `DEFAULT_AUTHORIZED_BOTS`.
   */
  readonly authorizedBots?: readonly string[];
  readonly sourceControlStorage: {
    sessions: { getBySessionId(sessionId: string): Promise<FactorySessionOwner | null> };
  };
  getRepositoryCollaboratorPermission(
    installationId: number,
    repoFullName: string,
    username: string,
    signal?: AbortSignal,
  ): Promise<GithubRepositoryPermission | undefined>;
}

export interface GithubWebhookDispatchDependencies {
  controller: MountedMastraCode['controller'];
  /**
   * Integration used by the default sender-authorization check (collaborator
   * permission lookup) and to resolve the owner of a session being recreated.
   * Author-gated notifications fail closed when neither this nor an
   * `isAuthorizedSender` override is supplied.
   */
  github?: GithubWebhookDispatchIntegration;
  listSubscriptions?: (
    target: GithubWebhookPullRequestTarget,
    options?: { includeTerminal?: boolean },
  ) => Promise<GithubSignalSubscriptionRow[]>;
  retireSubscription?: (id: string, status: 'open' | 'closed' | 'merged') => Promise<void>;
  isAuthorizedSender?: (notification: GithubWebhookNotification) => Promise<boolean>;
  /** Called when the sender gate drops a notification, so the drop is observable. */
  onSenderRejected?: (notification: GithubWebhookNotification) => void;
  onTargetError?: (subscription: GithubSignalSubscriptionRow, error: unknown) => void;
  /** Called when a subscription names a thread this deployment does not hold. */
  onTargetSkipped?: (subscription: GithubSignalSubscriptionRow) => void;
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
  github?: GithubWebhookDispatchIntegration,
) {
  const { sessionId, resourceId, threadId } = subscription;
  if (!sessionId || !resourceId || !threadId) {
    throw new Error(`GitHub subscription ${subscription.id} is missing its session binding.`);
  }
  // Read the thread straight from storage before touching sessions. This answers
  // two questions at once, and `queryThreadById` does it without constructing a
  // session (so no workspace or sandbox is provisioned just to make the check).
  //
  // First: do we even have this thread? A pull request's events can reach a
  // deployment that never owned the subscribed thread, and delivery must not
  // fabricate a session for a thread that lives somewhere else.
  //
  // Second: which resource owns it? The subscription records the Factory project
  // as its `resourceId`, but an unscoped session is registered under its own id,
  // so the stored value routinely names a resource that does not own the thread.
  // The thread row is the authoritative answer; the stored id is only a fallback.
  const thread = await controller.queryThreadById({ threadId });
  if (!thread) return undefined;
  const ownerResourceId = thread.resourceId || resourceId;
  const scope = subscription.sessionScope || undefined;
  let session = await controller.getSessionByResource(ownerResourceId, scope);
  if (!session) {
    const tags = {
      factoryProjectId: resourceId,
      projectRepositoryId: subscription.data.projectRepositoryId,
    };
    // Creating the session resolves its workspace, which authorizes the caller
    // against the Factory session row — no signed-in user, so run as its owner.
    // The session is created under the resource that owns the thread, so the
    // thread switch below resolves; the persisted Factory session is keyed by
    // the subscription's session ID.
    const sessionRow = await github?.sourceControlStorage.sessions.getBySessionId(sessionId);
    if (!sessionRow) {
      throw new Error(`GitHub subscription ${subscription.id} has no Factory session ${sessionId} to run as.`);
    }
    const requestContext = new RequestContext();
    requestContext.set('user', { workosId: sessionRow.userId, organizationId: sessionRow.orgId });
    session = await controller.createSession({
      id: sessionId,
      ownerId: sessionRow.userId,
      resourceId: ownerResourceId,
      scope,
      tags,
      requestContext,
    });
    await seedSessionOrg(session, sessionRow.orgId);
  } else if (!hasResolvedOrg(session.state?.get()?.factoryOrgId)) {
    // A session created before the org seed existed carries the project tag and
    // no org, so capture would refuse for the rest of its life even though the
    // org is recoverable. Heal it — but only here, and only when it is missing:
    // hoisting the row fetch above would make an existing-session delivery throw
    // on a missing row where it previously succeeded, and fetching it every time
    // would add a storage read to every delivery. A row that is missing or a
    // lookup that throws leaves the session marked unresolved, and delivery
    // continues either way.
    try {
      const sessionRow = await github?.sourceControlStorage.sessions.getBySessionId(sessionId);
      await seedSessionOrg(session, sessionRow?.orgId);
    } catch (error) {
      console.warn('[GitHub webhook] Unable to resolve the session organization.', error);
      await seedSessionOrg(session, undefined);
    }
  } else if (session.state?.get()?.factoryOrgUnresolved) {
    // The org is present, so an earlier failed resolution left a stale marker
    // behind. Clear it without a storage read — nothing else re-seeds a session
    // once the start hook has run, so the marker would otherwise outlive its
    // cause.
    await seedSessionOrg(session, session.state.get()?.factoryOrgId);
  }
  if (session.thread.getId() !== threadId) {
    await session.thread.switch({ threadId, emitEvent: false });
  }
  if (session.thread.getId() !== threadId) {
    throw new Error(`Session ${sessionId} did not bind thread ${threadId}.`);
  }
  return session;
}

/**
 * Reviewer bots authorized out of the box. Deployments extend — never replace —
 * this set through the integration's `authorizedBots`.
 */
export const DEFAULT_AUTHORIZED_BOTS: readonly string[] = ['coderabbitai[bot]', 'devin-ai-integration[bot]'];

/**
 * Parse a comma-separated `MASTRACODE_GITHUB_AUTHORIZED_BOTS` value into extra
 * bot logins. Returns undefined when nothing usable was configured.
 */
export function parseAuthorizedBotsEnv(value: string | undefined): string[] | undefined {
  const bots = (value ?? '')
    .split(',')
    .map(bot => bot.trim())
    .filter(Boolean);
  return bots.length > 0 ? bots : undefined;
}

/** Lowercased union of the default bot logins and any the deployment opted in. */
export function resolveAuthorizedBots(extra?: readonly string[]): Set<string> {
  const bots = new Set(DEFAULT_AUTHORIZED_BOTS);
  for (const bot of extra ?? []) {
    const normalized = bot.trim().toLowerCase();
    if (normalized) bots.add(normalized);
  }
  return bots;
}

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

/**
 * Recognizes Factory's own GitHub App identity. GitHub forbids an app from
 * reviewing a pull request it authored, so `factory-review` falls back to
 * posting its verdict as a comment under this login. Those comments have to
 * clear the author gate for the review handoff to reach the authoring agent;
 * the rules layer still decides which of them are worth acting on.
 */
export function isFactoryAppSender(sender: string | undefined, slug: string | undefined): boolean {
  if (!sender || !slug) return false;
  return sender.toLowerCase() === `${slug.toLowerCase()}[bot]`;
}

async function isAuthorizedGithubSender(
  notification: GithubWebhookNotification,
  github:
    | Pick<
        GithubWebhookDispatchIntegration,
        'getRepositoryCollaboratorPermission' | 'slug' | 'identity' | 'authorizedBots'
      >
    | undefined,
): Promise<boolean> {
  if (!AUTHOR_GATED_KINDS.has(notification.kind)) return true;
  const sender = notification.metadata.sender;
  const repository = notification.metadata.repository;
  if (!sender || !repository) return false;
  if (github?.identity?.matches(sender)) return true;
  if (isFactoryAppSender(sender, github?.slug)) return true;
  const normalizedSender = sender.toLowerCase();
  if (notification.metadata.senderType?.toLowerCase() === 'bot' || normalizedSender.endsWith('[bot]')) {
    return resolveAuthorizedBots(github?.authorizedBots).has(normalizedSender);
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
): Promise<{ delivered: number; failed: number; skipped: number; ignored: boolean }> {
  const notification = classifyGithubWebhook(parsed);
  if (!notification) return { delivered: 0, failed: 0, skipped: 0, ignored: true };
  const isAuthorizedSender =
    dependencies.isAuthorizedSender ??
    ((n: GithubWebhookNotification) => isAuthorizedGithubSender(n, dependencies.github));
  if (!(await isAuthorizedSender(notification))) {
    dependencies.onSenderRejected?.(notification);
    return { delivered: 0, failed: 0, skipped: 0, ignored: true };
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
  let skipped = 0;

  for (const subscription of subscriptions) {
    try {
      const session = await resolveSubscriptionSession(dependencies.controller, subscription, dependencies.github);
      // No session means this deployment does not hold the subscribed thread.
      // That is not a delivery failure, so it must not be retried or counted as
      // one; the subscription is left untouched because the thread may exist
      // wherever the subscription was created.
      if (!session) {
        skipped += 1;
        dependencies.onTargetSkipped?.(subscription);
        continue;
      }
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

  return { delivered, failed, skipped, ignored: false };
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
  }

  if (!options.controller) {
    return { status: 202, body: { ok: true } };
  }

  const result = await dispatchGithubWebhook(parsed, {
    onSenderRejected: notification => {
      console.info('[GitHub Webhook] sender not authorized', {
        deliveryId: parsed.deliveryId,
        repository: notification.metadata.repository,
        sender: notification.metadata.sender,
        kind: notification.kind,
      });
    },
    ...(options as GithubWebhookDispatchDependencies),
  });
  if (result.failed > 0) {
    console.warn(`[GitHub Webhook] ${result.failed} subscribed target(s) failed for delivery ${parsed.deliveryId}.`);
  }
  return { status: 202, body: { ok: true, ...(result.ignored ? { ignored: true as const } : {}) } };
}
