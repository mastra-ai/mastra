import type { ValidatableStepFlowEntry, WorkflowValidationInput } from '../dynamic/validate/types';
import type { Predicate } from '../predicate';
import type { WorkflowScheduleConfig } from '../scheduler/types';
import type { SerializedSingleStepEntry, SerializedStepOptions } from '../types';

export type WorkflowBuilderJsonValue =
  | string
  | number
  | boolean
  | null
  | WorkflowBuilderJsonValue[]
  | { [key: string]: WorkflowBuilderJsonValue };

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
/**
 * Optional identity/display fields shared by every control-flow entry.
 * Mirrors `StepFlowEntryOptions` on the canonical union.
 */
interface WorkflowBuilderEntryDisplayFields {
  description?: string;
  metadata?: Record<string, any>;
}

export interface WorkflowBuilderParallelEntry extends WorkflowBuilderEntryDisplayFields {
  type: 'parallel';
  id?: string;
  steps: WorkflowBuilderExecutableInnerEntry[];
}

export interface WorkflowBuilderForeachEntry extends WorkflowBuilderEntryDisplayFields {
  type: 'foreach';
  id?: string;
  step: WorkflowBuilderExecutableInnerEntry;
  opts?: { concurrency: number };
}

export interface WorkflowBuilderSleepEntry extends WorkflowBuilderEntryDisplayFields {
  type: 'sleep';
  id: string;
  duration: number;
}

export interface WorkflowBuilderSleepUntilEntry extends WorkflowBuilderEntryDisplayFields {
  type: 'sleepUntil';
  id: string;
  date: string;
}

export interface WorkflowBuilderConditionalEntry extends WorkflowBuilderEntryDisplayFields {
  type: 'conditional';
  id?: string;
  steps: WorkflowBuilderExecutableInnerEntry[];
  predicates: Predicate[];
}

export interface WorkflowBuilderLoopEntry extends WorkflowBuilderEntryDisplayFields {
  type: 'loop';
  id?: string;
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
  metadata?: Record<string, unknown>;
  inputSchema: WorkflowBuilderJsonObject;
  outputSchema: WorkflowBuilderJsonObject;
  stateSchema?: WorkflowBuilderJsonObject;
  requestContextSchema?: WorkflowBuilderJsonObject;
  graph: WorkflowBuilderGraphEntry[];
  /**
   * Optional declarative schedule config(s). JSON-safe by construction
   * (literal inputData/initialState/requestContext only), so it persists with
   * the definition and is re-declared on rehydration.
   */
  schedule?: WorkflowScheduleConfig | WorkflowScheduleConfig[];
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

export { WORKFLOW_BUILDER_AUTHORING_CONSTRAINTS, WORKFLOW_BUILDER_AUTHORING_PLAYBOOK } from './authoring-playbook';

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

// OpenAI strict-schema compatibility makes every optional property required and
// nullable, so strict-provider models are forced to emit `null` for fields they
// would otherwise omit. Strip null at exactly the optional structural slots the
// canonical schema declares — never blanket-strip, because a mapping constant
// source `{ "value": null }` is a legitimate null.
const OPTIONAL_ENTRY_KEYS = ['description', 'metadata', 'outputSchema', 'options', 'opts'] as const;
// `id` is optional only on container entries (parallel/conditional/foreach/loop);
// on sleep/sleepUntil/mapping it is required, so a null id there must survive to
// fail validation instead of being silently dropped.
const OPTIONAL_ID_ENTRY_TYPES = new Set(['parallel', 'conditional', 'foreach', 'loop']);
const OPTIONAL_STEP_OPTION_KEYS = ['retries', 'metadata'] as const;
const OPTIONAL_FOREACH_OPT_KEYS = ['concurrency'] as const;

function dropNullKeys(target: WorkflowBuilderJsonObject, keys: readonly string[]): void {
  for (const key of keys) {
    if (target[key] === null) delete target[key];
  }
}

function normalizeEntry(entry: Record<string, unknown>): WorkflowBuilderGraphEntry {
  const normalized = normalizeJsonValue(entry, 'graph entry', new Set()) as WorkflowBuilderJsonObject;
  dropNullKeys(normalized, OPTIONAL_ENTRY_KEYS);
  if (typeof normalized.type === 'string' && OPTIONAL_ID_ENTRY_TYPES.has(normalized.type)) {
    dropNullKeys(normalized, ['id']);
  }
  if (normalized.options && typeof normalized.options === 'object' && !Array.isArray(normalized.options)) {
    dropNullKeys(normalized.options as WorkflowBuilderJsonObject, OPTIONAL_STEP_OPTION_KEYS);
    if (Object.keys(normalized.options).length === 0) delete normalized.options;
  }
  if (normalized.opts && typeof normalized.opts === 'object' && !Array.isArray(normalized.opts)) {
    dropNullKeys(normalized.opts as WorkflowBuilderJsonObject, OPTIONAL_FOREACH_OPT_KEYS);
    // Canonical foreach opts requires concurrency, so an emptied opts is invalid.
    if (Object.keys(normalized.opts).length === 0) delete normalized.opts;
  }
  if (
    normalized.type === 'mapping' &&
    typeof normalized.mapConfig !== 'string' &&
    normalized.mapConfig !== null &&
    normalized.mapConfig !== undefined
  ) {
    normalized.mapConfig = JSON.stringify(normalized.mapConfig);
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
  if (normalized.description === null) delete normalized.description;
  if (normalized.metadata === null) delete normalized.metadata;
  if (normalized.stateSchema === null) delete normalized.stateSchema;
  if (normalized.requestContextSchema === null) delete normalized.requestContextSchema;
  if (normalized.schedule === null) delete normalized.schedule;
  if (!Array.isArray(normalized.graph)) throw new TypeError('Workflow definition graph must be an array.');
  normalized.graph = normalized.graph.map(entry =>
    normalizeEntry(entry as Record<string, unknown>),
  ) as unknown as WorkflowBuilderJsonValue[];
  return normalized as unknown as WorkflowBuilderDefinition;
}

export * from './preflight';
export * from './inspection';
export * from './authoring-schema';
export * from './agent';
