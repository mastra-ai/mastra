import type { UpsertStoredWorkflowParams } from '@mastra/client-js';

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

export type WorkflowDraftValidationIssueCode =
  | 'invalid-workflow-id'
  | 'invalid-schema'
  | 'empty-graph'
  | 'missing-step-id'
  | 'duplicate-step-id'
  | 'missing-reference'
  | 'invalid-map-config'
  | 'invalid-parallel'
  | 'invalid-foreach'
  | 'invalid-duration'
  | 'invalid-date'
  | 'invalid-conditional'
  | 'invalid-loop'
  | 'workflow-catalog-unavailable'
  | 'incompatible-schema'
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

const agentInputSchema = {
  type: 'object',
  properties: { prompt: { type: 'string' } },
  required: ['prompt'],
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

type SchemaCompatibility = 'compatible' | 'incompatible' | 'unknown';

function schemaCompatibility(source: unknown, destination: unknown): SchemaCompatibility {
  if (!isRecord(source) || !isRecord(destination)) return 'unknown';
  const sourceType = typeof source.type === 'string' ? source.type : undefined;
  const destinationType = typeof destination.type === 'string' ? destination.type : undefined;
  if (!sourceType || !destinationType) return 'unknown';
  if (sourceType !== destinationType) return 'incompatible';

  if (destinationType === 'array') return schemaCompatibility(source.items, destination.items);
  if (destinationType !== 'object') return 'compatible';

  const sourceProperties = isRecord(source.properties) ? source.properties : {};
  const destinationProperties = isRecord(destination.properties) ? destination.properties : {};
  const required = Array.isArray(destination.required)
    ? destination.required.filter((key): key is string => typeof key === 'string')
    : [];

  for (const key of required) {
    if (!(key in sourceProperties)) return 'incompatible';
  }
  for (const [key, destinationProperty] of Object.entries(destinationProperties)) {
    if (!(key in sourceProperties)) continue;
    if (schemaCompatibility(sourceProperties[key], destinationProperty) === 'incompatible') return 'incompatible';
  }
  return 'compatible';
}

function isValidMappingTemplate(template: string): boolean {
  for (const match of template.matchAll(/\$\{([^}]*)\}/g)) {
    const expression = match[1] ?? '';
    if (!expression || expression !== expression.trim()) return false;
    const [scope, ...path] = expression.split('.');
    if (scope === 'stepResults') {
      if (!path[0]) return false;
      continue;
    }
    if (scope === 'requestContext') {
      if (path.length === 0) return false;
      continue;
    }
    if (!['inputData', 'initData', 'state'].includes(scope)) return false;
  }
  return true;
}

function isValidMappingSource(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if ('value' in value) return true;
  if (typeof value.template === 'string') return isValidMappingTemplate(value.template);
  if (typeof value.requestContextPath === 'string' && value.requestContextPath.length > 0) return true;
  if (typeof value.path !== 'string') return false;
  if (value.initData === true) return true;
  if (typeof value.step === 'string' && value.step.length > 0) return true;
  return Array.isArray(value.step) && value.step.length > 0 && value.step.every(step => typeof step === 'string');
}

function mappingOutputSchema(
  step: Extract<WorkflowDraftStep, { type: 'mapping' }>,
  path?: string,
  issues?: WorkflowDraftValidationIssue[],
): JsonSchema | undefined {
  try {
    const config: unknown = JSON.parse(step.mapConfig);
    if (!isRecord(config)) return undefined;
    for (const [key, source] of Object.entries(config)) {
      if (isValidMappingSource(source)) continue;
      issues?.push({
        code: 'invalid-map-config',
        path: `${path}.${key}`,
        message:
          'Mapping entries must use value, template, requestContextPath, or a step/initData source with a path. Expressions are not supported.',
      });
    }
    return {
      type: 'object',
      properties: Object.fromEntries(Object.keys(config).map(key => [key, {}])),
      required: Object.keys(config),
    };
  } catch {
    return undefined;
  }
}

function getStepInputSchema(step: WorkflowDraftStep, context?: WorkflowDraftValidationContext): JsonSchema | undefined {
  switch (step.type) {
    case 'agent':
      return context?.agents ? (context.agents[step.agentId]?.inputSchema ?? agentInputSchema) : undefined;
    case 'tool':
      return context?.tools?.[step.toolId]?.inputSchema;
    case 'workflow':
      return context?.workflows?.[step.workflowId]?.inputSchema;
    case 'foreach':
      return { type: 'array', items: getStepInputSchema(step.step, context) ?? {} };
    case 'loop':
      return getStepInputSchema(step.step, context);
    default:
      return undefined;
  }
}

