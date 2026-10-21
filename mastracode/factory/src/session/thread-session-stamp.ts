import type { AgentControllerEvent } from '@mastra/core/agent-controller';

export interface ThreadSessionStampSession {
  readonly identity: { getId(): string };
  readonly thread: { setSettingOn(args: { threadId: string; key: string; value: unknown }): Promise<void> };
  subscribe(listener: (event: AgentControllerEvent) => void): () => void;
}

/**
 * Stamp each thread a session creates with `factorySessionId`. Sessions share
 * their Factory's or user's resource, so the stamp is what ties a new thread
 * to the session that opened it.
 */
export function observeSessionThreadStamp(session: ThreadSessionStampSession): () => void {
  return session.subscribe(event => {
    if (event.type !== 'thread_created') return;
    void session.thread
      .setSettingOn({ threadId: event.thread.id, key: 'factorySessionId', value: session.identity.getId() })
      .catch(error => console.warn('[Factory thread stamp] Unable to tie the new thread to its session.', error));
  });
}
