import type { Predicate } from '../predicate';
import type { ValidatableStepFlowEntry, WorkflowValidationInput } from '../stored/validate/types';
import type { SerializedSingleStepEntry, SerializedStepOptions } from '../types';

export type WorkflowBuilderJsonValue =
  string | number | boolean | null | WorkflowBuilderJsonValue[] | { [key: string]: WorkflowBuilderJsonValue };

export type WorkflowBuilderJsonObject = { [key: string]: WorkflowBuilderJsonValue };

export type WorkflowBuilderStepOptions = SerializedStepOptions;

/**
 * Authoring leaf entries are the canonical serialized leaf union minus
 * code-only `step` descriptors (a persisted definition cannot reference a
 * live Step object). Derived, not duplicated: when the serialized union
 * changes, these change with it.
 */
export type WorkflowBuilderSingleStepEntry = Exclude<SerializedSingleStepEntry, { type: 'step' }>;

export type WorkflowBuilderAgentEntry = Extract<WorkflowBuilderSingleStepEntry, { type: 'agent' }>;
export type WorkflowBuilderToolEntry = Extract<WorkflowBuilderSingleStepEntry, { type: 'tool' }>;
export type WorkflowBuilderMappingEntry = Extract<WorkflowBuilderSingleStepEntry, { type: 'mapping' }>;
export type WorkflowBuilderWorkflowEntry = Extract<WorkflowBuilderSingleStepEntry, { type: 'workflow' }>;

export type WorkflowBuilderExecutableInnerEntry = Exclude<WorkflowBuilderSingleStepEntry, { type: 'mapping' }>;

/**
 * Container entries are hand-written *narrowings* of the serialized union:
 * declarative predicates are required (closure conditions can't be authored),
 * fluent-only debug labels (`serializedConditions`/`serializedCondition`) are
 * absent, and `sleepUntil.date` is the wire's ISO string rather than a Date.
 * The static assertions at the bottom of this file prove each narrowing stays
 * inside the canonical union — drift is a compile error.
 */
export interface WorkflowBuilderParallelEntry {
  type: 'parallel';
  steps: WorkflowBuilderExecutableInnerEntry[];
}

export interface WorkflowBuilderForeachEntry {
  type: 'foreach';
  step: WorkflowBuilderExecutableInnerEntry;
  opts?: { concurrency: number };
}

export interface WorkflowBuilderSleepEntry {
  type: 'sleep';
  id: string;
  duration: number;
}

export interface WorkflowBuilderSleepUntilEntry {
  type: 'sleepUntil';
  id: string;
  date: string;
}

export interface WorkflowBuilderConditionalEntry {
  type: 'conditional';
  steps: WorkflowBuilderExecutableInnerEntry[];
  predicates: Predicate[];
}

export interface WorkflowBuilderLoopEntry {
  type: 'loop';
  step: WorkflowBuilderExecutableInnerEntry;
  loopType: 'dowhile' | 'dountil';
  predicate: Predicate;
}

export type WorkflowBuilderGraphEntry =
  | WorkflowBuilderSingleStepEntry
  | WorkflowBuilderParallelEntry
  | WorkflowBuilderForeachEntry
  | WorkflowBuilderSleepEntry
  | WorkflowBuilderSleepUntilEntry
  | WorkflowBuilderConditionalEntry
  | WorkflowBuilderLoopEntry;

export interface WorkflowBuilderDefinition {
  id: string;
  description?: string;
  inputSchema: WorkflowBuilderJsonObject;
  outputSchema: WorkflowBuilderJsonObject;
  stateSchema?: WorkflowBuilderJsonObject;
  requestContextSchema?: WorkflowBuilderJsonObject;
  graph: WorkflowBuilderGraphEntry[];
}

type Extends<A, B> = [A] extends [B] ? true : false;
type Expect<T extends true> = T;

/**
 * Compile-time drift guards: the authoring universe must remain a subset of
 * the canonical serialized/wire union the validation core operates on. If a
 * serialized variant gains a required field (or an authoring type drifts),
 * these tuple members stop typechecking and the build fails.
 */
export type WorkflowBuilderTypeAssertions = [
  Expect<Extends<WorkflowBuilderGraphEntry, ValidatableStepFlowEntry>>,
  Expect<Extends<WorkflowBuilderDefinition, WorkflowValidationInput>>,
];

export const WORKFLOW_BUILDER_SUPPORTED_STEP_TYPES = [
  'agent',
  'tool',
  'mapping',
  'workflow',
  'parallel',
  'foreach',
  'sleep',
  'sleepUntil',
  'conditional',
  'loop',
] as const;

export type WorkflowBuilderSupportedStepType = (typeof WORKFLOW_BUILDER_SUPPORTED_STEP_TYPES)[number];

