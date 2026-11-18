import type { MountedMastraCode } from '@mastra/code-sdk';

import type { GitLabWebhookDispatchIntegration } from '../../gitlab/webhook-dispatch.js';
import { parseGitLabWebhookBody, processGitLabWebhook } from '../../gitlab/webhook.js';
import type { ParsedGitLabWebhook } from '../../gitlab/webhook.js';
import type { PlatformConnectEventDelivery } from '../foundation/events-worker.js';
import { logPlatformInfo, logPlatformWarn } from '../logging.js';

const DELIVERY_ID_PREFIX = 'platform';

export interface GitLabConnectEventDependencies {
  controller?: MountedMastraCode['controller'];
  gitlab: GitLabWebhookDispatchIntegration;
  ingestFactoryEvent?: (event: ParsedGitLabWebhook) => Promise<unknown>;
  process?: typeof processGitLabWebhook;
  /** Called for every unverified event dropped, for diagnostics. */
  onUnverifiedDropped?: () => void;
}

/**
 * Feeds one Connect-forwarded GitLab webhook through the same ingress the
 * direct `/web/gitlab/webhook` route uses: rules first, then session
 * dispatch. Ingress failures propagate so the events worker retries the
 * event. Unverified events are dropped: GitLab dispatches from the payload,
 * so a body whose signature the platform could not check is never acted on.
 */
export async function handleGitLabConnectEvent(
  event: PlatformConnectEventDelivery,
  dependencies: GitLabConnectEventDependencies,
): Promise<void> {
  const deliveryId = `${DELIVERY_ID_PREFIX}:${event.connectionId}:${event.dedupeKey}`;
  if (event.unverified) {
    dependencies.onUnverifiedDropped?.();
    logPlatformWarn('Platform GitLab event dropped: the platform could not verify its signature', {
      connectionId: event.connectionId,
      eventId: event.id,
      eventType: event.eventType,
    });
    return;
  }
  const parsed = parseGitLabWebhookBody(event.payload, deliveryId);
  if (!parsed) {
    // Pipelines, deployments, wiki edits and the like are acknowledged and
    // dropped, exactly as the direct route treats an unsupported event header.
    return;
  }

  const process = dependencies.process ?? processGitLabWebhook;
  const result = await process(parsed, {
    ingestFactoryEvent: dependencies.ingestFactoryEvent,
    controller: dependencies.controller,
    // The integration supplies subscription storage and the project-member
    // trust check, so the dispatcher's default author gate applies unchanged.
    gitlab: dependencies.gitlab,
    sourceConnectionId: event.connectionId,
    onConnectionMismatch: () => {
      // Expected whenever two connections reach the same project: the event
      // is delivered by the connection that created the subscription.
    },
    onTargetSkipped: () => {
      // Routine when a subscription's thread belongs to another deployment.
    },
    onTargetError: (subscription, error) => {
      logPlatformWarn('Platform GitLab event delivery failed for a subscription', {
        deliveryId,
        subscriptionId: subscription.id,
        threadId: subscription.threadId,
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });
  if (result.status !== 202) {
    logPlatformInfo('Platform GitLab event was not accepted by the webhook processor', {
      connectionId: event.connectionId,
      deliveryId,
      status: result.status,
    });
  }
}
