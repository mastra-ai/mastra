import type { PubSub } from '@mastra/core/events';

export interface FeedScope {
  orgId: string;
  factoryProjectId: string;
}

export function feedTopic(orgId: string, factoryProjectId: string): string {
  return `factory.feed.${orgId}.${factoryProjectId}`;
}

export const FEED_MOVE_EVENT = 'factory.feed.move';

/** How a move the board answered `202` for ended, named by the input id that answer carried. */
export type FeedMove =
  | { inputId: string; status: 'accepted' }
  | { inputId: string; status: 'rejected'; code: string; reason: string };

/** Tells the project's open boards how a move they were promised an answer for ended. Never awaited. */
export function announceMove(pubsub: PubSub, scope: FeedScope, move: FeedMove): void {
  pubsub
    .publish(feedTopic(scope.orgId, scope.factoryProjectId), {
      type: FEED_MOVE_EVENT,
      runId: scope.factoryProjectId,
      data: move,
    })
    .catch((error: unknown) => {
      console.warn("[Factory] Failed to publish a move's answer", {
        factoryProjectId: scope.factoryProjectId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
}

/**
 * One frame for the whole project: something on the board moved — a card, a
 * decision, a run, or the attention list. Never awaited — a slow or dead broker
 * must not hold up the write it describes.
 */
export function touchFeed(pubsub: PubSub, scope: FeedScope): void {
  pubsub
    .publish(feedTopic(scope.orgId, scope.factoryProjectId), {
      type: 'factory.feed.touched',
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
