import type { EventCallback, PubSub } from '@mastra/core/events';
import { withAck } from '@mastra/core/events';

import type { SourceControlStorage } from './storage/domains/source-control/base.js';

/** One topic for every integration; the event names the integration whose links changed. */
export const LINKED_REPOSITORIES_CHANGED_TOPIC = 'factory.linked-repositories';

/**
 * Carries this replica's linked-repository changes to the other replicas, and
 * theirs to this replica's listeners, so whichever replica holds a polling
 * lease hears of a link made anywhere. Publishes are never awaited — a slow or
 * dead broker must not hold up the write it describes. If subscribing fails,
 * this replica keeps announcing its own changes and its readers keep
 * re-reading the set. Resolves to the unsubscribe.
 */
export async function shareLinkedRepositoryChanges(
  pubsub: PubSub,
  sourceControl: Pick<
    SourceControlStorage,
    'onLinkedRepositoriesChanged' | 'linkedRepositoriesChanged' | 'setLinkedRepositoryChangesShared'
  >,
): Promise<() => Promise<void>> {
  const origin = globalThis.crypto.randomUUID();
  const stopPublishing = sourceControl.onLinkedRepositoriesChanged(({ integrationId, local }) => {
    if (!local) return;
    pubsub
      .publish(LINKED_REPOSITORIES_CHANGED_TOPIC, {
        type: 'factory.linked-repositories.changed',
        runId: origin,
        data: { integrationId },
      })
      .catch((error: unknown) => {
        console.warn('[Factory] Failed to announce a linked repository change', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
  });
  const onEvent: EventCallback = withAck(async event => {
    if (event.runId === origin) return;
    const { integrationId } = (event.data ?? {}) as { integrationId?: unknown };
    if (typeof integrationId === 'string') sourceControl.linkedRepositoriesChanged({ integrationId, local: false });
  });
  try {
    // Without `latest`, a retaining broker replays old changes on boot.
    await pubsub.subscribe(LINKED_REPOSITORIES_CHANGED_TOPIC, onEvent, { startFrom: 'latest' });
  } catch (error) {
    console.warn(
      `[factory] subscribing to linked repository changes failed; the GitHub event poll reads linked repositories from the database on every tick: ${error instanceof Error ? error.message : error}`,
    );
    return async () => stopPublishing();
  }
  sourceControl.setLinkedRepositoryChangesShared(true);
  return async () => {
    sourceControl.setLinkedRepositoryChangesShared(false);
    stopPublishing();
    await pubsub.unsubscribe(LINKED_REPOSITORIES_CHANGED_TOPIC, onEvent);
  };
}
