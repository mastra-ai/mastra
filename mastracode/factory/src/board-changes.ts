import type { EventCallback, PubSub } from '@mastra/core/events';
import { withAck } from '@mastra/core/events';

/** One topic for every project, so a replica hears about all boards through one subscription. */
export const BOARD_CHANGES_TOPIC = 'factory.board-changes';

export interface BoardChangeScope {
  orgId: string;
  factoryProjectId: string;
}

/**
 * Tells other replicas that a project's board changed. Never awaited — a slow
 * or dead broker must not hold up the write it describes. `origin` lets the
 * publishing replica skip its own echo; it already handled the change.
 */
export function publishBoardChange(pubsub: PubSub, origin: string, scope: BoardChangeScope): void {
  pubsub
    .publish(BOARD_CHANGES_TOPIC, {
      type: 'factory.board.changed',
      runId: origin,
      data: { orgId: scope.orgId, factoryProjectId: scope.factoryProjectId },
    })
    .catch((error: unknown) => {
      console.warn('[Factory] Failed to publish a board change', {
        factoryProjectId: scope.factoryProjectId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
}

/** Hears board changes made on other replicas; resolves to the unsubscribe. */
export async function subscribeBoardChanges(
  pubsub: PubSub,
  origin: string,
  changed: (scope: BoardChangeScope) => void,
): Promise<() => Promise<void>> {
  const onEvent: EventCallback = withAck(async event => {
    if (event.runId === origin) return;
    const { orgId, factoryProjectId } = (event.data ?? {}) as Partial<BoardChangeScope>;
    if (typeof orgId === 'string' && typeof factoryProjectId === 'string') changed({ orgId, factoryProjectId });
  });
  // Without `latest`, a retaining broker replays changes made before this replica read anything.
  await pubsub.subscribe(BOARD_CHANGES_TOPIC, onEvent, { startFrom: 'latest' });
  return () => pubsub.unsubscribe(BOARD_CHANGES_TOPIC, onEvent);
}
