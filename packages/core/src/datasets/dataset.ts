import { isZodType } from '@mastra/schema-compat';
import { zodToJsonSchema } from '@mastra/schema-compat/zod-to-json';
import { MastraError } from '../error/index.js';
import type { TrajectoryExpectation } from '../evals/types.js';
import { validateAndSaveScore } from '../mastra/hooks.js';
import type { Mastra } from '../mastra/index.js';
import type { DatasetsStorage } from '../storage/domains/datasets/base.js';
import type { ExperimentsStorage } from '../storage/domains/experiments/base.js';
import type {
  DatasetRecord,
  DatasetItem,
  DatasetItemPayload,
  DatasetItemRow,
  DatasetTenancyFilters,
  DatasetVersion,
  Experiment,
  ExperimentProvenance,
  ExperimentResult,
  ExperimentResultStatus,
  ExperimentStatus,
  ExperimentTenancyFilters,
  ListDatasetItemsOutput,
  ListExperimentResultsOutput,
  ListExperimentsOutput,
  TargetType,
  UpdateDatasetInput,
  UpdateDatasetItemInput,
  UpdateExperimentResultInput,
} from '../storage/types.js';
import { runExperiment, resolveTarget, executeExperimentItem } from './experiment/index.js';
import { experimentScoreId } from './experiment/scorer.js';
import type { ExperimentConfig, StartExperimentConfig, ExperimentSummary } from './experiment/types.js';

/**
 * Public API for interacting with a single dataset.
 *
 * Provides methods for item CRUD, versioning, and experiment management.
 * Obtained via `DatasetsManager.get()` or `DatasetsManager.create()`.
 */
export class Dataset {
  readonly id: string;
  #mastra: Mastra;
  #datasetsStore?: DatasetsStorage;
  #experimentsStore?: ExperimentsStorage;
  /**
   * Tenancy read-scope carried by the handle. When set, all internal reads
   * ({@link Dataset.getDetails}, {@link Dataset.startExperimentAsync}) and item
   * mutations forward these filters to storage so cross-tenant reads/mutations
   * over a leaked dataset id are rejected as NOT_FOUND (or silent no-op for
   * deletes) rather than succeeding.
   */
  #scope?: DatasetTenancyFilters;

  constructor(id: string, mastra: Mastra, scope?: DatasetTenancyFilters) {
    this.id = id;
    this.#mastra = mastra;
    this.#scope = scope;
  }

  // ---------------------------------------------------------------------------
  // Lazy storage resolution
  // ---------------------------------------------------------------------------

  async #getDatasetsStore(): Promise<DatasetsStorage> {
    if (this.#datasetsStore) return this.#datasetsStore;

    const storage = this.#mastra.getStorage();
    if (!storage) {
      throw new MastraError({
        id: 'DATASETS_STORAGE_NOT_CONFIGURED',
        text: 'Storage not configured. Configure storage in Mastra instance.',
        domain: 'STORAGE',
        category: 'USER',
      });
    }

    const store = await storage.getStore('datasets');
    if (!store) {
      throw new MastraError({
        id: 'DATASETS_STORE_NOT_AVAILABLE',
        text: 'Datasets store not available. Ensure your storage adapter provides a datasets domain.',
        domain: 'STORAGE',
        category: 'USER',
      });
    }

    this.#datasetsStore = store;
    return store;
  }

  async #getExperimentsStore(): Promise<ExperimentsStorage> {
    if (this.#experimentsStore) return this.#experimentsStore;

    const storage = this.#mastra.getStorage();
    if (!storage) {
      throw new MastraError({
        id: 'DATASETS_STORAGE_NOT_CONFIGURED',
        text: 'Storage not configured. Configure storage in Mastra instance.',
        domain: 'STORAGE',
        category: 'USER',
      });
    }

    const store = await storage.getStore('experiments');
    if (!store) {
      throw new MastraError({
        id: 'EXPERIMENTS_STORE_NOT_AVAILABLE',
        text: 'Experiments store not available. Ensure your storage adapter provides an experiments domain.',
        domain: 'STORAGE',
        category: 'USER',
      });
    }

    this.#experimentsStore = store;
    return store;
  }

