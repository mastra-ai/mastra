import { createTool } from '@mastra/client-js';
import type { ClientToolsInput } from '@mastra/react';
import { z } from 'zod-v4';

import { applyWorkflowDraftMutation } from './workflow-draft';
import type { WorkflowDraft, WorkflowDraftMutation, WorkflowDraftValidationContext } from './workflow-draft';

const jsonSchema = z.record(z.string(), z.unknown());
const resultSchema = z.object({ success: z.boolean(), error: z.string().optional() });

const agentStepSchema = z.object({
  type: z.literal('agent'),
  id: z.string().min(1),
  agentId: z.string().min(1),
  outputSchema: jsonSchema.optional(),
});
const toolStepSchema = z.object({ type: z.literal('tool'), id: z.string().min(1), toolId: z.string().min(1) });
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
const parallelChildSchema = z.union([agentStepSchema, toolStepSchema, mappingStepSchema]);
const parallelChildInputSchema = z.union([agentStepSchema, toolStepSchema, mappingStepInputSchema]);
const parallelStepSchema = z.object({ type: z.literal('parallel'), steps: z.array(parallelChildSchema).min(1) });
const parallelStepInputSchema = z.object({
  type: z.literal('parallel'),
  steps: z.array(parallelChildInputSchema).min(1),
});
const foreachStepSchema = z.object({
  type: z.literal('foreach'),
  step: z.union([agentStepSchema, toolStepSchema]),
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
const workflowStepSchema = z.discriminatedUnion('type', [
  agentStepSchema,
  toolStepSchema,
  mappingStepSchema,
  parallelStepSchema,
  foreachStepSchema,
  sleepStepSchema,
  sleepUntilStepSchema,
]);
const workflowStepInputSchema = z.discriminatedUnion('type', [
  agentStepSchema,
  toolStepSchema,
  mappingStepInputSchema,
  parallelStepInputSchema,
  foreachStepSchema,
  sleepStepSchema,
  sleepUntilStepSchema,
]);

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
