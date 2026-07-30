import type { MastraDBMessage } from '@mastra/core/agent/message-list';

import type { WorkflowDraftAuthoringState, WorkflowDraftValidationContext } from './workflow-draft';
import type { WorkflowDraftCandidate } from './workflow-draft-tools';

export function getWorkflowBuilderThreadId(projectId: string, workflowId: string): string {
  return `workflow-builder-${projectId}-${workflowId}`;
}

export function getOriginalWorkflowRequest(messages: MastraDBMessage[]): string | undefined {
  const content = messages.find(message => message.role === 'user')?.content;
  if (!content || typeof content === 'string') return typeof content === 'string' ? content : undefined;
  return content.parts.find(part => part.type === 'text')?.text;
}

export function serializeWorkflowDraftInstructions(
  authoringState: WorkflowDraftAuthoringState,
  validationContext: WorkflowDraftValidationContext = {},
  candidate?: WorkflowDraftCandidate,
  originalRequest?: string,
): string {
  const originalRequestContext = originalRequest
    ? `## Original workflow request\n${originalRequest}\n\nContinue constructing or repairing this workflow. Do not ask the user to restate it.\n\n`
    : '';
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
  return `${originalRequestContext}## Current unsaved workflow authoring state
Lifecycle: ${authoringState.lifecycle}
Revision: ${authoringState.revision}
Finalized revision: ${authoringState.finalizedRevision ?? 'none'}

## Discovered catalogs
\`\`\`json
${JSON.stringify(catalogContext, null, 2)}
\`\`\`

## Workflow construction rules
Use inspect-workflow-resources to batch-inspect authoritative registered resource identities and schemas when the workflow depends on tools, agents, or nested workflows.
Submit one complete canonical WorkflowDefinition with submit-workflow-draft. Mapping steps use canonical descriptor objects, never template expressions or stringified objects. Examples:
- Workflow input: { "initData": true, "path": "prompt" }
- Preceding step output: { "step": "lookup-customer", "path": "customerId" }
Use mapConfig as a JSON object whose output fields each contain exactly one source descriptor. If validation rejects the definition, correct the complete definition using every returned diagnostic and submit it again. Studio automatically makes valid definitions Ready; never persist them because only the user may explicitly Save.

Agent steps take { prompt: string } and by default output { text: string }. Set outputSchema on an agent step to override that default for that step only. A foreach step needs a top-level array as its input; a mapping cannot build or unwrap an array root, so when the item array must be synthesized or reshaped, put an agent step with a top-level array outputSchema before the foreach (the bridge agent) and feed its array into the foreach.

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
