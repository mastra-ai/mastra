/**
 * Shared vocabulary for the one stored-workflow validation domain.
 *
 * Every validation surface (Mastra save path, builder preflight, Studio draft
 * UI) speaks in `WorkflowValidationIssue`s produced by the collect-mode core
 * in `./index`. Throwing behavior is a presentation concern layered on top
 * (`assertValidStoredWorkflow`), not a separate rule set.
 */
import type { Predicate } from '../../predicate';
import type { SerializedSingleStepEntry, SerializedStepFlowEntry } from '../../types';
import type { JsonSchema } from '../json-schema-to-zod';

export type WorkflowValidationIssueCode =
  | 'empty-graph'
  | 'missing-step-id'
  | 'duplicate-step-id'
  | 'missing-reference'
  | 'invalid-nested-workflow-id'
  | 'invalid-map-config'
  | 'invalid-map-reference'
  | 'invalid-map-placement'
  | 'invalid-parallel'
  | 'invalid-foreach'
  | 'invalid-conditional'
  | 'invalid-loop'
  | 'invalid-predicate-reference'
  | 'incompatible-schema'
  | 'unsupported-schema-keyword'
  | 'self-reference';

export interface WorkflowValidationIssue {
  code: WorkflowValidationIssueCode;
  path: string;
  message: string;
}

/** Input/output shapes known for one registered dependency. */
export interface WorkflowRegistrySchemas {
  inputSchema?: JsonSchema;
  outputSchema?: JsonSchema;
}

/**
 * What the validator knows about the surrounding registries. Presence of a
 * top-level key means "this kind was indexed, check references against it";
 * an absent key skips reference checks for that kind (a caller that cannot
 * enumerate, say, workflows must not produce false missing-reference issues).
 * Schemas are optional per entry — when present they power schema-flow
 * analysis, when absent compatibility degrades to `unknown` (never a false
 * incompatibility).
 */
export interface WorkflowRegistryIndex {
  agents?: Record<string, WorkflowRegistrySchemas>;
  tools?: Record<string, WorkflowRegistrySchemas>;
  workflows?: Record<string, WorkflowRegistrySchemas>;
}

/**
 * The graph-entry union validation accepts: the canonical serialized union,
 * widened only where the wire legitimately diverges from the fluent
 * serializer's output —
 *  - `sleepUntil.date` arrives as an ISO string over HTTP (Date at runtime)
 *  - `serializedConditions` / `serializedCondition` are fluent-builder debug
 *    labels; clients don't send them (rehydration derives them)
 *
 * `SerializedStepFlowEntry` is assignable to this union, and so is the
 * authoring subset (`WorkflowBuilderGraphEntry`) — asserted statically in
 * `workflows/builder`.
 */
export type ValidatableStepFlowEntry =
  | SerializedSingleStepEntry
  | Extract<SerializedStepFlowEntry, { type: 'sleep' }>
  | (Omit<Extract<SerializedStepFlowEntry, { type: 'sleepUntil' }>, 'date'> & { date?: Date | string })
  | Extract<SerializedStepFlowEntry, { type: 'parallel' }>
  | (Omit<Extract<SerializedStepFlowEntry, { type: 'conditional' }>, 'serializedConditions'> & {
      serializedConditions?: { id: string; fn: string }[];
    })
  | (Omit<Extract<SerializedStepFlowEntry, { type: 'loop' }>, 'serializedCondition'> & {
      serializedCondition?: { id: string; fn: string };
      predicate?: Predicate;
    })
  | Extract<SerializedStepFlowEntry, { type: 'foreach' }>;

/**
 * The definition shape validation operates on — the common structural core of
 * `StoredWorkflowGraph` (persistence) and `WorkflowBuilderDefinition`
 * (authoring wire shape).
 */
export interface WorkflowValidationInput {
  id: string;
  description?: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  stateSchema?: JsonSchema;
  requestContextSchema?: JsonSchema;
  graph: readonly ValidatableStepFlowEntry[];
}

/** Step id of a single-step (leaf) entry; `step` descriptors carry theirs nested. */
export function leafEntryId(entry: SerializedSingleStepEntry): string | undefined {
  return entry.type === 'step' ? entry.step.id : entry.id;
}
