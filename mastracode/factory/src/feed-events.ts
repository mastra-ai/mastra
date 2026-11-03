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

export const BOARD_TOUCHED_EVENT = 'factory.board.touched';
export const BOARD_TOUCH_COALESCE_MS = 250;

/**
 * Tells open boards their cards changed, on the feed topic so a tab keeps one stream. Bursts of
 * writes (a transition and its follow-up stamps) coalesce into one frame per project, since
 * each frame makes every open board ask for what changed.
 */
export function boardToucher(pubsub: PubSub): (scope: FeedScope) => void {
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  return scope => {
    const topic = feedTopic(scope.orgId, scope.factoryProjectId);
    if (pending.has(topic)) return;
    const timer = setTimeout(() => {
      pending.delete(topic);
      pubsub
        .publish(topic, { type: BOARD_TOUCHED_EVENT, runId: scope.factoryProjectId, data: {} })
        .catch((error: unknown) => {
          console.warn('[Factory] Failed to publish a board touch', {
            factoryProjectId: scope.factoryProjectId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
    }, BOARD_TOUCH_COALESCE_MS);
    timer.unref?.();
    pending.set(topic, timer);
  };
}
