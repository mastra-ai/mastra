import type { WorkflowDraftAuthoringState, WorkflowDraftValidationContext } from './workflow-draft';
import type { WorkflowDraftCandidate } from './workflow-draft-tools';

export function getWorkflowBuilderThreadId(projectId: string, workflowId: string): string {
  return `workflow-builder-${projectId}-${workflowId}`;
}

export function serializeWorkflowDraftInstructions(
  authoringState: WorkflowDraftAuthoringState,
  validationContext: WorkflowDraftValidationContext = {},
  candidate?: WorkflowDraftCandidate,
): string {
  const catalogContext = {
    workflowCatalog: validationContext.workflowCatalog ?? 'available',
    agents: Object.keys(validationContext.agents ?? {}),
    tools: Object.keys(validationContext.tools ?? {}),
    workflows: Object.keys(validationContext.workflows ?? {}),
  };
  const candidateContext = candidate
    ? `

## Generation-local candidate
Base accepted revision: ${candidate.baseAcceptedRevision}
Candidate revision: ${candidate.revision}
Uncheckpointed changes: ${candidate.hasUncheckpointedChanges ? 'yes' : 'no'}
Candidate issues:
\`\`\`json
${JSON.stringify(candidate.issues, null, 2)}
\`\`\`
Candidate definition:
\`\`\`json
${JSON.stringify(candidate.draft, null, 2)}
\`\`\``
    : '';
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
\`\`\`${candidateContext}`;
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