function getStepOutputSchema(
  step: WorkflowDraftStep,
  context?: WorkflowDraftValidationContext,
): JsonSchema | undefined {
  switch (step.type) {
    case 'agent':
      return step.outputSchema ?? context?.agents?.[step.agentId]?.outputSchema;
    case 'tool':
      return context?.tools?.[step.toolId]?.outputSchema;
    case 'workflow':
      return context?.workflows?.[step.workflowId]?.outputSchema;
    case 'mapping':
      return mappingOutputSchema(step);
    case 'foreach': {
      const itemSchema = getStepOutputSchema(step.step, context);
      return itemSchema ? { type: 'array', items: itemSchema } : undefined;
    }
    case 'loop':
      return getStepOutputSchema(step.step, context);
    default:
      return undefined;
  }
}

function validateStep(
  step: WorkflowDraftStep,
  path: string,
  seenIds: Set<string>,
  issues: WorkflowDraftValidationIssue[],
  context?: WorkflowDraftValidationContext,
): void {
  if ('id' in step) {
    if (step.id.trim().length === 0) {
      issues.push({ code: 'missing-step-id', path: `${path}.id`, message: 'Step id is required.' });
    } else if (seenIds.has(step.id)) {
      issues.push({ code: 'duplicate-step-id', path: `${path}.id`, message: `Step id "${step.id}" is duplicated.` });
    } else {
      seenIds.add(step.id);
    }
  }

  switch (step.type) {
    case 'agent':
      if (step.agentId.trim().length === 0 || (context?.agents && !context.agents[step.agentId])) {
        issues.push({
          code: 'missing-reference',
          path: `${path}.agentId`,
          message: `Agent "${step.agentId}" is unavailable.`,
        });
      }
      return;
    case 'tool':
      if (step.toolId.trim().length === 0 || (context?.tools && !context.tools[step.toolId])) {
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
      } else if (step.workflowId.trim().length === 0 || (context?.workflows && !context.workflows[step.workflowId])) {
        issues.push({
          code: 'missing-reference',
          path: `${path}.workflowId`,
          message: `Workflow "${step.workflowId}" is unavailable.`,
        });
      }
      return;
    case 'mapping':
      if (!mappingOutputSchema(step, `${path}.mapConfig`, issues)) {
        issues.push({
          code: 'invalid-map-config',
          path: `${path}.mapConfig`,
          message: 'Mapping config must be a JSON object.',
        });
      }
      return;
    case 'parallel':
      if (step.steps.length === 0) {
        issues.push({ code: 'invalid-parallel', path: `${path}.steps`, message: 'Parallel steps cannot be empty.' });
      }
      step.steps.forEach((child, index) => {
        if (child.type === 'mapping') {
          issues.push({
            code: 'invalid-map-config',
            path: `${path}.steps.${index}`,
            message: 'Persisted mapping steps must be top-level workflow entries.',
          });
        }
        validateStep(child, `${path}.steps.${index}`, seenIds, issues, context);
      });
      return;
    case 'foreach':
      if (step.opts?.concurrency !== undefined && step.opts.concurrency < 1) {
        issues.push({
          code: 'invalid-foreach',
          path: `${path}.opts.concurrency`,
          message: 'Concurrency must be positive.',
        });
      }
      validateStep(step.step, `${path}.step`, seenIds, issues, context);
      return;
    case 'conditional':
      if (step.steps.length === 0 || step.steps.length !== step.predicates.length) {
        issues.push({
          code: 'invalid-conditional',
          path,
          message: 'Conditional steps and predicates must be non-empty and aligned.',
        });
      }
      step.steps.forEach((child, index) => {
        if (child.type === 'mapping') {
          issues.push({
            code: 'invalid-map-config',
            path: `${path}.steps.${index}`,
            message: 'Persisted mapping steps must be top-level workflow entries.',
          });
        }
        validateStep(child, `${path}.steps.${index}`, seenIds, issues, context);
      });
      return;
    case 'loop':
      if (step.loopType !== 'dowhile' && step.loopType !== 'dountil') {
        issues.push({ code: 'invalid-loop', path: `${path}.loopType`, message: 'Loop type is invalid.' });
      }
      if (step.step.type === 'mapping') {
        issues.push({
          code: 'invalid-map-config',
          path: `${path}.step`,
          message: 'Persisted mapping steps must be top-level workflow entries.',
        });
      }
      validateStep(step.step, `${path}.step`, seenIds, issues, context);
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
  }
}

