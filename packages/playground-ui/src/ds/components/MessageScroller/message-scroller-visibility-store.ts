import { DEFAULT_VISIBILITY } from './message-scroller-context';
import type { MessageScrollerVisibility } from './message-scroller-context';

/** Changes on nearly every scroll frame: as a context value, React walked the whole transcript to find readers. */
export interface MessageScrollerVisibilityStore {
  getSnapshot: () => MessageScrollerVisibility;
  subscribe: (onChange: () => void) => () => void;
  publish: (next: MessageScrollerVisibility) => void;
}

const sameVisibility = (left: MessageScrollerVisibility, right: MessageScrollerVisibility) =>
  left.currentAnchorId === right.currentAnchorId &&
  left.visibleMessageIds.length === right.visibleMessageIds.length &&
  left.visibleMessageIds.every((messageId, index) => messageId === right.visibleMessageIds[index]);

export function createVisibilityStore(): MessageScrollerVisibilityStore {
  let visibility = DEFAULT_VISIBILITY;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => visibility,
    subscribe: onChange => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    publish: next => {
      if (sameVisibility(visibility, next)) return;
      visibility = next;
      for (const listener of listeners) listener();
    },
  };
}
