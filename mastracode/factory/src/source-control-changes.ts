import type { EventCallback, PubSub } from '@mastra/core/events';
import { withAck } from '@mastra/core/events';

/** One topic for every organization: a link change anywhere invalidates every replica's cached linked set. */
export const SOURCE_CONTROL_CHANGE_TOPIC = 'factory.source-control';

/**
 * Tells other replicas that repository links changed. Never awaited — a slow
 * or dead broker must not hold up the write it describes. `origin` lets the
 * publishing replica skip its own echo; it already invalidated locally.
 */
export function publishSourceControlChange(pubsub: PubSub, origin: string): void {
  pubsub
    .publish(SOURCE_CONTROL_CHANGE_TOPIC, { type: 'factory.source-control.changed', runId: origin, data: {} })
    .catch((error: unknown) => {
      console.warn('[Factory] Failed to publish a source-control change', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
}

/** Calls `changed` on other replicas' link writes; resolves to the unsubscribe. */
export async function subscribeSourceControlChanges(
  pubsub: PubSub,
  origin: string,
  changed: () => void,
): Promise<() => Promise<void>> {
  const onEvent: EventCallback = withAck(async event => {
    if (event.runId !== origin) changed();
  });
  // Without `latest`, a retaining broker replays its backlog on every boot.
  await pubsub.subscribe(SOURCE_CONTROL_CHANGE_TOPIC, onEvent, { startFrom: 'latest' });
  return () => pubsub.unsubscribe(SOURCE_CONTROL_CHANGE_TOPIC, onEvent);
}
