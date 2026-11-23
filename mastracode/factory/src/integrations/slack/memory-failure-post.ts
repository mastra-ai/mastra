import type { AgentChannels } from '@mastra/core/channels';

import { MEMORY_FAILURE_ABORT_REASON } from '../../tools/run-watch.js';
import type { RunReportSession } from '../../tools/run-watch.js';
import { sessionLink } from './channel-reply-processor.js';
import { runErrorCard } from './run-error-card.js';

/** What of a session the post needs: its events, and where its run happened. */
export interface MemoryFailureSession extends RunReportSession {
  identity: { getId(): string; getResourceId(): string };
  thread: { getId(): string | null };
  state: { get(): { factoryProjectId?: unknown } | undefined };
}

/**
 * Posts the run error card to the Slack thread of a run that a memory-model
 * failure stopped. Such a run ends as an abort, which the channel never shows,
 * so without this the thread hears nothing and every reply hits the same
 * failure. Runs someone stopped, and runs on threads not linked to Slack, post nothing.
 */
export function observeSessionMemoryFailurePosts(
  session: MemoryFailureSession,
  channels: () => AgentChannels | null | undefined,
): () => void {
  let lastError: Error | undefined;
  return session.subscribe(event => {
    if (event.type === 'agent_start') {
      lastError = undefined;
      return;
    }
    if (event.type === 'error') {
      lastError = event.error;
      return;
    }
    if (event.type !== 'agent_end') return;
    const error = lastError;
    lastError = undefined;
    if (event.reason !== 'aborted' || event.abortReason !== MEMORY_FAILURE_ABORT_REASON || !error) return;
    const threadId = session.thread.getId();
    if (!threadId) return;
    void postCard(session, threadId, error, channels).catch(postError => {
      console.warn('[Factory Slack] Unable to post a memory failure to the thread.', postError);
    });
  });
}

async function postCard(
  session: MemoryFailureSession,
  threadId: string,
  error: Error,
  channels: () => AgentChannels | null | undefined,
): Promise<void> {
  const render = await channels()?.buildRenderContextForThread(threadId);
  if (render?.platform !== 'slack') return;
  const projectId = session.state.get()?.factoryProjectId;
  const factoryProjectId = typeof projectId === 'string' && projectId ? projectId : undefined;
  const sessionUrl = sessionLink({
    threadId,
    sessionId: session.identity.getId(),
    resourceId: session.identity.getResourceId(),
    factoryProjectId,
  });
  await render.chatThread.post(runErrorCard(error, { target: { factoryProjectId, sessionUrl } }));
}
