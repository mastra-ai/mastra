import type { AgentControllerEvent } from '@mastra/core/agent-controller';

import type { TUIState } from './state.js';

/**
 * Whether a thread-routed event belongs to the thread the UI is showing. Every
 * tool event carries the id of the thread that produced it, so a call parked on
 * a detached thread (a background/sub-agent run) can be recognised and kept
 * from driving the current thread's UI, notifications, and permission hooks.
 * Events without thread routing are treated as belonging to the current thread.
 *
 * Shared by the serial dispatch queue and by the notification/permission hooks
 * that run at event receipt, so both apply the same routing. It lives in its own
 * module — with only type imports — because `setup.ts` needs it at module scope,
 * and pulling the dispatch handlers into that graph would load the SDK's auth
 * storage (and its filesystem access) on every import of the setup module.
 */
export function isEventRoutedToCurrentThread(event: AgentControllerEvent, state: TUIState): boolean {
  if (!('toolCallId' in event) || !('threadId' in event) || !event.threadId) return true;
  // A new thread has no id until it is created, so no thread-tagged event can be
  // attributed to it yet — routing one would let a detached thread's approval
  // drive the new thread's UI.
  if (state.pendingNewThread) return false;
  return event.threadId === state.session.thread.getId();
}
