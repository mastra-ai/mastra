import { createContext } from 'react';
import type { SetStateAction } from 'react';
import type { DraftStatus } from './thread-draft-state';
import type { ThreadDraft } from './thread-draft-storage';

export interface ThreadInputContextValue {
  getThreadInput: (threadId?: string) => string;
  setThreadInputForThread: (threadId: string | undefined, value: SetStateAction<string>) => void;
  drafts?: {
    get: (threadId?: string) => ThreadDraft;
    update: (threadId: string | undefined, value: SetStateAction<ThreadDraft>) => void;
    status: DraftStatus;
  };
}

const FALLBACK_THREAD_INPUT_KEY = '__default__';

export const resolveThreadInputKey = (threadId?: string) => threadId || FALLBACK_THREAD_INPUT_KEY;

export const ThreadInputContext = createContext<ThreadInputContextValue>({
  getThreadInput: () => '',
  setThreadInputForThread: () => {},
});
