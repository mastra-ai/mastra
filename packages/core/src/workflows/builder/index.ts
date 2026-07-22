import type { Predicate } from '../predicate';

export type WorkflowBuilderJsonValue =
  string | number | boolean | null | WorkflowBuilderJsonValue[] | { [key: string]: WorkflowBuilderJsonValue };

export type WorkflowBuilderJsonObject = { [key: string]: WorkflowBuilderJsonValue };

export interface WorkflowBuilderStepOptions {
  retries?: number;
  metadata?: WorkflowBuilderJsonObject;
}

export interface WorkflowBuilderAgentEntry {
  type: 'agent';
  id: string;
  agentId: string;
  outputSchema?: WorkflowBuilderJsonObject;
  options?: WorkflowBuilderStepOptions;
}

export interface WorkflowBuilderToolEntry {
  type: 'tool';
  id: string;
  toolId: string;
  options?: WorkflowBuilderStepOptions;
}

export interface WorkflowBuilderMappingEntry {
  type: 'mapping';
  id: string;
  mapConfig: string;
}

export interface WorkflowBuilderWorkflowEntry {
  type: 'workflow';
  id: string;
  workflowId: string;
  options?: WorkflowBuilderStepOptions;
}

export type WorkflowBuilderSingleStepEntry =
  WorkflowBuilderAgentEntry | WorkflowBuilderToolEntry | WorkflowBuilderMappingEntry | WorkflowBuilderWorkflowEntry;

export interface WorkflowBuilderParallelEntry {
  type: 'parallel';
  steps: WorkflowBuilderSingleStepEntry[];
}

export interface WorkflowBuilderForeachEntry {
  type: 'foreach';
  step: Exclude<WorkflowBuilderSingleStepEntry, WorkflowBuilderMappingEntry>;
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
  steps: WorkflowBuilderSingleStepEntry[];
  predicates: Predicate[];
}

export interface WorkflowBuilderLoopEntry {
  type: 'loop';
  step: WorkflowBuilderSingleStepEntry;
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

Every adjacent step must compose exactly: the previous output shape must satisfy the next input schema. Agent inputs are always { prompt: string }. Insert a mapping step whenever shapes differ; never rely on implicit coercion. A mapping's output keys are the top-level keys of its JSON-encoded mapConfig.

Parallel and conditional children must be single-step agent, tool, mapping, or nested workflow entries; do not nest containers inside them. Foreach bodies may be agent, tool, or nested workflow entries. Loop bodies may be any single-step entry. Conditional predicates align by index with their branch steps. Loop and conditional predicates must use the declarative predicate DSL.

Use dependency IDs returned by discovery. Never invent agent, tool, or workflow IDs. Keep workflow IDs, step IDs, schemas, mapping configs, options, predicates, and metadata JSON-safe.`;

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
