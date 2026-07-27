import { createTool } from '@mastra/client-js';
import {
  compareWorkflowBuilderSchemas,
  inspectWorkflowBuilderSchemas,
  normalizeWorkflowBuilderDefinition,
} from '@mastra/core/workflows/builder';
import type { WorkflowBuilderDefinition } from '@mastra/core/workflows/builder';
import type { ClientToolsInput } from '@mastra/react';
import { z } from 'zod-v4';

import type {
  WorkflowDraft,
  WorkflowDraftAuthoringResult,
  WorkflowDraftAuthoringState,
  WorkflowDraftMutation,
  WorkflowDraftStep,
  WorkflowDraftValidationContext,
  WorkflowDraftValidationIssue,
} from './workflow-draft';

type WorkflowPredicate = Extract<WorkflowDraftStep, { type: 'conditional' }>['predicates'][number];

const jsonSchema = z.record(z.string(), z.unknown());
const inspectionResultSchema = z.record(z.string(), z.unknown());
const catalogLookupInputSchema = z.object({ registryKey: z.string().min(1) });
const compatibleSourcesInputSchema = z.object({ targetStepId: z.string().min(1) });
const validationIssueInputSchema = z.object({ code: z.string().min(1), path: z.string().min(1) });

const resultSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  issues: z
    .array(
      z.object({
        code: z.string(),
        path: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
  lifecycle: z.enum(['untouched', 'constructing', 'ready']).optional(),
  revision: z.number().int().nonnegative().optional(),
  finalizedRevision: z.number().int().nonnegative().optional(),
  candidateRevision: z.number().int().nonnegative().optional(),
  baseAcceptedRevision: z.number().int().nonnegative().optional(),
});

const stepOptionsSchema = z
  .object({
    retries: z.number().int().nonnegative().optional(),
    metadata: jsonSchema.optional(),
  })
  .optional();
const agentStepSchema = z.object({
  type: z.literal('agent'),
  id: z.string().min(1),
  agentId: z.string().min(1),
  outputSchema: jsonSchema.optional(),
  options: stepOptionsSchema,
});
const agentStepInputSchema = z.object({
  type: z.literal('agent'),
  id: z.string().min(1),
  agentId: z.string().min(1).optional(),
  agent: z.string().min(1).optional(),
  outputSchema: jsonSchema.optional(),
  options: stepOptionsSchema,
});
const toolStepSchema = z.object({
  type: z.literal('tool'),
  id: z.string().min(1),
  toolId: z.string().min(1),
  options: stepOptionsSchema,
});
const mappingStepSchema = z.object({
  type: z.literal('mapping'),
  id: z.string().min(1),
  mapConfig: z.string().min(1),
});
const mappingDescriptorInputSchema = z.union([
  z.object({ value: z.unknown() }).strict(),
  z.object({ template: z.string().min(1) }).strict(),
  z.object({ requestContextPath: z.string().min(1) }).strict(),
  z.object({ initData: z.literal(true), path: z.string() }).strict(),
  z.object({ step: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]), path: z.string() }).strict(),
]);
const mappingConfigInputSchema = z.record(z.string(), mappingDescriptorInputSchema);
const mappingRepairInputSchema = z.object({
  targetStepId: z.string().min(1),
  mappingStepId: z.string().min(1),
  mapConfig: mappingConfigInputSchema,
});
const mappingSourceRepairInputSchema = z.object({
  mappingStepId: z.string().min(1),
  field: z.string().min(1),
  source: mappingDescriptorInputSchema,
});
const mappingStepInputSchema = z
  .object({
    type: z.literal('mapping'),
    id: z.string().min(1),
    mapConfig: mappingConfigInputSchema.optional(),
    output: mappingConfigInputSchema.optional(),
  })
  .refine(step => (step.mapConfig === undefined) !== (step.output === undefined), {
    message: 'Provide exactly one of mapConfig or output.',
  });
const nestedWorkflowStepSchema = z.object({
  type: z.literal('workflow'),
  id: z.string().min(1),
  workflowId: z.string().min(1),
  options: stepOptionsSchema,
});
const executableInnerStepSchema = z.union([agentStepSchema, toolStepSchema, nestedWorkflowStepSchema]);
const executableInnerStepInputSchema = z.union([agentStepInputSchema, toolStepSchema, nestedWorkflowStepSchema]);
const literalScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const predicatePathSchema = z
  .string()
  .regex(/^(initData|inputData|stepResults|state)(\.[A-Za-z0-9_-]+)*$/, 'Use a canonical predicate path root.');
