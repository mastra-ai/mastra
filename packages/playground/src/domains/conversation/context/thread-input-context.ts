import { createContext } from 'react';
import type { SetStateAction } from 'react';

export interface ThreadInputContextValue {
  getThreadInput: (threadId?: string) => string;
  setThreadInputForThread: (threadId: string | undefined, value: SetStateAction<string>) => void;
}

const FALLBACK_THREAD_INPUT_KEY = '__default__';

export const resolveThreadInputKey = (threadId?: string) => threadId || FALLBACK_THREAD_INPUT_KEY;

export const ThreadInputContext = createContext<ThreadInputContextValue>({
  getThreadInput: () => '',
  setThreadInputForThread: () => {},
});
