import { ErrorDomain, ErrorCategory, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  isRunFenceConflictError,
  resolveRunFence,
  WorkflowsStorage,
  TABLE_WORKFLOW_RUN_OWNERS,
  TABLE_WORKFLOW_SNAPSHOT,
  safelyParseJSON,
  normalizePerPage,
} from '@mastra/core/storage';
import type {
  ClaimRunOwnershipInput,
  ClaimRunOwnershipResult,
  PruneOptions,
  PruneResult,
  RenewRunOwnershipInput,
  RenewRunOwnershipResult,
  RetentionTablesDescriptor,
  RunFence,
  RunOwnershipRecord,
  TableRetentionPolicy,
  WorkflowRun,
  WorkflowRuns,
  StorageListWorkflowRunsInput,
  UpdateWorkflowStateOptions,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import type { Document, Filter } from 'mongodb';
import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import { resolveTargets, runPrune } from '../../retention';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';
import { getRunClaims, isDuplicateKeyError, withRunFence } from '../run-fencing';
import type { RunClaimDocument, RunFenceCheck } from '../run-fencing';

// Ownership documents are keyed by runId and judged on the database clock.
const RUN_OWNER_PROJECTION = {
  generation: 1,
  ownerId: 1,
  leaseExpiresAt: 1,
  live: { $gt: ['$leaseExpiresAt', '$$NOW'] },
};
const NOT_LIVE: Filter<RunClaimDocument> = {
  $or: [{ leaseExpiresAt: null }, { $expr: { $lte: ['$leaseExpiresAt', '$$NOW'] } }],
};

function toRunOwnershipRecord(doc: Document): RunOwnershipRecord {
  return {
    runId: doc._id,
    generation: Number(doc.generation),
    ownerId: doc.ownerId,
    leaseExpiresAt: doc.leaseExpiresAt ?? null,
    live: Boolean(doc.live),
  };
}

export class WorkflowsStorageMongoDB extends WorkflowsStorage {
  #connector: MongoDBConnector;
  #skipDefaultIndexes?: boolean;
  #indexes?: MongoDBIndexConfig[];

  /** Collections managed by this domain */
  static readonly MANAGED_COLLECTIONS = [TABLE_WORKFLOW_SNAPSHOT, TABLE_WORKFLOW_RUN_OWNERS] as const;

  /**
   * Anchor is `updatedAt` (BSON date), so the policy reads as inactivity:
   * a run is pruned only after its snapshot has not been touched for `maxAge`.
   */
  static override readonly retentionTables: RetentionTablesDescriptor = {
    workflowSnapshot: { table: TABLE_WORKFLOW_SNAPSHOT, column: 'updatedAt', indexed: true },
  };

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
    this.#skipDefaultIndexes = config.skipDefaultIndexes;
    // Filter indexes to only those for collections managed by this domain
    this.#indexes = config.indexes?.filter(idx =>
      (WorkflowsStorageMongoDB.MANAGED_COLLECTIONS as readonly string[]).includes(idx.collection),
    );
  }

  /** Delete workflow snapshots idle for longer than the policy's `maxAge`, batched. */
  async prune(policies: Record<string, TableRetentionPolicy>, options?: PruneOptions): Promise<PruneResult[]> {
    const targets = resolveTargets({
      policies,
      descriptor: WorkflowsStorageMongoDB.retentionTables,
      order: ['workflowSnapshot'],
    });
    return runPrune({ connector: this.#connector, domain: 'workflows', targets, options, logger: this.logger });
  }

  supportsConcurrentUpdates(): boolean {
    return true;
  }

  /**
   * Fenced writes need multi-document transactions, so only replica sets and
   * sharded clusters fence. Rejects while the deployment can't be probed.
   */
  supportsRunFencing(): Promise<boolean> {
    return this.#connector.probeTransactions();
  }

  private async getCollection(name: string) {
    return this.#connector.getCollection(name);
  }

  async init(): Promise<void> {
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  #runFenceCheck(fence: RunFence | undefined, runId: string, operation: string): RunFenceCheck | undefined {
    const resolved = resolveRunFence(this, fence, runId);
    return resolved && { claims: TABLE_WORKFLOW_RUN_OWNERS, fence: resolved, operation };
  }

  async #readRunOwner(runId: string): Promise<RunOwnershipRecord | null> {
    const owners = await getRunClaims(this.#connector, TABLE_WORKFLOW_RUN_OWNERS);
    const doc = await owners.findOne({ _id: runId }, { projection: RUN_OWNER_PROJECTION });
    return doc ? toRunOwnershipRecord(doc) : null;
  }

  #ownershipError(operation: string, runId: string, error: unknown): MastraError {
    return new MastraError(
      {
        id: createStorageErrorId('MONGODB', operation, 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        details: { runId },
      },
      error,
    );
  }

  // Each claim, renewal and release is one conditional write to the run's
  // ownership document, so racing claimers resolve one at a time. A claim
  // first tries to create the document; once it exists, the claim advances its
  // generation only when the expected generation and lease conditions still
  // hold.

  async claimRunOwnership({
    runId,
    ownerId,
    leaseMs,
    force,
    expectedGeneration,
  }: ClaimRunOwnershipInput): Promise<ClaimRunOwnershipResult> {
    try {
      const owners = await getRunClaims(this.#connector, TABLE_WORKFLOW_RUN_OWNERS);
      const claim = (generation: unknown) => [
        {
          $set: {
            generation,
            ownerId: { $literal: ownerId },
            leaseExpiresAt: { $add: ['$$NOW', leaseMs] },
          },
        },
      ];

      if (!expectedGeneration) {
        try {
          // Matches only a document that doesn't exist; an existing one makes
          // the upsert's insert fail on the duplicate _id.
          const created = await owners.findOneAndUpdate({ _id: runId, generation: { $exists: false } }, claim(1), {
            upsert: true,
            returnDocument: 'after',
            projection: RUN_OWNER_PROJECTION,
          });
          if (created) return { acquired: true, record: toRunOwnershipRecord(created) };
        } catch (error) {
          if (!isDuplicateKeyError(error)) throw error;
        }
        if (expectedGeneration === 0) return { acquired: false, record: await this.#readRunOwner(runId) };
      }

      const advanced = await owners.findOneAndUpdate(
        {
          _id: runId,
          ...(expectedGeneration !== undefined ? { generation: expectedGeneration } : {}),
          ...(force ? {} : NOT_LIVE),
        },
        claim({ $add: ['$generation', 1] }),
        { returnDocument: 'after', projection: RUN_OWNER_PROJECTION },
      );
      if (advanced) return { acquired: true, record: toRunOwnershipRecord(advanced) };
      return { acquired: false, record: await this.#readRunOwner(runId) };
    } catch (error) {
      throw this.#ownershipError('CLAIM_RUN_OWNERSHIP', runId, error);
    }
  }

  async renewRunOwnership({ leaseMs, ...fence }: RenewRunOwnershipInput): Promise<RenewRunOwnershipResult> {
    try {
      const owners = await getRunClaims(this.#connector, TABLE_WORKFLOW_RUN_OWNERS);
      const renewed = await owners.findOneAndUpdate(
        {
          _id: fence.runId,
          generation: fence.generation,
          ownerId: fence.ownerId,
          leaseExpiresAt: { $ne: null },
        },
        [{ $set: { leaseExpiresAt: { $add: ['$$NOW', leaseMs] } } }],
        { returnDocument: 'after', projection: RUN_OWNER_PROJECTION },
      );
      if (renewed) return { renewed: true, record: toRunOwnershipRecord(renewed) };
      return { renewed: false, record: await this.#readRunOwner(fence.runId) };
    } catch (error) {
      throw this.#ownershipError('RENEW_RUN_OWNERSHIP', fence.runId, error);
    }
  }

  async releaseRunOwnership(fence: RunFence): Promise<boolean> {
    try {
      const owners = await getRunClaims(this.#connector, TABLE_WORKFLOW_RUN_OWNERS);
      const released = await owners.updateOne(
        { _id: fence.runId, generation: fence.generation, ownerId: fence.ownerId },
        { $set: { leaseExpiresAt: null } },
      );
      return released.matchedCount > 0;
    } catch (error) {
      throw this.#ownershipError('RELEASE_RUN_OWNERSHIP', fence.runId, error);
    }
  }

  async getRunOwnership({ runId }: { runId: string }): Promise<RunOwnershipRecord | null> {
    try {
      return await this.#readRunOwner(runId);
    } catch (error) {
      throw this.#ownershipError('GET_RUN_OWNERSHIP', runId, error);
    }
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
    const owners = await this.getCollection(TABLE_WORKFLOW_RUN_OWNERS);
    await owners.deleteMany({});
  }

  async updateWorkflowResults({
    workflowName,
    runId,
    stepId,
    result,
    requestContext,
    fence,
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
    fence?: RunFence;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    const check = this.#runFenceCheck(fence, runId, 'updateWorkflowResults');
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
      const updatedDoc = await withRunFence(this.#connector, check, session =>
        collection.findOneAndUpdate(
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
                        $mergeObjects: [
                          { $ifNull: [{ $ifNull: ['$snapshot.context', {}] }, {}] },
                          { [stepId]: result },
                        ],
                      },
                    },
                    // Merge the new request context
                    {
                      requestContext: {
                        $mergeObjects: [
                          { $ifNull: [{ $ifNull: ['$snapshot.requestContext', {}] }, {}] },
                          requestContext,
                        ],
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
          { upsert: true, returnDocument: 'after', session },
        ),
      );

      const snapshot =
        typeof updatedDoc?.snapshot === 'string' ? JSON.parse(updatedDoc.snapshot) : updatedDoc?.snapshot;
      return snapshot?.context || {};
    } catch (error) {
      if (isRunFenceConflictError(error)) throw error;
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
    fence,
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
    fence?: RunFence;
  }): Promise<WorkflowRunState | undefined> {
    const check = this.#runFenceCheck(fence, runId, 'updateWorkflowState');
    try {
      const collection = await this.getCollection(TABLE_WORKFLOW_SNAPSHOT);

      // `expectedStatus` is a compare-and-set guard, not state. It becomes part of the query
      // filter so the match and the write stay a single atomic operation, and it is stripped
      // from the merged document so it can never be persisted into the snapshot.
      const { expectedStatus, ...state } = opts;
      const filter: Record<string, unknown> = { workflow_name: workflowName, run_id: runId };
      if (expectedStatus !== undefined) {
        filter['snapshot.status'] = { $in: Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus] };
      }

      // Use findOneAndUpdate with aggregation pipeline for atomic read-modify-write
      // This ensures concurrent updates don't overwrite each other
      const updatedDoc = await withRunFence(this.#connector, check, session =>
        collection.findOneAndUpdate(
          filter,
          [
            {
              $set: {
                snapshot: {
                  $mergeObjects: ['$snapshot', state],
                },
                updatedAt: new Date(),
              },
            },
          ],
          { returnDocument: 'after', session },
        ),
      );

      if (!updatedDoc) {
        return undefined;
      }

      const snapshot = typeof updatedDoc.snapshot === 'string' ? JSON.parse(updatedDoc.snapshot) : updatedDoc.snapshot;

      if (!snapshot?.context) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_WORKFLOW_STATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Snapshot not found for runId ${runId}`,
          details: { workflowName, runId },
        });
      }

      return snapshot;
    } catch (error) {
      if (error instanceof MastraError || isRunFenceConflictError(error)) throw error;
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
    fence,
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
    fence?: RunFence;
  }): Promise<void> {
    const check = this.#runFenceCheck(fence, runId, 'persistWorkflowSnapshot');
    try {
      const now = new Date();
      const collection = await this.getCollection(TABLE_WORKFLOW_SNAPSHOT);
      await withRunFence(this.#connector, check, session =>
        collection.updateOne(
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
          { upsert: true, session },
        ),
      );
    } catch (error) {
      if (isRunFenceConflictError(error)) throw error;
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

  async deleteWorkflowRunById({
    runId,
    workflowName,
    fence,
  }: {
    runId: string;
    workflowName: string;
    fence?: RunFence;
  }): Promise<void> {
    const check = this.#runFenceCheck(fence, runId, 'deleteWorkflowRunById');
    try {
      const collection = await this.getCollection(TABLE_WORKFLOW_SNAPSHOT);
      await withRunFence(this.#connector, check, session =>
        collection.deleteOne({ workflow_name: workflowName, run_id: runId }, { session }),
      );
    } catch (error) {
      if (isRunFenceConflictError(error)) throw error;
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
