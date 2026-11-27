import { Dataset } from '@mastra/core/datasets';
import type { Mastra } from '@mastra/core/mastra';
import type {
  DatasetItem,
  DatasetItemPayload,
  DatasetItemRow,
  DatasetRecord,
  DatasetVersion,
  Experiment,
  ExperimentProvenance,
  ExperimentResult,
  ExperimentResultStatus,
  ExperimentStatus,
  ListDatasetItemsInput,
  ListDatasetItemsOutput,
  ListExperimentResultsInput,
  ListExperimentResultsOutput,
  ListExperimentsInput,
  ListExperimentsOutput,
  PaginationInfo,
  TargetType,
  UpdateDatasetInput,
  UpdateDatasetItemInput,
  UpdateExperimentResultInput,
} from '@mastra/core/storage';
import { isZodType } from '@mastra/core/utils';
import { zodToJsonSchema } from '@mastra/core/utils/zod-to-json';
import type { DatasetsHttp } from './http';
import {
  DATASET_DATES,
  datasetPath,
  EXPERIMENT_DATES,
  RESULT_DATES,
  VERSION_DATES,
  isNotFound,
  notFound,
  readAllPages,
  rejectUnsupported,
  revive,
  unsupportedMethod,
} from './http';

type ItemsPage = { items: object[]; pagination: PaginationInfo };

const DRIVE_IT_YOURSELF =
  'Run the items yourself, then save them with createExperiment, submitExperimentResult and finalizeExperiment.';

function toJsonSchema(schema: unknown): Record<string, unknown> | null | undefined {
  if (schema === undefined || schema === null) return schema;
  return isZodType(schema) ? (zodToJsonSchema(schema) as Record<string, unknown>) : (schema as Record<string, unknown>);
}

/**
 * A Mastra Platform dataset with the same methods as core's `Dataset`. Reads and writes go to the
 * project's datasets over HTTP. Experiments are driven by the caller: create one, submit each
 * item's result, and finalize it. Get one from `project.datasets.get({ id })` or `project.datasets.create(...)`.
 */
export class PlatformDataset extends Dataset {
  readonly #http: DatasetsHttp;

  /** @internal Use `project.datasets.get({ id })`. */
  constructor(id: string, http: DatasetsHttp, mastra: Mastra) {
    // Core's Dataset reads storage from `mastra`; every method is overridden, so it never does.
    super(id, mastra);
    this.#http = http;
  }

  // ---------------------------------------------------------------------------
  // Details and items
  // ---------------------------------------------------------------------------

