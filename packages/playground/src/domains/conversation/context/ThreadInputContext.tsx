import { useCallback, useMemo, useState } from 'react';
import type { ReactNode, SetStateAction } from 'react';
import { resolveThreadInputKey, ThreadInputContext } from './thread-input-context';

export const ThreadInputProvider = ({ children }: { children: ReactNode }) => {
  const [threadInputs, setThreadInputs] = useState<Record<string, string>>({});

  const getThreadInput = useCallback(
    (threadId?: string) => threadInputs[resolveThreadInputKey(threadId)] ?? '',
    [threadInputs],
  );

  const setThreadInputForThread = useCallback((threadId: string | undefined, value: SetStateAction<string>) => {
    setThreadInputs(prev => {
      const key = resolveThreadInputKey(threadId);
      const previousValue = prev[key] ?? '';
      const nextValue = typeof value === 'function' ? value(previousValue) : value;

      if (nextValue === previousValue) return prev;

      if (nextValue.length === 0) {
        if (!(key in prev)) return prev;

        const nextInputs = { ...prev };
        delete nextInputs[key];
        return nextInputs;
      }

      return { ...prev, [key]: nextValue };
    });
  }, []);

  const value = useMemo(() => ({ getThreadInput, setThreadInputForThread }), [getThreadInput, setThreadInputForThread]);

  return <ThreadInputContext.Provider value={value}>{children}</ThreadInputContext.Provider>;
};
