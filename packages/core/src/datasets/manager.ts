import { isZodType } from '@mastra/schema-compat';
import { zodToJsonSchema } from '@mastra/schema-compat/zod-to-json';
import { MastraError } from '../error/index.js';
import type { Mastra } from '../mastra/index.js';
import type { DatasetsStorage } from '../storage/domains/datasets/base.js';
import type { ExperimentsStorage } from '../storage/domains/experiments/base.js';
import { Dataset } from './dataset.js';
import { compareExperiments as compareExperimentsInternal } from './experiment/analytics/compare.js';

/**
 * Public API for managing datasets.
 *
 * Provides methods for dataset CRUD and cross-dataset experiment operations.
 * Typically accessed via `mastra.datasets` (Phase 4).
 */
export class DatasetsManager {
  #mastra: Mastra;
  #datasetsStore?: DatasetsStorage;
  #experimentsStore?: ExperimentsStorage;

  constructor(mastra: Mastra) {
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
  // Dataset CRUD
  // ---------------------------------------------------------------------------

  /**
   * Create a new dataset.
   * Zod schemas are automatically converted to JSON Schema.
   */
  async create(input: {
    name: string;
    description?: string;
    inputSchema?: unknown;
    groundTruthSchema?: unknown;
    defaultRequestContext?: unknown;
    requestContextSchema?: unknown;
    metadata?: Record<string, unknown>;
  }): Promise<Dataset> {
    const store = await this.#getDatasetsStore();

    let { inputSchema, groundTruthSchema, requestContextSchema: requestContextSchemaInput, ...rest } = input;
    let requestContextSchema = requestContextSchemaInput;

    if (inputSchema !== undefined && isZodType(inputSchema)) {
      inputSchema = zodToJsonSchema(inputSchema);
    }
    if (groundTruthSchema !== undefined && isZodType(groundTruthSchema)) {
      groundTruthSchema = zodToJsonSchema(groundTruthSchema);
    }
    if (requestContextSchema !== undefined && isZodType(requestContextSchema)) {
      requestContextSchema = zodToJsonSchema(requestContextSchema);
    }

    const result = await store.createDataset({
      ...rest,
      inputSchema: inputSchema as Record<string, unknown> | undefined,
      groundTruthSchema: groundTruthSchema as Record<string, unknown> | undefined,
      requestContextSchema: requestContextSchema as Record<string, unknown> | undefined,
    });

    return new Dataset(result.id, this.#mastra);
  }

  /**
   * Get an existing dataset by ID.
   * Throws if the dataset does not exist.
   */
  async get(args: { id: string }): Promise<Dataset> {
    const store = await this.#getDatasetsStore();
    const record = await store.getDatasetById({ id: args.id });
    if (!record) {
      throw new MastraError({
        id: 'DATASET_NOT_FOUND',
        text: 'Dataset not found',
        domain: 'STORAGE',
        category: 'USER',
      });
    }
    return new Dataset(args.id, this.#mastra);
  }

  /**
   * List all datasets with pagination.
   */
  async list(args?: { page?: number; perPage?: number }) {
    const store = await this.#getDatasetsStore();
    return store.listDatasets({
      pagination: { page: args?.page ?? 0, perPage: args?.perPage ?? 20 },
    });
  }

  /**
   * Delete a dataset by ID.
   */
  async delete(args: { id: string }) {
    const store = await this.#getDatasetsStore();
    return store.deleteDataset({ id: args.id });
  }

  // ---------------------------------------------------------------------------
  // Cross-dataset experiment operations
  // ---------------------------------------------------------------------------

  /**
   * Get a specific experiment (run) by ID.
   */
  async getExperiment(args: { experimentId: string }) {
    const experimentsStore = await this.#getExperimentsStore();
    return experimentsStore.getExperimentById({ id: args.experimentId });
  }

  /**
   * Compare two or more experiments.
   *
   * Uses the internal `compareExperiments` function for pairwise comparison,
   * then enriches results with per-item input/groundTruth/output data.
   */
  async compareExperiments(args: { experimentIds: string[]; baselineId?: string }) {
    const { experimentIds, baselineId } = args;

    if (experimentIds.length < 2) {
      throw new MastraError({
        id: 'COMPARE_INVALID_INPUT',
        text: 'compareExperiments requires at least 2 experiment IDs.',
        domain: 'STORAGE',
        category: 'USER',
      });
    }

    const resolvedBaseline = baselineId ?? experimentIds[0]!;
    const otherExperimentId = experimentIds.find(id => id !== resolvedBaseline) ?? experimentIds[1]!;

    const internal = await compareExperimentsInternal(this.#mastra, {
      experimentIdA: resolvedBaseline,
      experimentIdB: otherExperimentId,
    });

    // Load results for both runs to get input/groundTruth/output
    const experimentsStore = await this.#getExperimentsStore();
    const [resultsA, resultsB] = await Promise.all([
      experimentsStore.listExperimentResults({
        experimentId: resolvedBaseline,
        pagination: { page: 0, perPage: false },
      }),
      experimentsStore.listExperimentResults({
        experimentId: otherExperimentId,
        pagination: { page: 0, perPage: false },
      }),
    ]);

    // Build results maps by itemId
    const resultsMapA = new Map(resultsA.results.map(r => [r.itemId, r]));
    const resultsMapB = new Map(resultsB.results.map(r => [r.itemId, r]));

    // Transform internal items to MVP shape
    const items = internal.items.map(item => {
      const resultA = resultsMapA.get(item.itemId);
      const resultB = resultsMapB.get(item.itemId);

      return {
        itemId: item.itemId,
        input: resultA?.input ?? resultB?.input ?? null,
        groundTruth: resultA?.groundTruth ?? resultB?.groundTruth ?? null,
        results: {
          [resolvedBaseline]: resultA ? { output: resultA.output, scores: item.scoresA } : null,
          [otherExperimentId]: resultB ? { output: resultB.output, scores: item.scoresB } : null,
        },
      };
    });

    return {
      baselineId: resolvedBaseline,
      items,
    };
  }
}
