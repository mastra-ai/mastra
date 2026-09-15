import { use, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ThreadInputContext } from './thread-input-context';

type ThreadInputSetter = Dispatch<SetStateAction<string>>;

export const useThreadInput = (
  threadId?: string,
): {
  threadInput: string;
  setThreadInput: ThreadInputSetter;
} => {
  const { getThreadInput, setThreadInputForThread } = use(ThreadInputContext);
  const setThreadInput = useCallback<ThreadInputSetter>(
    value => setThreadInputForThread(threadId, value),
    [setThreadInputForThread, threadId],
  );

  return {
    threadInput: getThreadInput(threadId),
    setThreadInput,
  };
};
