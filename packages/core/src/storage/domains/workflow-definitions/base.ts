import type { ValidatableStepFlowEntry } from '../../../workflows/dynamic/validate/types';
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

  /** Lifecycle status. Only 'active' definitions are loaded at startWorkers(). */
  status: 'active' | 'archived';

  /** Provenance — distinguishes user-stored from code-registered workflows. */
  source: 'storage';

  /** Immutable owner assigned when the definition is created. */
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

  /** Immutable owner to assign when the definition is created. */
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
  status?: 'active' | 'archived';

  /** Expected immutable owner. A different owner produces a conflict. */
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
 * Thrown when an upsert attempts to claim a workflow definition that already
 * belongs to a different author. The message intentionally does not disclose
 * the existing author.
 */
export class WorkflowDefinitionOwnershipConflictError extends Error {
  readonly workflowId: string;

  constructor(workflowId: string) {
    super(`Workflow definition "${workflowId}" conflicts with an existing definition.`);
    this.name = 'WorkflowDefinitionOwnershipConflictError';
    this.workflowId = workflowId;
  }
}

/**
 * Treat an explicitly supplied author as both creation ownership and the
 * expected owner on update. Omitting authorId preserves legacy/unscoped
 * behavior; supplying it can never create or transfer ownership after a row
 * already exists.
 */
export function assertWorkflowDefinitionAuthor(
  existing: Pick<WorkflowDefinition, 'id' | 'authorId'>,
  input: Pick<UpdateWorkflowDefinitionInput, 'authorId'>,
): void {
  if (input.authorId !== undefined && existing.authorId !== input.authorId) {
    throw new WorkflowDefinitionOwnershipConflictError(existing.id);
  }
}

/**
 * Abstract storage domain for persisted workflow definitions.
 *
 * Versioning is intentionally out of scope for v1 — `upsert` overwrites in
 * place. Ownership is the exception: an explicitly supplied `authorId` is an
 * immutable compare condition, so concurrent creators cannot take over the
 * winning row. A future revision can layer the {@link VersionedStorageDomain}
 * pattern on top without breaking the rehydration path.
 */
export abstract class WorkflowDefinitionsStorage extends StorageDomain {
  constructor() {
    super({ component: 'STORAGE', name: 'WORKFLOW_DEFINITIONS' });
  }

  abstract upsert(input: CreateWorkflowDefinitionInput | UpdateWorkflowDefinitionInput): Promise<WorkflowDefinition>;

  /**
   * Atomically create or update a related set of workflow definitions.
   *
   * Implementations must apply every ownership comparison and write in one
   * storage transaction: either every returned definition is durable or none
   * of the inputs has changed storage. The result order matches the input
   * order. This is the persistence boundary used by dynamic workflow bundles,
   * whose members may reference each other and therefore cannot safely become
   * visible one row at a time.
   */
  abstract upsertMany(
    inputs: readonly (CreateWorkflowDefinitionInput | UpdateWorkflowDefinitionInput)[],
  ): Promise<WorkflowDefinition[]>;
  abstract get(id: string): Promise<WorkflowDefinition | null>;
  abstract list(args?: ListWorkflowDefinitionsInput): Promise<ListWorkflowDefinitionsOutput>;
  abstract delete(id: string): Promise<void>;
}
