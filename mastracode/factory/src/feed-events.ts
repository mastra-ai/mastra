import type { PubSub } from '@mastra/core/events';

import type { FeedFrame } from './feed-frame.js';

export interface FeedScope {
  orgId: string;
  factoryProjectId: string;
}

export function feedTopic(orgId: string, factoryProjectId: string): string {
  return `factory.feed.${orgId}.${factoryProjectId}`;
}

/**
 * One frame for the whole project: something on the board moved — a card, a
 * decision, a run, or the attention list — naming the cards it moved. Never
 * awaited — a slow or dead broker must not hold up the write it describes.
 */
export function touchFeed(pubsub: PubSub, scope: FeedScope, frame: FeedFrame): void {
  pubsub
    .publish(feedTopic(scope.orgId, scope.factoryProjectId), {
      type: 'factory.feed.touched',
      runId: scope.factoryProjectId,
      data: frame,
    })
    .catch((error: unknown) => {
      console.warn('[Factory] Failed to publish a feed touch', {
        factoryProjectId: scope.factoryProjectId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
}