const pathOrLiteralSchema = z.union([
  z.object({ path: predicatePathSchema }),
  z.object({ literal: literalScalarSchema }),
]);
const predicateSchema: z.ZodType<WorkflowPredicate> = z.lazy(() =>
  z.union([
    z.object({
      op: z.enum(['eq', 'ne', 'lt', 'lte', 'gt', 'gte']),
      left: pathOrLiteralSchema,
      right: pathOrLiteralSchema,
    }),
    z.object({ op: z.enum(['in', 'notIn']), value: pathOrLiteralSchema, set: z.array(literalScalarSchema).min(1) }),
    z.object({ op: z.enum(['exists', 'notExists']), path: predicatePathSchema }),
    z.object({ op: z.enum(['truthy', 'falsy']), value: pathOrLiteralSchema }),
    z.object({ op: z.enum(['and', 'or']), args: z.array(predicateSchema).min(1) }),
    z.object({ op: z.literal('not'), arg: predicateSchema }),
  ]),
);
const parallelStepSchema = z.object({ type: z.literal('parallel'), steps: z.array(executableInnerStepSchema).min(1) });
const parallelStepInputSchema = z.object({
  type: z.literal('parallel'),
  steps: z.array(executableInnerStepInputSchema).min(1),
});
const foreachStepSchema = z.object({
  type: z.literal('foreach'),
  step: executableInnerStepSchema,
  opts: z.object({ concurrency: z.number().int().positive() }).optional(),
});
const foreachStepInputSchema = z.object({
  type: z.literal('foreach'),
  step: executableInnerStepInputSchema,
  opts: z.object({ concurrency: z.number().int().positive() }).optional(),
});
const sleepStepSchema = z.object({
  type: z.literal('sleep'),
  id: z.string().min(1),
  duration: z.number().nonnegative(),
});
const sleepUntilStepSchema = z.object({
  type: z.literal('sleepUntil'),
  id: z.string().min(1),
  date: z.string().min(1),
});
const conditionalStepSchema = z.object({
  type: z.literal('conditional'),
  steps: z.array(executableInnerStepSchema).min(1),
  predicates: z.array(predicateSchema).min(1),
});
const conditionalStepInputSchema = z.object({
  type: z.literal('conditional'),
  steps: z.array(executableInnerStepInputSchema).min(1),
  predicates: z.array(predicateSchema).min(1),
});
const loopStepSchema = z.object({
  type: z.literal('loop'),
  step: executableInnerStepSchema,
  loopType: z.enum(['dowhile', 'dountil']),
  predicate: predicateSchema,
});
const loopStepInputSchema = z.object({
  type: z.literal('loop'),
  step: executableInnerStepInputSchema,
  loopType: z.enum(['dowhile', 'dountil']),
  predicate: predicateSchema,
});
const workflowStepSchema = z.discriminatedUnion('type', [
  agentStepSchema,
  toolStepSchema,
  mappingStepSchema,
  nestedWorkflowStepSchema,
  parallelStepSchema,
  foreachStepSchema,
  sleepStepSchema,
  sleepUntilStepSchema,
  conditionalStepSchema,
  loopStepSchema,
]);
const workflowStepInputSchema = z.discriminatedUnion('type', [
  agentStepInputSchema,
  toolStepSchema,
  mappingStepInputSchema,
  nestedWorkflowStepSchema,
  parallelStepInputSchema,
  foreachStepInputSchema,
  sleepStepSchema,
  sleepUntilStepSchema,
  conditionalStepInputSchema,
  loopStepInputSchema,
]);

export const workflowDefinitionInputSchema = z.object({
  id: z.string().min(1),
  description: z.string().optional(),
  inputSchema: jsonSchema,
  outputSchema: jsonSchema,
  stateSchema: jsonSchema.nullish(),
  requestContextSchema: jsonSchema.nullish(),
  graph: z.array(workflowStepInputSchema),
});
const normalizedWorkflowDefinitionSchema = workflowDefinitionInputSchema.extend({
  graph: z.array(workflowStepSchema),
});
export const workflowCandidateCheckpointInputSchema = z.object({
  candidateRevision: z.number().int().nonnegative(),
});
export const workflowCheckpointInputSchema = workflowDefinitionInputSchema;

