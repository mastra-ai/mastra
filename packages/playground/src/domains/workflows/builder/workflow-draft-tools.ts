import { createTool } from '@mastra/client-js';
import { validateToolInput } from '@mastra/core/tools';
import {
  normalizeWorkflowBuilderDefinition,
  workflowBuilderDefinitionInputSchema,
  workflowBuilderDefinitionSchema,
} from '@mastra/core/workflows/builder';
import type { WorkflowBuilderDefinition } from '@mastra/core/workflows/builder';
import type { ClientToolsInput } from '@mastra/react';
import { z } from 'zod-v4';

import type {
  WorkflowDraft,
  WorkflowDraftAuthoringResult,
  WorkflowDraftAuthoringState,
  WorkflowDraftStepSchema,
  WorkflowDraftValidationContext,
  WorkflowDraftValidationIssue,
} from './workflow-draft';
import { validateWorkflowDraft } from './workflow-draft';
const catalogResultSchema = z.record(z.string(), z.unknown());
const resultSchema = z.object({
  success: z.boolean(),
  reason: z.enum(['superseded', 'already-ready', 'empty-arguments', 'generation-stopped']).optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  issues: z.array(z.object({ code: z.string(), path: z.string(), message: z.string() })).optional(),
  lifecycle: z.enum(['untouched', 'constructing', 'ready']).optional(),
  revision: z.number().int().nonnegative().optional(),
  finalizedRevision: z.number().int().nonnegative().optional(),
  candidateRevision: z.number().int().nonnegative().optional(),
  baseAcceptedRevision: z.number().int().nonnegative().optional(),
  definition: z.unknown().optional(),
});

export const workflowDefinitionInputSchema = workflowBuilderDefinitionInputSchema
  .extend({
    dependencies: z
      .array(workflowBuilderDefinitionInputSchema)
      // Nullish, not optional: OpenAI strict compatibility makes optional
      // properties required+nullable, so strict-provider models must send null.
      .nullish()
      .describe(
        'Helper workflows this definition nests that do not exist in the catalog yet. They travel with this submission as one unit: validated together, shown together, and saved together when the user clicks Save. Use them only when a nested workflow is genuinely needed — for example to give each parallel branch its own input shaping. Each helper becomes an ordinary stored workflow the user will see.',
      ),
  })
  .describe(
    'One complete canonical WorkflowDefinition. Submit exactly one candidate per attempt, never parallel alternatives. After diagnostics, correct and resubmit the whole definition. A successful submission becomes Ready automatically but is not persisted until the user clicks Save.',
  );

export function parseWorkflowDefinitionInput(input: unknown): WorkflowBuilderDefinition {
  const normalized = normalizeWorkflowBuilderDefinition(input);
  workflowBuilderDefinitionSchema.parse(normalized);
  return normalized;
}

function toDraftDefinition(normalized: WorkflowBuilderDefinition) {
  return {
    id: normalized.id,
    description: normalized.description,
    inputSchema: normalized.inputSchema,
    outputSchema: normalized.outputSchema,
    stateSchema: normalized.stateSchema,
    requestContextSchema: normalized.requestContextSchema,
    graph: normalized.graph as WorkflowDraft['graph'],
  };
}

// Normalization is best-effort: it rejects input it cannot canonicalize (a
// non-array `graph`, for example) by throwing, which Zod does not catch out of
// `preprocess`. Hand such input to the schema untouched so the failure comes
// back as a normal validation issue with a real path instead of escaping as an
// opaque thrown client-tool error.
function normalizeIfPossible(value: unknown): unknown {
  try {
    return normalizeWorkflowBuilderDefinition(value);
  } catch {
    return value;
  }
}

// The same composition Core tools declare: normalize, then validate, as one
// schema. Core's runner formats any failure identically for a native Core tool,
// so a missed canonical shape reads the same here as it does in Mastra Code.
const submittedDraftSchema = z.preprocess(
  input => {
    const { dependencies, ...definition } = (input ?? {}) as { dependencies?: unknown };
    const root = normalizeIfPossible(definition) as Record<string, unknown>;
    if (!Array.isArray(dependencies)) return root;
    return { ...root, dependencies: dependencies.map(dependency => normalizeIfPossible(dependency)) };
  },
  workflowBuilderDefinitionSchema.extend({ dependencies: z.array(workflowBuilderDefinitionSchema).optional() }),
);

