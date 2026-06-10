import { ErrorDomain, ErrorCategory, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  WorkflowsStorage,
  TABLE_WORKFLOW_SNAPSHOT,
  safelyParseJSON,
  normalizePerPage,
  serializeWorkflowSnapshotValue,
  withRuntimeStepResult,
} from '@mastra/core/storage';
import type {
  WorkflowRun,
  WorkflowRuns,
  StorageListWorkflowRunsInput,
  UpdateWorkflowStateOptions,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';

export class WorkflowsStorageMongoDB extends WorkflowsStorage {
  #connector: MongoDBConnector;
  #skipDefaultIndexes?: boolean;
  #indexes?: MongoDBIndexConfig[];

  /** Collections managed by this domain */
  static readonly MANAGED_COLLECTIONS = [TABLE_WORKFLOW_SNAPSHOT] as const;

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
    this.#skipDefaultIndexes = config.skipDefaultIndexes;
    // Filter indexes to only those for collections managed by this domain
    this.#indexes = config.indexes?.filter(idx =>
      (WorkflowsStorageMongoDB.MANAGED_COLLECTIONS as readonly string[]).includes(idx.collection),
    );
  }

  supportsConcurrentUpdates(): boolean {
    return true;
  }

  private async getCollection(name: string) {
    return this.#connector.getCollection(name);
  }

  // MongoDB keeps this merge in an aggregation pipeline so foreach updates
  // remain atomic without a client-side load/merge/save race.
  private buildWorkflowStepMergeExpression(stepId: string, serializedResult: unknown) {
    const getField = (input: unknown, field: string) => ({ $getField: { input, field } });
    const isObject = (value: unknown) => ({ $eq: [{ $type: value }, 'object'] });
    const isMissingOrNull = (value: unknown) => ({ $in: [{ $type: value }, ['missing', 'null']] });
    const hasForeachStepResultMarker = (value: unknown) => ({ $eq: [getField(value, '__mastra_foreach__'), true] });
    const arrayOrEmpty = (value: unknown) => ({ $cond: [{ $isArray: value }, value, []] });
    const hasCompletedIndex = (indexes: unknown, idx: unknown) => ({
      $cond: [{ $isArray: indexes }, { $in: [idx, indexes] }, false],
    });
    const hasWorkflowMetaSuspendPayload = (value: unknown) => ({
      $cond: [
        isObject(getField(value, 'suspendPayload')),
        { $eq: [{ $type: getField(getField(value, 'suspendPayload'), '__workflow_meta') }, 'object'] },
        false,
      ],
    });
    const stripForeachStepResultMarker = (value: unknown) => ({
      $arrayToObject: {
        $filter: {
          input: { $objectToArray: value },
          as: 'field',
          cond: { $ne: ['$$field.k', '__mastra_foreach__'] },
        },
      },
    });
    const isPendingMarker = (value: unknown) => ({
      $cond: [
        isObject(value),
        {
          $and: [
            { $eq: [getField(value, '__mastra_pending__'), true] },
            { $eq: [{ $size: { $objectToArray: value } }, 1] },
          ],
        },
        false,
      ],
    });
    const isSuspendedStepResult = (value: unknown) => ({
      $cond: [
        isObject(value),
        {
          $and: [
            { $eq: [getField(value, 'status'), 'suspended'] },
            { $in: [{ $type: getField(value, 'suspendedAt') }, ['int', 'long', 'double', 'decimal']] },
            hasWorkflowMetaSuspendPayload(value),
          ],
        },
        false,
      ],
    });
    const canResetWithPendingMarker = (value: unknown) => ({
      $or: [isMissingOrNull(value), isPendingMarker(value), isSuspendedStepResult(value)],
    });
    const hasPartialForeachValue = (output: unknown) => ({
      $cond: [
        { $isArray: output },
        {
          $anyElementTrue: {
            $map: {
              input: output,
              as: 'value',
              in: {
                $or: [isMissingOrNull('$$value'), isPendingMarker('$$value'), isSuspendedStepResult('$$value')],
              },
            },
          },
        },
        false,
      ],
    });
    const hasPendingMarker = (output: unknown) => ({
      $cond: [
        { $isArray: output },
        {
          $anyElementTrue: {
            $map: {
              input: output,
              as: 'value',
              in: isPendingMarker('$$value'),
            },
          },
        },
        false,
      ],
    });

    return {
      $let: {
        vars: {
          context: { $ifNull: ['$snapshot.context', {}] },
          stepResult: { $literal: serializedResult },
        },
        in: {
          $let: {
            vars: {
              existingStepResult: { $getField: { input: '$$context', field: stepId } },
            },
            in: {
              $let: {
                vars: {
                  existingOutput: getField('$$existingStepResult', 'output'),
                  newOutput: getField('$$stepResult', 'output'),
                  hasForeachMarker: hasForeachStepResultMarker('$$stepResult'),
                  completedIndexes: getField('$$stepResult', '__mastra_foreach_completed_indexes__'),
                  existingCompletedIndexes: getField('$$existingStepResult', '__mastra_foreach_completed_indexes__'),
                  // $objectToArray (inside the strip helper) errors on non-object
                  // input, and $let vars evaluate eagerly — guard like the core
                  // merge, which tolerates non-object results.
                  stepResultToStore: {
                    $cond: [isObject('$$stepResult'), stripForeachStepResultMarker('$$stepResult'), '$$stepResult'],
                  },
                },
                in: {
                  $mergeObjects: [
                    '$$context',
                    {
                      $arrayToObject: [
                        [
                          {
                            k: stepId,
                            v: {
                              $let: {
                                vars: {
                                  hasPendingMarker: hasPendingMarker('$$newOutput'),
                                  shouldMerge: {
                                    $and: [
                                      { $isArray: '$$existingOutput' },
                                      { $isArray: '$$newOutput' },
                                      {
                                        $and: [
                                          '$$hasForeachMarker',
                                          {
                                            $or: [
                                              hasPendingMarker('$$newOutput'),
                                              hasPartialForeachValue('$$existingOutput'),
                                              hasPartialForeachValue('$$newOutput'),
                                            ],
                                          },
                                        ],
                                      },
                                    ],
                                  },
                                },
                                in: {
                                  $cond: [
                                    '$$shouldMerge',
                                    {
                                      $mergeObjects: [
                                        '$$existingStepResult',
                                        { $cond: ['$$hasPendingMarker', {}, '$$stepResultToStore'] },
                                        {
                                          $cond: [
                                            '$$hasPendingMarker',
                                            {},
                                            {
                                              $let: {
                                                vars: {
                                                  mergedCompletedIndexes: {
                                                    $setUnion: [
                                                      arrayOrEmpty('$$existingCompletedIndexes'),
                                                      arrayOrEmpty('$$completedIndexes'),
                                                    ],
                                                  },
                                                },
                                                in: {
                                                  $cond: [
                                                    { $gt: [{ $size: '$$mergedCompletedIndexes' }, 0] },
                                                    {
                                                      __mastra_foreach_completed_indexes__: '$$mergedCompletedIndexes',
                                                    },
                                                    {},
                                                  ],
                                                },
                                              },
                                            },
                                          ],
                                        },
                                        {
                                          output: {
                                            $map: {
                                              input: {
                                                $range: [
                                                  0,
                                                  {
                                                    $max: [{ $size: '$$existingOutput' }, { $size: '$$newOutput' }],
                                                  },
                                                ],
                                              },
                                              as: 'idx',
                                              in: {
                                                $let: {
                                                  vars: {
                                                    existingValue: { $arrayElemAt: ['$$existingOutput', '$$idx'] },
                                                    newValue: { $arrayElemAt: ['$$newOutput', '$$idx'] },
                                                  },
                                                  in: {
                                                    $cond: [
                                                      { $lt: ['$$idx', { $size: '$$newOutput' }] },
                                                      {
                                                        $cond: [
                                                          isPendingMarker('$$newValue'),
                                                          {
                                                            $cond: [
                                                              {
                                                                $or: [
                                                                  { $gte: ['$$idx', { $size: '$$existingOutput' }] },
                                                                  canResetWithPendingMarker('$$existingValue'),
                                                                ],
                                                              },
                                                              null,
                                                              '$$existingValue',
                                                            ],
                                                          },
                                                          {
                                                            $cond: [
                                                              {
                                                                $and: [
                                                                  hasCompletedIndex('$$completedIndexes', '$$idx'),
                                                                  { $not: ['$$hasPendingMarker'] },
                                                                ],
                                                              },
                                                              '$$newValue',
                                                              {
                                                                $cond: [
                                                                  {
                                                                    $and: [
                                                                      hasCompletedIndex(
                                                                        '$$existingCompletedIndexes',
                                                                        '$$idx',
                                                                      ),
                                                                      { $not: ['$$hasPendingMarker'] },
                                                                    ],
                                                                  },
                                                                  '$$existingValue',
                                                                  {
                                                                    $cond: [
                                                                      {
                                                                        $and: [
                                                                          { $not: [isMissingOrNull('$$newValue')] },
                                                                          { $not: ['$$hasPendingMarker'] },
                                                                        ],
                                                                      },
                                                                      '$$newValue',
                                                                      {
                                                                        $cond: [
                                                                          {
                                                                            $gte: [
                                                                              '$$idx',
                                                                              { $size: '$$existingOutput' },
                                                                            ],
                                                                          },
                                                                          null,
                                                                          '$$existingValue',
                                                                        ],
                                                                      },
                                                                    ],
                                                                  },
                                                                ],
                                                              },
                                                            ],
                                                          },
                                                        ],
                                                      },
                                                      '$$existingValue',
                                                    ],
                                                  },
                                                },
                                              },
                                            },
                                          },
                                        },
                                      ],
                                    },
                                    '$$stepResultToStore',
                                  ],
                                },
                              },
                            },
                          },
                        ],
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    };
  }

  async init(): Promise<void> {
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  /**
   * Returns default index definitions for the workflows domain collections.
   */
  getDefaultIndexDefinitions(): MongoDBIndexConfig[] {
    return [
      { collection: TABLE_WORKFLOW_SNAPSHOT, keys: { workflow_name: 1, run_id: 1 }, options: { unique: true } },
      { collection: TABLE_WORKFLOW_SNAPSHOT, keys: { run_id: 1 } },
      { collection: TABLE_WORKFLOW_SNAPSHOT, keys: { workflow_name: 1 } },
      { collection: TABLE_WORKFLOW_SNAPSHOT, keys: { resourceId: 1 } },
      { collection: TABLE_WORKFLOW_SNAPSHOT, keys: { createdAt: -1 } },
      { collection: TABLE_WORKFLOW_SNAPSHOT, keys: { 'snapshot.status': 1 } },
    ];
  }

  /**
   * Creates default indexes for optimal query performance.
   */
  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) {
      return;
    }

    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        const collection = await this.getCollection(indexDef.collection);
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create index on ${indexDef.collection}:`, error);
      }
    }
  }

  /**
   * Creates custom user-defined indexes for this domain's collections.
   */
  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) {
      return;
    }

    for (const indexDef of this.#indexes) {
      try {
        const collection = await this.getCollection(indexDef.collection);
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create custom index on ${indexDef.collection}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    const collection = await this.getCollection(TABLE_WORKFLOW_SNAPSHOT);
    await collection.deleteMany({});
  }

  async updateWorkflowResults({
    workflowName,
    runId,
    stepId,
    result,
    requestContext,
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    try {
      const collection = await this.getCollection(TABLE_WORKFLOW_SNAPSHOT);
      const now = new Date();

      // Default snapshot structure for new entries
      const defaultSnapshot = {
        context: {},
        activePaths: [],
        timestamp: Date.now(),
        suspendedPaths: {},
        activeStepsPath: {},
        resumeLabels: {},
        serializedStepGraph: [],
        status: 'pending',
        value: {},
        waitingPaths: {},
        runId: runId,
        requestContext: {},
      };
      const serializedResult = serializeWorkflowSnapshotValue(result);

      const mergedContext = this.buildWorkflowStepMergeExpression(stepId, serializedResult);

      // Use findOneAndUpdate with aggregation pipeline for atomic read-modify-write
      // This ensures concurrent updates don't overwrite each other
      const updatedDoc = await collection.findOneAndUpdate(
        { workflow_name: workflowName, run_id: runId },
        [
          {
            $set: {
              workflow_name: workflowName,
              run_id: runId,
              // If snapshot doesn't exist, use default; otherwise merge
              snapshot: {
                $mergeObjects: [
                  // Start with default snapshot if document is new
                  { $ifNull: ['$snapshot', defaultSnapshot] },
                  // Merge the new context entry without replacing partial foreach arrays wholesale.
                  { context: mergedContext },
                  // Merge the new request context
                  {
                    requestContext: {
                      $mergeObjects: [{ $ifNull: [{ $ifNull: ['$snapshot.requestContext', {}] }, {}] }, requestContext],
                    },
                  },
                ],
              },
              updatedAt: now,
              // Only set createdAt if it doesn't exist
              createdAt: { $ifNull: ['$createdAt', now] },
            },
          },
        ],
        { upsert: true, returnDocument: 'after' },
      );

      const snapshot =
        typeof updatedDoc?.snapshot === 'string' ? JSON.parse(updatedDoc.snapshot) : updatedDoc?.snapshot;
      // The stored context holds the serialized view; hand runtime callers the
      // raw step result for non-foreach entries, matching core merge semantics.
      return withRuntimeStepResult(snapshot?.context || {}, stepId, result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'UPDATE_WORKFLOW_RESULTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            workflowName,
            runId,
            stepId,
          },
        },
        error,
      );
    }
  }
  async updateWorkflowState({
    workflowName,
    runId,
    opts,
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
  }): Promise<WorkflowRunState | undefined> {
    try {
      const collection = await this.getCollection(TABLE_WORKFLOW_SNAPSHOT);
      const serializedOpts = serializeWorkflowSnapshotValue(opts);

      // Use findOneAndUpdate with aggregation pipeline for atomic read-modify-write
      // This ensures concurrent updates don't overwrite each other
      const updatedDoc = await collection.findOneAndUpdate(
        {
          workflow_name: workflowName,
          run_id: runId,
          // Only update if snapshot exists and has context
          'snapshot.context': { $exists: true },
        },
        [
          {
            $set: {
              // Merge the new options into the existing snapshot. $literal keeps
              // user data (e.g. "$"-prefixed keys or "$field"-shaped strings in
              // workflow results) from being evaluated as aggregation expressions.
              snapshot: {
                $mergeObjects: ['$snapshot', { $literal: serializedOpts }],
              },
              updatedAt: new Date(),
            },
          },
        ],
        { returnDocument: 'after' },
      );

      if (!updatedDoc) {
        return undefined;
      }

      const snapshot = typeof updatedDoc.snapshot === 'string' ? JSON.parse(updatedDoc.snapshot) : updatedDoc.snapshot;
      return snapshot;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'UPDATE_WORKFLOW_STATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            workflowName,
            runId,
          },
        },
        error,
      );
    }
  }

  async persistWorkflowSnapshot({
    workflowName,
    runId,
    resourceId,
    snapshot,
    createdAt,
    updatedAt,
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
  }): Promise<void> {
    try {
      const now = new Date();
      const collection = await this.getCollection(TABLE_WORKFLOW_SNAPSHOT);
      await collection.updateOne(
        { workflow_name: workflowName, run_id: runId },
        {
          $set: {
            workflow_name: workflowName,
            run_id: runId,
            resourceId,
            snapshot,
            updatedAt: updatedAt ?? now,
          },
          $setOnInsert: {
            createdAt: createdAt ?? now,
          },
        },
        { upsert: true },
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'PERSIST_WORKFLOW_SNAPSHOT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId },
        },
        error,
      );
    }
  }

  async loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    try {
      const collection = await this.getCollection(TABLE_WORKFLOW_SNAPSHOT);
      const result = await collection.findOne({
        workflow_name: workflowName,
        run_id: runId,
      });

      if (!result) {
        return null;
      }

      return typeof result.snapshot === 'string' ? safelyParseJSON(result.snapshot as string) : result.snapshot;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LOAD_WORKFLOW_SNAPSHOT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId },
        },
        error,
      );
    }
  }

  async listWorkflowRuns(args?: StorageListWorkflowRunsInput): Promise<WorkflowRuns> {
    const options = args || {};
    try {
      const query: any = {};
      if (options.workflowName) {
        query['workflow_name'] = options.workflowName;
      }
      if (options.status) {
        query['snapshot.status'] = options.status;
      }
      if (options.fromDate) {
        query['createdAt'] = { $gte: options.fromDate };
      }
      if (options.toDate) {
        if (query['createdAt']) {
          query['createdAt'].$lte = options.toDate;
        } else {
          query['createdAt'] = { $lte: options.toDate };
        }
      }
      if (options.resourceId) {
        query['resourceId'] = options.resourceId;
      }

      const collection = await this.getCollection(TABLE_WORKFLOW_SNAPSHOT);
      let total = 0;

      let cursor = collection.find(query).sort({ createdAt: -1 });
      if (options.page !== undefined && typeof options.perPage === 'number') {
        // Validate page is non-negative
        if (options.page < 0) {
          throw new MastraError(
            {
              id: createStorageErrorId('MONGODB', 'LIST_WORKFLOW_RUNS', 'INVALID_PAGE'),
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.USER,
              details: { page: options.page },
            },
            new Error('page must be >= 0'),
          );
        }

        total = await collection.countDocuments(query);
        const normalizedPerPage = normalizePerPage(options.perPage, Number.MAX_SAFE_INTEGER);

        // Handle perPage = 0 edge case (MongoDB limit(0) disables limit)
        if (normalizedPerPage === 0) {
          return { runs: [], total };
        }

        const offset = options.page * normalizedPerPage;
        cursor = cursor.skip(offset);
        // Cap to MongoDB's 32-bit signed integer max to prevent overflow
        cursor = cursor.limit(Math.min(normalizedPerPage, 2147483647));
      }

      const results = await cursor.toArray();

      const runs = results.map(row => this.parseWorkflowRun(row));

      return {
        runs,
        total: total || runs.length,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_WORKFLOW_RUNS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName: options.workflowName || 'unknown' },
        },
        error,
      );
    }
  }

  async getWorkflowRunById(args: { runId: string; workflowName?: string }): Promise<WorkflowRun | null> {
    try {
      const query: any = {};
      if (args.runId) {
        query['run_id'] = args.runId;
      }
      if (args.workflowName) {
        query['workflow_name'] = args.workflowName;
      }

      const collection = await this.getCollection(TABLE_WORKFLOW_SNAPSHOT);
      const result = await collection.findOne(query);
      if (!result) {
        return null;
      }

      return this.parseWorkflowRun(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId: args.runId },
        },
        error,
      );
    }
  }

  async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    try {
      const collection = await this.getCollection(TABLE_WORKFLOW_SNAPSHOT);
      await collection.deleteOne({ workflow_name: workflowName, run_id: runId });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId, workflowName },
        },
        error,
      );
    }
  }

  private parseWorkflowRun(row: any): WorkflowRun {
    let parsedSnapshot: WorkflowRunState | string = row.snapshot as string;
    if (typeof parsedSnapshot === 'string') {
      try {
        parsedSnapshot = typeof row.snapshot === 'string' ? safelyParseJSON(row.snapshot as string) : row.snapshot;
      } catch (e) {
        // If parsing fails, return the raw snapshot string
        this.logger.warn(`Failed to parse snapshot for workflow ${row.workflow_name}: ${e}`);
      }
    }

    return {
      workflowName: row.workflow_name as string,
      runId: row.run_id as string,
      snapshot: parsedSnapshot,
      createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
      resourceId: row.resourceId,
    };
  }
}
