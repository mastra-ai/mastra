import type { WorkflowDraft } from './workflow-draft';

export function getWorkflowBuilderThreadId(projectId: string, workflowId: string): string {
  return `workflow-builder-${projectId}-${workflowId}`;
}

export function serializeWorkflowDraftInstructions(draft: WorkflowDraft): string {
  return `## Current persisted workflow definition\n\`\`\`json\n${JSON.stringify(draft, null, 2)}\n\`\`\``;
}

interface WorkflowConversationGeneration {
  start(abort: () => void): {
    token: number;
    isCurrent: () => boolean;
    cancel: () => void;
  };
}

export function createWorkflowConversationGeneration(): WorkflowConversationGeneration {
  let currentToken = 0;
  let currentAbort: (() => void) | undefined;

  return {
    start(abort) {
      currentAbort?.();
      const token = ++currentToken;
      currentAbort = abort;

      return {
        token,
        isCurrent: () => token === currentToken,
        cancel: () => {
          if (token !== currentToken) return;
          currentAbort?.();
          currentAbort = undefined;
          currentToken += 1;
        },
      };
    },
  };
}
