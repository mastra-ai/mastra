import type { MastraClient } from '@mastra/client-js';
import { DatasetsManager } from '@mastra/core/datasets';
import { MastraError } from '@mastra/core/error';
import { Mastra } from '@mastra/core/mastra';
import type {
  DatasetRecord,
  Experiment,
  ListDatasetsInput,
  ListDatasetsOutput,
  PaginationInfo,
  TargetType,
} from '@mastra/core/storage';
import { isZodType } from '@mastra/core/utils';
import { zodToJsonSchema } from '@mastra/core/utils/zod-to-json';
import {
  DATASET_DATES,
  DatasetsHttp,
  EXPERIMENT_DATES,
  datasetPath,
  isNotFound,
  notFound,
  paginate,
  readAllPages,
  rejectUnsupported,
  revive,
} from './http';
import { PlatformDataset } from './platform-dataset';

type DatasetsPage = { datasets: object[]; pagination: PaginationInfo };

const TENANCY = ['organizationId', 'projectId'] as const;

function invalidComparison(text: string): MastraError {
  return new MastraError({ id: 'COMPARE_INVALID_INPUT', text, domain: 'STORAGE', category: 'USER' });
}

function toJsonSchema(schema: unknown): Record<string, unknown> | undefined {
  if (schema === undefined) return undefined;
  return isZodType(schema) ? (zodToJsonSchema(schema) as Record<string, unknown>) : (schema as Record<string, unknown>);
}

/**
 * A Mastra Platform project's datasets, with the same methods as core's `mastra.datasets`. Code
 * written against `Pick<Mastra, 'datasets'>` works when given `{ datasets: project.datasets }`.
 *
 * The datasets live in the project's managed-agents database, so the project must have managed
 * agents set up (`project.setupAgents()`).
 *
 * @example
 * ```ts
 * const dataset = await project.datasets.get({ id: 'ds_123' });
 * await dataset.addItems({ items: [{ input: 'What is 2 + 2?', groundTruth: '4' }] });
 *
 * const { experimentId } = await dataset.createExperiment({ name: 'baseline' });
 * for (const item of await dataset.listItems({ version: (await dataset.getDetails()).version })) {
 *   await dataset.submitExperimentResult({ experimentId, itemId: item.id, output: await answer(item.input) });
 * }
 * await dataset.finalizeExperiment({ experimentId });
 * ```
 */
export class PlatformDatasets extends DatasetsManager {
  readonly #http: DatasetsHttp;
  readonly #mastra: Mastra;

  /** @internal Use `project.datasets`. */
  constructor(client: MastraClient) {
    // Core's manager and datasets read storage from this Mastra; every method is overridden, so they never do.
    const mastra = new Mastra({ logger: false });
    super(mastra);
    this.#http = new DatasetsHttp(client);
    this.#mastra = mastra;
  }

