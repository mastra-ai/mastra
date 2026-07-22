import type { StoredWorkflowDefinition } from '@mastra/client-js';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  checkpointWorkflowDraft,
  createLoadedWorkflowDraftAuthoringState,
  createWorkflowDraftAuthoringState,
  finalizeWorkflowDraft,
  mutateWorkflowDraftAuthoringState,
  releaseWorkflowDraftSave,
  reserveWorkflowDraftSave,
  validateWorkflowDraft,
} from './workflow-draft';
import type {
  WorkflowDraft,
  WorkflowDraftAuthoringResult,
  WorkflowDraftAuthoringState,
  WorkflowDraftMutation,
  WorkflowDraftValidationContext,
  WorkflowDraftValidationIssue,
} from './workflow-draft';
import { createWorkflowDraftTools } from './workflow-draft-tools';
import { useUpsertStoredWorkflow } from '@/domains/workflows/hooks/use-stored-workflows';

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

function initializeAuthoringState(
  initialDefinition: StoredWorkflowDefinition | undefined,
  initialId: string,
  validationContext?: WorkflowDraftValidationContext,
): WorkflowDraftAuthoringState {
  return initialDefinition
    ? createLoadedWorkflowDraftAuthoringState(fromStoredWorkflow(initialDefinition), validationContext)
    : createWorkflowDraftAuthoringState(initialId);
}

export function useWorkflowDraft(
  initialDefinition: StoredWorkflowDefinition | undefined,
  initialId: string,
  validationContext?: WorkflowDraftValidationContext,
) {
  const identity = initialDefinition?.id ?? initialId;
  const initializationKey = `${identity}:${initialDefinition ? 'loaded' : 'new'}`;
  const [authoringState, setAuthoringState] = useState(() =>
    initializeAuthoringState(initialDefinition, initialId, validationContext),
  );
  const stateRef = useRef(authoringState);
  const identityRef = useRef(identity);
  const initializationKeyRef = useRef(initializationKey);
  const mountedRef = useRef(true);
  const saveMutation = useUpsertStoredWorkflow();

  const replaceState = (next: WorkflowDraftAuthoringState) => {
    stateRef.current = next;
    setAuthoringState(next);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      identityRef.current = '';
    };
  }, []);

  useLayoutEffect(() => {
    if (initializationKeyRef.current === initializationKey) return;
    initializationKeyRef.current = initializationKey;
    identityRef.current = identity;
    replaceState(initializeAuthoringState(initialDefinition, initialId, validationContext));
  }, [identity, initialDefinition, initialId, initializationKey, validationContext]);

  const applyResult = (result: WorkflowDraftAuthoringResult) => {
    if (result.state !== stateRef.current) replaceState(result.state);
    return result;
  };

  const checkpoint = (expectedRevision: number, draft: WorkflowDraft) =>
    applyResult(checkpointWorkflowDraft(stateRef.current, expectedRevision, draft, validationContext));

  const finalize = (expectedRevision: number) =>
    applyResult(finalizeWorkflowDraft(stateRef.current, expectedRevision, validationContext));

  const mutate = (expectedRevision: number, mutation: WorkflowDraftMutation) =>
    applyResult(mutateWorkflowDraftAuthoringState(stateRef.current, expectedRevision, mutation, validationContext));

  const setDraft = useCallback(
    (draft: WorkflowDraft) => {
      const result = checkpointWorkflowDraft(stateRef.current, stateRef.current.revision, draft, validationContext);
      if (result.state !== stateRef.current) replaceState(result.state);
      return result;
    },
    [validationContext],
  );

  const createTools = useCallback(
    (isCurrentGeneration?: () => boolean) =>
      createWorkflowDraftTools({
        getDraft: () => stateRef.current.draft,
        setDraft: nextDraft => {
          setDraft(nextDraft);
        },
        validationContext,
        isCurrentGeneration,
      }),
    [setDraft, validationContext],
  );
  const tools = useMemo(() => createTools(), [createTools]);

  const reset = useCallback(
    (definition?: StoredWorkflowDefinition) => {
      if (stateRef.current.savingRevision !== undefined) return false;
      const nextIdentity = definition?.id ?? initialId;
      identityRef.current = nextIdentity;
      replaceState(
        definition
          ? createLoadedWorkflowDraftAuthoringState(fromStoredWorkflow(definition), validationContext)
          : createWorkflowDraftAuthoringState(nextIdentity),
      );
      return true;
    },
    [initialId, validationContext],
  );

  const save = async () => {
    const expectedRevision = stateRef.current.revision;
    const reservation = reserveWorkflowDraftSave(stateRef.current, expectedRevision, validationContext);
    applyResult(reservation);
    if (!reservation.ok) {
      throw new WorkflowDraftValidationError(
        reservation.issues ?? [{ code: 'invalid-mutation', path: 'save', message: reservation.error }],
      );
    }

    const reservedDraft = reservation.state.draft;
    const reservedIdentity = identityRef.current;
    try {
      const result = await saveMutation.mutateAsync(reservedDraft);
      if (
        mountedRef.current &&
        identityRef.current === reservedIdentity &&
        stateRef.current.savingRevision === expectedRevision
      ) {
        replaceState(releaseWorkflowDraftSave(stateRef.current, expectedRevision));
      }
      return result;
    } catch (error) {
      if (
        mountedRef.current &&
        identityRef.current === reservedIdentity &&
        stateRef.current.savingRevision === expectedRevision
      ) {
        replaceState(releaseWorkflowDraftSave(stateRef.current, expectedRevision));
      }
      throw error;
    }
  };

  const validation =
    authoringState.lifecycle === 'untouched'
      ? { ok: true as const }
      : validateWorkflowDraft(authoringState.draft, validationContext);

  return {
    authoringState,
    draft: authoringState.draft,
    lifecycle: authoringState.lifecycle,
    revision: authoringState.revision,
    finalizedRevision: authoringState.finalizedRevision,
    savingRevision: authoringState.savingRevision,
    validation,
    isReady:
      authoringState.lifecycle === 'ready' &&
      authoringState.finalizedRevision === authoringState.revision &&
      authoringState.savingRevision === undefined,
    setDraft,
    tools,
    createTools,
    checkpoint,
    finalize,
    mutate,
    reset,
    save,
    isSaving: saveMutation.isPending || authoringState.savingRevision !== undefined,
  };
}
