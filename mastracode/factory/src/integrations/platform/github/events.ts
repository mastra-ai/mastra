import type { MountedMastraCode } from '@mastra/code-sdk';
import type { IMastraLogger } from '@mastra/core/logger';

import type { GithubRepositoryPermission } from '../../github/integration.js';
import { listPullRequestSubscriptionsForWebhook, retirePullRequestSubscription } from '../../github/subscriptions.js';
import { dispatchGithubWebhook, isFactoryAppSender, resolveAuthorizedBots } from '../../github/webhook.js';
import type {
  GithubWebhookDispatchIntegration,
  GithubWebhookNotification,
  ParsedGithubWebhook,
} from '../../github/webhook.js';

const SUPPORTED_EVENTS = new Set([
  'issues',
  'issue_comment',
  'pull_request',
  'pull_request_review',
  'pull_request_review_comment',
  // Pushes never reach the subscription dispatcher; they feed the factory
  // ingest path so environment templates rebuild on default-branch updates.
  'push',
]);
// Kinds emitted by `classifyGithubWebhook` that carry untrusted sender-authored
// content and must pass the sender authorization gate below.
const AUTHOR_GATED_KINDS = new Set([
  'issue-comment-created',
  'review-comment-created',
  'review-approved',
  'review-changes-requested',
  'review-submitted',
  'review-dismissed',
]);
const AUTHORIZED_PERMISSIONS = new Set<GithubRepositoryPermission>(['admin', 'maintain', 'write']);
const PERMISSION_CHECK_TIMEOUT_MS = 5_000;

export type GithubEventLogger = Pick<IMastraLogger, 'debug' | 'warn' | 'error'>;

export interface GithubEventDeliveryConfig {
  controller: MountedMastraCode['controller'];
  github: GithubWebhookDispatchIntegration;
  ingestFactoryEvent?: (event: ParsedGithubWebhook, options?: { orgIds?: readonly string[] }) => Promise<unknown>;
  dispatch?: typeof dispatchGithubWebhook;
}

/** A GitHub webhook as Factory handles it, or null when Factory doesn't handle this event. */
export function parseGithubEvent(input: {
  event: string | undefined;
  deliveryId: string | undefined;
  payload: unknown;
}): ParsedGithubWebhook | null {
  if (
    !input.event ||
    !input.deliveryId ||
    !SUPPORTED_EVENTS.has(input.event) ||
    !input.payload ||
    typeof input.payload !== 'object' ||
    Array.isArray(input.payload)
  ) {
    return null;
  }
  return { event: input.event, deliveryId: input.deliveryId, payload: input.payload as Record<string, unknown> };
}

/** The webhook's repository id, from its payload. */
export function githubEventRepositoryId(event: ParsedGithubWebhook): number | undefined {
  const repository = event.payload.repository;
  if (!repository || typeof repository !== 'object') return undefined;
  const id = (repository as { id?: unknown }).id;
  return typeof id === 'number' && Number.isSafeInteger(id) ? id : undefined;
}

/** The webhook's GitHub App installation id, from its payload. */
export function githubEventInstallationId(event: ParsedGithubWebhook): number | undefined {
  const installation = event.payload.installation;
  if (!installation || typeof installation !== 'object') return undefined;
  const id = (installation as { id?: unknown }).id;
  return typeof id === 'number' && Number.isSafeInteger(id) ? id : undefined;
}

/** The same webhook, attributed to another installation of the repository. */
export function withGithubEventInstallation(event: ParsedGithubWebhook, installationId: number): ParsedGithubWebhook {
  const installation = event.payload.installation;
  return {
    ...event,
    payload: {
      ...event.payload,
      installation: { ...(installation && typeof installation === 'object' ? installation : {}), id: installationId },
    },
  };
}

/**
 * Feeds one webhook to Factory: the rules engine for the events it ingests,
 * then the pull request subscription dispatcher. Throws when ingest fails so
 * the events worker retries; ingest and delivery are idempotent per delivery id.
 *
 * Only `orgIds`' projects and subscriptions see it: when orgs on different apps
 * link the same repository, each app's copy of the webhook belongs to its own
 * orgs, even where two orgs share an installation.
 */
