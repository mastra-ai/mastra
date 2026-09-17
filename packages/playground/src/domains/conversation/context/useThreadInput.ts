import { use, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { DraftStatus } from './thread-draft-state';
import type { ThreadDraft } from './thread-draft-storage';
import { ThreadInputContext } from './thread-input-context';

type ThreadInputSetter = Dispatch<SetStateAction<string>>;

export const useThreadInput = (
  threadId?: string,
): {
  threadInput: string;
  setThreadInput: ThreadInputSetter;
  draft?: ThreadDraft;
  updateDraft?: Dispatch<SetStateAction<ThreadDraft>>;
  draftStatus?: DraftStatus;
  discardUnreadable?: () => Promise<void>;
} => {
  const { getThreadInput, setThreadInputForThread, drafts } = use(ThreadInputContext);
  const setThreadInput = useCallback<ThreadInputSetter>(
    value => setThreadInputForThread(threadId, value),
    [setThreadInputForThread, threadId],
  );

  return {
    threadInput: getThreadInput(threadId),
    setThreadInput,
    draft: drafts?.get(threadId),
    updateDraft: drafts ? value => drafts.update(threadId, value) : undefined,
    draftStatus: drafts?.status,
    discardUnreadable: drafts?.discardUnreadable,
  };
};
