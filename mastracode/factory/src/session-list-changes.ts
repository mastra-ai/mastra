import type { EventCallback, PubSub } from '@mastra/core/events';
import { withAck } from '@mastra/core/events';

import { touchFeed } from './feed-events.js';
import type { AnnouncedLists, ProjectListScope } from './storage/announced-lists.js';
import type { SourceControlStorage } from './storage/domains/source-control/base.js';
import type { WorkItemsStorage } from './storage/domains/work-items/base.js';

export const SESSION_LIST_CHANGES_TOPIC = 'factory.session-list-changes';

type ListName = 'sessions' | 'follows';

export async function shareSessionListChanges(
  pubsub: PubSub,
  storage: {
    sourceControl: Pick<SourceControlStorage, 'projectSessions'>;
    workItems: Pick<WorkItemsStorage, 'projectSubscriptions'>;
  },
): Promise<() => Promise<void>> {
  const origin = globalThis.crypto.randomUUID();
  const lists: Record<ListName, AnnouncedLists<unknown>> = {
    sessions: storage.sourceControl.projectSessions,
    follows: storage.workItems.projectSubscriptions,
  };
  const stopAnnouncing = (Object.keys(lists) as ListName[]).map(list =>
    lists[list].onAnnounced(scope => {
      pubsub
        .publish(SESSION_LIST_CHANGES_TOPIC, {
          type: 'factory.session-list.changed',
          runId: origin,
          data: { list, orgId: scope.orgId, factoryProjectId: scope.factoryProjectId },
        })
        .catch((error: unknown) => {
          console.warn('[Factory] Failed to publish a session list change', {
            factoryProjectId: scope.factoryProjectId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      touchFeed(pubsub, scope);
    }),
  );
  const stopPublishing = () => {
    for (const stop of stopAnnouncing) stop();
  };
  const onEvent: EventCallback = withAck(async event => {
    if (event.runId === origin) return;
    const { list, orgId, factoryProjectId } = (event.data ?? {}) as Partial<ProjectListScope & { list: string }>;
    if (
      (list === 'sessions' || list === 'follows') &&
      typeof orgId === 'string' &&
      typeof factoryProjectId === 'string'
    ) {
      lists[list].changed({ orgId, factoryProjectId });
    }
  });
  try {
    // Without `latest`, a retaining broker replays changes made before this replica read anything.
    await pubsub.subscribe(SESSION_LIST_CHANGES_TOPIC, onEvent, { startFrom: 'latest' });
  } catch (error) {
    console.warn(
      `[factory] subscribing to session list changes failed; the sidebar reads sessions and follows from the database on every request: ${error instanceof Error ? error.message : error}`,
    );
    return async () => stopPublishing();
  }
  for (const list of Object.values(lists)) list.trustAnnouncements();
  return async () => {
    for (const list of Object.values(lists)) list.distrustAnnouncements();
    stopPublishing();
    await pubsub.unsubscribe(SESSION_LIST_CHANGES_TOPIC, onEvent);
  };
}