export function parseWorkflowDefinitionInput(input: unknown): WorkflowBuilderDefinition {
  const normalized = normalizeWorkflowBuilderDefinition(input);
  normalizedWorkflowDefinitionSchema.parse(normalized);
  return normalized;
}

function parseWorkflowDraftInput(input: unknown): WorkflowDraft {
  const normalized = parseWorkflowDefinitionInput(input);
  return {
    id: normalized.id,
    description: normalized.description,
    inputSchema: normalized.inputSchema,
    outputSchema: normalized.outputSchema,
    stateSchema: normalized.stateSchema,
    requestContextSchema: normalized.requestContextSchema,
    graph: normalized.graph.map(step => workflowStepSchema.parse(step)),
  };
}

function normalizeWorkflowStep(step: unknown): unknown {
  if (!step || typeof step !== 'object' || !('type' in step)) return step;

  if (step.type === 'agent' && !('agentId' in step) && 'agent' in step && typeof step.agent === 'string') {
    return { ...step, agentId: step.agent };
  }

  if (step.type === 'mapping') {
    const mapConfig =
      'mapConfig' in step && step.mapConfig !== undefined
        ? step.mapConfig
        : 'output' in step && step.output !== undefined
          ? { output: step.output }
          : undefined;
    return {
      ...step,
      mapConfig:
        typeof mapConfig === 'string' ? mapConfig : mapConfig === undefined ? mapConfig : JSON.stringify(mapConfig),
    };
  }

  if ((step.type === 'parallel' || step.type === 'conditional') && 'steps' in step && Array.isArray(step.steps)) {
    return { ...step, steps: step.steps.map(normalizeWorkflowStep) };
  }

  if ((step.type === 'foreach' || step.type === 'loop') && 'step' in step) {
    return { ...step, step: normalizeWorkflowStep(step.step) };
  }

  return step;
}

function parseWorkflowStep(step: unknown) {
  return workflowStepSchema.safeParse(normalizeWorkflowStep(step));
}

export interface WorkflowDraftToolResult {
  toolId: string;
  result: z.infer<typeof resultSchema>;
}

export interface WorkflowDraftCandidate {
  draft: WorkflowDraft;
  revision: number;
  baseAcceptedRevision: number;
  issues: WorkflowDraftValidationIssue[];
  hasUncheckpointedChanges: boolean;
}

export function createWorkflowDraftCandidate(state: WorkflowDraftAuthoringState): WorkflowDraftCandidate {
  return {
    draft: structuredClone(state.draft),
    revision: 0,
    baseAcceptedRevision: state.revision,
    issues: [],
    hasUncheckpointedChanges: false,
  };
}

export interface WorkflowDraftToolStore {
  getState: () => WorkflowDraftAuthoringState;
  checkpoint: (expectedRevision: number, draft: WorkflowDraft) => WorkflowDraftAuthoringResult;
  finalize: (expectedRevision: number) => WorkflowDraftAuthoringResult;
  mutateCandidate: (
    state: WorkflowDraftAuthoringState,
    expectedRevision: number,
    mutation: WorkflowDraftMutation,
  ) => WorkflowDraftAuthoringResult;
  candidate?: WorkflowDraftCandidate;
  validationContext?: WorkflowDraftValidationContext;
  isCurrentGeneration?: () => boolean;
  getToolBlockReason?: (toolId: string) => string | undefined;
  autoFinalizeRepair?: boolean;
  onResult?: (event: WorkflowDraftToolResult) => void;
  onCandidateChange?: (candidate: WorkflowDraftCandidate) => void;
}

const supersededResult = { success: false as const, error: 'Submission was superseded.' };

function toToolResult(result: WorkflowDraftAuthoringResult) {
  if (!result.ok) {
    return { success: false as const, error: result.error, ...(result.issues ? { issues: result.issues } : {}) };
  }
  return {
    success: true as const,
    lifecycle: result.state.lifecycle,
    revision: result.state.revision,
    finalizedRevision: result.state.finalizedRevision,
  };
}

function reportResult(store: WorkflowDraftToolStore, toolId: string, result: WorkflowDraftAuthoringResult) {
  const toolResult = toToolResult(result);
  store.onResult?.({ toolId, result: toolResult });
  return toolResult;
}

function toCandidateAuthoringState(candidate: WorkflowDraftCandidate): WorkflowDraftAuthoringState {
  return {
    lifecycle: 'constructing',
    revision: candidate.revision,
    draft: candidate.draft,
    checkpointIssues: candidate.issues,
    finalIssues: candidate.issues,
  };
}

