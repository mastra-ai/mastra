import type { WorkflowDraftAuthoringState, WorkflowDraftValidationContext } from './workflow-draft';

export function getWorkflowBuilderThreadId(projectId: string, workflowId: string): string {
  return `workflow-builder-${projectId}-${workflowId}`;
}

export function serializeWorkflowDraftInstructions(
  authoringState: WorkflowDraftAuthoringState,
  validationContext: WorkflowDraftValidationContext = {},
): string {
  const catalogContext = {
    workflowCatalog: validationContext.workflowCatalog ?? 'available',
    agents: Object.keys(validationContext.agents ?? {}),
    tools: Object.keys(validationContext.tools ?? {}),
    workflows: Object.keys(validationContext.workflows ?? {}),
  };
  return `## Current unsaved workflow authoring state
Lifecycle: ${authoringState.lifecycle}
Revision: ${authoringState.revision}
Finalized revision: ${authoringState.finalizedRevision ?? 'none'}

## Discovered catalogs
\`\`\`json
${JSON.stringify(catalogContext, null, 2)}
\`\`\`

## Current accepted workflow definition
\`\`\`json
${JSON.stringify(authoringState.draft, null, 2)}
\`\`\``;
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
