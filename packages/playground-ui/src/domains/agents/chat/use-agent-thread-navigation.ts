import { v4 as uuid } from '@lukeed/uuid';
import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { scopeAnonymousDraftKey } from './drafts/thread-draft-storage';
import type { ThreadDraftHandle } from './drafts/ThreadInputContext';

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
  draftScope: [string | undefined, string | undefined, string | undefined, string];
  canPersistDraft: boolean;
  draftHandle: RefObject<ThreadDraftHandle | null>;
  navigateToThread: (threadId: string) => void;
  expandThreadsPanel?: () => void;
  refreshThreads: () => Promise<unknown>;
}) {
  const [generated, setGenerated] = useState(() => ({ routeThreadId: threadId, newThreadId: uuid() }));
  let current = generated;
  if (generated.routeThreadId !== threadId) {
    current = { routeThreadId: threadId, newThreadId: uuid() };
    setGenerated(current);
  }

  const isNewThread = threadId === 'new';
  const newThreadId = current.newThreadId;
  const actualThreadId = isNewThread ? newThreadId : (threadId ?? newThreadId);
  const draftKey =
    (canPersistDraft && scopeAnonymousDraftKey(JSON.stringify([...draftScope, threadId ?? 'new']))) ||
    JSON.stringify([...draftScope, threadId ?? 'new']);
  const newThreadKey =
    (canPersistDraft && scopeAnonymousDraftKey(JSON.stringify([...draftScope, newThreadId]))) ||
    JSON.stringify([...draftScope, newThreadId]);
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
