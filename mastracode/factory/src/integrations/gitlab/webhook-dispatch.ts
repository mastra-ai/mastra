import type { MountedMastraCode } from '@mastra/code-sdk';
import type { NotificationPriority } from '@mastra/core/notifications';

import { resolveSubscriptionSession, subscriptionRunContext } from '../subscription-session.js';
import type { SubscriptionSessionLookup } from '../subscription-session.js';
import { GITLAB_TRUSTED_ACCESS_LEVEL } from './integration.js';
import {
  listMergeRequestSubscriptionsForWebhook,
  mergeRequestUrl,
  normalizeSubscriptionHost,
  retireMergeRequestSubscription,
} from './subscriptions.js';
import type {
  GitLabSignalSubscriptionRow,
  GitLabSubscriptionStorage,
  GitLabWebhookMergeRequestTarget,
} from './subscriptions.js';
import type { ParsedGitLabWebhook } from './webhook.js';

export interface GitLabWebhookNotificationMetadata {
  event: string;
  action: string;
  host: string;
  projectId: number;
  projectPath: string;
  mergeRequestIid: number;
  sender?: string;
  senderId?: number;
  deliveryId: string;
}

export interface GitLabWebhookNotification {
  action: string;
  kind: string;
  priority: NotificationPriority;
  summary: string;
  terminal: boolean;
  metadata: GitLabWebhookNotificationMetadata;
  payload: Record<string, unknown>;
}

/**
 * The integration surface this dispatch uses. Narrow on purpose so the direct
 * and Platform-backed integrations, and tests, can satisfy it.
 */
export interface GitLabWebhookDispatchIntegration {
  readonly integrationStorage: GitLabSubscriptionStorage;
  readonly sourceControlStorage?: SubscriptionSessionLookup;
  getProjectMemberAccessLevel(connectionId: string, projectId: string, username: string): Promise<number | undefined>;
  resolveActiveConnectionForHost?(storedConnectionId: string, host: string): Promise<string>;
}

