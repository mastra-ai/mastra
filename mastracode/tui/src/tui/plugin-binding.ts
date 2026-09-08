import type { TUIState } from './state.js';

const transitions = new WeakMap<TUIState, number>();

export function syncPluginBinding(state: TUIState): void {
  const host = state.pluginInteractiveHost;
  if (!host || !state.isInitialized || transitions.has(state)) return;
  const session = state.session;
  const threadId = state.pendingNewThread ? undefined : session.thread.getId();
  const resourceId = session.identity.getResourceId();
  const current = host.getInteractiveBinding();
  if (current?.session === session && current.threadId === threadId && current.resourceId === resourceId) return;
  host.publish(threadId ? { session, sessionId: session.identity.getId(), resourceId, threadId } : undefined);
}

export async function withPluginBindingTransition<T>(state: TUIState, action: () => Promise<T>): Promise<T> {
  transitions.set(state, (transitions.get(state) ?? 0) + 1);
  state.pluginInteractiveHost?.publish(undefined);
  try {
    return await action();
  } finally {
    const remaining = (transitions.get(state) ?? 1) - 1;
    if (remaining) transitions.set(state, remaining);
    else transitions.delete(state);
    syncPluginBinding(state);
  }
}
