import type { ValidatableStepFlowEntry } from '../../../workflows/dynamic/validate/types';
import type { WorkflowScheduleConfig } from '../../../workflows/scheduler/types';
import { StorageDomain } from '../base';

/**
 * On-disk shape for a statically-defined, JSON-round-trippable workflow.
 *
 * Created by tools that produce workflows declaratively (the workflow-builder
 * CLI / studio) and rehydrated at load time into a runnable
 * `Workflow` instance. Anything carrying a closure is intentionally absent
 * from this shape: conditional/loop conditions, mapping `fn` sources, and
 * dynamic sleep durations are out of scope for the static subset.
 */
export interface WorkflowDefinition {
  id: string;
  description?: string;
  metadata?: Record<string, unknown>;

  /** JSON Schema (Draft 2020-12) — rehydrated to Zod via `json-schema-to-zod`. */
  inputSchema: unknown;
  outputSchema: unknown;
  stateSchema?: unknown;
  requestContextSchema?: unknown;

  /**
   * The workflow graph in its JSON-safe form: close to what the engine emits
   * via `serializedStepGraph`, but with full mapping configs preserved (no
   * truncation) and all step/agent/tool references stored as ids.
   *
   * Typed as `ValidatableStepFlowEntry` rather than `SerializedStepFlowEntry`
   * because a persisted row is deliberately not the runtime shape: dates are
   * ISO strings, and the `serializedConditions`/`serializedCondition` debug
   * labels are absent because rehydration derives them from the stored
   * predicates instead of persisting them.
   *
   * Rows are written already normalized (see `normalizeWorkflowBuilderDefinition`),
   * so mapping configs arrive here as JSON strings.
   */
  graph: ValidatableStepFlowEntry[];

  /**
   * Optional declarative schedule config(s), JSON-safe (literal values only).
   * Persisted so rehydrated workflows re-declare their schedules on boot
   * instead of having their `wf_*` schedule rows swept as orphans.
   */
  schedule?: WorkflowScheduleConfig | WorkflowScheduleConfig[];

  /** Lifecycle status. Only 'active' definitions are loaded at startWorkers(). */
  status: 'active' | 'archived';

  /** Provenance — distinguishes user-stored from code-registered workflows. */
  source: 'storage';
  authorId?: string;

  createdAt: Date;
  updatedAt: Date;
}

/** Input for creating a new workflow definition. */
export interface CreateWorkflowDefinitionInput {
  id: string;
  description?: string;
  metadata?: Record<string, unknown>;
  inputSchema: unknown;
  outputSchema: unknown;
  stateSchema?: unknown;
  requestContextSchema?: unknown;
  graph: ValidatableStepFlowEntry[];
  schedule?: WorkflowScheduleConfig | WorkflowScheduleConfig[];
  authorId?: string;
}

/** Input for updating an existing workflow definition. */
export interface UpdateWorkflowDefinitionInput {
  id: string;
  description?: string;
  metadata?: Record<string, unknown>;
  inputSchema?: unknown;
  outputSchema?: unknown;
  stateSchema?: unknown;
  requestContextSchema?: unknown;
  graph?: ValidatableStepFlowEntry[];
  schedule?: WorkflowScheduleConfig | WorkflowScheduleConfig[] | null;
  status?: 'active' | 'archived';
  authorId?: string;
}

export interface ListWorkflowDefinitionsInput {
  status?: 'active' | 'archived';
  authorId?: string;
}

export interface ListWorkflowDefinitionsOutput {
  definitions: WorkflowDefinition[];
  total: number;
}

/**
 * Abstract storage domain for persisted workflow definitions.
 *
 * Versioning is intentionally out of scope for v1 — `upsert` overwrites in
 * place. A future revision can layer the {@link VersionedStorageDomain}
 * pattern on top without breaking the rehydration path.
 */
export abstract class WorkflowDefinitionsStorage extends StorageDomain {
  constructor() {
    super({ component: 'STORAGE', name: 'WORKFLOW_DEFINITIONS' });
  }

  abstract upsert(input: CreateWorkflowDefinitionInput | UpdateWorkflowDefinitionInput): Promise<WorkflowDefinition>;
  abstract get(id: string): Promise<WorkflowDefinition | null>;
  abstract list(args?: ListWorkflowDefinitionsInput): Promise<ListWorkflowDefinitionsOutput>;
  abstract delete(id: string): Promise<void>;
}
