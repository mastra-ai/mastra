import { ErrorDomain, ErrorCategory, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  WorkflowsStorage,
  TABLE_WORKFLOW_SNAPSHOT,
  safelyParseJSON,
  normalizePerPage,
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
                  // Merge the new context entry
                  {
                    context: {
                      $mergeObjects: [{ $ifNull: [{ $ifNull: ['$snapshot.context', {}] }, {}] }, { [stepId]: result }],
                    },
                  },
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
      return snapshot?.context || {};
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
              // Merge the new options into the existing snapshot
              snapshot: {
                $mergeObjects: ['$snapshot', opts],
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
