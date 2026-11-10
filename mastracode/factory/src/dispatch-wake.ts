import type { EventCallback, PubSub } from '@mastra/core/events';
import { withAck } from '@mastra/core/events';

/** One topic for every project: any replica's dispatcher claims across all of them. */
export const DISPATCH_WAKE_TOPIC = 'factory.dispatch';

/** A project linked a repository: integration workers idling with nothing to poll resume. */
export const REPOSITORY_LINKED_TOPIC = 'factory.repository-linked';

/**
 * Tells dispatchers on other replicas that claimable work exists. Never
 * awaited — a slow or dead broker must not hold up the write it describes.
 * `origin` lets the publishing replica skip its own echo; it already woke
 * its dispatcher directly.
 */
export function publishDispatchWake(pubsub: PubSub, origin: string, topic = DISPATCH_WAKE_TOPIC): void {
  pubsub.publish(topic, { type: `${topic}.wake`, runId: origin, data: {} }).catch((error: unknown) => {
    console.warn('[Factory] Failed to publish a wake', {
      topic,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

/** Wakes on other replicas' writes; resolves to the unsubscribe. */
export async function subscribeDispatchWakes(
  pubsub: PubSub,
  origin: string,
  wake: () => void,
  topic = DISPATCH_WAKE_TOPIC,
): Promise<() => Promise<void>> {
  const onEvent: EventCallback = withAck(async event => {
    if (event.runId !== origin) wake();
  });
  // Without `latest`, a retaining broker replays its backlog as spurious wakes.
  await pubsub.subscribe(topic, onEvent, { startFrom: 'latest' });
  return () => pubsub.unsubscribe(topic, onEvent);
}
