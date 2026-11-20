import { v4 as uuid } from '@lukeed/uuid';
import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';

interface ThreadDraftHandle {
  move: (to: string) => Promise<void>;
}

export function useAgentThreadNavigation({
  threadId,
  draftScope,
  canPersistDraft,
  draftHandle,
  navigateToThread,
  expandThreadsPanel,
  refreshThreads,
}: {
  threadId?: string;
  draftScope: (string | undefined)[];
  canPersistDraft: boolean;
  draftHandle: RefObject<ThreadDraftHandle | null>;
  navigateToThread: (threadId: string) => void;
  expandThreadsPanel?: () => void;
  refreshThreads: () => Promise<unknown>;
}) {
  const generated = useRef<{ routeThreadId?: string; newThreadId: string } | undefined>(undefined);
  if (!generated.current || generated.current.routeThreadId !== threadId) {
    generated.current = { routeThreadId: threadId, newThreadId: uuid() };
  }

  const isNewThread = threadId === 'new';
  const newThreadId = generated.current.newThreadId;
  const actualThreadId = isNewThread ? newThreadId : (threadId ?? newThreadId);
  const draftKey = JSON.stringify([...draftScope, threadId ?? 'new']);
  const newThreadKey = JSON.stringify([...draftScope, newThreadId]);
  const activeNewThread = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    activeNewThread.current = isNewThread ? newThreadKey : undefined;
    return () => {
      activeNewThread.current = undefined;
    };
  }, [isNewThread, newThreadKey]);

  const refreshThreadList = async () => {
    if (isNewThread && activeNewThread.current === newThreadKey) {
      const currentDraft = draftHandle.current;
      if (canPersistDraft) await currentDraft?.move(newThreadKey);
      if (activeNewThread.current === newThreadKey && currentDraft === draftHandle.current) {
        navigateToThread(newThreadId);
      }
    }
    expandThreadsPanel?.();
    await refreshThreads();
  };

  return { actualThreadId, draftKey, isNewThread, refreshThreadList };
}
