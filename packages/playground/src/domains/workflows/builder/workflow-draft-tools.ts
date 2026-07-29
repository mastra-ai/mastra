import { createTool } from '@mastra/client-js';
import { normalizeWorkflowBuilderDefinition } from '@mastra/core/workflows/builder';
import type { WorkflowBuilderDefinition } from '@mastra/core/workflows/builder';
import type { ClientToolsInput } from '@mastra/react';
import { z } from 'zod-v4';

import type {
  WorkflowDraft,
  WorkflowDraftAuthoringResult,
  WorkflowDraftAuthoringState,
  WorkflowDraftStep,
  WorkflowDraftValidationContext,
  WorkflowDraftValidationIssue,
} from './workflow-draft';
import { validateWorkflowDraft } from './workflow-draft';

type WorkflowPredicate = Extract<WorkflowDraftStep, { type: 'conditional' }>['predicates'][number];

const jsonSchema = z.record(z.string(), z.unknown());
const inspectionResultSchema = z.record(z.string(), z.unknown());
const resultSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  issues: z.array(z.object({ code: z.string(), path: z.string(), message: z.string() })).optional(),
  lifecycle: z.enum(['untouched', 'constructing', 'ready']).optional(),
  revision: z.number().int().nonnegative().optional(),
  finalizedRevision: z.number().int().nonnegative().optional(),
  candidateRevision: z.number().int().nonnegative().optional(),
  baseAcceptedRevision: z.number().int().nonnegative().optional(),
});

const stepOptionsSchema = z
  .object({ retries: z.number().int().nonnegative().optional(), metadata: jsonSchema.optional() })
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
const mappingDescriptorInputSchema = z
  .union([
    z.object({ value: z.unknown() }).strict().describe('Constant source: { "value": <JSON value> }.'),
    z
      .object({ template: z.string().min(1) })
      .strict()
      .describe('Template source: { "template": "..." }.'),
    z.object({ requestContextPath: z.string().min(1) }).strict(),
    z
      .object({ initData: z.literal(true), path: z.string().min(1) })
      .strict()
      .describe('Workflow-input source: { "initData": true, "path": "field.path" }. initData must be true.'),
    z
      .object({ step: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]), path: z.string() })
      .strict()
      .describe('Prior-step source: { "step": "step-id", "path": "field.path" }.'),
  ])
  .describe('Use exactly one source form. Never combine initData and step.');
const mappingConfigInputSchema = z.record(z.string(), mappingDescriptorInputSchema);
const mappingStepSchema = z.object({ type: z.literal('mapping'), id: z.string().min(1), mapConfig: z.string().min(1) });
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
  graph: z.array(workflowStepInputSchema).min(1),
});
const normalizedWorkflowDefinitionSchema = workflowDefinitionInputSchema.extend({ graph: z.array(workflowStepSchema) });

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
  candidate?: WorkflowDraftCandidate;
  validationContext?: WorkflowDraftValidationContext;
  isCurrentGeneration?: () => boolean;
  onResult?: (event: WorkflowDraftToolResult) => void;
  onCandidateChange?: (candidate: WorkflowDraftCandidate) => void;
}

const supersededResult = { success: false as const, error: 'Submission was superseded.' };

function publishCandidate(store: WorkflowDraftToolStore, candidate: WorkflowDraftCandidate) {
  store.onCandidateChange?.({ ...candidate, draft: structuredClone(candidate.draft), issues: [...candidate.issues] });
}

function reportResult(store: WorkflowDraftToolStore, toolId: string, result: z.infer<typeof resultSchema>) {
  store.onResult?.({ toolId, result });
  return result;
}

function catalogUnavailable(store: WorkflowDraftToolStore) {
  return !store.validationContext || store.validationContext.workflowCatalog === 'unavailable';
}

const resourceRequestSchema = z.object({
  type: z.enum(['tool', 'agent', 'workflow']),
  registryKey: z.string().min(1),
});

function inspectResource(store: WorkflowDraftToolStore, request: z.infer<typeof resourceRequestSchema>) {
  const catalogName = request.type === 'tool' ? 'tools' : request.type === 'agent' ? 'agents' : 'workflows';
  const entry = store.validationContext?.[catalogName]?.[request.registryKey];
  if (!entry) return { ...request, found: false };
  return {
    ...request,
    found: true,
    runtimeId: entry.runtimeId,
    inputSchema: entry.inputSchema,
    outputSchema: entry.outputSchema,
    ...(request.type === 'workflow' ? { authoritativeWorkflowId: request.registryKey } : {}),
  };
}

