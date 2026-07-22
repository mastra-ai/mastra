import { createTool } from '@mastra/client-js';
import { normalizeWorkflowBuilderDefinition } from '@mastra/core/workflows/builder';
import type { WorkflowBuilderDefinition } from '@mastra/core/workflows/builder';
import type { ClientToolsInput } from '@mastra/react';
import { z } from 'zod-v4';

import { applyWorkflowDraftMutation } from './workflow-draft';
import type {
  WorkflowDraft,
  WorkflowDraftMutation,
  WorkflowDraftStep,
  WorkflowDraftValidationContext,
} from './workflow-draft';

type WorkflowPredicate = Extract<WorkflowDraftStep, { type: 'conditional' }>['predicates'][number];

const jsonSchema = z.record(z.string(), z.unknown());
const resultSchema = z.object({ success: z.boolean(), error: z.string().optional() });

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
const singleStepSchema = z.union([agentStepSchema, toolStepSchema, mappingStepSchema, nestedWorkflowStepSchema]);
const singleStepInputSchema = z.union([
  agentStepInputSchema,
  toolStepSchema,
  mappingStepInputSchema,
  nestedWorkflowStepSchema,
]);
const foreachInnerStepSchema = z.union([agentStepSchema, toolStepSchema, nestedWorkflowStepSchema]);
const foreachInnerStepInputSchema = z.union([agentStepInputSchema, toolStepSchema, nestedWorkflowStepSchema]);
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
const parallelStepSchema = z.object({ type: z.literal('parallel'), steps: z.array(singleStepSchema).min(1) });
const parallelStepInputSchema = z.object({ type: z.literal('parallel'), steps: z.array(singleStepInputSchema).min(1) });
const foreachStepSchema = z.object({
  type: z.literal('foreach'),
  step: foreachInnerStepSchema,
  opts: z.object({ concurrency: z.number().int().positive() }).optional(),
});
const foreachStepInputSchema = z.object({
  type: z.literal('foreach'),
  step: foreachInnerStepInputSchema,
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
  steps: z.array(singleStepSchema).min(1),
  predicates: z.array(predicateSchema).min(1),
});
const conditionalStepInputSchema = z.object({
  type: z.literal('conditional'),
  steps: z.array(singleStepInputSchema).min(1),
  predicates: z.array(predicateSchema).min(1),
});
const loopStepSchema = z.object({
  type: z.literal('loop'),
  step: singleStepSchema,
  loopType: z.enum(['dowhile', 'dountil']),
  predicate: predicateSchema,
});
const loopStepInputSchema = z.object({
  type: z.literal('loop'),
  step: singleStepInputSchema,
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

export function parseWorkflowDefinitionInput(input: unknown): WorkflowBuilderDefinition {
  const normalized = normalizeWorkflowBuilderDefinition(input);
  workflowDefinitionInputSchema.parse(normalized);
  return normalized;
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

  if (step.type === 'parallel' && 'steps' in step && Array.isArray(step.steps)) {
    return { ...step, steps: step.steps.map(normalizeWorkflowStep) };
  }

  return step;
}

function parseWorkflowStep(step: unknown) {
  return workflowStepSchema.safeParse(normalizeWorkflowStep(step));
}

export interface WorkflowDraftToolStore {
  getDraft: () => WorkflowDraft;
  setDraft: (draft: WorkflowDraft) => void;
  validationContext?: WorkflowDraftValidationContext;
  isCurrentGeneration?: () => boolean;
}

function createMutationExecutor(store: WorkflowDraftToolStore) {
  return async (mutation: WorkflowDraftMutation) => {
    if (store.isCurrentGeneration?.() === false) {
      return { success: false, error: 'This workflow-builder submission was superseded.' };
    }
    const result = applyWorkflowDraftMutation(store.getDraft(), mutation, store.validationContext);
    if (!result.ok) return { success: false, error: result.issues.map(issue => issue.message).join(' ') };
    if (store.isCurrentGeneration?.() === false) {
      return { success: false, error: 'This workflow-builder submission was superseded.' };
    }
    store.setDraft(result.draft);
    return { success: true };
  };
}

export function createWorkflowDraftTools(store: WorkflowDraftToolStore): ClientToolsInput {
  const executeMutation = createMutationExecutor(store);

  return {
    'set-workflow-identity': createTool({
      id: 'set-workflow-identity',
      description: 'Set the persisted workflow id and human-readable description.',
      inputSchema: z.object({ id: z.string().min(1), description: z.string().optional() }),
      outputSchema: resultSchema,
      execute: async ({ id, description }: { id: string; description?: string }) =>
        executeMutation({ type: 'set-identity', id, description }),
    }),
    'set-workflow-schemas': createTool({
      id: 'set-workflow-schemas',
      description: 'Set JSON schemas for workflow input, output, state, and request context.',
      inputSchema: z.object({
        inputSchema: jsonSchema,
        outputSchema: jsonSchema,
        stateSchema: jsonSchema.nullish(),
        requestContextSchema: jsonSchema.nullish(),
      }),
      outputSchema: resultSchema,
      execute: async (input: {
        inputSchema: WorkflowDraft['inputSchema'];
        outputSchema: WorkflowDraft['outputSchema'];
        stateSchema?: WorkflowDraft['stateSchema'] | null;
        requestContextSchema?: WorkflowDraft['requestContextSchema'] | null;
      }) =>
        executeMutation({
          type: 'set-schemas',
          ...input,
          stateSchema: input.stateSchema ?? undefined,
          requestContextSchema: input.requestContextSchema ?? undefined,
        }),
    }),
    'add-workflow-step': createTool({
      id: 'add-workflow-step',
      description:
        'Add one supported static workflow step. Agent steps must use { type: "agent", id, agentId }; use agentId, never agent. Tool steps must use { type: "tool", id, toolId }. Also supports mapping, parallel, foreach, sleep, and sleepUntil.',
      inputSchema: z.object({ step: workflowStepInputSchema, index: z.number().int().nonnegative().optional() }),
      outputSchema: resultSchema,
      execute: async ({ step, index }) => {
        const parsedStep = parseWorkflowStep(step);
        if (!parsedStep.success) return { success: false, error: z.prettifyError(parsedStep.error) };
        return executeMutation({ type: 'add-step', step: parsedStep.data, index });
      },
    }),
    'update-workflow-step': createTool({
      id: 'update-workflow-step',
      description:
        'Update an existing workflow step by id. Agent steps must use agentId, never agent; tool steps must use toolId.',
      inputSchema: z.object({ stepId: z.string().min(1), step: workflowStepInputSchema }),
      outputSchema: resultSchema,
      execute: async ({ stepId, step }) => {
        const parsedStep = parseWorkflowStep(step);
        if (!parsedStep.success) return { success: false, error: z.prettifyError(parsedStep.error) };
        return executeMutation({ type: 'update-step', stepId, step: parsedStep.data });
      },
    }),
    'remove-workflow-step': createTool({
      id: 'remove-workflow-step',
      description: 'Remove an existing workflow step by id.',
      inputSchema: z.object({ stepId: z.string().min(1) }),
      outputSchema: resultSchema,
      execute: async ({ stepId }: { stepId: string }) => executeMutation({ type: 'remove-step', stepId }),
    }),
  };
}
