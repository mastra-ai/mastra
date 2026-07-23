import type { UpsertStoredWorkflowParams } from '@mastra/client-js';
import { normalizeWorkflowBuilderDefinition, preflightWorkflowDefinition } from '@mastra/core/workflows/builder';
import type {
  WorkflowDefinitionPreflightContext,
  WorkflowDefinitionPreflightIssue,
  WorkflowDefinitionPreflightIssueCode,
} from '@mastra/core/workflows/builder';

export type WorkflowDraft = UpsertStoredWorkflowParams;
export type WorkflowDraftStep = WorkflowDraft['graph'][number];
type JsonSchema = WorkflowDraft['inputSchema'];

export interface WorkflowDraftStepSchema {
  inputSchema?: JsonSchema;
  outputSchema?: JsonSchema;
}

export interface WorkflowDraftValidationContext {
  agents?: Record<string, WorkflowDraftStepSchema>;
  tools?: Record<string, WorkflowDraftStepSchema>;
  workflows?: Record<string, WorkflowDraftStepSchema>;
  workflowCatalog?: 'available' | 'unavailable';
}

export type WorkflowDraftLifecycle = 'untouched' | 'constructing' | 'ready';

export interface WorkflowDraftAuthoringState {
  lifecycle: WorkflowDraftLifecycle;
  revision: number;
  finalizedRevision?: number;
  savingRevision?: number;
  draft: WorkflowDraft;
  checkpointIssues: WorkflowDraftValidationIssue[];
  finalIssues: WorkflowDraftValidationIssue[];
}

export const WORKFLOW_DRAFT_REVISION_CONFLICT = 'Draft changed before this operation completed.';

export type WorkflowDraftAuthoringResult =
  | { ok: true; state: WorkflowDraftAuthoringState }
  | { ok: false; state: WorkflowDraftAuthoringState; error: string; issues?: WorkflowDraftValidationIssue[] };

export type WorkflowDraftMutation =
  | { type: 'set-identity'; id: string; description?: string }
  | {
      type: 'set-schemas';
      inputSchema: WorkflowDraft['inputSchema'];
      outputSchema: WorkflowDraft['outputSchema'];
      stateSchema?: WorkflowDraft['stateSchema'];
      requestContextSchema?: WorkflowDraft['requestContextSchema'];
    }
  | { type: 'add-step'; step: WorkflowDraftStep; index?: number }
  | { type: 'update-step'; stepId: string; step: WorkflowDraftStep }
  | { type: 'remove-step'; stepId: string };

/**
 * Draft issues are the Core validation codes plus a few draft-only concerns
 * (identity, schema shape, sleep literals, catalog availability, mutations).
 * Deriving from the Core union means new Core checks surface here without a
 * hand-maintained copy.
 */
export type WorkflowDraftValidationIssueCode =
  | WorkflowDefinitionPreflightIssueCode
  | 'invalid-workflow-id'
  | 'invalid-schema'
  | 'invalid-duration'
  | 'invalid-date'
  | 'workflow-catalog-unavailable'
  | 'invalid-mutation';

export interface WorkflowDraftValidationIssue {
  code: WorkflowDraftValidationIssueCode;
  path: string;
  message: string;
}

export type WorkflowDraftValidationResult = { ok: true } | { ok: false; issues: WorkflowDraftValidationIssue[] };

export type WorkflowDraftMutationResult =
  { ok: true; draft: WorkflowDraft } | { ok: false; draft: WorkflowDraft; issues: WorkflowDraftValidationIssue[] };

const emptyObjectSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const;

