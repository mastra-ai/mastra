import { createSlackAdapter as createBaseSlackAdapter } from '@chat-adapter/slack';
import type { SlackAdapter, SlackAdapterConfig } from '@chat-adapter/slack';

/**
 * `@chat-adapter/slack`'s factory, plus Mastra's Agent Session typing bridge
 * when `agentView` is on. Use this instead of the upstream factory so a
 * Mastra-driven adapter shows Slack's native Stop button.
 */
export function createSlackAdapter(config?: SlackAdapterConfig): SlackAdapter {
  const adapter = createBaseSlackAdapter(config);
  // The adapter reports turn cancellation exactly when `agentView` is on.
  return adapter.supportsTurnCancellation ? withAgentSessionTyping(adapter) : adapter;
}

/**
 * Keep Slack's Agent Session in step with Mastra's typing statuses.
 *
 * Under `agentView` the adapter routes a bare `startTyping()` to
 * `agents.sessions.setStatus('processing')` — which creates the session and
 * is what makes Slack offer the Stop button — but routes a text status to the
 * legacy `assistant.threads.setStatus`, which only renders the text. Mastra
 * always sends text (`is thinking…`, tool descriptions), so left alone no
 * session is ever created and Stop never appears.
 *
 * Mark the session processing before the first text status of each turn. A
 * turn ends when the status is cleared (`''`), `endTyping` runs, or a native
 * stream completes — each sets the session back to `active`, so the next text
 * status re-opens it.
 */
export function withAgentSessionTyping(adapter: SlackAdapter): SlackAdapter {
  const processing = new Set<string>();
  const startTyping = adapter.startTyping.bind(adapter);
  const endTyping = adapter.endTyping.bind(adapter);
  const stream = adapter.stream.bind(adapter);

  adapter.startTyping = async (threadId, status, options) => {
    if (!status) {
      // Bare → processing, '' → active: the adapter already speaks Agent
      // Sessions here; just track which one it is.
      if (status === '') processing.delete(threadId);
      else processing.add(threadId);
      return startTyping(threadId, status, options);
    }
    if (!processing.has(threadId)) {
      processing.add(threadId);
      await startTyping(threadId, undefined, options);
    }
    return startTyping(threadId, status, options);
  };

  adapter.endTyping = async (threadId, status) => {
    processing.delete(threadId);
    return endTyping(threadId, status);
  };

  adapter.stream = async (threadId, textStream, options) => {
    try {
      return await stream(threadId, textStream, options);
    } finally {
      // Both the native and fallback stream paths end the session `active`.
      processing.delete(threadId);
    }
  };

  return adapter;
}