function catalogUnavailable(store: WorkflowDraftToolStore) {
  return !store.validationContext || store.validationContext.workflowCatalog === 'unavailable';
}

function lookupCatalogEntry(
  store: WorkflowDraftToolStore,
  catalog: keyof Pick<WorkflowDraftValidationContext, 'agents' | 'tools' | 'workflows'>,
  registryKey: string,
) {
  if (catalogUnavailable(store)) return { available: false, reason: 'catalog-unavailable' };
  const entry = store.validationContext?.[catalog]?.[registryKey];
  if (!entry) return { available: true, found: false, registryKey };
  return {
    available: true,
    found: true,
    registryKey,
    runtimeId: entry.runtimeId,
    inputSchema: entry.inputSchema,
    outputSchema: entry.outputSchema,
  };
}

function getStepId(step: WorkflowDraftStep): string | undefined {
  return 'id' in step ? step.id : undefined;
}

function findStep(draft: WorkflowDraft, targetStepId: string): WorkflowDraftStep | undefined {
  for (const step of draft.graph) {
    if (getStepId(step) === targetStepId) return step;
    if (step.type === 'parallel' || step.type === 'conditional') {
      const child = step.steps.find(candidate => candidate.id === targetStepId);
      if (child) return child;
    } else if ((step.type === 'foreach' || step.type === 'loop') && step.step.id === targetStepId) {
      return step.step;
    }
  }
  return undefined;
}

function getStepInputSchema(step: WorkflowDraftStep, context: WorkflowDraftValidationContext) {
  if (step.type === 'agent') return context.agents?.[step.agentId]?.inputSchema;
  if (step.type === 'tool') return context.tools?.[step.toolId]?.inputSchema;
  if (step.type === 'workflow') return context.workflows?.[step.workflowId]?.inputSchema;
  return undefined;
}

function findTopLevelStepIndex(draft: WorkflowDraft, targetStepId: string) {
  return draft.graph.findIndex(step => getStepId(step) === targetStepId);
}

function mappingStep(id: string, mapConfig: z.infer<typeof mappingConfigInputSchema>): WorkflowDraftStep {
  return { type: 'mapping', id, mapConfig: JSON.stringify(mapConfig) };
}

function orderedSourceIds(draft: WorkflowDraft, targetStepId: string) {
  const ids: string[] = [];
  for (const step of draft.graph) {
    if (getStepId(step) === targetStepId) return ids;
    if (step.type === 'parallel' || step.type === 'conditional') {
      for (const child of step.steps) {
        if (child.id === targetStepId) return ids;
        ids.push(child.id);
      }
    } else if (step.type === 'foreach' || step.type === 'loop') {
      if (step.step.id === targetStepId) return ids;
      ids.push(step.step.id);
    }
    const id = getStepId(step);
    if (id) ids.push(id);
  }
  return ids;
}

