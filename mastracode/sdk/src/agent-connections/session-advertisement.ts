import type { AgentController, Session } from '@mastra/core/agent-controller';

import { createThreadOwnershipManager } from './ownership.js';

/**
 * Advertise a session's threads to peer agents and keep them advertised.
 *
 * Cross-agent communication addresses peers by `(agentId, resourceId, threadId)`,
 * so every thread the user has loaded has to stay claimed for as long as the
 * session lives — a thread that is silently released becomes unreachable, and a
 * peer that saved it can no longer send to it. Claims are therefore keyed per
 * thread and only released when this session is torn down.
 */
export function createSessionThreadAdvertisement<TState>(options: {
  session: Session<TState>;
  controller: AgentController<TState>;
  /** Human-readable peer label for every thread this session advertises. */
  projectName: string;
}): { claim(threadId: string): Promise<void>; close(): void } {
  const { session, controller, projectName } = options;
  // Title updates can land while a thread's ownership request is still in
  // flight, when there is no advertisement to update yet. Remembering the
  // latest title (with a revision) lets the claim apply it afterwards instead
  // of losing the rename.
  const latestObservedTitles = new Map<string, { revision: number; title: string | undefined }>();

  const threadOwnership = createThreadOwnershipManager(async threadId => {
    const revisionAtStart = latestObservedTitles.get(threadId)?.revision ?? 0;
    const thread = await session.thread.getById({ threadId });
    const agent = controller.getCurrentAgent(session);
    const claim = await agent.claimThreadOwnership({
      threadId,
      resourceId: session.identity.getResourceId(),
      // The claim answers for `threadId`, which is not necessarily the session's
      // current thread once the user has moved on — so the woken run must bind
      // its memory and request context to the claimed thread, not the current one.
      streamOptions: () => session.machinery.buildStreamOptions({ threadId }),
      peer: {
        label: projectName,
        ...(thread?.title ? { title: thread.title } : {}),
      },
    });
    const observedTitle = latestObservedTitles.get(threadId);
    if (claim.claimed && observedTitle && observedTitle.revision !== revisionAtStart) {
      agent.updateThreadPeerAdvertisement({
        resourceId: session.identity.getResourceId(),
        threadId,
        peer: { title: observedTitle.title },
      });
    }
    return claim;
  });

  const claimThreadOwnership = async (threadId: string) => {
    try {
      await threadOwnership.claim(threadId);
    } catch (error) {
      console.error(`Failed to claim cross-agent thread ownership for ${threadId}`, error);
    }
  };

  const unsubscribeSession = session.subscribe(event => {
    if (event.type === 'thread_changed') void claimThreadOwnership(event.threadId);
    else if (event.type === 'thread_created') void claimThreadOwnership(event.thread.id);
    else if (event.type === 'thread_title_updated' || event.type === 'om_thread_title_updated') {
      const title = event.type === 'thread_title_updated' ? event.title : event.newTitle;
      const revision = (latestObservedTitles.get(event.threadId)?.revision ?? 0) + 1;
      latestObservedTitles.set(event.threadId, { revision, title });
      controller.getCurrentAgent(session).updateThreadPeerAdvertisement({
        resourceId: session.identity.getResourceId(),
        threadId: event.threadId,
        peer: { title },
      });
    }
  });

  return {
    /**
     * Claim (and start advertising) a thread. Errors are logged, not thrown:
     * the caller often cannot await the result, and a failed claim is retried
     * by the ownership manager.
     */
    claim: claimThreadOwnership,
    close() {
      unsubscribeSession();
      threadOwnership.close();
    },
  };
}
