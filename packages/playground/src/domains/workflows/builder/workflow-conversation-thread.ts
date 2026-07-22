const WORKFLOW_CONVERSATION_THREAD_PREFIX = 'workflow-builder-studio-';
const WORKFLOW_CONVERSATION_STORAGE_PREFIX = 'workflow-builder-thread:';

function getBrowserStorage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

export function getWorkflowConversationThreadId(workflowId: string, storage = getBrowserStorage()): string {
  return (
    storage?.getItem(`${WORKFLOW_CONVERSATION_STORAGE_PREFIX}${workflowId}`) ??
    `${WORKFLOW_CONVERSATION_THREAD_PREFIX}${workflowId}`
  );
}

export function rememberWorkflowConversationThread(
  workflowId: string,
  threadId: string,
  storage = getBrowserStorage(),
): void {
  storage?.setItem(`${WORKFLOW_CONVERSATION_STORAGE_PREFIX}${workflowId}`, threadId);
}