export function createWorkflowDraftTools(store: WorkflowDraftToolStore): ClientToolsInput {
  const candidate = store.candidate ?? createWorkflowDraftCandidate(store.getState());

  const publishCandidate = () => {
    store.onCandidateChange?.({
      ...candidate,
      draft: structuredClone(candidate.draft),
      issues: [...candidate.issues],
    });
  };

  const reportCandidateResult = (toolId: string, result: WorkflowDraftAuthoringResult) => {
    const acceptedState = store.getState();
    const toolResult = result.ok
      ? {
          success: true as const,
          lifecycle: result.state.lifecycle,
          revision: acceptedState.revision,
          finalizedRevision: acceptedState.finalizedRevision,
          candidateRevision: candidate.revision,
          baseAcceptedRevision: candidate.baseAcceptedRevision,
        }
      : {
          success: false as const,
          error: result.error,
          ...(result.issues ? { issues: result.issues } : {}),
          candidateRevision: candidate.revision,
          baseAcceptedRevision: candidate.baseAcceptedRevision,
        };
    store.onResult?.({ toolId, result: toolResult });
    return toolResult;
  };

  const blockedResult = (toolId: string) => {
    const error = store.getToolBlockReason?.(toolId);
    if (!error) return undefined;
    const result = { success: false as const, error };
    store.onResult?.({ toolId, result });
    return result;
  };

  const executeMutation = async (toolId: string, mutation: WorkflowDraftMutation) => {
    if (store.isCurrentGeneration?.() === false) return supersededResult;
    const blocked = blockedResult(toolId);
    if (blocked) return blocked;
    const result = store.mutateCandidate(toCandidateAuthoringState(candidate), candidate.revision, mutation);
    if (result.ok) {
      candidate.draft = result.state.draft;
      candidate.revision = result.state.revision;
      candidate.issues = result.state.finalIssues;
      candidate.hasUncheckpointedChanges = true;
    } else {
      candidate.issues = result.issues ?? [];
    }
    publishCandidate();
    if (store.isCurrentGeneration?.() === false) return supersededResult;
    return reportCandidateResult(toolId, result);
  };

  return {
    'get-tool-schema': createTool({
      id: 'get-tool-schema',
      description: 'Inspect the authoritative registered tool identity and normalized input/output JSON Schemas.',
      inputSchema: catalogLookupInputSchema,
      outputSchema: inspectionResultSchema,
      execute: async ({ registryKey }) => lookupCatalogEntry(store, 'tools', registryKey),
    }),
    'get-agent-schema': createTool({
      id: 'get-agent-schema',
      description: 'Inspect the authoritative registered agent identity and normalized input/output JSON Schemas.',
      inputSchema: catalogLookupInputSchema,
      outputSchema: inspectionResultSchema,
      execute: async ({ registryKey }) => lookupCatalogEntry(store, 'agents', registryKey),
    }),
    'get-workflow-schema': createTool({
      id: 'get-workflow-schema',
      description: 'Inspect the authoritative registered workflow identity and normalized input/output JSON Schemas.',
      inputSchema: catalogLookupInputSchema,
      outputSchema: inspectionResultSchema,
      execute: async ({ registryKey }) => lookupCatalogEntry(store, 'workflows', registryKey),
    }),
    'list-compatible-sources': createTool({
      id: 'list-compatible-sources',
      description:
        'List initData and preceding runtime-visible step results in workflow order, with canonical compatible, incompatible, or unknown schema status for a target step input.',
      inputSchema: compatibleSourcesInputSchema,
      outputSchema: inspectionResultSchema,
      execute: async ({ targetStepId }) => {
        if (catalogUnavailable(store)) return { available: false, reason: 'catalog-unavailable' };
        const context = store.validationContext;
        if (!context) return { available: false, reason: 'catalog-unavailable' };
        const draft = candidate.draft;
        const target = findStep(draft, targetStepId);
        if (!target) return { available: true, found: false, targetStepId, sources: [] };
        const targetInputSchema = getStepInputSchema(target, context);
        const inspection = inspectWorkflowBuilderSchemas(normalizeWorkflowBuilderDefinition(draft), context);
        const sources = [
          {
            source: 'initData',
            schema: draft.inputSchema,
            compatibility: compareWorkflowBuilderSchemas(draft.inputSchema, targetInputSchema),
          },
          ...orderedSourceIds(draft, targetStepId).map(stepId => {
            const schema = inspection.stepOutputs.get(stepId);
            return {
              source: 'step',
              stepId,
              schema,
              compatibility: compareWorkflowBuilderSchemas(schema, targetInputSchema),
            };
          }),
        ];
        return { available: true, found: true, targetStepId, targetInputSchema, sources };
      },
    }),
    'explain-validation-issue': createTool({
      id: 'explain-validation-issue',
      description: 'Return the current authoritative validation issue matching a canonical issue code and path.',
      inputSchema: validationIssueInputSchema,
      outputSchema: inspectionResultSchema,
      execute: async ({ code, path }) => {
        if (catalogUnavailable(store)) return { available: false, reason: 'catalog-unavailable' };
        const issue = candidate.issues.find(
          candidateIssue => candidateIssue.code === code && candidateIssue.path === path,
        );
        return issue ? { available: true, found: true, issue } : { available: true, found: false, code, path };
      },
    }),
    'checkpoint-workflow-draft': createTool({
      id: 'checkpoint-workflow-draft',
      description:
        'Atomically checkpoint one complete canonical workflow definition into the accepted unsaved Studio draft. Rejected checkpoints preserve both the accepted draft and the repairable generation candidate.',
      inputSchema: workflowCheckpointInputSchema,
      outputSchema: resultSchema,
      execute: async input => {
        if (store.isCurrentGeneration?.() === false) return supersededResult;
        const blocked = blockedResult('checkpoint-workflow-draft');
        if (blocked) return blocked;
        candidate.draft = parseWorkflowDraftInput(input);
        candidate.revision += 1;
        candidate.issues = [];
        candidate.hasUncheckpointedChanges = true;
        publishCandidate();
        const result = store.checkpoint(candidate.baseAcceptedRevision, candidate.draft);
        if (result.ok) {
          candidate.draft = structuredClone(result.state.draft);
          candidate.revision = 0;
          candidate.baseAcceptedRevision = result.state.revision;
          candidate.issues = [];
          candidate.hasUncheckpointedChanges = false;
        } else {
          candidate.issues = result.issues ?? [];
        }
        publishCandidate();
        if (store.isCurrentGeneration?.() === false) return supersededResult;
        return result.ok
          ? reportResult(store, 'checkpoint-workflow-draft', result)
          : reportCandidateResult('checkpoint-workflow-draft', result);
      },
    }),
    'checkpoint-workflow-candidate': createTool({
      id: 'checkpoint-workflow-candidate',
      description:
        'Atomically checkpoint the current generation-local candidate into the accepted unsaved Studio draft. Pass the exact candidate revision returned by the latest candidate mutation.',
      inputSchema: workflowCandidateCheckpointInputSchema,
      outputSchema: resultSchema,
      execute: async ({ candidateRevision }) => {
        if (store.isCurrentGeneration?.() === false) return supersededResult;
        const blocked = blockedResult('checkpoint-workflow-candidate');
        if (blocked) return blocked;
        if (candidateRevision !== candidate.revision) {
          return reportCandidateResult('checkpoint-workflow-candidate', {
            ok: false,
            state: store.getState(),
            error: 'Generation candidate changed before checkpoint completed.',
          });
        }
        const result = store.checkpoint(candidate.baseAcceptedRevision, candidate.draft);
        if (result.ok) {
          candidate.draft = structuredClone(result.state.draft);
          candidate.revision = 0;
          candidate.baseAcceptedRevision = result.state.revision;
          candidate.issues = [];
          candidate.hasUncheckpointedChanges = false;
        } else {
          candidate.issues = result.issues ?? [];
        }
        publishCandidate();
        if (store.isCurrentGeneration?.() === false) return supersededResult;
        if (result.ok && store.autoFinalizeRepair) {
          await Promise.resolve();
          if (store.isCurrentGeneration?.() === false) return supersededResult;
          const finalized = store.finalize(result.state.revision);
          if (!finalized.ok) {
            candidate.issues = finalized.issues ?? [];
            publishCandidate();
          }
          if (store.isCurrentGeneration?.() === false) return supersededResult;
          return reportResult(store, 'checkpoint-workflow-candidate', finalized);
        }
        return result.ok
          ? reportResult(store, 'checkpoint-workflow-candidate', result)
          : reportCandidateResult('checkpoint-workflow-candidate', result);
      },
    }),
    'finalize-workflow-draft': createTool({
      id: 'finalize-workflow-draft',
      description:
        'Strictly finalize the exact accepted draft revision after a successful checkpoint. A changed generation candidate must be checkpointed first. Finalization only marks the unsaved draft ready for explicit user Save; it does not persist.',
      inputSchema: z.object({ expectedRevision: z.number().int().nonnegative() }),
      outputSchema: resultSchema,
      execute: async ({ expectedRevision }: { expectedRevision: number }) => {
        if (store.isCurrentGeneration?.() === false) return supersededResult;
        const blocked = blockedResult('finalize-workflow-draft');
        if (blocked) return blocked;
        if (candidate.hasUncheckpointedChanges) {
          const error = 'Checkpoint the current generation candidate before finalizing.';
          const result = { ok: false as const, state: store.getState(), error };
          return reportResult(store, 'finalize-workflow-draft', result);
        }
        const result = store.finalize(expectedRevision);
        if (store.isCurrentGeneration?.() === false) return supersededResult;
        return reportResult(store, 'finalize-workflow-draft', result);
      },
    }),
    'insert-workflow-mapping-before': createTool({
      id: 'insert-workflow-mapping-before',
      description: 'Insert a canonical typed mapping immediately before a top-level target step.',
      inputSchema: mappingRepairInputSchema,
      outputSchema: resultSchema,
      execute: async ({ targetStepId, mappingStepId, mapConfig }) => {
        const index = findTopLevelStepIndex(candidate.draft, targetStepId);
        if (index < 0) return { success: false, error: `Top-level step "${targetStepId}" does not exist.` };
        return executeMutation('insert-workflow-mapping-before', {
          type: 'add-step',
          step: mappingStep(mappingStepId, mapConfig),
          index,
        });
      },
    }),
    'insert-workflow-mapping-after': createTool({
      id: 'insert-workflow-mapping-after',
      description: 'Insert a canonical typed mapping immediately after a top-level target step.',
      inputSchema: mappingRepairInputSchema,
      outputSchema: resultSchema,
      execute: async ({ targetStepId, mappingStepId, mapConfig }) => {
        const index = findTopLevelStepIndex(candidate.draft, targetStepId);
        if (index < 0) return { success: false, error: `Top-level step "${targetStepId}" does not exist.` };
        return executeMutation('insert-workflow-mapping-after', {
          type: 'add-step',
          step: mappingStep(mappingStepId, mapConfig),
          index: index + 1,
        });
      },
    }),
    'set-workflow-mapping-source': createTool({
      id: 'set-workflow-mapping-source',
      description: 'Set one output field on an existing top-level mapping using exactly one canonical typed source.',
      inputSchema: mappingSourceRepairInputSchema,
      outputSchema: resultSchema,
      execute: async ({ mappingStepId, field, source }) => {
        const existing = candidate.draft.graph.find(
          (step): step is Extract<WorkflowDraftStep, { type: 'mapping' }> =>
            step.type === 'mapping' && step.id === mappingStepId,
        );
        if (!existing) return { success: false, error: `Top-level mapping "${mappingStepId}" does not exist.` };
        let config: unknown;
        try {
          config = JSON.parse(existing.mapConfig);
        } catch {
          return { success: false, error: `Mapping "${mappingStepId}" does not contain valid JSON.` };
        }
        const parsed = mappingConfigInputSchema.safeParse(config);
        if (!parsed.success) return { success: false, error: z.prettifyError(parsed.error) };
        return executeMutation('set-workflow-mapping-source', {
          type: 'update-step',
          stepId: mappingStepId,
          step: mappingStep(mappingStepId, { ...parsed.data, [field]: source }),
        });
      },
    }),
    'set-workflow-predicate': createTool({
      id: 'set-workflow-predicate',
      description: 'Replace the predicate for a conditional branch or loop body using canonical rooted operands.',
      inputSchema: z.object({ targetStepId: z.string().min(1), predicate: predicateSchema }),
      outputSchema: resultSchema,
      execute: async ({ targetStepId, predicate }) =>
        executeMutation('set-workflow-predicate', { type: 'set-predicate', targetStepId, predicate }),
    }),
    'add-workflow-step': createTool({
      id: 'add-workflow-step',
      description:
        'Add one supported step to the generation-local candidate. The accepted Studio draft is unchanged until the candidate passes checkpoint validation.',
      inputSchema: z.object({ step: workflowStepInputSchema, index: z.number().int().nonnegative().optional() }),
      outputSchema: resultSchema,
      execute: async ({ step, index }) => {
        const parsedStep = parseWorkflowStep(step);
        if (!parsedStep.success) return { success: false, error: z.prettifyError(parsedStep.error) };
        return executeMutation('add-workflow-step', { type: 'add-step', step: parsedStep.data, index });
      },
    }),
    'update-workflow-step': createTool({
      id: 'update-workflow-step',
      description:
        'Replace one step in the generation-local candidate. The accepted Studio draft is unchanged until the candidate passes checkpoint validation.',
      inputSchema: z.object({ stepId: z.string().min(1), step: workflowStepInputSchema }),
      outputSchema: resultSchema,
      execute: async ({ stepId, step }) => {
        const parsedStep = parseWorkflowStep(step);
        if (!parsedStep.success) return { success: false, error: z.prettifyError(parsedStep.error) };
        return executeMutation('update-workflow-step', { type: 'update-step', stepId, step: parsedStep.data });
      },
    }),
    'remove-workflow-step': createTool({
      id: 'remove-workflow-step',
      description:
        'Remove one step from the generation-local candidate. The accepted Studio draft is unchanged until the candidate passes checkpoint validation.',
      inputSchema: z.object({ stepId: z.string().min(1) }),
      outputSchema: resultSchema,
      execute: async ({ stepId }: { stepId: string }) =>
        executeMutation('remove-workflow-step', { type: 'remove-step', stepId }),
    }),
  };
}
