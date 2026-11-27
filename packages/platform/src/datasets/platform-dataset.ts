import { Dataset, runExperiment } from '@mastra/core/datasets';
import type {
  DataItem,
  ExperimentConfig,
  ExperimentEvent,
  ExperimentItemCompletedEvent,
  ExperimentSummary,
  StartExperimentConfig,
} from '@mastra/core/datasets';
import { MastraError } from '@mastra/core/error';
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
  refusal,
  rejectUnsupported,
  revive,
  unsupportedMethod,
} from './http';

type ItemsPage = { items: object[]; pagination: PaginationInfo };

type SubmittedScore = { scorerId: string; scorerName?: string; score: number; reason?: string };

/** Options for {@link PlatformDataset.startExperiment}: core's options plus the Mastra that owns the target. */
export type PlatformStartExperimentConfig<I = unknown, O = unknown, E = unknown> = StartExperimentConfig<I, O, E> & {
  /**
   * Mastra to run the experiment in. Required with `targetType`/`targetId`, which name an agent,
   * workflow, scorer or processor registered on it. With `task`, it is passed to the task.
   */
  mastra?: Mastra;
};

function toJsonSchema(schema: unknown): Record<string, unknown> | null | undefined {
  if (schema === undefined || schema === null) return schema;
  return isZodType(schema) ? (zodToJsonSchema(schema) as Record<string, unknown>) : (schema as Record<string, unknown>);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Scores from an item event in the shape the Platform stores; unscored and failed scorers are left out. */
function submittedScores(scores: ExperimentItemCompletedEvent['scores']): SubmittedScore[] {
  if (!Array.isArray(scores)) return [];
  return scores.flatMap(s => {
    if (!isRecord(s) || typeof s.scorerId !== 'string' || typeof s.score !== 'number' || s.error) return [];
    return [
      {
        scorerId: s.scorerId,
        ...(typeof s.scorerName === 'string' ? { scorerName: s.scorerName } : {}),
        score: s.score,
        ...(typeof s.reason === 'string' ? { reason: s.reason } : {}),
      },
    ];
  });
}

/** The item error without its stack, which would send local file paths to the Platform. */
function submittedError(error: ExperimentItemCompletedEvent['error']): { message: string; code?: string } | null {
  if (!isRecord(error)) return null;
  return {
    message: typeof error.message === 'string' ? error.message : 'Unknown error',
    ...(typeof error.code === 'string' ? { code: error.code } : {}),
  };
}

/**
 * A Mastra Platform dataset with the same methods as core's `Dataset`. Reads and writes go to the
 * project's datasets over HTTP; `startExperiment` runs in this process and uploads each result as
 * it finishes. Get one from `project.datasets.get({ id })` or `project.datasets.create(...)`.
 */
export class PlatformDataset extends Dataset {
  readonly #http: DatasetsHttp;
  readonly #mastra: Mastra;

  /** @internal Use `project.datasets.get({ id })`. */
  constructor(id: string, http: DatasetsHttp, mastra: Mastra) {
    // Core's Dataset reads storage from `mastra`; every method is overridden, so it never does.
    super(id, mastra);
    this.#http = http;
    this.#mastra = mastra;
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

  /**
   * Runs an experiment in this process over the dataset's items and uploads each result, with its
   * scores, to the Platform as it finishes. Takes core's options; pass `mastra` when using
   * `targetType`/`targetId`. Nothing is written to `mastra`'s own storage.
   *
   * A failed upload doesn't stop the run: the item gets a `persistenceError` and is counted in
   * `persistenceFailures`. The experiment is finalized when the run ends, including when it fails
   * or is aborted.
   */
  override async startExperiment<I = unknown, O = unknown, E = unknown>(
    config: PlatformStartExperimentConfig<I, O, E>,
  ): Promise<ExperimentSummary> {
    const { mastra: configMastra, onEvent, ...experiment } = config;
    if (experiment.targetType !== undefined && !configMastra) {
      throw refusal(
        `startExperiment: pass \`mastra\` to run ${experiment.targetType} "${experiment.targetId}"; it is looked up in that Mastra`,
        { code: 'PLATFORM_DATASETS_MASTRA_REQUIRED', method: 'startExperiment', options: ['targetType', 'targetId'] },
      );
    }
    const mastra = configMastra ?? this.#mastra;

    const details = await this.getDetails();
    const version = experiment.version ?? details.version;
    const items = await this.#itemsAt(version);
    if (items.length === 0) {
      throw new MastraError({
        id: 'EXPERIMENT_NO_ITEMS',
        text: `No items in dataset ${this.id} at version ${version}`,
        domain: 'STORAGE',
        category: 'USER',
      });
    }

    const target =
      experiment.targetType !== undefined ? { type: experiment.targetType, id: experiment.targetId } : undefined;
    const { experimentId } = await this.createExperiment({
      ...(experiment.name !== undefined ? { name: experiment.name } : {}),
      ...(experiment.description !== undefined ? { description: experiment.description } : {}),
      ...(experiment.metadata !== undefined || target
        ? { metadata: { ...(target ? { target } : {}), ...experiment.metadata } }
        : {}),
      ...(experiment.provenance !== undefined ? { provenance: experiment.provenance } : {}),
      ...(experiment.grouping !== undefined ? { grouping: experiment.grouping } : {}),
      version,
    });

    const uploadErrors = new Map<string, string>();
    const upload = async (event: ExperimentItemCompletedEvent) => {
      const scores = submittedScores(event.scores);
      try {
        await this.submitExperimentResult({
          experimentId,
          itemId: event.itemId,
          input: event.input,
          output: event.output,
          groundTruth: event.groundTruth,
          error: submittedError(event.error),
          startedAt: new Date(event.startedAt),
          completedAt: new Date(event.completedAt),
          ...(event.traceId ? { traceId: event.traceId } : {}),
          ...(scores.length ? { scores } : {}),
        });
      } catch (error) {
        uploadErrors.set(event.itemId, error instanceof Error ? error.message : String(error));
        mastra
          .getLogger()
          ?.error(`Failed to upload experiment result for item ${event.itemId} in experiment ${experimentId}`, {
            error,
          });
      }
    };

    // Items keep their dataset ids so uploads land on them. Inline data skips the dataset-level
    // scorers core would use, so they are copied onto items that name none.
    const data: DataItem[] = items.map(item => ({
      id: item.id,
      input: item.input,
      groundTruth: item.groundTruth,
      ...(item.expectedTrajectory != null
        ? { expectedTrajectory: item.expectedTrajectory as DataItem['expectedTrajectory'] }
        : {}),
      ...(item.metadata ? { metadata: item.metadata } : {}),
      ...(item.requestContext ? { requestContext: item.requestContext } : {}),
      ...(item.toolMocks ? { toolMocks: item.toolMocks } : {}),
      ...(item.unmockedToolPolicy ? { unmockedToolPolicy: item.unmockedToolPolicy } : {}),
      ...((item.scorerIds ?? details.scorerIds) ? { scorerIds: (item.scorerIds ?? details.scorerIds)! } : {}),
    }));

    let summary: ExperimentSummary | undefined;
    try {
      summary = await runExperiment(mastra, {
        ...experiment,
        data,
        experimentId,
        persistence: { experiments: 'none', scores: 'none' },
        onEvent: async (event: ExperimentEvent) => {
          if (event.type === 'experiment.item.completed') await upload(event);
          await onEvent?.(event);
        },
        // Same widening as core's Dataset.startExperiment: runExperiment isn't generic over I/O/E.
      } as ExperimentConfig);
    } finally {
      await this.finalizeExperiment({ experimentId }).catch(error => {
        // Don't hide the run's own error, or fail a run whose results were uploaded.
        mastra.getLogger()?.error(`Failed to finalize experiment ${experimentId}`, { error });
      });
    }

    if (uploadErrors.size === 0) return summary;
    return {
      ...summary,
      persistenceFailures: (summary.persistenceFailures ?? 0) + uploadErrors.size,
      results: summary.results.map(result => {
        const message = uploadErrors.get(result.itemId);
        return message ? { ...result, persistenceError: { message } } : result;
      }),
    };
  }

  // ---------------------------------------------------------------------------
  // Not available on the Platform
  // ---------------------------------------------------------------------------

  override async startExperimentAsync(): Promise<never> {
    throw unsupportedMethod('startExperimentAsync', 'Use startExperiment, which runs here and uploads results.');
  }

  override async runExperimentItem(): Promise<never> {
    throw unsupportedMethod(
      'runExperimentItem',
      'Run the item yourself and save it with submitExperimentResult, or use startExperiment.',
    );
  }
}