  /**
   * Creates a dataset. The Platform assigns its id, so `id` is refused; keep the returned
   * dataset's `id` to get it again.
   */
  override async create(input: {
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
  }): Promise<PlatformDataset> {
    rejectUnsupported('create', input, ['id', ...TENANCY, 'candidateKey', 'candidateId']);
    const {
      id: _id,
      organizationId: _o,
      projectId: _p,
      candidateKey: _k,
      candidateId: _c,
      inputSchema,
      groundTruthSchema,
      ...rest
    } = input;
    const record = await this.#http.send<{ id: string }>('POST', '/datasets', {
      ...rest,
      ...(inputSchema !== undefined ? { inputSchema: toJsonSchema(inputSchema) } : {}),
      ...(groundTruthSchema !== undefined ? { groundTruthSchema: toJsonSchema(groundTruthSchema) } : {}),
    });
    return this.#dataset(record.id);
  }

  /** Gets a dataset. Throws a `MastraError` with id `DATASET_NOT_FOUND` when it doesn't exist. */
  override async get(args: { id: string; organizationId?: string; projectId?: string }): Promise<PlatformDataset> {
    rejectUnsupported('get', args, TENANCY);
    const dataset = this.#dataset(args.id);
    await dataset.getDetails();
    return dataset;
  }

  /**
   * Lists datasets. `name` (a case-insensitive substring), `datasetIds` and `targetIds` are matched
   * here after reading every dataset, so `page`/`perPage` still apply as in core.
   */
  override async list(args?: {
    page?: number;
    perPage?: number | false;
    filters?: {
      organizationId?: string;
      projectId?: string;
      candidateKey?: string;
      candidateId?: string;
      targetType?: TargetType;
      targetIds?: string[];
      datasetIds?: string[];
      name?: string;
    };
    orderBy?: ListDatasetsInput['orderBy'];
  }): Promise<ListDatasetsOutput> {
    const filters = args?.filters;
    rejectUnsupported('list', filters, [...TENANCY, 'candidateKey', 'candidateId']);
    const page = args?.page ?? 0;
    const perPage = args?.perPage ?? 20;
    const query = {
      ...(filters?.targetType ? { targetType: filters.targetType } : {}),
      ...(args?.orderBy ? { orderBy: args.orderBy } : {}),
    };

    const matchHere = filters?.name !== undefined || filters?.datasetIds || filters?.targetIds;
    if (perPage !== false && !matchHere) {
      const result = await this.#http.get<DatasetsPage>('/datasets', { ...query, page, perPage });
      return {
        datasets: result.datasets.map(record => revive<DatasetRecord>(record, DATASET_DATES)),
        pagination: result.pagination,
      };
    }

    const name = filters?.name?.toLowerCase();
    const all = await readAllPages(async (p, size) => {
      const result = await this.#http.get<DatasetsPage>('/datasets', { ...query, page: p, perPage: size });
      return {
        rows: result.datasets.map(record => revive<DatasetRecord>(record, DATASET_DATES)),
        pagination: result.pagination,
      };
    });
    const matches = all.filter(
      record =>
        (name === undefined || record.name.toLowerCase().includes(name)) &&
        (!filters?.datasetIds || filters.datasetIds.includes(record.id)) &&
        (!filters?.targetIds || filters.targetIds.some(id => record.targetIds?.includes(id))),
    );
    const { rows, pagination } = paginate(matches, page, perPage);
    return { datasets: rows, pagination };
  }

  override async delete(args: { id: string; organizationId?: string; projectId?: string }): Promise<void> {
    rejectUnsupported('delete', args, TENANCY);
    await this.#http.send('DELETE', datasetPath(args.id));
  }

  /** Gets an experiment from any of the project's datasets, or `null` when it doesn't exist. */
  override async getExperiment(args: {
    experimentId: string;
    organizationId?: string;
    projectId?: string;
  }): Promise<Experiment | null> {
    rejectUnsupported('getExperiment', args, TENANCY);
    try {
      return revive<Experiment>(
        await this.#http.get<object>(`/experiments/${encodeURIComponent(args.experimentId)}`),
        EXPERIMENT_DATES,
      );
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  override async deleteExperiment(args: {
    experimentId: string;
    organizationId?: string;
    projectId?: string;
  }): Promise<void> {
    rejectUnsupported('deleteExperiment', args, TENANCY);
    try {
      await this.#http.send('DELETE', `/experiments/${encodeURIComponent(args.experimentId)}`);
    } catch (error) {
      // Like core, deleting an experiment that doesn't exist does nothing.
      if (!isNotFound(error)) throw error;
    }
  }

  /**
   * Compares two to ten experiments of one dataset against a baseline (the first, unless
   * `baselineId` says otherwise), returning each item's output and scores per experiment, as core
   * does. Scores come from the project's observability, so they need it enabled. Throws a
   * `MastraError` with id `EXPERIMENT_NOT_FOUND` when an experiment doesn't exist or belongs to
   * another dataset.
   */
  override async compareExperiments(args: {
    experimentIds: string[];
    baselineId?: string;
    organizationId?: string;
    projectId?: string;
  }): ReturnType<DatasetsManager['compareExperiments']> {
    rejectUnsupported('compareExperiments', args, TENANCY);
    const experimentIds = [...new Set(args.experimentIds)];
    if (experimentIds.length < 2) {
      throw invalidComparison('compareExperiments requires at least 2 distinct experiment IDs.');
    }
    const baselineId = args.baselineId ?? experimentIds[0]!;
    if (!experimentIds.includes(baselineId)) {
      throw invalidComparison(`baselineId "${baselineId}" must be one of experimentIds.`);
    }

    // The route lives under the dataset, so find it from the baseline.
    const baseline = await this.getExperiment({ experimentId: baselineId });
    if (!baseline?.datasetId) throw notFound('EXPERIMENT_NOT_FOUND', `Experiment not found: ${baselineId}`, undefined);
    try {
      return await this.#http.send('POST', datasetPath(baseline.datasetId, 'compare'), { experimentIds, baselineId });
    } catch (error) {
      if (isNotFound(error)) throw notFound('EXPERIMENT_NOT_FOUND', 'Experiment not found', error);
      throw error;
    }
  }

  #dataset(id: string): PlatformDataset {
    return new PlatformDataset(id, this.#http, this.#mastra);
  }
}