export const WORKFLOW_BUILDER_AUTHORING_CONSTRAINTS = `# Persisted workflow authoring contract

A persisted workflow is a JSON-safe static graph. The supported entry types are agent, tool, mapping, nested workflow, parallel, foreach, sleep, sleepUntil, declarative conditional, and declarative loop. Closure mappings, function predicates, callbacks, and arbitrary executable functions are unsupported.

Every adjacent step must compose exactly: the previous output shape must satisfy the next input schema. Agent inputs are always { prompt: string }. Insert a mapping step whenever shapes differ; never rely on implicit coercion. A mapping's output keys are the top-level keys of its JSON-encoded mapConfig. Persisted mappings only select, rename, template, or provide constant values; they cannot evaluate arithmetic or arbitrary expressions. Template placeholders must use inputData, initData, state, requestContext, or stepResults namespaces (for example \${stepResults.add-numbers.result}), never input, steps, or JavaScript expressions. Use a discovered tool or agent when computation is required.

Mapping entries must be top-level linear steps. Parallel and conditional children, foreach bodies, and loop bodies may be agent, tool, or nested workflow entries; do not place mappings or nested containers inside them. Parallel and conditional children all receive the same preceding output. Foreach requires an array input and passes each array item directly to its body. Loop bodies must accept both the preceding output and their own output on later iterations. Use a nested workflow when a branch or foreach item needs its own input-shaping mapping. Conditional predicates align by index with their branch steps. Loop and conditional predicates must use the declarative predicate DSL.

Nested workflow entries must use the referenced workflowId as their step id because persisted runtime rehydration cannot preserve a separate call-site identity. Use dependency IDs returned by discovery. Never invent agent, tool, or workflow IDs. Keep workflow IDs, step IDs, schemas, mapping configs, options, predicates, and metadata JSON-safe.`;

function normalizeJsonValue(value: unknown, path: string, seen: Set<object>): WorkflowBuilderJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${path} must contain only finite numbers.`);
    return value;
  }
  if (typeof value !== 'object') throw new TypeError(`${path} must be JSON-safe.`);
  if (seen.has(value)) throw new TypeError(`${path} must not contain cycles.`);
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((item, index) => normalizeJsonValue(item, `${path}.${index}`, seen));
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new TypeError(`${path} must contain only plain objects.`);
    }
    const normalized: WorkflowBuilderJsonObject = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) normalized[key] = normalizeJsonValue(item, `${path}.${key}`, seen);
    }
    return normalized;
  } finally {
    seen.delete(value);
  }
}

function normalizeEntry(entry: Record<string, unknown>): WorkflowBuilderGraphEntry {
  const normalized = normalizeJsonValue(entry, 'graph entry', new Set()) as WorkflowBuilderJsonObject;
  if (normalized.type === 'agent' && typeof normalized.agentId !== 'string' && typeof normalized.agent === 'string') {
    normalized.agentId = normalized.agent;
    delete normalized.agent;
  }
  if (normalized.type === 'mapping' && typeof normalized.mapConfig !== 'string') {
    const mapConfig =
      normalized.mapConfig ?? (normalized.output === undefined ? undefined : { output: normalized.output });
    if (mapConfig !== undefined) normalized.mapConfig = JSON.stringify(mapConfig);
    delete normalized.output;
  }
  if ((normalized.type === 'parallel' || normalized.type === 'conditional') && Array.isArray(normalized.steps)) {
    normalized.steps = normalized.steps.map(step =>
      normalizeEntry(step as Record<string, unknown>),
    ) as unknown as WorkflowBuilderJsonValue[];
  }
  if ((normalized.type === 'foreach' || normalized.type === 'loop') && normalized.step) {
    normalized.step = normalizeEntry(normalized.step as Record<string, unknown>) as unknown as WorkflowBuilderJsonValue;
  }
  return normalized as unknown as WorkflowBuilderGraphEntry;
}

export function normalizeWorkflowBuilderDefinition(input: unknown): WorkflowBuilderDefinition {
  const normalized = normalizeJsonValue(input, 'workflow definition', new Set()) as WorkflowBuilderJsonObject;
  if (normalized.stateSchema === null) delete normalized.stateSchema;
  if (normalized.requestContextSchema === null) delete normalized.requestContextSchema;
  if (!Array.isArray(normalized.graph)) throw new TypeError('Workflow definition graph must be an array.');
  normalized.graph = normalized.graph.map(entry =>
    normalizeEntry(entry as Record<string, unknown>),
  ) as unknown as WorkflowBuilderJsonValue[];
  return normalized as unknown as WorkflowBuilderDefinition;
}

export * from './preflight';
