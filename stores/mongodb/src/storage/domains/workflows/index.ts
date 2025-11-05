import { ErrorDomain, ErrorCategory, MastraError } from '@mastra/core/error';
import { WorkflowsStorage, TABLE_WORKFLOW_SNAPSHOT, safelyParseJSON, normalizePerPage } from '@mastra/core/storage';
import type { WorkflowRun, WorkflowRuns, StorageListWorkflowRunsInput } from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import type { StoreOperationsMongoDB } from '../operations';

export class WorkflowsStorageMongoDB extends WorkflowsStorage {
  private operations: StoreOperationsMongoDB;

  constructor({ operations }: { operations: StoreOperationsMongoDB }) {
    super();
    this.operations = operations;
  }

  updateWorkflowResults(
    {
      // workflowName,
      // runId,
      // stepId,
      // result,
      // requestContext,
    }: {
      workflowName: string;
      runId: string;
      stepId: string;
      result: StepResult<any, any, any, any>;
      requestContext: Record<string, any>;
    },
  ): Promise<Record<string, StepResult<any, any, any, any>>> {
    throw new Error('Method not implemented.');
  }
  updateWorkflowState(
    {
      // workflowName,
      // runId,
      // opts,
    }: {
      workflowName: string;
      runId: string;
      opts: {
        status: string;
        result?: StepResult<any, any, any, any>;
        error?: string;
        suspendedPaths?: Record<string, number[]>;
        waitingPaths?: Record<string, number[]>;
      };
    },
  ): Promise<WorkflowRunState | undefined> {
    throw new Error('Method not implemented.');
  }

  async persistWorkflowSnapshot({
    workflowName,
    runId,
    resourceId,
    snapshot,
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    try {
      const collection = await this.operations.getCollection(TABLE_WORKFLOW_SNAPSHOT);
      await collection.updateOne(
        { workflow_name: workflowName, run_id: runId },
        {
          $set: {
            workflow_name: workflowName,
            run_id: runId,
            resourceId,
            snapshot,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_PERSIST_WORKFLOW_SNAPSHOT_FAILED',
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
      const result = await this.operations.load<any[]>({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: {
          workflow_name: workflowName,
          run_id: runId,
        },
      });

      if (!result?.length) {
        return null;
      }

      return typeof result[0].snapshot === 'string' ? safelyParseJSON(result[0].snapshot) : result[0].snapshot;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_LOAD_WORKFLOW_SNAPSHOT_FAILED',
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

      const collection = await this.operations.getCollection(TABLE_WORKFLOW_SNAPSHOT);
      let total = 0;

      let cursor = collection.find(query).sort({ createdAt: -1 });
      if (options.page !== undefined && typeof options.perPage === 'number') {
        // Validate page is non-negative
        if (options.page < 0) {
          throw new MastraError(
            {
              id: 'STORAGE_MONGODB_INVALID_PAGE',
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
          id: 'STORAGE_MONGODB_STORE_LIST_WORKFLOW_RUNS_FAILED',
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

      const collection = await this.operations.getCollection(TABLE_WORKFLOW_SNAPSHOT);
      const result = await collection.findOne(query);
      if (!result) {
        return null;
      }

      return this.parseWorkflowRun(result);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_GET_WORKFLOW_RUN_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId: args.runId },
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
        console.warn(`Failed to parse snapshot for workflow ${row.workflow_name}: ${e}`);
      }
    }

    return {
      workflowName: row.workflow_name as string,
      runId: row.run_id as string,
      snapshot: parsedSnapshot,
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
      resourceId: row.resourceId,
    };
  }
}
