import { isZodType } from '@mastra/schema-compat';
import { zodToJsonSchema } from '@mastra/schema-compat/zod-to-json';
import { MastraError } from '../error/index.js';
import type { Mastra } from '../mastra/index.js';
import type { DatasetsStorage } from '../storage/domains/datasets/base.js';
import type { ExperimentsStorage } from '../storage/domains/experiments/base.js';
import type { DatasetTenancyFilters, TargetType } from '../storage/types.js';
import { Dataset } from './dataset.js';
import { compareExperiments as compareExperimentsInternal } from './experiment/analytics/compare.js';

/**
 * Build a {@link DatasetTenancyFilters} from public manager args. Returns
 * `undefined` when neither field is set (preserves legacy unscoped behavior).
 * Null values are coerced away — `DatasetTenancyFilters` is `string | undefined`
 * only, matching the existing `listDatasets` filter contract.
 */
function scopeFromArgs(args: {
  organizationId?: string | null;
  projectId?: string | null;
}): DatasetTenancyFilters | undefined {
  const scope: DatasetTenancyFilters = {};
  if (typeof args.organizationId === 'string') scope.organizationId = args.organizationId;
  if (typeof args.projectId === 'string') scope.projectId = args.projectId;
  return scope.organizationId === undefined && scope.projectId === undefined ? undefined : scope;
}

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
   *
   * Accepts Zod schemas for `inputSchema` / `groundTruthSchema` (typed as
   * `unknown` here); they are normalized to JSON Schema via `zodToJsonSchema`
   * before being forwarded to the storage-canonical
   * {@link import('../storage/types.js').CreateDatasetInput} shape. All other
   * fields mirror `CreateDatasetInput` exactly.
   */
  async create(input: {
    id?: string;
    name: string;
    description?: string;
    inputSchema?: unknown;
    groundTruthSchema?: unknown;
    requestContextSchema?: Record<string, unknown> | null;
    metadata?: Record<string, unknown>;
    targetType?: TargetType;
    targetIds?: string[];
    scorerIds?: string[];
    organizationId?: string | null;
    projectId?: string | null;
    candidateKey?: string | null;
    candidateId?: string | null;
  }): Promise<Dataset> {
    const store = await this.#getDatasetsStore();

    let { inputSchema, groundTruthSchema, ...rest } = input;

    if (inputSchema !== undefined && isZodType(inputSchema)) {
      inputSchema = zodToJsonSchema(inputSchema);
    }
    if (groundTruthSchema !== undefined && isZodType(groundTruthSchema)) {
      groundTruthSchema = zodToJsonSchema(groundTruthSchema);
    }

    const result = await store.createDataset({
      ...rest,
      inputSchema: inputSchema as Record<string, unknown> | undefined,
      groundTruthSchema: groundTruthSchema as Record<string, unknown> | undefined,
    });

    // Preserve the tenancy the caller created the dataset under so subsequent
    // reads/updates on the returned handle stay bound to the same tenant.
    const createScope = scopeFromArgs(input);
    return new Dataset(result.id, this.#mastra, createScope);
  }

  /**
   * Get an existing dataset by ID, optionally scoped to a tenant.
   *
   * When `organizationId` / `projectId` are provided, the read is scoped to
   * that tenancy: a dataset row that exists but belongs to a different tenant
   * returns NOT_FOUND (same 404 as a truly missing row) rather than leaking
   * cross-tenant existence. The returned {@link Dataset} handle carries the
   * scope forward on all subsequent reads and item mutations.
   */
  async get(args: { id: string; organizationId?: string; projectId?: string }): Promise<Dataset> {
    const store = await this.#getDatasetsStore();
    const scope = scopeFromArgs(args);
    const record = await store.getDatasetById({ id: args.id, filters: scope });
    if (!record) {
      throw new MastraError({
        id: 'DATASET_NOT_FOUND',
        text: 'Dataset not found',
        domain: 'STORAGE',
        category: 'USER',
      });
    }
    return new Dataset(args.id, this.#mastra, scope);
  }

  /**
   * List all datasets with pagination.
   *
   * Supports optional tenancy and candidate-identity filters. When omitted, all
   * datasets visible to the configured storage instance are returned.
   */
  async list(args?: {
    page?: number;
    perPage?: number;
    filters?: {
      organizationId?: string;
      projectId?: string;
      candidateKey?: string;
      candidateId?: string;
      /** Filter by dataset target type. */
      targetType?: TargetType;
      /**
       * Filter to datasets whose `targetIds` intersect this list (any overlap matches).
       */
      targetIds?: string[];
      /** Substring match on dataset `name`, case-insensitive. */
      name?: string;
    };
  }) {
    const store = await this.#getDatasetsStore();
    return store.listDatasets({
      pagination: { page: args?.page ?? 0, perPage: args?.perPage ?? 20 },
      ...(args?.filters ? { filters: args.filters } : {}),
    });
  }

  /**
   * Delete a dataset by ID, optionally scoped to a tenant.
   *
   * When `organizationId` / `projectId` are provided, the delete is scoped to
   * that tenancy: a dataset row in another tenant is a silent no-op (no error)
   * so cross-tenant existence is not leaked via error timing/text.
   */
  async delete(args: { id: string; organizationId?: string; projectId?: string }) {
    const store = await this.#getDatasetsStore();
    return store.deleteDataset({ id: args.id, filters: scopeFromArgs(args) });
  }

  // ---------------------------------------------------------------------------
  // Cross-dataset experiment operations
  // ---------------------------------------------------------------------------

  /**
   * Get a specific experiment (run) by ID, optionally scoped to a tenant.
   *
   * When `organizationId` / `projectId` are provided, the read is scoped to
   * that tenancy: an experiment row that exists but belongs to a different
   * tenant returns `null` (same as a truly missing row) rather than leaking
   * cross-tenant existence via error timing/text.
   */
  async getExperiment(args: { experimentId: string; organizationId?: string; projectId?: string }) {
    const experimentsStore = await this.#getExperimentsStore();
    return experimentsStore.getExperimentById({
      id: args.experimentId,
      filters: scopeFromArgs(args),
    });
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
