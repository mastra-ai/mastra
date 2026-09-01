import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import type { PubSub } from '@mastra/core/events';

import { touchSessionFeed } from '../feed-events.js';
import type { FeedScope } from '../feed-events.js';

export interface RunLifecycleFeedSession {
  readonly identity: { getResourceId(): string };
  subscribe(listener: (event: AgentControllerEvent) => void): () => void;
}

export interface RunLifecycleFeedDependencies {
  sourceControl: {
    sessions: {
      getBySessionId(sessionId: string): Promise<{ orgId: string; projectRepositoryId: string } | null>;
      markRunEnded(args: { sessionId: string }): Promise<void>;
    };
    projectRepositories: { get(args: { orgId: string; id: string }): Promise<{ connectionId: string } | null> };
    connections: { get(args: { orgId: string; id: string }): Promise<{ factoryProjectId: string } | null> };
  };
  pubsub: Pick<PubSub, 'publish'>;
}

/**
 * Announce every run start and end on the project's feed stream, so board
 * cards and sidebar rows refetch the run registry on the event instead of
 * discovering it on their next poll tick. A run shorter than one poll
 * interval is otherwise invisible to every surface outside the open session.
 */
export function observeSessionRunLifecycle(
  session: RunLifecycleFeedSession,
  { sourceControl, pubsub }: RunLifecycleFeedDependencies,
): () => void {
  const sessionId = session.identity.getResourceId();
  let scopePromise: Promise<FeedScope | null> | undefined;

  const resolveScope = async (): Promise<FeedScope | null> => {
    const sessionRow = await sourceControl.sessions.getBySessionId(sessionId);
    if (!sessionRow) return null;
    const repository = await sourceControl.projectRepositories.get({
      orgId: sessionRow.orgId,
      id: sessionRow.projectRepositoryId,
    });
    if (!repository) return null;
    const connection = await sourceControl.connections.get({ orgId: sessionRow.orgId, id: repository.connectionId });
    if (!connection) return null;
    return { orgId: sessionRow.orgId, factoryProjectId: connection.factoryProjectId };
  };

  return session.subscribe(event => {
    if (event.type !== 'agent_start' && event.type !== 'agent_end') return;
    // Stamp before publishing so a client refetching on the frame reads the
    // stamped row; a lost stamp still gets a frame (the registry refetch).
    const stamped =
      event.type === 'agent_end'
        ? sourceControl.sessions.markRunEnded({ sessionId }).catch((error: unknown) => {
            console.warn('[Factory run feed] Unable to stamp the run end.', {
              sessionId,
              error: error instanceof Error ? error.message : String(error),
            });
          })
        : Promise.resolve();
    const pending = scopePromise ?? resolveScope();
    scopePromise = pending;
    void stamped
      .then(() => pending)
      .then(scope => {
        // Null is not cached: the session row can land after the controller
        // session exists, and a chat-only session simply has no row at all.
        if (!scope) {
          scopePromise = undefined;
          return;
        }
        touchSessionFeed(pubsub, scope, sessionId);
      })
      .catch(error => {
        scopePromise = undefined;
        console.warn('[Factory run feed] Unable to publish a run frame.', {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  });
}
