import { useImperativeHandle, useMemo, useState, useSyncExternalStore } from 'react';
import type { ReactNode, Ref } from 'react';
import { createThreadDraftState } from './thread-draft-state';
import { ThreadInputContext } from './thread-input-context';
import type { ThreadInputContextValue } from './thread-input-context';

export interface ThreadDraftHandle {
  move: (to: string) => Promise<void>;
}

export const ThreadInputProvider = ({
  children,
  persistence,
  ref,
}: {
  children: ReactNode;
  ref?: Ref<ThreadDraftHandle>;
  persistence?: { key: string; threadId: string };
}) => {
  const [state] = useState(() => createThreadDraftState(persistence));
  const snapshot = useSyncExternalStore(state.subscribe, state.getSnapshot, state.getSnapshot);
  useImperativeHandle(ref, () => ({ move: state.move }), [state]);
  const value = useMemo<ThreadInputContextValue>(
    () => ({
      getThreadInput: threadId => state.getDraft(threadId).text,
      setThreadInputForThread: (threadId, value) =>
        state.updateDraft(threadId, previous => ({
          ...previous,
          text: typeof value === 'function' ? value(previous.text) : value,
        })),
      drafts: {
        get: state.getDraft,
        update: state.updateDraft,
        status: snapshot.status,
        discardUnreadable: state.discardUnreadable,
      },
    }),
    [state, snapshot],
  );
  return <ThreadInputContext.Provider value={value}>{children}</ThreadInputContext.Provider>;
};
