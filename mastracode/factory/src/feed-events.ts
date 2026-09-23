import type { PubSub } from '@mastra/core/events';

export interface FeedScope {
  orgId: string;
  factoryProjectId: string;
}

export function feedTopic(orgId: string, factoryProjectId: string): string {
  return `factory.feed.${orgId}.${factoryProjectId}`;
}

/**
 * One frame for the whole project: `workItemId` names the item whose comments
 * moved, and its absence means only the project's attention did. Never awaited
 * — a slow or dead broker must not hold up the write it describes.
 */
export function touchFeed(pubsub: PubSub, scope: FeedScope, workItemId?: string): void {
  pubsub
    .publish(feedTopic(scope.orgId, scope.factoryProjectId), {
      type: 'factory.feed.touched',
      runId: workItemId ?? scope.factoryProjectId,
      data: workItemId ? { workItemId } : {},
    })
    .catch((error: unknown) => {
      console.warn('[Factory] Failed to publish a feed touch', {
        factoryProjectId: scope.factoryProjectId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
}