  /**
   * Preflight tenancy gate for storage APIs whose signatures don't accept
   * `filters`. When the handle has a `#scope`, a scoped `getDatasetById` is
   * used to prove the dataset exists in the caller's tenancy; on miss we
   * throw NOT_FOUND, mirroring {@link Dataset.getDetails}. Callers that must
   * return a non-throwing empty result (e.g. list endpoints) should catch and
   * translate.
   */
  async #assertScope(): Promise<void> {
    if (!this.#scope) return;
    const store = await this.#getDatasetsStore();
    const record = await store.getDatasetById({ id: this.id, filters: this.#scope });
    if (!record) {
      throw new MastraError({
        id: 'DATASET_NOT_FOUND',
        text: `Dataset not found: ${this.id}`,
        domain: 'STORAGE',
        category: 'USER',
      });
    }
  }

  /**
   * Ownership gate: verifies a child record's `datasetId` matches `this.id`.
   * Prevents a valid scoped handle from reading/mutating child records
   * (items, experiments, results) that live under a different dataset — even
   * one in the same tenant. Returns `null` when the record is missing or
   * belongs to a different dataset, so callers can either return null or
   * translate to NOT_FOUND depending on their contract.
   */
  #ownsChild<T extends { datasetId?: string | null }>(record: T | null | undefined): T | null {
    if (!record) return null;
    if (record.datasetId !== this.id) return null;
    return record;
  }

  // ---------------------------------------------------------------------------
  // Dataset metadata
  // ---------------------------------------------------------------------------

  /**
   * Get the full dataset record from storage.
   */
  async getDetails(): Promise<DatasetRecord> {
    const store = await this.#getDatasetsStore();
    const record = await store.getDatasetById({ id: this.id, filters: this.#scope });
    if (!record) {
      throw new MastraError({
        id: 'DATASET_NOT_FOUND',
        text: `Dataset not found: ${this.id}`,
        domain: 'STORAGE',
        category: 'USER',
      });
    }
    return record;
  }

  /**
   * Update dataset metadata and/or schemas.
   *
   * Accepts Zod schemas for `inputSchema` / `groundTruthSchema` (widened to
   * `unknown`); they are normalized to JSON Schema before being forwarded to
   * the storage-canonical {@link UpdateDatasetInput} shape. All other fields
   * mirror {@link UpdateDatasetInput} exactly (minus `id`, which is supplied
   * from `this.id`).
   */
  async update(
    input: Omit<UpdateDatasetInput, 'id' | 'inputSchema' | 'groundTruthSchema'> & {
      inputSchema?: unknown;
      groundTruthSchema?: unknown;
    },
  ): Promise<DatasetRecord> {
    const store = await this.#getDatasetsStore();

    let { inputSchema, groundTruthSchema, ...rest } = input;

    if (inputSchema !== undefined && inputSchema !== null && isZodType(inputSchema)) {
      inputSchema = zodToJsonSchema(inputSchema);
    }
    if (groundTruthSchema !== undefined && groundTruthSchema !== null && isZodType(groundTruthSchema)) {
      groundTruthSchema = zodToJsonSchema(groundTruthSchema);
    }

    return store.updateDataset({
      id: this.id,
      ...rest,
      inputSchema: inputSchema as Record<string, unknown> | null | undefined,
      groundTruthSchema: groundTruthSchema as Record<string, unknown> | null | undefined,
      filters: this.#scope,
    });
  }

  // ---------------------------------------------------------------------------
  // Item CRUD
  // ---------------------------------------------------------------------------

  /**
   * Add a single item to the dataset.
   */
  async addItem(input: DatasetItemPayload): Promise<DatasetItem> {
    const store = await this.#getDatasetsStore();
    return store.addItem({ datasetId: this.id, ...input, filters: this.#scope });
  }

  /**
   * Add multiple items to the dataset in bulk.
   */
  async addItems(input: { items: DatasetItemPayload[] }): Promise<DatasetItem[]> {
    const store = await this.#getDatasetsStore();
    return store.batchInsertItems({
      datasetId: this.id,
      items: input.items,
      filters: this.#scope,
    });
  }

  /**
   * Get a single item by ID, optionally at a specific version.
   */
  async getItem(args: { itemId: string; version?: number }): Promise<DatasetItem | null> {
    await this.#assertScope();
    const store = await this.#getDatasetsStore();
    const item = await store.getItemById({ id: args.itemId, datasetVersion: args.version });
    return this.#ownsChild(item);
  }

  /**
   * List items in the dataset, optionally at a specific version, with
   * optional substring search and pagination.
   *
   * Return shape depends on the arguments:
   *
   * - When `version` is the only argument provided (no `search`, `page`, or
   *   `perPage`), returns a bare `DatasetItem[]` snapshot of every item at
   *   that version. This shape is retained for callers that predate
   *   server-side pagination on the versioned path; new code should pass
   *   `page` / `perPage` (or `search`) to opt into the paginated shape.
   * - In all other cases (no arguments, or `search` / `page` / `perPage`
   *   provided with or without `version`), returns the paginated
   *   `{ items, pagination }` shape.
   *
   * @deprecated The `DatasetItem[]` branch of the return type is retained
   * for backwards compatibility with the `version`-only call form; pass
   * `page` / `perPage` (or `search`) to always receive the paginated
   * `{ items, pagination }` shape.
   */
  async listItems(args?: {
    version?: number;
    page?: number;
    perPage?: number;
    search?: string;
  }): Promise<DatasetItem[] | ListDatasetItemsOutput> {
    const store = await this.#getDatasetsStore();

    const onlyVersion =
      args?.version !== undefined && args.search === undefined && args.page === undefined && args.perPage === undefined;

    if (onlyVersion) {
      // getItemsByVersion is keyed by datasetId — gate via scoped parent existence
      await this.#assertScope();
      return store.getItemsByVersion({ datasetId: this.id, version: args.version! });
    }

    return store.listItems({
      datasetId: this.id,
      ...(args?.version !== undefined ? { version: args.version } : {}),
      ...(args?.search ? { search: args.search } : {}),
      pagination: { page: args?.page ?? 0, perPage: args?.perPage ?? 20 },
      filters: this.#scope,
    });
  }

  /**
   * Update an existing item in the dataset. Only the provided payload fields
   * are patched.
   */
  async updateItem(
    input: { itemId: string } & Omit<UpdateDatasetItemInput, 'id' | 'datasetId' | 'filters'>,
  ): Promise<DatasetItem> {
    const store = await this.#getDatasetsStore();
    const { itemId, ...rest } = input;
    return store.updateItem({ id: itemId, datasetId: this.id, ...rest, filters: this.#scope });
  }

  /**
   * Delete a single item from the dataset.
   */
  async deleteItem(args: { itemId: string }): Promise<void> {
    const store = await this.#getDatasetsStore();
    return store.deleteItem({ id: args.itemId, datasetId: this.id, filters: this.#scope });
  }

  /**
   * Delete multiple items from the dataset in bulk.
   */
  async deleteItems(args: { itemIds: string[] }): Promise<void> {
    const store = await this.#getDatasetsStore();
    return store.batchDeleteItems({ datasetId: this.id, itemIds: args.itemIds, filters: this.#scope });
  }

  // ---------------------------------------------------------------------------
  // Versioning
  // ---------------------------------------------------------------------------

  /**
   * List all versions of this dataset.
   */
  async listVersions(args?: { page?: number; perPage?: number }): Promise<{
    versions: DatasetVersion[];
    pagination: { total: number; page: number; perPage: number | false; hasMore: boolean };
  }> {
    await this.#assertScope();
    const store = await this.#getDatasetsStore();
    return store.listDatasetVersions({
      datasetId: this.id,
      pagination: { page: args?.page ?? 0, perPage: args?.perPage ?? 20 },
    });
  }

  /**
   * Get full SCD-2 history of a specific item across all dataset versions.
   */
  async getItemHistory(args: { itemId: string }): Promise<DatasetItemRow[]> {
    await this.#assertScope();
    const store = await this.#getDatasetsStore();
    const rows = await store.getItemHistory(args.itemId);
    // Ownership gate: SCD-2 history is keyed only by item id — filter out any
    // rows that don't belong to this dataset so a known cross-dataset item id
    // cannot leak history through a valid scoped handle.
    return rows.filter(row => row.datasetId === this.id);
  }

  // ---------------------------------------------------------------------------
  // Experiments
  // ---------------------------------------------------------------------------

  /**
   * Run an experiment on this dataset and wait for completion.
   */
  async startExperiment<I = unknown, O = unknown, E = unknown>(
    config: StartExperimentConfig<I, O, E>,
  ): Promise<ExperimentSummary> {
    return runExperiment(this.#mastra, {
      datasetId: this.id,
      ...config,
      filters: this.#scope,
    } as ExperimentConfig);
  }

  /**
   * Start an experiment asynchronously (fire-and-forget).
   * Returns immediately with the experiment ID and pending status.
   */
  async startExperimentAsync<I = unknown, O = unknown, E = unknown>(
    config: StartExperimentConfig<I, O, E>,
  ): Promise<{ experimentId: string; status: 'pending'; totalItems: number }> {
    const persistExperiments = config.persistence?.experiments !== 'none';
    const experimentsStore = persistExperiments ? await this.#getExperimentsStore() : undefined;
    const datasetsStore = await this.#getDatasetsStore();

    const dataset = await datasetsStore.getDatasetById({ id: this.id, filters: this.#scope });
    if (!dataset) {
      throw new MastraError({
        id: 'DATASET_NOT_FOUND',
        text: `Dataset not found: ${this.id}`,
        domain: 'STORAGE',
        category: 'USER',
      });
    }

    // Validate that dataset has items before creating experiment record
    const targetVersion = config.version ?? dataset.version;
    const items = await datasetsStore.getItemsByVersion({
      datasetId: this.id,
      version: targetVersion,
    });
    if (items.length === 0) {
      throw new MastraError({
        id: 'EXPERIMENT_NO_ITEMS',
        text: `Cannot run experiment: dataset "${this.id}" has no items at version ${targetVersion}`,
        domain: 'STORAGE',
        category: 'USER',
      });
    }

    const experimentId = crypto.randomUUID();

    if (experimentsStore) {
      await experimentsStore.createExperiment({
        id: experimentId,
        datasetId: this.id,
        datasetVersion: targetVersion,
        targetType: config.targetType ?? 'agent',
        targetId: config.targetId ?? 'inline',
        totalItems: items.length,
        name: config.name,
        description: config.description,
        metadata: config.metadata,
        provenance: config.provenance,
        experimentSetId: config.grouping?.experimentSetId,
        comparisonId: config.grouping?.comparisonId,
        variantId: config.grouping?.variantId,
        trialIndex: config.grouping?.trialIndex,
        agentVersion: config.agentVersion,
        organizationId: dataset.organizationId ?? null,
        projectId: dataset.projectId ?? null,
      });
    }

    // Fire-and-forget — runExperiment resolves the applicable run, item, or dataset scorer source
    void runExperiment(this.#mastra, {
      datasetId: this.id,
      experimentId,
      ...config,
      version: targetVersion,
      filters: this.#scope,
    } as ExperimentConfig).catch(async err => {
      if (experimentsStore) {
        await experimentsStore
          .updateExperiment({
            id: experimentId,
            status: 'failed',
            completedAt: new Date(),
          })
          .catch(() => {});
      }
      this.#mastra.getLogger()?.error(`Experiment ${experimentId} failed: ${err?.message ?? err}`);
    });

    return { experimentId, status: 'pending' as const, totalItems: items.length };
  }

  /**
   * List experiments (runs) for this dataset, with optional filters and
   * pagination. All filters are pushed to the storage layer.
   *
   * @param args.targetType   Restrict to a specific target type (e.g. `agent`).
   * @param args.targetId     Restrict to a specific target ID.
   * @param args.agentVersion Restrict to a specific agent version — useful for
   *                          baseline vs variant read patterns.
   * @param args.status       Restrict to a specific experiment status.
   * @param args.filters      Multi-tenant scoping filters (organization/project).
   * @param args.page         Page number. Defaults to `0`.
   * @param args.perPage      Page size. Defaults to `20`.
   */
  async listExperiments(args?: {
    targetType?: TargetType;
    targetId?: string;
    agentVersion?: string;
    status?: ExperimentStatus;
    experimentSetId?: string;
    comparisonId?: string;
    variantId?: string;
    trialIndex?: number;
    filters?: ExperimentTenancyFilters;
    page?: number;
    perPage?: number;
  }): Promise<ListExperimentsOutput> {
    await this.#assertScope();
    const experimentsStore = await this.#getExperimentsStore();
    return experimentsStore.listExperiments({
      datasetId: this.id,
      ...(args?.targetType !== undefined ? { targetType: args.targetType } : {}),
      ...(args?.targetId !== undefined ? { targetId: args.targetId } : {}),
      ...(args?.agentVersion !== undefined ? { agentVersion: args.agentVersion } : {}),
      ...(args?.status !== undefined ? { status: args.status } : {}),
      ...(args?.experimentSetId !== undefined ? { experimentSetId: args.experimentSetId } : {}),
      ...(args?.comparisonId !== undefined ? { comparisonId: args.comparisonId } : {}),
      ...(args?.variantId !== undefined ? { variantId: args.variantId } : {}),
      ...(args?.trialIndex !== undefined ? { trialIndex: args.trialIndex } : {}),
      ...(args?.filters !== undefined ? { filters: args.filters } : {}),
      pagination: { page: args?.page ?? 0, perPage: args?.perPage ?? 20 },
    });
  }

  /**
   * Verify the experiment belongs to this dataset (and, by extension, to the
   * handle's tenancy scope which was enforced when the handle was minted).
   * Throws NOT_FOUND on missing or cross-dataset experiments so cross-tenant
   * mutation via a valid scoped handle + a known foreign experimentId is
   * rejected.
   */
  async #assertExperimentOwnership(experimentId: string): Promise<void> {
    await this.#assertScope();
    const experimentsStore = await this.#getExperimentsStore();
    const experiment = await experimentsStore.getExperimentById({
      id: experimentId,
      filters: this.#scope,
    });
    if (!experiment || experiment.datasetId !== this.id) {
      throw new MastraError({
        id: 'EXPERIMENT_NOT_FOUND',
        text: `Experiment not found: ${experimentId}`,
        domain: 'STORAGE',
        category: 'USER',
      });
    }
  }

  /**
   * Get a specific experiment (run) by ID.
   */
  async getExperiment(args: { experimentId: string }) {
    await this.#assertScope();
    const experimentsStore = await this.#getExperimentsStore();
    const experiment = await experimentsStore.getExperimentById({
      id: args.experimentId,
      filters: this.#scope,
    });
    if (!experiment || experiment.datasetId !== this.id) return null;
    return experiment;
  }

  /**
   * Update an experiment's user-facing label (name, description, metadata).
   * Status and counters are owned by the runtime and cannot be changed here.
   * Throws EXPERIMENT_NOT_FOUND for unknown or cross-dataset experiments.
   */
  async updateExperiment(args: {
    experimentId: string;
    name?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Experiment> {
    await this.#getOwnedExperiment(args.experimentId);
    const experimentsStore = await this.#getExperimentsStore();
    return experimentsStore.updateExperiment({
      id: args.experimentId,
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.description !== undefined ? { description: args.description } : {}),
      ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
    });
  }

  /**
   * List results for a specific experiment, with optional filters and
   * pagination. All filters are pushed to the storage layer.
   *
   * @param args.experimentId The experiment whose results to list.
   * @param args.traceId      Restrict to results linked to a specific trace.
   * @param args.status       Restrict to a specific per-result review status.
   * @param args.filters      Multi-tenant scoping filters (organization/project).
   * @param args.page         Page number. Defaults to `0`.
   * @param args.perPage      Page size. Defaults to `20`.
   */
  async listExperimentResults(args: {
    experimentId: string;
    traceId?: string;
    status?: ExperimentResultStatus;
    filters?: ExperimentTenancyFilters;
    page?: number;
    perPage?: number;
  }): Promise<ListExperimentResultsOutput> {
    await this.#assertExperimentOwnership(args.experimentId);
    const experimentsStore = await this.#getExperimentsStore();
    return experimentsStore.listExperimentResults({
      experimentId: args.experimentId,
      ...(args.traceId !== undefined ? { traceId: args.traceId } : {}),
      ...(args.status !== undefined ? { status: args.status } : {}),
      ...(args.filters !== undefined ? { filters: args.filters } : {}),
      pagination: { page: args?.page ?? 0, perPage: args?.perPage ?? 20 },
    });
  }

  /**
   * Update an experiment result's status or tags.
   */
  async updateExperimentResult(input: UpdateExperimentResultInput & { experimentId: string }) {
    // The result's parent experiment must belong to this dataset. If the
    // caller supplied `experimentId`, verify ownership on that; otherwise we
    // cannot bind the update to this dataset and must reject.
    if (!input.experimentId) {
      throw new MastraError({
        id: 'EXPERIMENT_RESULT_MISSING_EXPERIMENT_ID',
        text: 'updateExperimentResult requires experimentId when called via a Dataset handle',
        domain: 'STORAGE',
        category: 'USER',
      });
    }
    await this.#assertExperimentOwnership(input.experimentId);
    const experimentsStore = await this.#getExperimentsStore();
    return experimentsStore.updateExperimentResult(input);
  }

  // ---------------------------------------------------------------------------
  // Caller-driven experiments (caller owns the loop)
  // ---------------------------------------------------------------------------

  /**
   * Load an experiment owned by this dataset (tenancy + dataset ownership).
   * Used by the caller-driven methods so a caller cannot mutate another
   * dataset's (or tenant's) experiment.
   */
  async #getOwnedExperiment(experimentId: string): Promise<Experiment> {
    await this.#assertScope();
    const experimentsStore = await this.#getExperimentsStore();
    const experiment = await experimentsStore.getExperimentById({
      id: experimentId,
      filters: this.#scope,
    });
    if (!experiment || experiment.datasetId !== this.id) {
      throw new MastraError({
        id: 'EXPERIMENT_NOT_FOUND',
        text: `Experiment not found: ${experimentId}`,
        domain: 'STORAGE',
        category: 'USER',
      });
    }
    return experiment;
  }

  /**
   * Create an experiment whose execution loop is owned by the caller
   * (e.g. a Temporal workflow). No runner is spawned. Two shapes:
   *
   * - With `targetType`/`targetId`: the caller drives the loop and Mastra
   *   executes each item on demand via {@link Dataset.runExperimentItem}.
   *   Optional `scorers` are pinned on the experiment as the run-level
   *   scorer source.
   * - Without a target: pure ingestion — the caller executes and scores
   *   everything itself and upserts rows via
   *   {@link Dataset.submitExperimentResult}.
   *
   * Either way the caller closes the run with
   * {@link Dataset.finalizeExperiment}.
   *
   * Idempotent on `id`: passing a caller-supplied id (e.g. a workflow run id)
   * and retrying the create converges on the same experiment instead of
   * creating duplicates.
   */
  async createExperiment(args?: {
    /** Caller-supplied experiment id (e.g. a workflow run id) for idempotent creates. */
    id?: string;
    /** Target to execute per item via {@link Dataset.runExperimentItem}. Both or neither of targetType/targetId. */
    targetType?: TargetType;
    targetId?: string;
    /** Run-level scorer IDs, resolved server-side by {@link Dataset.runExperimentItem}. Requires a target. */
    scorers?: string[];
    name?: string;
    description?: string;
    metadata?: Record<string, unknown>;
    provenance?: ExperimentProvenance;
    grouping?: { experimentSetId?: string; comparisonId?: string; variantId?: string; trialIndex?: number };
    /** Dataset version to pin. Defaults to the dataset's current version. */
    version?: number;
  }): Promise<{
    experimentId: string;
    status: ExperimentStatus;
    totalItems: number;
    datasetVersion: number;
    /** The persisted start timestamp — stable across retried creates with the same `id`. */
    startedAt: Date | null;
  }> {
    const experimentsStore = await this.#getExperimentsStore();
    const datasetsStore = await this.#getDatasetsStore();

    const hasTargetType = args?.targetType !== undefined;
    const hasTargetId = args?.targetId !== undefined;
    if (hasTargetType !== hasTargetId) {
      throw new MastraError({
        id: 'EXPERIMENT_INVALID_TARGET',
        text: `targetType and targetId must be provided together (got targetType: ${args?.targetType ?? 'none'}, targetId: ${args?.targetId ?? 'none'})`,
        domain: 'STORAGE',
        category: 'USER',
      });
    }
    if (args?.scorers?.length && !hasTargetType) {
      throw new MastraError({
        id: 'EXPERIMENT_INVALID_TARGET',
        text: 'scorers require a target: without a target Mastra never executes or scores items; submit flat scores via submitExperimentResult instead',
        domain: 'STORAGE',
        category: 'USER',
      });
    }
    // Validate the target exists in this Mastra registry at create time so a
    // typo fails fast instead of failing on the first runExperimentItem call.
    if (hasTargetType) {
      const resolved = await resolveTarget(this.#mastra, args!.targetType!, args!.targetId!);
      if (!resolved) {
        throw new MastraError({
          id: 'EXPERIMENT_TARGET_NOT_FOUND',
          text: `Target not found: ${args!.targetType} "${args!.targetId}"`,
          domain: 'STORAGE',
          category: 'USER',
        });
      }
    }

    const dataset = await datasetsStore.getDatasetById({ id: this.id, filters: this.#scope });
    if (!dataset) {
      throw new MastraError({
        id: 'DATASET_NOT_FOUND',
        text: `Dataset not found: ${this.id}`,
        domain: 'STORAGE',
        category: 'USER',
      });
    }

    // Idempotent create: a retried create with the same id returns the
    // existing experiment instead of failing or duplicating.
    if (args?.id) {
      const existing = await experimentsStore.getExperimentById({ id: args.id, filters: this.#scope });
      if (existing) {
        const sameShape =
          existing.datasetId === this.id &&
          existing.targetType === (args.targetType ?? null) &&
          existing.targetId === (args.targetId ?? null);
        if (!sameShape) {
          throw new MastraError({
            id: 'EXPERIMENT_ID_CONFLICT',
            text: `Experiment id ${args.id} already exists and does not match this experiment's dataset or target`,
            domain: 'STORAGE',
            category: 'USER',
          });
        }
        // Repair a half-created record: a prior create that crashed between
        // createExperiment and the status update leaves the row 'pending'.
        // A retried create finishes the job so the caller never observes a
        // permanently-pending experiment.
        let status = existing.status;
        let startedAt = existing.startedAt ?? null;
        if (existing.status === 'pending') {
          startedAt = new Date();
          await experimentsStore.updateExperiment({ id: existing.id, status: 'running', startedAt });
          status = 'running';
        }
        return {
          experimentId: existing.id,
          status,
          totalItems: existing.totalItems,
          datasetVersion: existing.datasetVersion ?? dataset.version,
          startedAt,
        };
      }
    }

    const targetVersion = args?.version ?? dataset.version;
    const items = await datasetsStore.getItemsByVersion({ datasetId: this.id, version: targetVersion });
    if (items.length === 0) {
      throw new MastraError({
        id: 'EXPERIMENT_NO_ITEMS',
        text: `Cannot create experiment: dataset "${this.id}" has no items at version ${targetVersion}`,
        domain: 'STORAGE',
        category: 'USER',
      });
    }

    const experimentId = args?.id ?? crypto.randomUUID();

    try {
      await experimentsStore.createExperiment({
        id: experimentId,
        datasetId: this.id,
        datasetVersion: targetVersion,
        targetType: args?.targetType ?? null,
        targetId: args?.targetId ?? null,
        scorerIds: args?.scorers?.length ? args.scorers : null,
        totalItems: items.length,
        name: args?.name,
        description: args?.description,
        metadata: args?.metadata,
        provenance: args?.provenance,
        experimentSetId: args?.grouping?.experimentSetId,
        comparisonId: args?.grouping?.comparisonId,
        variantId: args?.grouping?.variantId,
        trialIndex: args?.grouping?.trialIndex,
        organizationId: dataset.organizationId ?? null,
        projectId: dataset.projectId ?? null,
      });
    } catch (createError) {
      // Concurrent creates with the same caller-supplied id can both miss the
      // idempotency read and race into createExperiment; the loser hits a
      // duplicate-id failure. Converge by re-reading the winner's record.
      if (!args?.id) throw createError;
      const existing = await experimentsStore.getExperimentById({ id: args.id, filters: this.#scope });
      if (!existing) throw createError;
      const sameShape =
        existing.datasetId === this.id &&
        existing.targetType === (args.targetType ?? null) &&
        existing.targetId === (args.targetId ?? null);
      if (!sameShape) {
        throw new MastraError({
          id: 'EXPERIMENT_ID_CONFLICT',
          text: `Experiment id ${args.id} already exists and does not match this experiment's dataset or target`,
          domain: 'STORAGE',
          category: 'USER',
        });
      }
      return {
        experimentId: existing.id,
        status: existing.status,
        totalItems: existing.totalItems,
        datasetVersion: existing.datasetVersion ?? dataset.version,
        startedAt: existing.startedAt ?? null,
      };
    }

    // Caller-driven experiments are "running" from creation: the caller
    // owns the loop and there is no queued/pending phase inside Mastra.
    // If this update fails after a successful create, a retried create with
    // the same id repairs the 'pending' status (see the idempotency branch).
    const startedAt = new Date();
    await experimentsStore.updateExperiment({ id: experimentId, status: 'running', startedAt });

    return { experimentId, status: 'running', totalItems: items.length, datasetVersion: targetVersion, startedAt };
  }

  /**
   * Execute one experiment item server-side: run the experiment's target
   * against the item, run the resolved scorers, and upsert the result row
   * keyed by `(experimentId, itemId, attempt)`.
   *
   * Built for caller-driven loops (mode 2): a durable orchestrator (e.g. a
   * Temporal workflow) fans out one call per item and owns retries/timeouts —
   * a retried call converges on the same row. Requires an experiment created
   * with a target via {@link Dataset.createExperiment}.
   *
   * Scorer precedence: experiment `scorers` → item `scorerIds` → dataset
   * `scorerIds` → none.
   */
  async runExperimentItem(args: {
    experimentId: string;
    itemId: string;
    /** Zero-based repetition index for repeated trials. Defaults to `0`. */
    attempt?: number;
    /** Request context merged with the item's own request context (item wins). */
    requestContext?: Record<string, unknown>;
  }): Promise<{ result: ExperimentResult; scores: Awaited<ReturnType<typeof executeExperimentItem>>['scores'] }> {
    const experiment = await this.#getOwnedExperiment(args.experimentId);
    if (experiment.targetType === null) {
      throw new MastraError({
        id: 'EXPERIMENT_HAS_NO_TARGET',
        text: `Experiment ${args.experimentId} has no target; ingest results via submitExperimentResult instead`,
        domain: 'STORAGE',
        category: 'USER',
      });
    }
    if (experiment.status === 'completed' || experiment.status === 'failed') {
      throw new MastraError({
        id: 'EXPERIMENT_ALREADY_FINALIZED',
        text: `Experiment ${args.experimentId} is already ${experiment.status}; no further items can be run`,
        domain: 'STORAGE',
        category: 'USER',
      });
    }

    const datasetsStore = await this.#getDatasetsStore();
    const dataset = await datasetsStore.getDatasetById({ id: this.id, filters: this.#scope });
    const item = await datasetsStore.getItemById({
      id: args.itemId,
      datasetVersion: experiment.datasetVersion ?? undefined,
    });
    if (!item || item.datasetId !== this.id) {
      throw new MastraError({
        id: 'DATASET_ITEM_NOT_FOUND',
        text: `Item ${args.itemId} not found in dataset ${this.id} at version ${experiment.datasetVersion}`,
        domain: 'STORAGE',
        category: 'USER',
      });
    }

    return executeExperimentItem({
      mastra: this.#mastra,
      experiment,
      item: {
        id: item.id,
        datasetVersion: item.datasetVersion,
        input: item.input,
        groundTruth: item.groundTruth,
        expectedTrajectory: item.expectedTrajectory as TrajectoryExpectation | undefined,
        requestContext: item.requestContext,
        metadata: item.metadata,
        scorerIds: item.scorerIds,
      },
      datasetScorerIds: dataset?.scorerIds ?? null,
      attempt: args.attempt ?? 0,
      requestContext: args.requestContext,
      organizationId: experiment.organizationId ?? dataset?.organizationId ?? null,
      projectId: experiment.projectId ?? dataset?.projectId ?? null,
    });
  }

  /**
   * Submit (or re-submit) one item result for a target-less (pure-ingestion)
   * experiment created with {@link Dataset.createExperiment}.
   *
   * Upsert semantics: the row is identified by the natural key
   * `(experimentId, itemId, attempt)`, so a retried submission (e.g. a
   * retried Temporal activity) converges on a single row instead of
   * duplicating. `attempt` defaults to `0`; use it only for intentional
   * repeated trials of the same item.
   *
   * `input` / `groundTruth` default to the dataset item's values at the
   * experiment's pinned dataset version when omitted.
   *
   * Inline `scores` are persisted to the scores store keyed by
   * `runId = experimentId`, the same shape the native runner writes, so
   * comparisons and Studio aggregation work unchanged. Score persistence is
   * best-effort and never fails the submission.
   */
  async submitExperimentResult(args: {
    experimentId: string;
    itemId: string;
    /** Zero-based repetition index for repeated trials. Defaults to `0`. */
    attempt?: number;
    input?: unknown;
    output?: unknown;
    groundTruth?: unknown;
    error?: { message: string; stack?: string; code?: string } | null;
    startedAt?: Date;
    completedAt?: Date;
    traceId?: string;
    scores?: {
      scorerId: string;
      scorerName?: string;
      score: number;
      reason?: string;
      metadata?: Record<string, unknown>;
    }[];
  }): Promise<ExperimentResult> {
    const experiment = await this.#getOwnedExperiment(args.experimentId);
    if (experiment.targetType !== null) {
      throw new MastraError({
        id: 'EXPERIMENT_HAS_TARGET',
        text: `Experiment ${args.experimentId} has a target (${experiment.targetType} "${experiment.targetId}"); results are produced by Mastra, not ingested. Use runExperimentItem instead.`,
        domain: 'STORAGE',
        category: 'USER',
      });
    }
    if (experiment.status === 'completed' || experiment.status === 'failed') {
      throw new MastraError({
        id: 'EXPERIMENT_ALREADY_FINALIZED',
        text: `Experiment ${args.experimentId} is already ${experiment.status}; no further results can be submitted`,
        domain: 'STORAGE',
        category: 'USER',
      });
    }

    const datasetsStore = await this.#getDatasetsStore();
    const item = await datasetsStore.getItemById({
      id: args.itemId,
      datasetVersion: experiment.datasetVersion ?? undefined,
    });
    if (!item || item.datasetId !== this.id) {
      throw new MastraError({
        id: 'DATASET_ITEM_NOT_FOUND',
        text: `Item ${args.itemId} not found in dataset ${this.id} at version ${experiment.datasetVersion}`,
        domain: 'STORAGE',
        category: 'USER',
      });
    }

    const experimentsStore = await this.#getExperimentsStore();
    const now = new Date();
    const result = await experimentsStore.upsertExperimentResult({
      experimentId: args.experimentId,
      itemId: args.itemId,
      attempt: args.attempt ?? 0,
      itemDatasetVersion: experiment.datasetVersion,
      input: args.input !== undefined ? args.input : item.input,
      output: args.output ?? null,
      groundTruth: args.groundTruth !== undefined ? args.groundTruth : (item.groundTruth ?? null),
      metadata: item.metadata,
      error: args.error ?? null,
      startedAt: args.startedAt ?? now,
      completedAt: args.completedAt ?? now,
      retryCount: 0,
      traceId: args.traceId ?? null,
      organizationId: experiment.organizationId ?? null,
      projectId: experiment.projectId ?? null,
    });

    if (args.scores?.length) {
      const storage = this.#mastra.getStorage();
      if (storage) {
        // Retry convergence: the result row upserts on (experimentId, itemId,
        // attempt); score rows use a deterministic id derived from the same
        // natural key plus the scorer, so a retried submission replaces the
        // previous score (latest wins) instead of accumulating duplicates.
        for (const score of args.scores) {
          try {
            await validateAndSaveScore(storage, {
              id: experimentScoreId(args.experimentId, args.itemId, args.attempt ?? 0, score.scorerId),
              scorerId: score.scorerId,
              score: score.score,
              reason: score.reason,
              input: result.input,
              output: result.output,
              additionalContext: score.metadata,
              entityType: 'EXTERNAL',
              entityId: args.itemId,
              source: 'TEST',
              runId: args.experimentId,
              traceId: args.traceId,
              scorer: {
                id: score.scorerId,
                name: score.scorerName ?? score.scorerId,
                description: '',
                hasJudge: false,
              },
              entity: { id: 'external', name: 'external' },
            });
          } catch (saveError) {
            this.#mastra.getLogger()?.warn(`Failed to save external score for scorer ${score.scorerId}: ${saveError}`);
          }
        }
      }
    }

    return result;
  }

  /**
   * Finalize a caller-driven experiment: compute per-item
   * succeeded/failed/skipped counts from the persisted result rows and mark
   * the experiment completed. The caller sends no bookkeeping — the server is
   * the source of truth. Works for both targeted (runExperimentItem) and
   * target-less (submitExperimentResult) experiments.
   *
   * Idempotent: finalizing an already-completed experiment recomputes nothing
   * and returns the stored record.
   */
  async finalizeExperiment(args: { experimentId: string }): Promise<Experiment> {
    const experiment = await this.#getOwnedExperiment(args.experimentId);
    if (experiment.status === 'completed' || experiment.status === 'failed') {
      return experiment;
    }

    const experimentsStore = await this.#getExperimentsStore();

    // Page through all results and compute per-item counts server-side.
    // With repeated trials an item can have several rows (one per attempt);
    // the top-line counts roll attempts up so that
    // succeeded + failed + skipped === totalItems:
    //   succeeded — at least one attempt completed without an error
    //   failed    — submitted, but every attempt errored
    //   skipped   — never submitted (any attempt)
    // Attempt-level detail stays available via listExperimentResults.
    const itemSucceeded = new Map<string, boolean>();
    let page = 0;
    const perPage = 100;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { results, pagination } = await experimentsStore.listExperimentResults({
        experimentId: args.experimentId,
        pagination: { page, perPage },
      });
      for (const result of results) {
        const succeeded = !result.error;
        itemSucceeded.set(result.itemId, (itemSucceeded.get(result.itemId) ?? false) || succeeded);
      }
      if (!pagination.hasMore || results.length === 0) break;
      page++;
    }

    let succeededCount = 0;
    let failedCount = 0;
    for (const succeeded of itemSucceeded.values()) {
      if (succeeded) succeededCount++;
      else failedCount++;
    }
    const skippedCount = Math.max(0, experiment.totalItems - itemSucceeded.size);

    return experimentsStore.updateExperiment({
      id: args.experimentId,
      status: 'completed',
      succeededCount,
      failedCount,
      skippedCount,
      completedAt: new Date(),
    });
  }

  /**
   * Delete an experiment (run) by ID.
   *
   * The ownership check above already refuses cross-tenant / cross-dataset
   * requests, but we still forward `this.#scope` to storage so the delete
   * is defense-in-depth: a leaked handle or race that skipped the assertion
   * still cannot delete another tenant's experiment (storage silently no-ops
   * on tenancy mismatch).
   */
  async deleteExperiment(args: { experimentId: string }) {
    await this.#assertExperimentOwnership(args.experimentId);
    const experimentsStore = await this.#getExperimentsStore();
    return experimentsStore.deleteExperiment({ id: args.experimentId, filters: this.#scope });
  }
}