  override async getDetails(): Promise<DatasetRecord> {
    const record = await this.#http.get<object | null>(datasetPath(this.id)).catch(error => {
      if (isNotFound(error)) throw notFound('DATASET_NOT_FOUND', `Dataset not found: ${this.id}`, error);
      throw error;
    });
    if (!record) throw notFound('DATASET_NOT_FOUND', `Dataset not found: ${this.id}`, undefined);
    return revive<DatasetRecord>(record, DATASET_DATES);
  }

  override async update(
    input: Omit<UpdateDatasetInput, 'id' | 'inputSchema' | 'groundTruthSchema'> & {
      inputSchema?: unknown;
      groundTruthSchema?: unknown;
    },
  ): Promise<DatasetRecord> {
    rejectUnsupported('update', input, ['filters']);
    const { inputSchema, groundTruthSchema, ...rest } = input;
    const record = await this.#http.send<object>('PATCH', datasetPath(this.id), {
      ...rest,
      ...(inputSchema !== undefined ? { inputSchema: toJsonSchema(inputSchema) } : {}),
      ...(groundTruthSchema !== undefined ? { groundTruthSchema: toJsonSchema(groundTruthSchema) } : {}),
    });
    return revive<DatasetRecord>(record, DATASET_DATES);
  }

  override async addItem(input: DatasetItemPayload): Promise<DatasetItem> {
    const item = await this.#http.send<object>('POST', datasetPath(this.id, 'items'), input);
    return revive<DatasetItem>(item, DATASET_DATES);
  }

  override async addItems(input: { items: DatasetItemPayload[] }): Promise<DatasetItem[]> {
    const { items } = await this.#http.send<{ items: object[] }>('POST', datasetPath(this.id, 'items', 'batch'), {
      items: input.items,
    });
    return items.map(item => revive<DatasetItem>(item, DATASET_DATES));
  }

  override async getItem(args: { itemId: string; version?: number }): Promise<DatasetItem | null> {
    try {
      const item =
        args.version === undefined
          ? await this.#http.get<object | null>(datasetPath(this.id, 'items', args.itemId))
          : await this.#http.get<object | null>(datasetPath(this.id, 'items', args.itemId, 'versions', args.version));
      return item ? revive<DatasetItem>(item, DATASET_DATES) : null;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  override async listItems(args?: {
    version?: number;
    page?: number;
    perPage?: number;
    search?: string;
    orderBy?: ListDatasetItemsInput['orderBy'];
  }): Promise<DatasetItem[] | ListDatasetItemsOutput> {
    const onlyVersion =
      args?.version !== undefined && args.search === undefined && args.page === undefined && args.perPage === undefined;
    // Like core, a version on its own returns every item at that version as an array.
    if (onlyVersion) return this.#itemsAt(args.version!);

    const result = await this.#http.get<ItemsPage>(datasetPath(this.id, 'items'), {
      page: args?.page ?? 0,
      perPage: args?.perPage ?? 20,
      ...(args?.version !== undefined ? { version: args.version } : {}),
      ...(args?.search ? { search: args.search } : {}),
      ...(args?.orderBy ? { orderBy: args.orderBy } : {}),
    });
    return {
      items: result.items.map(item => revive<DatasetItem>(item, DATASET_DATES)),
      pagination: result.pagination,
    };
  }

  async #itemsAt(version: number): Promise<DatasetItem[]> {
    return readAllPages(async (page, perPage) => {
      const result = await this.#http.get<ItemsPage>(datasetPath(this.id, 'items'), { version, page, perPage });
      return {
        rows: result.items.map(item => revive<DatasetItem>(item, DATASET_DATES)),
        pagination: result.pagination,
      };
    });
  }

  override async updateItem(
    input: { itemId: string } & Omit<UpdateDatasetItemInput, 'id' | 'datasetId' | 'filters'>,
  ): Promise<DatasetItem> {
    const { itemId, ...rest } = input;
    const item = await this.#http.send<object>('PATCH', datasetPath(this.id, 'items', itemId), rest);
    return revive<DatasetItem>(item, DATASET_DATES);
  }

  override async deleteItem(args: { itemId: string }): Promise<void> {
    await this.#http.send('DELETE', datasetPath(this.id, 'items', args.itemId));
  }

  override async purgeItem(args: { itemId: string }): Promise<void> {
    await this.#http.send('DELETE', datasetPath(this.id, 'items', args.itemId, 'purge'));
  }

  override async deleteItems(args: { itemIds: string[] }): Promise<void> {
    await this.#http.send('DELETE', datasetPath(this.id, 'items', 'batch'), { itemIds: args.itemIds });
  }

  // ---------------------------------------------------------------------------
  // Versions
  // ---------------------------------------------------------------------------

  override async listVersions(args?: { page?: number; perPage?: number }): Promise<{
    versions: DatasetVersion[];
    pagination: { total: number; page: number; perPage: number | false; hasMore: boolean };
  }> {
    const result = await this.#http.get<{ versions: object[]; pagination: PaginationInfo }>(
      datasetPath(this.id, 'versions'),
      { page: args?.page ?? 0, perPage: args?.perPage ?? 20 },
    );
    return {
      versions: result.versions.map(version => revive<DatasetVersion>(version, VERSION_DATES)),
      pagination: result.pagination,
    };
  }

  override async getItemHistory(args: { itemId: string }): Promise<DatasetItemRow[]> {
    const { history } = await this.#http.get<{ history: object[] }>(
      datasetPath(this.id, 'items', args.itemId, 'history'),
    );
    return history.map(row => revive<DatasetItemRow>(row, DATASET_DATES)).filter(row => row.datasetId === this.id);
  }

  // ---------------------------------------------------------------------------
  // Experiments
  // ---------------------------------------------------------------------------

  override async listExperiments(args?: {
    targetType?: TargetType;
    targetId?: string;
    agentVersion?: string;
    status?: ExperimentStatus;
    experimentSetId?: string;
    comparisonId?: string;
    variantId?: string;
    trialIndex?: number;
    filters?: { organizationId?: string; projectId?: string };
    page?: number;
    perPage?: number;
    orderBy?: ListExperimentsInput['orderBy'];
  }): Promise<ListExperimentsOutput> {
    rejectUnsupported('listExperiments', args, ['agentVersion', 'status', 'filters']);
    const { page = 0, perPage = 20, agentVersion: _a, status: _s, filters: _f, ...query } = args ?? {};
    const result = await this.#http.get<{ experiments: object[]; pagination: PaginationInfo }>(
      datasetPath(this.id, 'experiments'),
      { ...query, page, perPage },
    );
    return {
      experiments: result.experiments.map(experiment => revive<Experiment>(experiment, EXPERIMENT_DATES)),
      pagination: result.pagination,
    };
  }

  override async getExperiment(args: { experimentId: string }): Promise<Experiment | null> {
    try {
      const experiment = await this.#http.get<object | null>(datasetPath(this.id, 'experiments', args.experimentId));
      const revived = experiment && revive<Experiment>(experiment, EXPERIMENT_DATES);
      return revived?.datasetId === this.id ? revived : null;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  override async updateExperiment(args: {
    experimentId: string;
    name?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Experiment> {
    const { experimentId, ...body } = args;
    const experiment = await this.#withExperiment(experimentId, () =>
      this.#http.send<object>('PATCH', datasetPath(this.id, 'experiments', experimentId), body),
    );
    return revive<Experiment>(experiment, EXPERIMENT_DATES);
  }

  override async listExperimentResults(args: {
    experimentId: string;
    traceId?: string;
    status?: ExperimentResultStatus;
    tags?: string[];
    filters?: { organizationId?: string; projectId?: string };
    page?: number;
    perPage?: number;
    orderBy?: ListExperimentResultsInput['orderBy'];
  }): Promise<ListExperimentResultsOutput> {
    rejectUnsupported('listExperimentResults', args, ['traceId', 'filters']);
    const result = await this.#withExperiment(args.experimentId, () =>
      this.#http.get<{ results: object[]; pagination: PaginationInfo }>(
        datasetPath(this.id, 'experiments', args.experimentId, 'results'),
        {
          page: args.page ?? 0,
          perPage: args.perPage ?? 20,
          ...(args.status ? { status: args.status } : {}),
          ...(args.tags ? { tags: args.tags } : {}),
          ...(args.orderBy ? { orderBy: args.orderBy } : {}),
        },
      ),
    );
    return {
      results: result.results.map(row => revive<ExperimentResult>(row, RESULT_DATES)),
      pagination: result.pagination,
    };
  }

  override async updateExperimentResult(
    input: UpdateExperimentResultInput & { experimentId: string },
  ): Promise<ExperimentResult> {
    const { id, experimentId, ...body } = input;
    const result = await this.#withExperiment(experimentId, () =>
      this.#http.send<object>('PATCH', datasetPath(this.id, 'experiments', experimentId, 'results', id), body),
    );
    return revive<ExperimentResult>(result, RESULT_DATES);
  }

  override async deleteExperiment(args: { experimentId: string }): Promise<void> {
    await this.#withExperiment(args.experimentId, () =>
      this.#http.send('DELETE', datasetPath(this.id, 'experiments', args.experimentId)),
    );
  }

  /** Runs a call on one of this dataset's experiments, turning a 404 into core's not-found error. */
  async #withExperiment<T>(experimentId: string, call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (isNotFound(error)) throw notFound('EXPERIMENT_NOT_FOUND', `Experiment not found: ${experimentId}`, error);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Experiments whose results come from this process
  // ---------------------------------------------------------------------------

  /**
   * Creates an experiment that you fill in with {@link submitExperimentResult} and close with
   * {@link finalizeExperiment}. Pass `id` to make retried creates return the same experiment.
   *
   * Platform experiments created from code have no target: the Platform can't run your local agent
   * or workflow, so `targetType`, `targetId` and `scorers` are refused. Record what ran in
   * `metadata` or `provenance` instead.
   */
  override async createExperiment(args?: {
    id?: string;
    targetType?: TargetType;
    targetId?: string;
    scorers?: string[];
    name?: string;
    description?: string;
    metadata?: Record<string, unknown>;
    provenance?: ExperimentProvenance;
    grouping?: { experimentSetId?: string; comparisonId?: string; variantId?: string; trialIndex?: number };
    version?: number;
  }): Promise<{
    experimentId: string;
    status: ExperimentStatus;
    totalItems: number;
    datasetVersion: number;
    startedAt: Date | null;
  }> {
    rejectUnsupported('createExperiment', args, ['targetType', 'targetId', 'scorers']);
    const { targetType: _t, targetId: _i, scorers: _s, ...body } = args ?? {};
    const created = await this.#http.send<{
      experimentId: string;
      status: ExperimentStatus;
      totalItems: number;
      datasetVersion: number | null;
      startedAt: string | null;
    }>('POST', datasetPath(this.id, 'experiments'), { ...body, start: false });
    return {
      experimentId: created.experimentId,
      status: created.status,
      totalItems: created.totalItems,
      datasetVersion: created.datasetVersion ?? 0,
      startedAt: created.startedAt ? new Date(created.startedAt) : null,
    };
  }

  /**
   * Saves one item's result. Scores go to the project's observability, where Studio reads them, so
   * the project needs observability on; `completedAt` is required with scores, and at most 50 are
   * accepted per result.
   */
  override async submitExperimentResult(args: {
    experimentId: string;
    itemId: string;
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
    const { experimentId, ...body } = args;
    const result = await this.#withExperiment(experimentId, () =>
      this.#http.send<object>('POST', datasetPath(this.id, 'experiments', experimentId, 'results'), body),
    );
    return revive<ExperimentResult>(result, RESULT_DATES);
  }

  override async finalizeExperiment(args: { experimentId: string }): Promise<Experiment> {
    const experiment = await this.#withExperiment(args.experimentId, () =>
      this.#http.send<object>('POST', datasetPath(this.id, 'experiments', args.experimentId, 'finalize'), {}),
    );
    return revive<Experiment>(experiment, EXPERIMENT_DATES);
  }

  // ---------------------------------------------------------------------------
  // Not available on the Platform
  // ---------------------------------------------------------------------------

  /**
   * Not supported yet. Run the items yourself, then save them with {@link createExperiment},
   * {@link submitExperimentResult} and {@link finalizeExperiment}.
   */
  override async startExperiment(): Promise<never> {
    throw unsupportedMethod('startExperiment', DRIVE_IT_YOURSELF);
  }

  override async startExperimentAsync(): Promise<never> {
    throw unsupportedMethod('startExperimentAsync', DRIVE_IT_YOURSELF);
  }

  override async runExperimentItem(): Promise<never> {
    throw unsupportedMethod('runExperimentItem', DRIVE_IT_YOURSELF);
  }
}
