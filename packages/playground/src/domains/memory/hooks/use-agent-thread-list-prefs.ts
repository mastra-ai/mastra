import { useCallback, useState } from 'react';

const STORAGE_KEY = 'playground-show-workflow-invocation-threads';

function readStoredPreference(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Persists whether the agent sidebar thread list includes workflow `createStep(agent)` transcripts
 * (`scope: workflow-agent-invocation`). Default: hidden so workflow runs do not clutter normal chats.
 */
export function useAgentThreadListPrefs() {
  const [showWorkflowInvocationThreads, setShowWorkflowInvocationThreadsState] = useState(readStoredPreference);

  const setShowWorkflowInvocationThreads = useCallback((value: boolean) => {
    setShowWorkflowInvocationThreadsState(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  return { showWorkflowInvocationThreads, setShowWorkflowInvocationThreads };
}
