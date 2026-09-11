import type { DynamicWorkflowDefinition } from '@mastra/client-js';
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
import type { WorkflowDraftCandidate, WorkflowDraftToolResult } from './workflow-draft-tools';
import { useUpsertDynamicWorkflow } from '@/domains/workflows/hooks/use-dynamic-workflows';

export class WorkflowDraftValidationError extends Error {
  constructor(public readonly issues: WorkflowDraftValidationIssue[]) {
    super(issues.map(issue => issue.message).join(' '));
    this.name = 'WorkflowDraftValidationError';
  }
}

function fromDynamicWorkflow(definition: DynamicWorkflowDefinition): WorkflowDraft {
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
  initialDefinition: DynamicWorkflowDefinition | undefined,
  initialId: string,
  validationContext?: WorkflowDraftValidationContext,
): WorkflowDraftAuthoringState {
  return initialDefinition
    ? createLoadedWorkflowDraftAuthoringState(fromDynamicWorkflow(initialDefinition), validationContext)
    : createWorkflowDraftAuthoringState(initialId);
}

function createValidationContextKey(validationContext?: WorkflowDraftValidationContext) {
  if (!validationContext) return 'pending';
  const catalogEntries = (catalog?: WorkflowDraftValidationContext['agents']) =>
    Object.entries(catalog ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, schemas]) => [id, schemas]);
  return JSON.stringify({
    agents: catalogEntries(validationContext.agents),
    tools: catalogEntries(validationContext.tools),
    workflowCatalog: validationContext.workflowCatalog,
    workflows: catalogEntries(validationContext.workflows),
  });
}

export function useWorkflowDraft(
  initialDefinition: DynamicWorkflowDefinition | undefined,
  initialId: string,
  validationContext?: WorkflowDraftValidationContext,
) {
  const identity = initialDefinition?.id ?? initialId;
  const validationContextKey = createValidationContextKey(validationContext);
  const initializationKey = `${identity}:${initialDefinition ? `loaded:${validationContextKey}` : 'new'}`;
  const [authoringState, setAuthoringState] = useState(() =>
    initializeAuthoringState(initialDefinition, initialId, validationContext),
  );
  const stateRef = useRef(authoringState);
  const identityRef = useRef(identity);
  const initializationKeyRef = useRef(initializationKey);
  const mountedRef = useRef(true);
  const saveMutation = useUpsertDynamicWorkflow();

  const replaceState = useCallback((next: WorkflowDraftAuthoringState) => {
    stateRef.current = next;
    setAuthoringState(next);
  }, []);

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
    if (identityRef.current === identity && stateRef.current.revision > 0) return;
    identityRef.current = identity;
    replaceState(initializeAuthoringState(initialDefinition, initialId, validationContext));
  }, [identity, initialDefinition, initialId, initializationKey, replaceState, validationContext]);

  const applyResult = useCallback(
    (result: WorkflowDraftAuthoringResult) => {
      if (result.state !== stateRef.current) replaceState(result.state);
      return result;
    },
    [replaceState],
  );

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
    [replaceState, validationContext],
  );

  const createTools = useCallback(
    (
      isCurrentGeneration?: () => boolean,
      onResult?: (event: WorkflowDraftToolResult) => void,
      candidate?: WorkflowDraftCandidate,
      onCandidateChange?: (candidate: WorkflowDraftCandidate) => void,
    ) =>
      createWorkflowDraftTools({
        getState: () => stateRef.current,
        checkpoint: (expectedRevision, draft) => {
          const result = checkpointWorkflowDraft(stateRef.current, expectedRevision, draft, validationContext);
          if (result.ok) applyResult(result);
          return result;
        },
        finalize: expectedRevision =>
          applyResult(finalizeWorkflowDraft(stateRef.current, expectedRevision, validationContext)),
        candidate,
        validationContext,
        isCurrentGeneration,
        onResult,
        onCandidateChange,
      }),
    [applyResult, validationContext],
  );
  const tools = useMemo(() => createTools(), [createTools]);

  const reset = useCallback(
    (definition?: DynamicWorkflowDefinition) => {
      if (stateRef.current.savingRevision !== undefined) return false;
      const nextIdentity = definition?.id ?? initialId;
      identityRef.current = nextIdentity;
      replaceState(
        definition
          ? createLoadedWorkflowDraftAuthoringState(fromDynamicWorkflow(definition), validationContext)
          : createWorkflowDraftAuthoringState(nextIdentity),
      );
      return true;
    },
    [initialId, replaceState, validationContext],
  );

  const save = async (metadata?: Record<string, unknown>) => {
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
      const result = await saveMutation.mutateAsync({ ...reservedDraft, metadata });
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
    saveError: saveMutation.error instanceof Error ? saveMutation.error : undefined,
    isSaving: saveMutation.isPending || authoringState.savingRevision !== undefined,
  };
}
