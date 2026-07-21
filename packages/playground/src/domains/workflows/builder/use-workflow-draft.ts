import type { StoredWorkflowDefinition, UpsertStoredWorkflowResponse } from '@mastra/client-js';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useUpsertStoredWorkflow } from '../hooks/use-stored-workflows';
import { createWorkflowDraft, validateWorkflowDraft } from './workflow-draft';
import type { WorkflowDraft, WorkflowDraftValidationContext, WorkflowDraftValidationIssue } from './workflow-draft';
import { createWorkflowDraftTools } from './workflow-draft-tools';

export class WorkflowDraftValidationError extends Error {
  constructor(public readonly issues: WorkflowDraftValidationIssue[]) {
    super(issues.map(issue => issue.message).join(' '));
    this.name = 'WorkflowDraftValidationError';
  }
}

function fromStoredWorkflow(definition: StoredWorkflowDefinition): WorkflowDraft {
  return {
    id: definition.id,
    description: definition.description,
    inputSchema: definition.inputSchema,
    outputSchema: definition.outputSchema,
    stateSchema: definition.stateSchema,
    requestContextSchema: definition.requestContextSchema,
    graph: definition.graph,
  };
}

export function useWorkflowDraft(
  initialDefinition: StoredWorkflowDefinition | undefined,
  workflowId: string,
  validationContext?: WorkflowDraftValidationContext,
) {
  const [draft, setDraftState] = useState<WorkflowDraft>(() =>
    initialDefinition ? fromStoredWorkflow(initialDefinition) : createWorkflowDraft(workflowId),
  );
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const upsertWorkflow = useUpsertStoredWorkflow();

  const setDraft = useCallback((nextDraft: WorkflowDraft) => {
    draftRef.current = nextDraft;
    setDraftState(nextDraft);
  }, []);

  const createTools = useCallback(
    (isCurrentGeneration?: () => boolean) =>
      createWorkflowDraftTools({
        getDraft: () => draftRef.current,
        setDraft,
        validationContext,
        isCurrentGeneration,
      }),
    [setDraft, validationContext],
  );
  const tools = useMemo(() => createTools(), [createTools]);

  const reset = useCallback(
    (definition?: StoredWorkflowDefinition) => {
      setDraft(definition ? fromStoredWorkflow(definition) : createWorkflowDraft(workflowId));
    },
    [setDraft, workflowId],
  );

  const save = useCallback(async (): Promise<UpsertStoredWorkflowResponse> => {
    const validation = validateWorkflowDraft(draftRef.current, validationContext);
    if (!validation.ok) throw new WorkflowDraftValidationError(validation.issues);
    return upsertWorkflow.mutateAsync(draftRef.current);
  }, [upsertWorkflow, validationContext]);

  return {
    draft,
    setDraft,
    reset,
    tools,
    createTools,
    validation: validateWorkflowDraft(draft, validationContext),
    save,
    isSaving: upsertWorkflow.isPending,
    saveError: upsertWorkflow.error,
  };
}
