import type { SerializedStepFlowEntry } from '../../../workflows/types';
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
   * The workflow graph in its JSON-safe form. Same shape the engine already
   * emits via `serializedStepGraph` — but with full mapping configs preserved
   * (no truncation) and all step/agent/tool references stored as ids.
   */
  graph: SerializedStepFlowEntry[];

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
  graph: SerializedStepFlowEntry[];
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
  graph?: SerializedStepFlowEntry[];
  status?: 'active' | 'archived';
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