function incompatibleSchemaIssue(issues: WorkflowDraftValidationIssue[], path: string, message: string): void {
  issues.push({ code: 'incompatible-schema', path, message });
}

function childOutputProperties(
  steps: Extract<WorkflowDraftStep, { type: 'parallel' | 'conditional' }>['steps'],
  context?: WorkflowDraftValidationContext,
): Record<string, JsonSchema> | undefined {
  const properties: Record<string, JsonSchema> = {};
  for (const child of steps) {
    const output = getStepOutputSchema(child, context);
    if (!output) return undefined;
    properties[child.id] = output;
  }
  return properties;
}

function validateStepSchemaFlow(
  step: WorkflowDraftStep,
  inputSchema: JsonSchema | undefined,
  path: string,
  issues: WorkflowDraftValidationIssue[],
  context?: WorkflowDraftValidationContext,
): JsonSchema | undefined {
  switch (step.type) {
    case 'mapping':
      return getStepOutputSchema(step, context);
    case 'sleep':
    case 'sleepUntil':
      return inputSchema;
    case 'parallel': {
      step.steps.forEach((child, index) => {
        validateStepSchemaFlow(child, inputSchema, `${path}.steps.${index}`, issues, context);
      });
      const properties = childOutputProperties(step.steps, context);
      return properties ? { type: 'object', properties, required: Object.keys(properties) } : undefined;
    }
    case 'conditional': {
      step.steps.forEach((child, index) => {
        validateStepSchemaFlow(child, inputSchema, `${path}.steps.${index}`, issues, context);
      });
      const properties = childOutputProperties(step.steps, context);
      return properties ? { type: 'object', properties } : undefined;
    }
    case 'foreach': {
      const itemSchema =
        isRecord(inputSchema) && inputSchema.type === 'array' && isRecord(inputSchema.items)
          ? inputSchema.items
          : undefined;
      if (isRecord(inputSchema) && typeof inputSchema.type === 'string' && inputSchema.type !== 'array') {
        incompatibleSchemaIssue(issues, path, 'Foreach input must be an array. Insert or update a mapping step.');
      }
      const itemOutput = validateStepSchemaFlow(step.step, itemSchema, `${path}.step`, issues, context);
      return itemOutput ? { type: 'array', items: itemOutput } : undefined;
    }
    case 'loop': {
      const output = validateStepSchemaFlow(step.step, inputSchema, `${path}.step`, issues, context);
      const destination = getStepInputSchema(step.step, context);
      if (schemaCompatibility(output, destination) === 'incompatible') {
        incompatibleSchemaIssue(
          issues,
          `${path}.step`,
          'Loop step output is incompatible with its input for a subsequent iteration.',
        );
      }
      return output;
    }
    default: {
      const destination = getStepInputSchema(step, context);
      if (schemaCompatibility(inputSchema, destination) === 'incompatible') {
        const label =
          path.startsWith('graph.') && !path.includes('.steps.') && !path.endsWith('.step')
            ? `Step ${path.slice('graph.'.length)} input is incompatible with ${path === 'graph.0' ? 'the workflow input' : 'the previous step output'}. Insert or update a mapping step.`
            : 'Step input is incompatible with the containing flow input. Insert a top-level mapping step or use a nested workflow to shape the input.';
        incompatibleSchemaIssue(issues, path, label);
      }
      return getStepOutputSchema(step, context);
    }
  }
}

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
  if (draft.graph.length === 0) {
    issues.push({ code: 'empty-graph', path: 'graph', message: 'Workflow graph must contain at least one step.' });
  }

  const seenIds = new Set<string>();
  draft.graph.forEach((step, index) => validateStep(step, `graph.${index}`, seenIds, issues, context));

  let currentSchema: JsonSchema | undefined = draft.inputSchema;
  draft.graph.forEach((step, index) => {
    currentSchema = validateStepSchemaFlow(step, currentSchema, `graph.${index}`, issues, context);
  });
  if (schemaCompatibility(currentSchema, draft.outputSchema) === 'incompatible') {
    incompatibleSchemaIssue(
      issues,
      'outputSchema',
      'Workflow output schema is incompatible with the final step output. Add a top-level mapping step or update the output schema.',
    );
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

const issueKey = (issue: WorkflowDraftValidationIssue): string => `${issue.code}:${issue.path}`;

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
