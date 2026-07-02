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
import { runExperiment } from './experiment/index.js';
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

  constructor(id: string, mastra: Mastra) {
    this.id = id;
    this.#mastra = mastra;
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

  // ---------------------------------------------------------------------------
  // Dataset metadata
  // ---------------------------------------------------------------------------

  /**
   * Get the full dataset record from storage.
   */
  async getDetails(): Promise<DatasetRecord> {
    const store = await this.#getDatasetsStore();
    const record = await store.getDatasetById({ id: this.id });
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
    return store.addItem({ datasetId: this.id, ...input });
  }

  /**
   * Add multiple items to the dataset in bulk.
   */
  async addItems(input: { items: DatasetItemPayload[] }): Promise<DatasetItem[]> {
    const store = await this.#getDatasetsStore();
    return store.batchInsertItems({
      datasetId: this.id,
      items: input.items,
    });
  }

  /**
   * Get a single item by ID, optionally at a specific version.
   */
  async getItem(args: { itemId: string; version?: number }): Promise<DatasetItem | null> {
    const store = await this.#getDatasetsStore();
    return store.getItemById({ id: args.itemId, datasetVersion: args.version });
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
      return store.getItemsByVersion({ datasetId: this.id, version: args.version! });
    }

    return store.listItems({
      datasetId: this.id,
      ...(args?.version !== undefined ? { version: args.version } : {}),
      ...(args?.search ? { search: args.search } : {}),
      pagination: { page: args?.page ?? 0, perPage: args?.perPage ?? 20 },
    });
  }

  /**
   * Update an existing item in the dataset. Only the provided payload fields
   * are patched.
   */
  async updateItem(input: { itemId: string } & Partial<DatasetItemPayload>): Promise<DatasetItem> {
    const store = await this.#getDatasetsStore();
    const { itemId, ...rest } = input;
    return store.updateItem({ id: itemId, datasetId: this.id, ...rest });
  }

  /**
   * Delete a single item from the dataset.
   */
  async deleteItem(args: { itemId: string }): Promise<void> {
    const store = await this.#getDatasetsStore();
    return store.deleteItem({ id: args.itemId, datasetId: this.id });
  }

  /**
   * Delete multiple items from the dataset in bulk.
   */
  async deleteItems(args: { itemIds: string[] }): Promise<void> {
    const store = await this.#getDatasetsStore();
    return store.batchDeleteItems({ datasetId: this.id, itemIds: args.itemIds });
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
    const store = await this.#getDatasetsStore();
    return store.getItemHistory(args.itemId);
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
    return runExperiment(this.#mastra, { datasetId: this.id, ...config } as ExperimentConfig);
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

    const dataset = await datasetsStore.getDatasetById({ id: this.id });
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

    const run = await experimentsStore.createExperiment({
      datasetId: this.id,
      datasetVersion: targetVersion,
      targetType: config.targetType ?? 'agent',
      targetId: config.targetId ?? 'inline',
      totalItems: items.length,
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
   * Get a specific experiment (run) by ID.
   */
  async getExperiment(args: { experimentId: string }) {
    const experimentsStore = await this.#getExperimentsStore();
    return experimentsStore.getExperimentById({ id: args.experimentId });
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
   * Delete an experiment (run) by ID.
   */
  /**
   * Update an experiment result's status or tags.
   */
  async updateExperimentResult(input: UpdateExperimentResultInput) {
    const experimentsStore = await this.#getExperimentsStore();
    return experimentsStore.updateExperimentResult(input);
  }

  async deleteExperiment(args: { experimentId: string }) {
    const experimentsStore = await this.#getExperimentsStore();
    return experimentsStore.deleteExperiment({ id: args.experimentId });
  }
}
