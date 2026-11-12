import type { PubSub } from '@mastra/core/events';

export interface FeedScope {
  orgId: string;
  factoryProjectId: string;
}

export function feedTopic(orgId: string, factoryProjectId: string): string {
  return `factory.feed.${orgId}.${factoryProjectId}`;
}

export const FEED_TOUCHED = 'factory.feed.touched';
export const INTAKE_TOUCHED = 'factory.intake.touched';

/**
 * One frame for the whole project: something on the board moved — a card, a
 * decision, a run, or the attention list. Never awaited — a slow or dead broker
 * must not hold up the write it describes.
 */
export function touchFeed(pubsub: PubSub, scope: FeedScope): void {
  touch(pubsub, scope, FEED_TOUCHED);
}

/**
 * The project's intake candidates changed: one was added, changed, filed or removed. Carried on
 * the board's topic so an open board still holds one subscription.
 */
export function touchIntake(pubsub: PubSub, scope: FeedScope): void {
  touch(pubsub, scope, INTAKE_TOUCHED);
}

function touch(pubsub: PubSub, scope: FeedScope, type: typeof FEED_TOUCHED | typeof INTAKE_TOUCHED): void {
  pubsub
    .publish(feedTopic(scope.orgId, scope.factoryProjectId), {
      type,
      runId: scope.factoryProjectId,
      data: {},
    })
    .catch((error: unknown) => {
      console.warn('[Factory] Failed to publish a feed touch', {
        factoryProjectId: scope.factoryProjectId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
}