export interface GitLabWebhookDispatchDependencies {
  controller: MountedMastraCode['controller'];
  gitlab?: GitLabWebhookDispatchIntegration;
  listSubscriptions?: (
    target: GitLabWebhookMergeRequestTarget,
    options?: { includeTerminal?: boolean },
  ) => Promise<GitLabSignalSubscriptionRow[]>;
  retireSubscription?: (id: string, status: 'open' | 'closed' | 'merged') => Promise<void>;
  /**
   * Author gate override. The default requires the sender to be a trusted
   * project member through the subscription's connection.
   */
  isAuthorizedSender?: (
    notification: GitLabWebhookNotification,
    subscription: GitLabSignalSubscriptionRow,
  ) => Promise<boolean>;
  /** Called when the sender gate drops a notification, so the drop is observable. */
  onSenderRejected?: (notification: GitLabWebhookNotification) => void;
  onTargetError?: (subscription: GitLabSignalSubscriptionRow, error: unknown) => void;
  /** Called when a subscription names a thread this deployment does not hold. */
  onTargetSkipped?: (subscription: GitLabSignalSubscriptionRow) => void;
  /**
   * The connection the event arrived through. When set, only subscriptions
   * created under that connection are delivered; a direct project webhook
   * leaves it unset because GitLab does not say which connection it belongs to.
   */
  sourceConnectionId?: string;
  /** Called when a subscription is skipped because it belongs to another connection. */
  onConnectionMismatch?: (subscription: GitLabSignalSubscriptionRow) => void;
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

/**
 * The GitLab instance a delivery came from: the project's `web_url` host, which
 * must agree with the `X-Gitlab-Instance` header when one was sent. A mismatch
 * yields no host, so the delivery matches no subscription.
 */
export function gitlabWebhookHost(parsed: ParsedGitLabWebhook): string | undefined {
  const declaredHost = parsed.instanceHost ? normalizeSubscriptionHost(parsed.instanceHost) : undefined;
  const projectUrl = getString(getObject(parsed.payload.project)?.web_url);
  if (!projectUrl) return declaredHost;
  try {
    const payloadHost = normalizeSubscriptionHost(new URL(projectUrl).host);
    if (declaredHost && declaredHost !== payloadHost) return undefined;
    return payloadHost;
  } catch {
    return undefined;
  }
}

const AUTHOR_GATED_KINDS = new Set([
  'issue-comment-created',
  'review-comment-created',
  'review-approved',
  'review-dismissed',
]);
const PERMISSION_CHECK_TIMEOUT_MS = 5_000;

export function classifyGitLabWebhook(parsed: ParsedGitLabWebhook): GitLabWebhookNotification | undefined {
  const { event, payload } = parsed;
  const project = getObject(payload.project);
  const attributes = getObject(payload.object_attributes);
  const user = getObject(payload.user);
  const host = gitlabWebhookHost(parsed);
  const projectId = getNumber(project?.id);
  const projectPath = getString(project?.path_with_namespace);
  const sender = getString(payload.user_username) ?? getString(user?.username);
  const senderId = getNumber(user?.id) ?? getNumber(payload.user_id);
  if (!host || !projectId || !projectPath || !attributes) return undefined;

  let action: string;
  let mergeRequestIid: number | undefined;
  let priority: NotificationPriority;
  let kind: string;
  let label: string;
  let terminal = false;

  if (event === 'Merge Request Hook') {
    action = getString(attributes.action)?.toLowerCase() ?? '';
    mergeRequestIid = getNumber(attributes.iid);
    if (action === 'approved') {
      priority = 'urgent';
      kind = 'review-approved';
      label = 'approved the merge request';
    } else if (action === 'unapproved') {
      priority = 'high';
      kind = 'review-dismissed';
      label = 'revoked an approval';
    } else if (action === 'merge') {
      priority = 'urgent';
      kind = 'pull-request-merged';
      label = 'merged the merge request';
      terminal = true;
    } else if (action === 'close') {
      priority = 'urgent';
      kind = 'pull-request-closed';
      label = 'closed the merge request';
      terminal = true;
    } else if (action === 'reopen') {
      priority = 'high';
      kind = 'pull-request-reopened';
      label = 'reopened the merge request';
    } else if (action === 'update' && getString(attributes.oldrev)) {
      priority = 'medium';
      kind = 'pull-request-synchronize';
      label = 'pushed new commits';
    } else if (action === 'update') {
      priority = 'low';
      kind = 'pull-request-edited';
      label = 'edited the merge request';
    } else {
      return undefined;
    }
  } else if (event === 'Note Hook' && getString(attributes.noteable_type) === 'MergeRequest') {
    action = 'created';
    mergeRequestIid = getNumber(getObject(payload.merge_request)?.iid);
    priority = 'high';
    if (getString(attributes.type) === 'DiffNote') {
      kind = 'review-comment-created';
      label = 'left a review comment';
    } else {
      kind = 'issue-comment-created';
      label = 'commented';
    }
  } else {
    return undefined;
  }
  if (!mergeRequestIid) return undefined;

  const actor = sender ? `${sender} ` : '';
  return {
    action,
    kind,
    priority,
    summary: `${actor}${label} on ${projectPath}!${mergeRequestIid}`,
    terminal,
    metadata: {
      event,
      action,
      host,
      projectId,
      projectPath,
      mergeRequestIid,
      ...(sender ? { sender } : {}),
      ...(senderId !== undefined ? { senderId } : {}),
      deliveryId: parsed.deliveryId,
    },
    payload,
  };
}

function notificationTargetUrl(notification: GitLabWebhookNotification): string {
  const attributes = getObject(notification.payload.object_attributes);
  const { host, projectPath, mergeRequestIid } = notification.metadata;
  return getString(attributes?.url) ?? mergeRequestUrl(host, projectPath, mergeRequestIid);
}

/**
 * Comments and approval changes wake a session only when a trusted project
 * member sent them. The check runs through the subscription's own connection so
 * a deployment answers with the credential that created the link; an
 * unreachable or slow provider fails closed.
 */
async function isTrustedGitLabSender(
  notification: GitLabWebhookNotification,
  subscription: GitLabSignalSubscriptionRow,
  gitlab: GitLabWebhookDispatchIntegration | undefined,
): Promise<boolean> {
  if (!AUTHOR_GATED_KINDS.has(notification.kind)) return true;
  const sender = notification.metadata.sender;
  if (!sender || !gitlab) return false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const connectionId = gitlab.resolveActiveConnectionForHost
      ? await gitlab.resolveActiveConnectionForHost(subscription.data.installationExternalId, subscription.data.host)
      : subscription.data.installationExternalId;
    const accessLevel = await Promise.race([
      gitlab.getProjectMemberAccessLevel(connectionId, subscription.data.projectId, sender),
      new Promise<undefined>(resolve => {
        timeout = setTimeout(() => resolve(undefined), PERMISSION_CHECK_TIMEOUT_MS);
      }),
    ]);
    return (accessLevel ?? 0) >= GITLAB_TRUSTED_ACCESS_LEVEL;
  } catch {
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function dispatchGitLabWebhook(
  parsed: ParsedGitLabWebhook,
  dependencies: GitLabWebhookDispatchDependencies,
): Promise<{ delivered: number; failed: number; skipped: number; ignored: boolean }> {
  const notification = classifyGitLabWebhook(parsed);
  if (!notification) return { delivered: 0, failed: 0, skipped: 0, ignored: true };

  const target: GitLabWebhookMergeRequestTarget = {
    host: notification.metadata.host,
    projectId: String(notification.metadata.projectId),
    changeRequestId: String(notification.metadata.mergeRequestIid),
  };
  const listSubscriptions =
    dependencies.listSubscriptions ??
    ((subscriptionTarget: GitLabWebhookMergeRequestTarget, options?: { includeTerminal?: boolean }) => {
      if (!dependencies.gitlab) throw new Error('GitLab integration is required to load webhook subscriptions.');
      return listMergeRequestSubscriptionsForWebhook(
        subscriptionTarget,
        options,
        dependencies.gitlab.integrationStorage,
      );
    });
  const retireSubscription =
    dependencies.retireSubscription ??
    ((id: string, status: 'open' | 'closed' | 'merged') => {
      if (!dependencies.gitlab) throw new Error('GitLab integration is required to retire webhook subscriptions.');
      return retireMergeRequestSubscription(id, status, dependencies.gitlab.integrationStorage);
    });
  const isAuthorizedSender =
    dependencies.isAuthorizedSender ??
    ((candidate: GitLabWebhookNotification, subscription: GitLabSignalSubscriptionRow) =>
      isTrustedGitLabSender(candidate, subscription, dependencies.gitlab));

  const subscriptions = await listSubscriptions(target, { includeTerminal: notification.action === 'reopen' });
  let delivered = 0;
  let failed = 0;
  let skipped = 0;
  let rejected = false;

  for (const subscription of subscriptions) {
    try {
      // Two connections can reach the same project. Each polled event names
      // its connection, so a subscription is woken once, by its own connection,
      // and never by a credential that did not create the link.
      if (
        dependencies.sourceConnectionId !== undefined &&
        subscription.data.installationExternalId !== dependencies.sourceConnectionId
      ) {
        skipped += 1;
        dependencies.onConnectionMismatch?.(subscription);
        continue;
      }
      if (!(await isAuthorizedSender(notification, subscription))) {
        rejected = true;
        continue;
      }
      const session = await resolveSubscriptionSession(dependencies.controller, subscription, {
        label: 'GitLab',
        sourceControl: dependencies.gitlab?.sourceControlStorage,
      });
      // No session means this deployment does not hold the subscribed thread.
      // Not a delivery failure: leave the subscription for wherever it lives.
      if (!session) {
        skipped += 1;
        dependencies.onTargetSkipped?.(subscription);
        continue;
      }
      const runContext = await subscriptionRunContext(subscription, dependencies.gitlab?.sourceControlStorage);
      // Without a tenant the woken run would fail closed after the terminal
      // subscription had already been retired, so count it as a failed delivery.
      if (!runContext) {
        throw new Error(`GitLab subscription ${subscription.id} has no resolvable tenant identity; not delivered.`);
      }
      const result = await session.sendNotificationSignal(
        {
          source: 'gitlab',
          kind: notification.kind,
          summary: notification.summary,
          priority: notification.priority,
          payload: notification.payload,
          sourceId: parsed.deliveryId,
          dedupeKey: `${parsed.deliveryId}:${subscription.sessionId}:${subscription.threadId}`,
          coalesceKey: `gitlab:${notification.metadata.host}:${notification.metadata.projectId}:merge-request:${notification.metadata.mergeRequestIid}`,
          metadata: {
            event: notification.metadata.event,
            action: notification.action,
            repository: notification.metadata.projectPath,
            mergeRequestIid: notification.metadata.mergeRequestIid,
            targetUrl: notificationTargetUrl(notification),
            deliveryId: parsed.deliveryId,
          },
        },
        { requestContext: runContext },
      );
      await Promise.all([result.persisted, result.accepted].filter(Boolean));
      if (notification.terminal) {
        await retireSubscription(subscription.id, notification.kind === 'pull-request-merged' ? 'merged' : 'closed');
      } else if (notification.action === 'reopen') {
        await retireSubscription(subscription.id, 'open');
      }
      delivered += 1;
    } catch (error) {
      failed += 1;
      dependencies.onTargetError?.(subscription, error);
    }
  }
  if (rejected) dependencies.onSenderRejected?.(notification);

  return { delivered, failed, skipped, ignored: false };
}