function parseWorkflowDraftInput(
  input: unknown,
): { draft: WorkflowDraft; error?: undefined } | { draft?: undefined; error: string } {
  const { error, data } = validateToolInput(submittedDraftSchema, input, 'submit-workflow-draft');
  if (error) return { error: error.message };

  const { dependencies, ...definition } = data as WorkflowBuilderDefinition & {
    dependencies?: WorkflowBuilderDefinition[];
  };
  const draft = toDraftDefinition(definition);
  if (!dependencies || dependencies.length === 0) return { draft };
  return { draft: { ...draft, dependencies: dependencies.map(toDraftDefinition) } };
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

// Every rejection states what happened AND what to do about it in `error`.
// Models anchor on `error` and act on it before reading sibling fields, so
// recovery guidance kept anywhere else is guidance they will not follow.
const GENERATION_STOPPED_ERROR =
  'Workflow generation was stopped for this turn, so this submission was not evaluated. Nothing has been accepted and nothing is broken. Do NOT apologize, do NOT claim the workflow is broken, and do NOT invent a reason. Wait for the user.';

const SUPERSEDED_NOOP_MESSAGE =
  'This submission structurally matched the earlier accepted revision for this workflow; treating it as a no-op confirmation. The workflow is Ready and awaiting the user’s explicit Save. Do NOT resubmit, apologize, or claim the workflow is broken.';

function alreadyReadyError(revision: number): string {
  return `Workflow is already Ready as revision ${revision}. The accepted definition is authoritative. Stop and wait for the user; do NOT resubmit, apologize, or claim the workflow is broken.`;
}

const EMPTY_ARGUMENTS_ERROR =
  'You invoked submit-workflow-draft with no arguments. Compose the complete WorkflowDefinition first, then send it as the tool arguments: a single object with id, description, inputSchema, outputSchema, and graph (plus dependencies if it nests helper workflows). Do NOT call the tool before the definition is built, do NOT retry with an empty payload, do NOT apologize, and do NOT claim the workflow is broken.';

function isEmptyArguments(input: unknown): boolean {
  if (input === undefined || input === null) return true;
  if (typeof input !== 'object') return false;
  return Object.keys(input as Record<string, unknown>).length === 0;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const entries = keys
    .map(k => {
      const v = (value as Record<string, unknown>)[k];
      if (v === undefined) return undefined;
      return `${JSON.stringify(k)}:${stableStringify(v)}`;
    })
    .filter((entry): entry is string => entry !== undefined);
  return `{${entries.join(',')}}`;
}

function draftsStructurallyEqual(a: WorkflowDraft, b: WorkflowDraft): boolean {
  return stableStringify(a) === stableStringify(b);
}

function makeSupersededResult(store: WorkflowDraftToolStore, input?: unknown) {
  const state = store.getState();
  if (state.lifecycle === 'ready') {
    if (input !== undefined) {
      const submitted = parseWorkflowDraftInput(input);
      if (submitted.draft && draftsStructurallyEqual(submitted.draft, state.draft)) {
        return {
          success: true as const,
          lifecycle: state.lifecycle,
          revision: state.revision,
          finalizedRevision: state.finalizedRevision,
          baseAcceptedRevision: state.revision,
          message: SUPERSEDED_NOOP_MESSAGE,
          definition: structuredClone(state.draft),
        };
      }
    }
    return {
      success: false as const,
      reason: 'already-ready' as const,
      error: alreadyReadyError(state.finalizedRevision ?? state.revision),
      lifecycle: state.lifecycle,
      finalizedRevision: state.finalizedRevision,
      baseAcceptedRevision: state.revision,
      definition: structuredClone(state.draft),
    };
  }
  return {
    success: false as const,
    reason: 'generation-stopped' as const,
    error: GENERATION_STOPPED_ERROR,
    lifecycle: state.lifecycle,
    finalizedRevision: state.finalizedRevision,
    baseAcceptedRevision: state.revision,
  };
}

function publishCandidate(store: WorkflowDraftToolStore, candidate: WorkflowDraftCandidate) {
  store.onCandidateChange?.({ ...candidate, draft: structuredClone(candidate.draft), issues: [...candidate.issues] });
}

function reportResult(store: WorkflowDraftToolStore, toolId: string, result: z.infer<typeof resultSchema>) {
  store.onResult?.({ toolId, result });
  return result;
}

const AGENT_OUTPUT_CONTRACT =
  'An agent step takes a { prompt: string } input and by default outputs { text: string }. To make an agent emit a different shape — for example a top-level array to drive a foreach — set outputSchema on that agent step; it overrides the default for that step only.';

/**
 * Only the workflow catalog can be withheld: it is the one listing gated behind a
 * permission the user may lack. Agents and tools stay listable in that case.
 */
function workflowCatalogUnavailable(store: WorkflowDraftToolStore) {
  return !store.validationContext || store.validationContext.workflowCatalog === 'unavailable';
}

function catalogRows(
  store: WorkflowDraftToolStore,
  catalogName: 'agents' | 'tools' | 'workflows',
  toRow: (registryKey: string, entry: WorkflowDraftStepSchema) => Record<string, unknown>,
) {
  return Object.entries(store.validationContext?.[catalogName] ?? {}).map(([registryKey, entry]) =>
    toRow(registryKey, entry),
  );
}

export function createWorkflowDraftTools(store: WorkflowDraftToolStore): ClientToolsInput {
  const candidate = store.candidate ?? createWorkflowDraftCandidate(store.getState());

  return {
    'list-available-agents': createTool({
      id: 'list-available-agents',
      description:
        'Returns every agent registered on this Mastra instance. The registry keys returned here are the only valid values you can put in `{ type: "agent", agentId }` graph entries. Every row includes `outputContract` so you know what an agent step produces — read it instead of guessing.',
      inputSchema: z.object({}),
      outputSchema: catalogResultSchema,
      execute: async () => ({
        agents: catalogRows(store, 'agents', (registryKey, entry) => ({
          registryKey,
          runtimeId: entry.runtimeId,
          description: entry.description,
          outputContract: AGENT_OUTPUT_CONTRACT,
        })),
      }),
    }),
    'list-available-tools': createTool({
      id: 'list-available-tools',
      description:
        'Returns every tool registered on this Mastra instance. The registry keys returned here are the only valid values you can put in `{ type: "tool", toolId }` graph entries. Every row includes `inputSchema` and `outputSchema` as JSON Schema — read them to know what fields the tool accepts and emits; never invent field names.',
      inputSchema: z.object({}),
      outputSchema: catalogResultSchema,
      execute: async () => ({
        tools: catalogRows(store, 'tools', (registryKey, entry) => ({
          registryKey,
          runtimeId: entry.runtimeId,
          description: entry.description,
          inputSchema: entry.inputSchema,
          outputSchema: entry.outputSchema,
        })),
      }),
    }),
    'list-available-workflows': createTool({
      id: 'list-available-workflows',
      description:
        'Returns every workflow already registered on this Mastra instance. The `authoritativeWorkflowId` values returned here are the only valid values you can put in `{ type: "workflow", workflowId }` graph entries. Every row includes `inputSchema` and `outputSchema` as JSON Schema — read them to know what shape the nested workflow expects and produces; never invent field names. Helper workflows you submit in the same draft are not listed here yet.',
      inputSchema: z.object({}),
      outputSchema: catalogResultSchema,
      execute: async () => {
        if (workflowCatalogUnavailable(store))
          return { available: false, reason: 'catalog-unavailable' as const, workflows: [] };
        return {
          available: true,
          workflows: catalogRows(store, 'workflows', (registryKey, entry) => ({
            registryKey,
            authoritativeWorkflowId: entry.runtimeId ?? registryKey,
            description: entry.description,
            inputSchema: entry.inputSchema,
            outputSchema: entry.outputSchema,
          })),
        };
      },
    }),
    'submit-workflow-draft': createTool({
      id: 'submit-workflow-draft',
      description:
        'Submit or replace one complete canonical WorkflowDefinition, plus any helper workflows it nests that do not exist yet. Studio immediately displays the candidate, validates the whole set through Core, returns all diagnostics for a corrected whole-definition retry, and automatically marks a valid set Ready. This never persists anything; the user must explicitly Save, which saves the workflow and its helpers together.',
      inputSchema: workflowDefinitionInputSchema,
      outputSchema: resultSchema,
      execute: async input => {
        if (store.isCurrentGeneration?.() === false) return makeSupersededResult(store, input);

        if (isEmptyArguments(input)) {
          const state = store.getState();
          return reportResult(store, 'submit-workflow-draft', {
            success: false as const,
            reason: 'empty-arguments' as const,
            error: EMPTY_ARGUMENTS_ERROR,
            lifecycle: state.lifecycle,
            finalizedRevision: state.finalizedRevision,
            baseAcceptedRevision: state.revision,
          });
        }

        // A structurally malformed submission (a foreach missing its inner
        // `step`, unrecognized keys like `items`/`itemWorkflow`) fails the
        // canonical schema before the semantic validator runs. Core's tool
        // runner already turns that into actionable model-facing text, so use
        // it verbatim rather than letting the failure escape as an opaque tool
        // error. Such a submission never becomes a candidate, so authoring
        // state is left untouched.
        const parsed = parseWorkflowDraftInput(input);
        if (parsed.error !== undefined) {
          const state = store.getState();
          return reportResult(store, 'submit-workflow-draft', {
            success: false,
            error: parsed.error,
            candidateRevision: state.revision,
            baseAcceptedRevision: state.revision,
          });
        }

        candidate.draft = parsed.draft;
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

        if (store.isCurrentGeneration?.() === false) return makeSupersededResult(store, input);
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
          definition: structuredClone(finalize.state.draft),
        });
      },
    }),
  };
}
