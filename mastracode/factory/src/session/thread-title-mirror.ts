import type { AgentControllerEvent, AgentControllerThread } from '@mastra/core/agent-controller';

import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import { normalizeSessionTitle } from './session-title.js';

export interface ThreadTitleMirrorSession {
  readonly identity: { getResourceId(): string };
  readonly thread: { getById(args: { threadId: string }): Promise<AgentControllerThread | null> };
  subscribe(listener: (event: AgentControllerEvent) => void): () => void;
}

export interface ThreadTitleMirrorDependencies {
  sourceControl: {
    sessions: Pick<SourceControlStorageHandle['sessions'], 'getBySessionId' | 'rename'>;
  };
}

/**
 * Copy a thread's title onto its source-control session row, from whichever
 * namer produced it — core on the first turn, the observational-memory observer
 * as the thread grows, or an explicit rename.
 *
 * The factory sidebar reads the session row, which otherwise keeps the raw first
 * prompt (chat sessions) or nothing at all (work sessions, which then show their
 * branch). Binding a thread reconciles the row against the stored title, so a
 * session started before this ran — or one whose rename event was missed — is
 * named the next time it is opened.
 */
export function observeSessionThreadTitle(
  session: ThreadTitleMirrorSession,
  { sourceControl }: ThreadTitleMirrorDependencies,
): () => void {
  const sessionId = session.identity.getResourceId();

  const mirror = async (rawTitle: string | undefined): Promise<void> => {
    const title = rawTitle ? normalizeSessionTitle(rawTitle) : null;
    if (!title) return;
    const row = await sourceControl.sessions.getBySessionId(sessionId);
    if (!row || row.title === title) return;
    await sourceControl.sessions.rename({ sessionId, title });
  };

  const safely = (work: Promise<void>) =>
    void work.catch(error => console.warn('[Factory thread-title mirror] Unable to persist the session title.', error));

  return session.subscribe(event => {
    switch (event.type) {
      case 'thread_title_updated':
        return safely(mirror(event.title));
      case 'om_thread_title_updated':
        return safely(mirror(event.newTitle));
      case 'thread_changed':
        return safely(session.thread.getById({ threadId: event.threadId }).then(thread => mirror(thread?.title)));
    }
  });
}
