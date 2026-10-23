import { useImperativeHandle, useState, useSyncExternalStore } from 'react';
import type { ReactNode, Ref, SetStateAction } from 'react';
import { createThreadDraftState } from './thread-draft-state';
import type { ThreadDraft } from './thread-draft-storage';
import { resolveThreadInputKey, ThreadInputContext } from './thread-input-context';
import type { ThreadInputContextValue } from './thread-input-context';

export interface ThreadDraftHandle {
  move: (to: string) => Promise<void>;
}

const EMPTY_DRAFT: ThreadDraft = { text: '', attachments: [] };

export const ThreadInputProvider = ({
  children,
  persistence,
  ref,
}: {
  children: ReactNode;
  ref?: Ref<ThreadDraftHandle>;
  persistence?: { key: string; threadId: string };
}) => {
  const [state] = useState(() => createThreadDraftState(persistence?.key));
  const snapshot = useSyncExternalStore(state.subscribe, state.getSnapshot, state.getSnapshot);
  const [memoryDrafts, setMemoryDrafts] = useState(() => new Map<string, ThreadDraft>());
  useImperativeHandle(ref, () => ({ move: state.move }), [state]);
  const isPersisted = (threadId?: string) => persistence !== undefined && threadId === persistence.threadId;
  const get = (threadId?: string) =>
    isPersisted(threadId) ? snapshot.draft : (memoryDrafts.get(resolveThreadInputKey(threadId)) ?? EMPTY_DRAFT);
  const update = (threadId: string | undefined, value: SetStateAction<ThreadDraft>) => {
    if (isPersisted(threadId)) return state.updateDraft(value);
    const key = resolveThreadInputKey(threadId);
    setMemoryDrafts(previous => {
      const current = previous.get(key) ?? EMPTY_DRAFT;
      const draft = typeof value === 'function' ? value(current) : value;
      if (draft.text === current.text && draft.attachments === current.attachments) return previous;
      const next = new Map(previous);
      if (!draft.text && draft.attachments.length === 0) next.delete(key);
      else next.set(key, draft);
      return next;
    });
  };
  const value: ThreadInputContextValue = {
    getThreadInput: threadId => get(threadId).text,
    setThreadInputForThread: (threadId, value) =>
      update(threadId, previous => ({
        ...previous,
        text: typeof value === 'function' ? value(previous.text) : value,
      })),
    drafts: { get, update, status: snapshot.status },
  };
  return <ThreadInputContext.Provider value={value}>{children}</ThreadInputContext.Provider>;
};
