import { isZodType } from '@mastra/schema-compat';
import { zodToJsonSchema } from '@mastra/schema-compat/zod-to-json';
import { MastraError } from '../error/index.js';
import type { Mastra } from '../mastra/index.js';
import type { DatasetsStorage } from '../storage/domains/datasets/base.js';
import type { ExperimentsStorage } from '../storage/domains/experiments/base.js';
import type {
  DatasetRecord,
  DatasetItem,
  DatasetItemRow,
  DatasetItemSource,
  DatasetVersion,
  TargetType,
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
   * Zod schemas are automatically converted to JSON Schema.
   */
  async update(input: {
    name?: string;
    description?: string;
    metadata?: Record<string, unknown>;
    inputSchema?: unknown;
    groundTruthSchema?: unknown;
    requestContextSchema?: Record<string, unknown> | null;
    tags?: string[] | null;
    targetType?: TargetType | null;
    targetIds?: string[] | null;
    scorerIds?: string[] | null;
  }): Promise<DatasetRecord> {
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
  async addItem(input: {
    input: unknown;
    groundTruth?: unknown;
    expectedTrajectory?: unknown;
    requestContext?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    source?: DatasetItemSource;
  }): Promise<DatasetItem> {
    const store = await this.#getDatasetsStore();
    return store.addItem({
      datasetId: this.id,
      input: input.input,
      groundTruth: input.groundTruth,
      expectedTrajectory: input.expectedTrajectory,
      requestContext: input.requestContext,
      metadata: input.metadata,
      source: input.source,
    });
  }

  /**
   * Add multiple items to the dataset in bulk.
   */
  async addItems(input: {
    items: Array<{
      input: unknown;
      groundTruth?: unknown;
      expectedTrajectory?: unknown;
      requestContext?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      source?: DatasetItemSource;
    }>;
  }): Promise<DatasetItem[]> {
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
   * List items in the dataset, optionally at a specific version.
   */
  async listItems(args?: {
    version?: number;
    page?: number;
    perPage?: number;
    search?: string;
  }): Promise<
    | DatasetItem[]
    | { items: DatasetItem[]; pagination: { total: number; page: number; perPage: number | false; hasMore: boolean } }
  > {
    const store = await this.#getDatasetsStore();
    if (args?.version) {
      return store.getItemsByVersion({ datasetId: this.id, version: args.version });
    }
    return store.listItems({
      datasetId: this.id,
      search: args?.search,
      pagination: { page: args?.page ?? 0, perPage: args?.perPage ?? 20 },
    });
  }

  /**
   * Update an existing item in the dataset.
   */
  async updateItem(input: {
    itemId: string;
    input?: unknown;
    groundTruth?: unknown;
    expectedTrajectory?: unknown;
    requestContext?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<DatasetItem> {
    const store = await this.#getDatasetsStore();
    return store.updateItem({
      id: input.itemId,
      datasetId: this.id,
      input: input.input,
      groundTruth: input.groundTruth,
      expectedTrajectory: input.expectedTrajectory,
      requestContext: input.requestContext,
      metadata: input.metadata,
    });
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
   * List all experiments (runs) for this dataset.
   */
  async listExperiments(args?: { page?: number; perPage?: number }) {
    const experimentsStore = await this.#getExperimentsStore();
    return experimentsStore.listExperiments({
      datasetId: this.id,
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
   * List results for a specific experiment.
   */
  async listExperimentResults(args: { experimentId: string; page?: number; perPage?: number }) {
    const experimentsStore = await this.#getExperimentsStore();
    return experimentsStore.listExperimentResults({
      experimentId: args.experimentId,
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
