const WORKFLOW_CONVERSATION_THREAD_PREFIX = 'workflow-builder-studio-';
const WORKFLOW_CONVERSATION_STORAGE_PREFIX = 'workflow-builder-thread:';
const WORKFLOW_CONVERSATION_METADATA_KEY = 'workflowBuilderConversation';

export const WORKFLOW_BUILDER_AGENT_ID = 'workflow-builder';

function getBrowserStorage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getPersistedThreadId(metadata: Record<string, unknown> | undefined): string | undefined {
  const conversation = metadata?.[WORKFLOW_CONVERSATION_METADATA_KEY];
  if (!isRecord(conversation)) return undefined;
  return typeof conversation.threadId === 'string' && conversation.threadId ? conversation.threadId : undefined;
}

export function getWorkflowConversationThreadId(
  workflowId: string,
  metadata?: Record<string, unknown>,
  storage = getBrowserStorage(),
): string {
  return (
    getPersistedThreadId(metadata) ??
    storage?.getItem(`${WORKFLOW_CONVERSATION_STORAGE_PREFIX}${workflowId}`) ??
    `${WORKFLOW_CONVERSATION_THREAD_PREFIX}${workflowId}`
  );
}

export function createWorkflowConversationMetadata(
  metadata: Record<string, unknown> | undefined,
  threadId: string,
): Record<string, unknown> {
  return {
    ...metadata,
    [WORKFLOW_CONVERSATION_METADATA_KEY]: {
      agentId: WORKFLOW_BUILDER_AGENT_ID,
      resourceId: WORKFLOW_BUILDER_AGENT_ID,
      threadId,
    },
  };
}

export function rememberWorkflowConversationThread(
  workflowId: string,
  threadId: string,
  storage = getBrowserStorage(),
): void {
  storage?.setItem(`${WORKFLOW_CONVERSATION_STORAGE_PREFIX}${workflowId}`, threadId);
}