export async function deliverGithubEvent(
  config: GithubEventDeliveryConfig,
  event: ParsedGithubWebhook,
  orgIds: readonly string[],
  logger?: GithubEventLogger,
): Promise<void> {
  if (isFactoryIngestedEvent(event)) {
    await config.ingestFactoryEvent?.(event, { orgIds });
  } else {
    logger?.debug('Platform GitHub event not forwarded to Factory ingress', {
      deliveryId: event.deliveryId,
      event: event.event,
      action: event.payload.action,
    });
  }
  const dispatch = config.dispatch ?? dispatchGithubWebhook;
  const github = config.github;
  const result = await dispatch(event, {
    controller: config.controller,
    listSubscriptions: async (target, options) =>
      (await listPullRequestSubscriptionsForWebhook(target, options, github.integrationStorage)).filter(row =>
        orgIds.includes(row.orgId),
      ),
    retireSubscription: (id, status) => retirePullRequestSubscription(id, status, github.integrationStorage),
    github,
    isAuthorizedSender: notification => isAuthorizedSender(github, notification),
    onTargetSkipped: subscription => {
      // Routine when a subscription's thread belongs to another deployment.
      logger?.debug('Platform GitHub event skipped: thread is not held here', {
        deliveryId: event.deliveryId,
        subscriptionId: subscription.id,
        threadId: subscription.threadId,
      });
    },
    onSenderRejected: notification => {
      logger?.debug('Platform GitHub event dropped: sender not authorized', {
        deliveryId: event.deliveryId,
        repository: notification.metadata.repository,
        sender: notification.metadata.sender,
        kind: notification.kind,
      });
    },
    onTargetError: (subscription, error) => {
      logger?.error('Platform GitHub event delivery failed for a subscription', {
        deliveryId: event.deliveryId,
        subscriptionId: subscription.id,
        resourceId: subscription.resourceId,
        threadId: subscription.threadId,
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });
  if (result.failed > 0) {
    logger?.warn('Platform GitHub event completed with failed subscription deliveries', {
      deliveryId: event.deliveryId,
      delivered: result.delivered,
      failed: result.failed,
    });
  }
}

async function isAuthorizedSender(
  github: GithubWebhookDispatchIntegration,
  notification: GithubWebhookNotification,
): Promise<boolean> {
  if (!AUTHOR_GATED_KINDS.has(notification.kind)) return true;
  const sender = notification.metadata.sender;
  const repository = notification.metadata.repository;
  if (!sender || !repository) return false;
  // Factory's own app has to clear the gate before the bot rules below, which
  // fail closed for every bot that is not explicitly allowlisted. GitHub
  // forbids an app from reviewing its own pull request, so `factory-review`
  // posts its verdict as a comment under this login and that comment is the
  // handoff the authoring agent wakes on.
  if (github.identity?.matches(sender)) return true;
  if (isFactoryAppSender(sender, github.slug)) return true;
  const normalizedSender = sender.toLowerCase();
  const authorizedBots = resolveAuthorizedBots(github.authorizedBots);
  if (authorizedBots.has(normalizedSender)) return true;
  // Any other bot is gated purely by the allowlist: a GitHub App never holds a
  // collaborator permission under its sender login, so falling through to the
  // permission lookup would only fail closed after a wasted API call.
  if (notification.metadata.senderType?.toLowerCase() === 'bot' || normalizedSender.endsWith('[bot]')) {
    return false;
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), PERMISSION_CHECK_TIMEOUT_MS);
  try {
    const permission = await github.getRepositoryCollaboratorPermission(
      notification.metadata.installationId,
      repository,
      sender,
      abortController.signal,
    );
    return permission !== undefined && AUTHORIZED_PERMISSIONS.has(permission);
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

// Events forwarded to the factory rules engine. Closures let the reconciler
// finalize cards; `synchronize` and `review_requested` on a pull request are
// the triggers the review board's re-review path listens for; submitted
// reviews and pull request comments are how review feedback reaches the agent
// that authored the branch. Direct-webhook consumers ingest every parsed
// event; the platform path gates because the remaining events (issue edits,
// comment edits and deletions) only interest the subscription dispatcher,
// not the factory rules.
const ISSUE_INGESTED_ACTIONS = new Set([
  'opened',
  'reopened',
  'edited',
  'labeled',
  'unlabeled',
  'assigned',
  'unassigned',
]);

export function isFactoryIngestedEvent(event: ParsedGithubWebhook): boolean {
  if ((event.event === 'issues' || event.event === 'pull_request') && event.payload.action === 'closed') {
    return true;
  }
  if (event.event === 'pull_request') {
    const action = event.payload.action;
    // `opened` is what mints the Review card for a pull request.
    if (action === 'opened' || action === 'synchronize' || action === 'review_requested') return true;
    // A reopen, and a label or assignee change, reach the routes of the card the pull request belongs to.
    if (action === 'reopened' || ['labeled', 'unlabeled', 'assigned', 'unassigned'].includes(String(action)))
      return true;
  }
  // Issue opens, reopens, edits, label and assignee changes mint and update Work cards (#24972).
  if (event.event === 'issues' && ISSUE_INGESTED_ACTIONS.has(String(event.payload.action))) return true;
  if (event.event === 'pull_request_review' && event.payload.action === 'submitted') return true;
  if (event.event === 'issue_comment' && event.payload.action === 'created') return true;
  // `factory-review` edits its earlier verdict in place on a re-review. The rules
  // engine only acts on edits that leave a request-changes verdict behind.
  if (event.event === 'pull_request_review' && event.payload.action === 'edited') return true;
  if (event.event === 'issue_comment' && event.payload.action === 'edited') {
    const issue = event.payload.issue;
    if (issue && typeof issue === 'object' && 'pull_request' in issue && issue.pull_request) return true;
  }
  // Default-branch pushes reach the environment build hand-off
  // (`GithubRules` calls the `onRepositoryPush` hook).
  if (event.event === 'push') return true;
  return false;
}