export function createWorkflowDraft(id: string): WorkflowDraft {
  return {
    id,
    inputSchema: emptyObjectSchema,
    outputSchema: emptyObjectSchema,
    graph: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateJsonSchema(schema: unknown, path: string, issues: WorkflowDraftValidationIssue[]): void {
  if (!isRecord(schema)) {
    issues.push({ code: 'invalid-schema', path, message: 'Schema must be a JSON object.' });
    return;
  }
  try {
    JSON.stringify(schema);
  } catch {
    issues.push({ code: 'invalid-schema', path, message: 'Schema must be JSON-serializable.' });
  }
}

/** Visits every entry (top-level and container children) with its issue path. */
function forEachDraftStep(
  graph: WorkflowDraft['graph'],
  visit: (
    step: WorkflowDraftStep | Extract<WorkflowDraftStep, { type: 'parallel' }>['steps'][number],
    path: string,
  ) => void,
): void {
  graph.forEach((step, index) => {
    const path = `graph.${index}`;
    visit(step, path);
    if (step.type === 'parallel' || step.type === 'conditional') {
      step.steps.forEach((child, childIndex) => visit(child, `${path}.steps.${childIndex}`));
    } else if (step.type === 'foreach' || step.type === 'loop') {
      visit(step.step, `${path}.step`);
    }
  });
}

/**
 * Draft-only checks the Core validator intentionally does not own: sleep
 * literals, catalog availability, and empty reference ids (flagged even when
 * no catalog was loaded, so an obviously incomplete step never looks fine).
 */
function validateDraftSpecifics(
  draft: WorkflowDraft,
  issues: WorkflowDraftValidationIssue[],
  context?: WorkflowDraftValidationContext,
): void {
  forEachDraftStep(draft.graph, (step, path) => {
    switch (step.type) {
      case 'agent':
        if (step.agentId.trim().length === 0) {
          issues.push({
            code: 'missing-reference',
            path: `${path}.agentId`,
            message: `Agent "${step.agentId}" is unavailable.`,
          });
        }
        return;
      case 'tool':
        if (step.toolId.trim().length === 0) {
          issues.push({
            code: 'missing-reference',
            path: `${path}.toolId`,
            message: `Tool "${step.toolId}" is unavailable.`,
          });
        }
        return;
      case 'workflow':
        if (context?.workflowCatalog === 'unavailable') {
          issues.push({
            code: 'workflow-catalog-unavailable',
            path: `${path}.workflowId`,
            message: 'Workflow catalog is unavailable, so nested workflow references cannot be finalized.',
          });
        } else if (step.workflowId.trim().length === 0) {
          issues.push({
            code: 'missing-reference',
            path: `${path}.workflowId`,
            message: `Workflow "${step.workflowId}" is unavailable.`,
          });
        }
        return;
      case 'loop':
        if (step.loopType !== 'dowhile' && step.loopType !== 'dountil') {
          issues.push({ code: 'invalid-loop', path: `${path}.loopType`, message: 'Loop type is invalid.' });
        }
        return;
      case 'sleep':
        if (!Number.isFinite(step.duration) || step.duration < 0) {
          issues.push({
            code: 'invalid-duration',
            path: `${path}.duration`,
            message: 'Sleep duration must be non-negative.',
          });
        }
        return;
      case 'sleepUntil':
        if (Number.isNaN(Date.parse(step.date))) {
          issues.push({
            code: 'invalid-date',
            path: `${path}.date`,
            message: 'Sleep-until date must be ISO-compatible.',
          });
        }
        return;
      default:
        return;
    }
  });
}

const TOP_LEVEL_ENTRY_PATH = /^graph\.\d+$/;

/** Rewrites Core issue copy into the Studio UI's actionable phrasing. */
function toDraftIssue(issue: WorkflowDefinitionPreflightIssue): WorkflowDraftValidationIssue {
  if (issue.code === 'incompatible-schema') {
    if (issue.message === 'Foreach input must be an array.') {
      return { ...issue, message: 'Foreach input must be an array. Insert or update a mapping step.' };
    }
    if (issue.path === 'outputSchema') {
      return {
        ...issue,
        message:
          'Workflow output schema is incompatible with the final step output. Add a top-level mapping step or update the output schema.',
      };
    }
    if (issue.message === 'Step input is incompatible with the preceding workflow output.') {
      return TOP_LEVEL_ENTRY_PATH.test(issue.path)
        ? {
            ...issue,
            message: `Step ${issue.path.slice('graph.'.length)} input is incompatible with ${issue.path === 'graph.0' ? 'the workflow input' : 'the previous step output'}. Insert or update a mapping step.`,
          }
        : {
            ...issue,
            message:
              'Step input is incompatible with the containing flow input. Insert a top-level mapping step or use a nested workflow to shape the input.',
          };
    }
    return issue;
  }
  if (
    issue.code === 'invalid-map-config' &&
    (issue.message === 'Mapping descriptor must be an object.' ||
      issue.message === 'Mapping descriptor must define exactly one source.')
  ) {
    return {
      ...issue,
      message:
        'Mapping entries must use value, template, requestContextPath, or a step/initData source with a path. Expressions are not supported.',
    };
  }
  return issue;
}

const issueKey = (issue: WorkflowDraftValidationIssue): string => `${issue.code}:${issue.path}`;

export function validateWorkflowDraft(
  draft: WorkflowDraft,
  context?: WorkflowDraftValidationContext,
): WorkflowDraftValidationResult {
  const issues: WorkflowDraftValidationIssue[] = [];

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.id)) {
    issues.push({ code: 'invalid-workflow-id', path: 'id', message: 'Workflow id must be descriptive kebab-case.' });
  }
  validateJsonSchema(draft.inputSchema, 'inputSchema', issues);
  validateJsonSchema(draft.outputSchema, 'outputSchema', issues);
  if (draft.stateSchema !== undefined) validateJsonSchema(draft.stateSchema, 'stateSchema', issues);
  if (draft.requestContextSchema !== undefined) {
    validateJsonSchema(draft.requestContextSchema, 'requestContextSchema', issues);
  }
  validateDraftSpecifics(draft, issues, context);

  // Structure, references, JSON-Schema keywords, and schema-flow all come
  // from the single Core validation domain — the same checks the server runs
  // at save time, so a finalized draft cannot be rejected on save.
  const coreContext: WorkflowDefinitionPreflightContext = {
    agents: context?.agents,
    tools: context?.tools,
    workflows: context?.workflowCatalog === 'unavailable' ? undefined : context?.workflows,
  };
  try {
    const preflight = preflightWorkflowDefinition(normalizeWorkflowBuilderDefinition(draft), coreContext);
    if (!preflight.ok) {
      const seen = new Set(issues.map(issueKey));
      issues.push(...preflight.issues.map(toDraftIssue).filter(issue => !seen.has(issueKey(issue))));
    }
  } catch (error) {
    issues.push({
      code: 'invalid-schema',
      path: 'graph',
      message: error instanceof Error ? error.message : 'Workflow definition could not be normalized.',
    });
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

function mutationIssue(draft: WorkflowDraft, path: string, message: string): WorkflowDraftMutationResult {
  return { ok: false, draft, issues: [{ code: 'invalid-mutation', path, message }] };
}

function mutateWorkflowDraft(
  draft: WorkflowDraft,
  mutation: WorkflowDraftMutation,
): WorkflowDraftMutationResult | WorkflowDraft {
  switch (mutation.type) {
    case 'set-identity':
      return { ...draft, id: mutation.id, description: mutation.description };
    case 'set-schemas':
      return {
        ...draft,
        inputSchema: mutation.inputSchema,
        outputSchema: mutation.outputSchema,
        stateSchema: mutation.stateSchema,
        requestContextSchema: mutation.requestContextSchema,
      };
    case 'add-step': {
      if (mutation.index !== undefined && mutation.index > draft.graph.length) {
        return mutationIssue(draft, 'index', 'Step index is outside the workflow graph.');
      }
      const graph = [...draft.graph];
      graph.splice(mutation.index ?? graph.length, 0, mutation.step);
      return { ...draft, graph };
    }
    case 'update-step':
      if (!draft.graph.some(step => 'id' in step && step.id === mutation.stepId)) {
        return mutationIssue(draft, 'stepId', `Step "${mutation.stepId}" does not exist.`);
      }
      return {
        ...draft,
        graph: draft.graph.map(step => ('id' in step && step.id === mutation.stepId ? mutation.step : step)),
      };
    case 'remove-step':
      if (!draft.graph.some(step => 'id' in step && step.id === mutation.stepId)) {
        return mutationIssue(draft, 'stepId', `Step "${mutation.stepId}" does not exist.`);
      }
      return { ...draft, graph: draft.graph.filter(step => !('id' in step) || step.id !== mutation.stepId) };
  }
}

export function applyWorkflowDraftMutation(
  draft: WorkflowDraft,
  mutation: WorkflowDraftMutation,
  context?: WorkflowDraftValidationContext,
): WorkflowDraftMutationResult {
  const mutationResult = mutateWorkflowDraft(draft, mutation);
  if ('ok' in mutationResult) return mutationResult;
  const nextDraft = mutationResult;
  const previousValidation = validateWorkflowDraft(draft, context);
  const nextValidation = validateWorkflowDraft(nextDraft, context);
  if (nextValidation.ok) return { ok: true, draft: nextDraft };

  const previousIssueKeys = new Set(previousValidation.ok ? [] : previousValidation.issues.map(issueKey));
  const introducedIssues = nextValidation.issues.filter(
    issue => issue.code !== 'incompatible-schema' && !previousIssueKeys.has(issueKey(issue)),
  );
  if (introducedIssues.length > 0) return { ok: false, draft, issues: introducedIssues };
  return { ok: true, draft: nextDraft };
}

const checkpointBlockingCodes = new Set<WorkflowDraftValidationIssueCode>([
  'invalid-schema',
  'missing-step-id',
  'duplicate-step-id',
  'invalid-map-config',
  'invalid-map-placement',
  'invalid-parallel',
  'invalid-foreach',
  'invalid-duration',
  'invalid-date',
  'invalid-conditional',
  'invalid-loop',
]);

export function validateWorkflowCheckpoint(
  draft: WorkflowDraft,
  context?: WorkflowDraftValidationContext,
): WorkflowDraftValidationResult {
  const validation = validateWorkflowDraft(draft, context);
  if (validation.ok) return validation;
  const issues = validation.issues.filter(issue => checkpointBlockingCodes.has(issue.code));
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

function validationIssues(result: WorkflowDraftValidationResult): WorkflowDraftValidationIssue[] {
  return result.ok ? [] : result.issues;
}

export function createWorkflowDraftAuthoringState(id: string): WorkflowDraftAuthoringState {
  return {
    lifecycle: 'untouched',
    revision: 0,
    draft: createWorkflowDraft(id),
    checkpointIssues: [],
    finalIssues: [],
  };
}

export function createLoadedWorkflowDraftAuthoringState(
  draft: WorkflowDraft,
  context?: WorkflowDraftValidationContext,
): WorkflowDraftAuthoringState {
  const validation = validateWorkflowDraft(draft, context);
  return {
    lifecycle: validation.ok ? 'ready' : 'constructing',
    revision: 0,
    finalizedRevision: validation.ok ? 0 : undefined,
    draft,
    checkpointIssues: validationIssues(validateWorkflowCheckpoint(draft, context)),
    finalIssues: validationIssues(validation),
  };
}

function rejectAuthoringOperation(state: WorkflowDraftAuthoringState, error: string): WorkflowDraftAuthoringResult {
  return { ok: false, state, error };
}

function assertMutableRevision(state: WorkflowDraftAuthoringState, expectedRevision: number): string | undefined {
  if (state.savingRevision !== undefined) return 'Workflow save is in progress.';
  if (state.revision !== expectedRevision) return WORKFLOW_DRAFT_REVISION_CONFLICT;
  return undefined;
}

export function checkpointWorkflowDraft(
  state: WorkflowDraftAuthoringState,
  expectedRevision: number,
  draft: WorkflowDraft,
  context?: WorkflowDraftValidationContext,
): WorkflowDraftAuthoringResult {
  const conflict = assertMutableRevision(state, expectedRevision);
  if (conflict) return rejectAuthoringOperation(state, conflict);
  const validation = validateWorkflowCheckpoint(draft, context);
  if (!validation.ok) {
    return {
      ok: false,
      state,
      error: validation.issues.map(issue => issue.message).join(' '),
      issues: validation.issues,
    };
  }
  return {
    ok: true,
    state: {
      lifecycle: 'constructing',
      revision: state.revision + 1,
      draft,
      checkpointIssues: [],
      finalIssues: validationIssues(validateWorkflowDraft(draft, context)),
    },
  };
}

export function mutateWorkflowDraftAuthoringState(
  state: WorkflowDraftAuthoringState,
  expectedRevision: number,
  mutation: WorkflowDraftMutation,
  context?: WorkflowDraftValidationContext,
): WorkflowDraftAuthoringResult {
  const conflict = assertMutableRevision(state, expectedRevision);
  if (conflict) return rejectAuthoringOperation(state, conflict);
  const result = applyWorkflowDraftMutation(state.draft, mutation, context);
  if (!result.ok) {
    return { ok: false, state, error: result.issues.map(issue => issue.message).join(' '), issues: result.issues };
  }
  return {
    ok: true,
    state: {
      lifecycle: 'constructing',
      revision: state.revision + 1,
      draft: result.draft,
      checkpointIssues: validationIssues(validateWorkflowCheckpoint(result.draft, context)),
      finalIssues: validationIssues(validateWorkflowDraft(result.draft, context)),
    },
  };
}

export function finalizeWorkflowDraft(
  state: WorkflowDraftAuthoringState,
  expectedRevision: number,
  context?: WorkflowDraftValidationContext,
): WorkflowDraftAuthoringResult {
  const conflict = assertMutableRevision(state, expectedRevision);
  if (conflict) return rejectAuthoringOperation(state, conflict);
  const validation = validateWorkflowDraft(state.draft, context);
  if (!validation.ok) {
    return {
      ok: false,
      state: { ...state, lifecycle: 'constructing', finalizedRevision: undefined, finalIssues: validation.issues },
      error: validation.issues.map(issue => issue.message).join(' '),
      issues: validation.issues,
    };
  }
  return {
    ok: true,
    state: { ...state, lifecycle: 'ready', finalizedRevision: state.revision, checkpointIssues: [], finalIssues: [] },
  };
}

export function reserveWorkflowDraftSave(
  state: WorkflowDraftAuthoringState,
  expectedRevision: number,
  context?: WorkflowDraftValidationContext,
): WorkflowDraftAuthoringResult {
  if (
    state.lifecycle !== 'ready' ||
    state.finalizedRevision !== expectedRevision ||
    state.revision !== expectedRevision
  ) {
    return rejectAuthoringOperation(state, 'Workflow draft must be finalized before saving.');
  }
  const validation = validateWorkflowDraft(state.draft, context);
  if (!validation.ok) {
    return {
      ok: false,
      state: { ...state, lifecycle: 'constructing', finalizedRevision: undefined, finalIssues: validation.issues },
      error: validation.issues.map(issue => issue.message).join(' '),
      issues: validation.issues,
    };
  }
  if (state.savingRevision !== undefined) return rejectAuthoringOperation(state, 'Workflow save is in progress.');
  return { ok: true, state: { ...state, savingRevision: expectedRevision } };
}

export function releaseWorkflowDraftSave(
  state: WorkflowDraftAuthoringState,
  savingRevision: number,
): WorkflowDraftAuthoringState {
  return state.savingRevision === savingRevision ? { ...state, savingRevision: undefined } : state;
}
