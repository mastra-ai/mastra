import { createTool } from '@mastra/client-js';
import { normalizeWorkflowBuilderDefinition } from '@mastra/core/workflows/builder';
import type { WorkflowBuilderDefinition } from '@mastra/core/workflows/builder';
import type { ClientToolsInput } from '@mastra/react';
import { z } from 'zod-v4';

import type {
  WorkflowDraft,
  WorkflowDraftAuthoringResult,
  WorkflowDraftAuthoringState,
  WorkflowDraftMutation,
  WorkflowDraftStep,
  WorkflowDraftValidationIssue,
} from './workflow-draft';

type WorkflowPredicate = Extract<WorkflowDraftStep, { type: 'conditional' }>['predicates'][number];

const jsonSchema = z.record(z.string(), z.unknown());
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
const mappingStepInputSchema = z.object({
  type: z.literal('mapping'),
  id: z.string().min(1),
  mapConfig: z.union([z.string().min(1), jsonSchema]).optional(),
  output: jsonSchema.optional(),
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
const pathOrLiteralSchema = z.union([
  z.object({ path: z.string().min(1) }),
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
    z.object({ op: z.enum(['exists', 'notExists']), path: z.string().min(1) }),
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
export const workflowCandidateCheckpointInputSchema = z.object({
  candidateRevision: z.number().int().nonnegative(),
});
export const workflowCheckpointInputSchema = workflowDefinitionInputSchema;

export function parseWorkflowDefinitionInput(input: unknown): WorkflowBuilderDefinition {
  const normalized = normalizeWorkflowBuilderDefinition(input);
  workflowDefinitionInputSchema.parse(normalized);
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
  result: ReturnType<typeof toToolResult>;
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
  isCurrentGeneration?: () => boolean;
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
      : { success: false as const, error: result.error, ...(result.issues ? { issues: result.issues } : {}) };
    store.onResult?.({ toolId, result: toolResult });
    return toolResult;
  };

  const executeMutation = async (toolId: string, mutation: WorkflowDraftMutation) => {
    if (store.isCurrentGeneration?.() === false) return supersededResult;
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
    'checkpoint-workflow-draft': createTool({
      id: 'checkpoint-workflow-draft',
      description:
        'Atomically checkpoint one complete canonical workflow definition into the accepted unsaved Studio draft. Rejected checkpoints preserve both the accepted draft and the repairable generation candidate.',
      inputSchema: workflowCheckpointInputSchema,
      outputSchema: resultSchema,
      execute: async input => {
        if (store.isCurrentGeneration?.() === false) return supersededResult;
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
        return reportResult(store, 'checkpoint-workflow-draft', result);
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
        return reportResult(store, 'checkpoint-workflow-candidate', result);
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
