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
 * Project the bound thread's title onto its source-control session row, from
 * whichever namer produced it — core on the first turn, the observational-memory
 * observer as the thread grows, or an explicit rename.
 *
 * The factory sidebar reads the session row, which otherwise keeps the raw first
 * prompt (chat sessions) or nothing at all (work sessions, which then show their
 * branch). Binding a thread reconciles the row against the stored title, so a
 * session started before this ran — or one whose rename event was missed — is
 * named the next time it is opened.
 *
 * A session names threads it is no longer showing, and each write reads the row
 * before replacing it. Titles for any other thread are therefore dropped, and
 * writes run one at a time so the last event wins rather than the fastest.
 */
export function observeSessionThreadTitle(
  session: ThreadTitleMirrorSession,
  { sourceControl }: ThreadTitleMirrorDependencies,
): () => void {
  const sessionId = session.identity.getResourceId();
  let boundThreadId: string | undefined;
  let writes: Promise<void> = Promise.resolve();

  const project = (threadId: string, rawTitle: string | undefined): void => {
    // A thread can be named before anything binds one, so the first thread to
    // surface a title speaks for the row until `thread_changed` rebinds it.
    boundThreadId ??= threadId;
    if (threadId !== boundThreadId) return;
    const title = rawTitle ? normalizeSessionTitle(rawTitle) : null;
    if (!title) return;

    writes = writes
      .then(async () => {
        if (threadId !== boundThreadId) return;
        const row = await sourceControl.sessions.getBySessionId(sessionId);
        if (!row || row.title === title) return;
        await sourceControl.sessions.rename({ sessionId, title });
      })
      .catch(error => console.warn('[Factory thread-title mirror] Unable to persist the session title.', error));
  };

  return session.subscribe(event => {
    switch (event.type) {
      case 'thread_title_updated':
        return project(event.threadId, event.title);
      case 'om_thread_title_updated':
        return project(event.threadId, event.newTitle);
      case 'thread_changed': {
        boundThreadId = event.threadId;
        void session.thread
          .getById({ threadId: event.threadId })
          .then(thread => project(event.threadId, thread?.title))
          .catch(error => console.warn('[Factory thread-title mirror] Unable to read the bound thread.', error));
        return;
      }
    }
  });
}