export function createWorkflowDraftTools(store: WorkflowDraftToolStore): ClientToolsInput {
  const candidate = store.candidate ?? createWorkflowDraftCandidate(store.getState());

  return {
    'inspect-workflow-resources': createTool({
      id: 'inspect-workflow-resources',
      description:
        'Batch-inspect authoritative registered tools, agents, and workflows. Returns registry keys, runtime IDs, normalized input/output JSON Schemas, nested workflow identity, and catalog availability.',
      inputSchema: z.object({
        query: z.string().optional().describe('Optional case-insensitive registry-key or runtime-ID search.'),
        resources: z
          .array(resourceRequestSchema)
          .max(50)
          .optional()
          .describe('Optional exact resources to batch-inspect.'),
      }),
      outputSchema: inspectionResultSchema,
      execute: async ({ query, resources = [] }) => {
        if (catalogUnavailable(store))
          return { available: false, reason: 'catalog-unavailable', resources: [], catalog: [] };
        const normalizedQuery = query?.toLowerCase();
        const catalog = (['tool', 'agent', 'workflow'] as const).flatMap(type => {
          const catalogName = type === 'tool' ? 'tools' : type === 'agent' ? 'agents' : 'workflows';
          return Object.entries(store.validationContext?.[catalogName] ?? {})
            .filter(([registryKey, entry]) =>
              normalizedQuery
                ? registryKey.toLowerCase().includes(normalizedQuery) ||
                  entry.runtimeId?.toLowerCase().includes(normalizedQuery)
                : true,
            )
            .map(([registryKey, entry]) => ({ type, registryKey, runtimeId: entry.runtimeId }));
        });
        return { available: true, catalog, resources: resources.map(resource => inspectResource(store, resource)) };
      },
    }),
    'submit-workflow-draft': createTool({
      id: 'submit-workflow-draft',
      description:
        'Submit or replace one complete canonical WorkflowDefinition. Studio immediately displays the candidate, validates it through Core, returns all diagnostics for a corrected whole-definition retry, and automatically marks valid definitions Ready. This never persists the workflow; the user must explicitly Save.',
      inputSchema: workflowDefinitionInputSchema,
      outputSchema: resultSchema,
      execute: async input => {
        if (store.isCurrentGeneration?.() === false) return supersededResult;

        candidate.draft = parseWorkflowDraftInput(input);
        candidate.revision += 1;
        candidate.issues = [];
        candidate.hasUncheckpointedChanges = true;
        publishCandidate(store, candidate);

        const validation = validateWorkflowDraft(candidate.draft, store.validationContext);
        if (!validation.ok) {
          candidate.issues = validation.issues;
          publishCandidate(store, candidate);
          return reportResult(store, 'submit-workflow-draft', {
            success: false,
            error: validation.issues.map(issue => `${issue.path}: ${issue.message}`).join('\n'),
            issues: validation.issues,
            candidateRevision: candidate.revision,
            baseAcceptedRevision: candidate.baseAcceptedRevision,
          });
        }

        const checkpoint = store.checkpoint(candidate.baseAcceptedRevision, candidate.draft);
        if (!checkpoint.ok) {
          candidate.issues = checkpoint.issues ?? [];
          publishCandidate(store, candidate);
          return reportResult(store, 'submit-workflow-draft', {
            success: false,
            error: checkpoint.error,
            ...(checkpoint.issues ? { issues: checkpoint.issues } : {}),
            candidateRevision: candidate.revision,
            baseAcceptedRevision: candidate.baseAcceptedRevision,
          });
        }

        if (store.isCurrentGeneration?.() === false) return supersededResult;
        const finalize = store.finalize(checkpoint.state.revision);
        if (!finalize.ok) {
          candidate.issues = finalize.issues ?? [];
          publishCandidate(store, candidate);
          return reportResult(store, 'submit-workflow-draft', {
            success: false,
            error: finalize.error,
            ...(finalize.issues ? { issues: finalize.issues } : {}),
            candidateRevision: candidate.revision,
            baseAcceptedRevision: candidate.baseAcceptedRevision,
          });
        }

        candidate.draft = structuredClone(finalize.state.draft);
        candidate.revision = 0;
        candidate.baseAcceptedRevision = finalize.state.revision;
        candidate.issues = [];
        candidate.hasUncheckpointedChanges = false;
        publishCandidate(store, candidate);
        return reportResult(store, 'submit-workflow-draft', {
          success: true,
          lifecycle: finalize.state.lifecycle,
          revision: finalize.state.revision,
          finalizedRevision: finalize.state.finalizedRevision,
          candidateRevision: 0,
          baseAcceptedRevision: candidate.baseAcceptedRevision,
        });
      },
    }),
  };
}
