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
 * Keep Slack's Agent Session open while Mastra shows typing statuses.
 *
 * Under `agentView` the adapter routes a bare `startTyping()` to
 * `agents.sessions.setStatus('processing')` — which creates the session and
 * is what makes Slack offer the Stop button — but routes a text status to the
 * legacy `assistant.threads.setStatus`, which only renders the text. Mastra
 * always sends text (`is thinking…`, tool descriptions), so left alone no
 * session is ever created and Stop never appears.
 *
 * Mark the session processing before every text status. Slack ends sessions
 * on its own (a finished reply stream, the Stop button, a later run in the
 * same thread), so remembering "already open" goes stale and leaves later
 * runs without Stop. `setStatus('processing')` is idempotent, and core
 * already skips repeated statuses.
 */
export function withAgentSessionTyping(adapter: SlackAdapter): SlackAdapter {
  const startTyping = adapter.startTyping.bind(adapter);

  adapter.startTyping = async (threadId, status, options) => {
    if (status) await startTyping(threadId, undefined, options);
    return startTyping(threadId, status, options);
  };

  return adapter;
}
