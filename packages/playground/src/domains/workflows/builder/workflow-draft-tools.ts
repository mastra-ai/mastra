import { createTool } from '@mastra/client-js';
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
  WorkflowDraftValidationContext,
  WorkflowDraftValidationIssue,
} from './workflow-draft';
import { validateWorkflowDraft } from './workflow-draft';
const inspectionResultSchema = z.record(z.string(), z.unknown());
const resultSchema = z.object({
  success: z.boolean(),
  reason: z.enum(['superseded', 'already-ready']).optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  issues: z.array(z.object({ code: z.string(), path: z.string(), message: z.string() })).optional(),
  lifecycle: z.enum(['untouched', 'constructing', 'ready']).optional(),
  revision: z.number().int().nonnegative().optional(),
  finalizedRevision: z.number().int().nonnegative().optional(),
  candidateRevision: z.number().int().nonnegative().optional(),
  baseAcceptedRevision: z.number().int().nonnegative().optional(),
});

export const workflowDefinitionInputSchema = workflowBuilderDefinitionInputSchema.describe(
  'One complete canonical WorkflowDefinition. Submit exactly one candidate per attempt, never parallel alternatives. After diagnostics, correct and resubmit the whole definition. A successful submission becomes Ready automatically but is not persisted until the user clicks Save.',
);

export function parseWorkflowDefinitionInput(input: unknown): WorkflowBuilderDefinition {
  const normalized = normalizeWorkflowBuilderDefinition(input);
  workflowBuilderDefinitionSchema.parse(normalized);
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
    graph: normalized.graph as WorkflowDraft['graph'],
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

const SUPERSEDED_MESSAGE =
  'This tool call was superseded by another call in the same turn. An earlier call for this workflow was accepted first and remains the current accepted state. Do NOT apologize, retry, or claim the workflow is broken based on this response. Call inspect-workflow-resources to see the actual accepted definition before saying anything about persistence, schema, mapping form, or graph shape.';

const SUPERSEDED_NOOP_MESSAGE =
  'This submission structurally matched the earlier accepted revision for this workflow; treating it as a no-op confirmation. The workflow is Ready and awaiting the user’s explicit Save. Do NOT resubmit, apologize, or claim the workflow is broken.';

function alreadyReadyMessage(revision: number): string {
  return `The workflow is already Ready as revision ${revision}. Stop and wait for the user; do NOT resubmit.`;
}

const EMPTY_ARGUMENTS_ERROR = 'No workflow definition arguments were received.';
const EMPTY_ARGUMENTS_MESSAGE =
  'submit-workflow-draft was invoked without any arguments. The provider may have truncated or dropped the tool call payload. Retry once by sending a single complete WorkflowDefinition object as the tool arguments (id, description, inputSchema, outputSchema, graph). Do NOT retry with the same empty payload, do NOT apologize, and do NOT claim the workflow is broken.';

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
      try {
        const submitted = parseWorkflowDraftInput(input);
        if (draftsStructurallyEqual(submitted, state.draft)) {
          return {
            success: true as const,
            lifecycle: state.lifecycle,
            revision: state.revision,
            finalizedRevision: state.finalizedRevision,
            baseAcceptedRevision: state.revision,
            message: SUPERSEDED_NOOP_MESSAGE,
          };
        }
      } catch {
        // Fall through to the already-ready rejection path below.
      }
    }
    return {
      success: false as const,
      reason: 'already-ready' as const,
      error: `Workflow is already Ready as revision ${state.finalizedRevision ?? state.revision}.`,
      message: alreadyReadyMessage(state.finalizedRevision ?? state.revision),
      lifecycle: state.lifecycle,
      finalizedRevision: state.finalizedRevision,
      baseAcceptedRevision: state.revision,
    };
  }
  return {
    success: false as const,
    reason: 'superseded' as const,
    error: 'Submission was superseded.',
    message: SUPERSEDED_MESSAGE,
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
    ...(request.type === 'workflow' ? { authoritativeWorkflowId: entry.runtimeId ?? request.registryKey } : {}),
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
        if (store.isCurrentGeneration?.() === false) return makeSupersededResult(store, input);

        if (isEmptyArguments(input)) {
          const state = store.getState();
          return reportResult(store, 'submit-workflow-draft', {
            success: false as const,
            error: EMPTY_ARGUMENTS_ERROR,
            message: EMPTY_ARGUMENTS_MESSAGE,
            lifecycle: state.lifecycle,
            finalizedRevision: state.finalizedRevision,
            baseAcceptedRevision: state.revision,
          });
        }

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
        });
      },
    }),
  };
}
