import { isZodType } from '@mastra/schema-compat';
import { zodToJsonSchema } from '@mastra/schema-compat/zod-to-json';
import { MastraError } from '../error/index.js';
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
  ExperimentResultStatus,
  ExperimentStatus,
  ExperimentTenancyFilters,
  ListDatasetItemsOutput,
  ListExperimentResultsOutput,
  ListExperimentsOutput,
  TargetType,
  UpdateDatasetInput,
  UpdateExperimentResultInput,
} from '../storage/types.js';
import { normalizeExperimentScorers, runExperiment } from './experiment/index.js';
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
  async updateItem(input: { itemId: string } & Partial<Omit<DatasetItemPayload, 'externalId'>>): Promise<DatasetItem> {
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
    const experimentsStore = await this.#getExperimentsStore();
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

    const { thresholds } = normalizeExperimentScorers(this.#mastra, config.scorers, dataset.scorerIds ?? []);

    const run = await experimentsStore.createExperiment({
      datasetId: this.id,
      datasetVersion: targetVersion,
      targetType: config.targetType ?? 'agent',
      targetId: config.targetId ?? 'inline',
      totalItems: items.length,
      thresholds,
      name: config.name,
      description: config.description,
      metadata: config.metadata,
      agentVersion: config.agentVersion,
      organizationId: dataset.organizationId ?? null,
      projectId: dataset.projectId ?? null,
    });

    const experimentId = run.id;

    // Fire-and-forget — runExperiment merges dataset-attached scorers automatically
    void runExperiment(this.#mastra, {
      datasetId: this.id,
      experimentId,
      ...config,
      version: targetVersion,
      filters: this.#scope,
    } as ExperimentConfig).catch(async err => {
      await experimentsStore
        .updateExperiment({
          id: experimentId,
          status: 'failed',
          completedAt: new Date(),
        })
        .catch(() => {});
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
