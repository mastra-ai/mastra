import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  normalizePerPage,
  TABLE_WORKFLOW_SNAPSHOT,
  WorkflowsStorage,
} from '@mastra/core/storage';
import type {
  WorkflowRun,
  WorkflowRuns,
  StorageListWorkflowRunsInput,
  UpdateWorkflowStateOptions,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import type { Service } from 'electrodb';
import type { WorkflowSnapshotEntityData } from '../../../entities/utils';
import { resolveDynamoDBConfig } from '../../db';
import type { DynamoDBDomainConfig } from '../../db';
import type { DynamoDBTtlConfig } from '../../index';
import { getTtlProps } from '../../ttl';
import { deleteTableData } from '../utils';

// Define the structure for workflow snapshot items retrieved from DynamoDB
interface WorkflowSnapshotDBItem {
  entity: string; // Typically 'workflow_snapshot'
  workflow_name: string;
  run_id: string;
  snapshot: WorkflowRunState; // Should be WorkflowRunState after ElectroDB get attribute processing
  createdAt: string; // ISO Date string
  updatedAt: string; // ISO Date string
  resourceId?: string;
}

function formatWorkflowRun(snapshotData: WorkflowSnapshotDBItem): WorkflowRun {
  return {
    workflowName: snapshotData.workflow_name,
    runId: snapshotData.run_id,
    snapshot: snapshotData.snapshot as WorkflowRunState,
    createdAt: new Date(snapshotData.createdAt),
    updatedAt: new Date(snapshotData.updatedAt),
    resourceId: snapshotData.resourceId,
  };
}

// Maximum retry attempts for optimistic locking conflicts
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 50;

export class WorkflowStorageDynamoDB extends WorkflowsStorage {
  private service: Service<Record<string, any>>;
  private ttlConfig?: DynamoDBTtlConfig;

  constructor(config: DynamoDBDomainConfig) {
    super();
    const resolved = resolveDynamoDBConfig(config);
    this.service = resolved.service;
    this.ttlConfig = resolved.ttl;
  }

  supportsConcurrentUpdates(): boolean {
    return true;
  }

  async dangerouslyClearAll(): Promise<void> {
    await deleteTableData(this.service, TABLE_WORKFLOW_SNAPSHOT);
  }

  /**
   * Helper to check if an error is a DynamoDB conditional check failure
   */
  private isConditionalCheckFailed(error: unknown): boolean {
    if (error && typeof error === 'object') {
      const err = error as { name?: string; code?: string; __type?: string; message?: string; cause?: unknown };
      // Check direct DynamoDB error properties
      if (
        err.name === 'ConditionalCheckFailedException' ||
        err.code === 'ConditionalCheckFailedException' ||
        (err.__type?.includes('ConditionalCheckFailedException') ?? false)
      ) {
        return true;
      }
      // Check ElectroDB wrapped error message
      if (err.message?.includes('conditional request failed')) {
        return true;
      }
      // Check nested cause for the original DynamoDB error
      if (err.cause && typeof err.cause === 'object') {
        const cause = err.cause as { name?: string; code?: string };
        if (cause.name === 'ConditionalCheckFailedException' || cause.code === 'ConditionalCheckFailedException') {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Helper to delay with exponential backoff and jitter
   */
  private async delay(attempt: number): Promise<void> {
    const backoff = BASE_DELAY_MS * Math.pow(2, attempt);
    const jitter = Math.random() * backoff * 0.5;
    await new Promise(resolve => setTimeout(resolve, backoff + jitter));
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
    // Use optimistic locking with retry for atomic updates
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Load existing record with updatedAt for version checking
        const existingRecord = await this.service.entities.workflow_snapshot
          .get({
            entity: 'workflow_snapshot',
            workflow_name: workflowName,
            run_id: runId,
          })
          .go();

        const now = new Date();
        let snapshot: WorkflowRunState;
        let previousUpdatedAt: string | undefined;

        if (!existingRecord.data) {
          // Create new snapshot if none exists
          snapshot = {
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
            runId,
            requestContext: {},
          } as WorkflowRunState;
        } else {
          snapshot = existingRecord.data.snapshot as WorkflowRunState;
          previousUpdatedAt = existingRecord.data.updatedAt;
        }

        // Merge the new step result and request context
        snapshot.context[stepId] = result;
        snapshot.requestContext = { ...snapshot.requestContext, ...requestContext };

        const data: WorkflowSnapshotEntityData = {
          entity: 'workflow_snapshot',
          workflow_name: workflowName,
          run_id: runId,
          snapshot: JSON.stringify(snapshot),
          createdAt: existingRecord.data?.createdAt ?? now.toISOString(),
          updatedAt: now.toISOString(),
          ...getTtlProps('workflow_snapshot', this.ttlConfig),
        };

        if (previousUpdatedAt) {
          // Use conditional update - only succeed if updatedAt hasn't changed
          await this.service.entities.workflow_snapshot
            .upsert(data)
            .where((attr: any, op: any) => op.eq(attr.updatedAt, previousUpdatedAt!))
            .go();
        } else {
          // New record - use condition that item doesn't exist
          await this.service.entities.workflow_snapshot
            .create(data)
            .where((attr: any, op: any) => op.notExists(attr.run_id))
            .go();
        }

        return snapshot.context;
      } catch (error) {
        if (this.isConditionalCheckFailed(error)) {
          // Conflict detected, retry with backoff
          if (attempt < MAX_RETRIES - 1) {
            this.logger.debug(
              `Optimistic locking conflict in updateWorkflowResults, retrying (attempt ${attempt + 1})`,
            );
            await this.delay(attempt);
            continue;
          }
        }
        // Non-retryable error or max retries exceeded
        if (error instanceof MastraError) throw error;
        throw new MastraError(
          {
            id: createStorageErrorId('DYNAMODB', 'UPDATE_WORKFLOW_RESULTS', 'FAILED'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.THIRD_PARTY,
            details: { workflowName, runId, stepId },
          },
          error,
        );
      }
    }

    // Should not reach here, but TypeScript needs this
    throw new MastraError(
      {
        id: createStorageErrorId('DYNAMODB', 'UPDATE_WORKFLOW_RESULTS', 'MAX_RETRIES_EXCEEDED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        details: { workflowName, runId, stepId },
      },
      new Error('Max retries exceeded for optimistic locking'),
    );
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
    // Use optimistic locking with retry for atomic updates
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Load existing record with updatedAt for version checking
        const existingRecord = await this.service.entities.workflow_snapshot
          .get({
            entity: 'workflow_snapshot',
            workflow_name: workflowName,
            run_id: runId,
          })
          .go();

        if (!existingRecord.data) {
          return undefined;
        }

        const existingSnapshot = existingRecord.data.snapshot as WorkflowRunState;

        if (!existingSnapshot || !existingSnapshot.context) {
          return undefined;
        }

        const previousUpdatedAt = existingRecord.data.updatedAt;

        // Merge the new options with the existing snapshot
        const updatedSnapshot = { ...existingSnapshot, ...opts };

        const now = new Date();
        const data: WorkflowSnapshotEntityData = {
          entity: 'workflow_snapshot',
          workflow_name: workflowName,
          run_id: runId,
          snapshot: JSON.stringify(updatedSnapshot),
          createdAt: existingRecord.data.createdAt,
          updatedAt: now.toISOString(),
          resourceId: existingRecord.data.resourceId,
          ...getTtlProps('workflow_snapshot', this.ttlConfig),
        };

        // Use conditional update - only succeed if updatedAt hasn't changed
        await this.service.entities.workflow_snapshot
          .upsert(data)
          .where((attr: any, op: any) => op.eq(attr.updatedAt, previousUpdatedAt))
          .go();

        return updatedSnapshot;
      } catch (error) {
        if (this.isConditionalCheckFailed(error)) {
          // Conflict detected, retry with backoff
          if (attempt < MAX_RETRIES - 1) {
            this.logger.debug(`Optimistic locking conflict in updateWorkflowState, retrying (attempt ${attempt + 1})`);
            await this.delay(attempt);
            continue;
          }
        }
        // Non-retryable error or max retries exceeded
        if (error instanceof MastraError) throw error;
        throw new MastraError(
          {
            id: createStorageErrorId('DYNAMODB', 'UPDATE_WORKFLOW_STATE', 'FAILED'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.THIRD_PARTY,
            details: { workflowName, runId },
          },
          error,
        );
      }
    }

    // Should not reach here, but TypeScript needs this
    throw new MastraError(
      {
        id: createStorageErrorId('DYNAMODB', 'UPDATE_WORKFLOW_STATE', 'MAX_RETRIES_EXCEEDED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        details: { workflowName, runId },
      },
      new Error('Max retries exceeded for optimistic locking'),
    );
  }

  // Workflow operations
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
    this.logger.debug('Persisting workflow snapshot', { workflowName, runId });

    try {
      const now = new Date();
      const data: WorkflowSnapshotEntityData = {
        entity: 'workflow_snapshot',
        workflow_name: workflowName,
        run_id: runId,
        snapshot: JSON.stringify(snapshot),
        createdAt: (createdAt ?? now).toISOString(),
        updatedAt: (updatedAt ?? now).toISOString(),
        resourceId,
        ...getTtlProps('workflow_snapshot', this.ttlConfig),
      };

      // Use upsert instead of create to handle both create and update cases
      await this.service.entities.workflow_snapshot.upsert(data).go();
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DYNAMODB', 'PERSIST_WORKFLOW_SNAPSHOT', 'FAILED'),
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
    this.logger.debug('Loading workflow snapshot', { workflowName, runId });

    try {
      // Provide *all* composite key components for the primary index ('entity', 'workflow_name', 'run_id')
      const result = await this.service.entities.workflow_snapshot
        .get({
          entity: 'workflow_snapshot', // Add entity type
          workflow_name: workflowName,
          run_id: runId,
        })
        .go();

      if (!result.data?.snapshot) {
        // Check snapshot exists
        return null;
      }

      // Parse the snapshot string
      return result.data.snapshot as WorkflowRunState;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DYNAMODB', 'LOAD_WORKFLOW_SNAPSHOT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId },
        },
        error,
      );
    }
  }

  async listWorkflowRuns(args?: StorageListWorkflowRunsInput): Promise<WorkflowRuns> {
    this.logger.debug('Getting workflow runs', { args });

    try {
      // Default values
      const perPage = args?.perPage !== undefined ? args.perPage : 10;
      const page = args?.page !== undefined ? args.page : 0;

      if (page < 0) {
        throw new MastraError(
          {
            id: createStorageErrorId('DYNAMODB', 'LIST_WORKFLOW_RUNS', 'INVALID_PAGE'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { page },
          },
          new Error('page must be >= 0'),
        );
      }

      const normalizedPerPage = normalizePerPage(perPage, 10);
      const offset = page * normalizedPerPage;

      let query;

      if (args?.workflowName) {
        // Query by workflow name using the primary index
        // Provide *all* composite key components for the PK ('entity', 'workflow_name')
        query = this.service.entities.workflow_snapshot.query.primary({
          entity: 'workflow_snapshot', // Add entity type
          workflow_name: args.workflowName,
        });
      } else {
        // If no workflow name, we need to scan
        // This is not ideal for production with large datasets
        this.logger.warn('Performing a scan operation on workflow snapshots - consider using a more specific query');
        query = this.service.entities.workflow_snapshot.scan; // Scan still uses the service entity
      }

      const allMatchingSnapshots: WorkflowSnapshotDBItem[] = [];
      let cursor: string | null = null;
      const DYNAMODB_PAGE_SIZE = 100; // Sensible page size for fetching

      do {
        const pageResults: { data: WorkflowSnapshotDBItem[]; cursor: string | null } = await query.go({
          limit: DYNAMODB_PAGE_SIZE,
          cursor,
        });

        if (pageResults.data && pageResults.data.length > 0) {
          let pageFilteredData: WorkflowSnapshotDBItem[] = pageResults.data;

          if (args?.status) {
            pageFilteredData = pageFilteredData.filter((snapshot: WorkflowSnapshotDBItem) => {
              return snapshot.snapshot.status === args.status;
            });
          }

          // Apply date filters if specified
          if (args?.fromDate || args?.toDate) {
            pageFilteredData = pageFilteredData.filter((snapshot: WorkflowSnapshotDBItem) => {
              const createdAt = new Date(snapshot.createdAt);
              if (args.fromDate && createdAt < args.fromDate) {
                return false;
              }
              if (args.toDate && createdAt > args.toDate) {
                return false;
              }
              return true;
            });
          }

          // Filter by resourceId if specified
          if (args?.resourceId) {
            pageFilteredData = pageFilteredData.filter((snapshot: WorkflowSnapshotDBItem) => {
              return snapshot.resourceId === args.resourceId;
            });
          }
          allMatchingSnapshots.push(...pageFilteredData);
        }

        cursor = pageResults.cursor;
      } while (cursor);

      if (!allMatchingSnapshots.length) {
        return { runs: [], total: 0 };
      }

      // Apply offset and limit to the accumulated filtered results
      const total = allMatchingSnapshots.length;
      const paginatedData = allMatchingSnapshots.slice(offset, offset + normalizedPerPage);

      // Format and return the results
      const runs = paginatedData.map((snapshot: WorkflowSnapshotDBItem) => formatWorkflowRun(snapshot));

      return {
        runs,
        total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DYNAMODB', 'LIST_WORKFLOW_RUNS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName: args?.workflowName || '', resourceId: args?.resourceId || '' },
        },
        error,
      );
    }
  }

  async getWorkflowRunById(args: { runId: string; workflowName?: string }): Promise<WorkflowRun | null> {
    const { runId, workflowName } = args;
    this.logger.debug('Getting workflow run by ID', { runId, workflowName });

    try {
      // If we have a workflowName, we can do a direct get using the primary key
      if (workflowName) {
        this.logger.debug('WorkflowName provided, using direct GET operation.');
        const result = await this.service.entities.workflow_snapshot
          .get({
            entity: 'workflow_snapshot', // Entity type for PK
            workflow_name: workflowName,
            run_id: runId,
          })
          .go();

        if (!result.data) {
          return null;
        }

        const snapshot = result.data.snapshot;
        return {
          workflowName: result.data.workflow_name,
          runId: result.data.run_id,
          snapshot,
          createdAt: new Date(result.data.createdAt),
          updatedAt: new Date(result.data.updatedAt),
          resourceId: result.data.resourceId,
        };
      }

      // Otherwise, if workflowName is not provided, use the GSI on runId.
      // This is more efficient than a full table scan.
      this.logger.debug(
        'WorkflowName not provided. Attempting to find workflow run by runId using GSI. Ensure GSI (e.g., "byRunId") is defined on the workflowSnapshot entity with run_id as its key and provisioned in DynamoDB.',
      );

      // IMPORTANT: This assumes a GSI (e.g., named 'byRunId') exists on the workflowSnapshot entity
      // with 'run_id' as its partition key. This GSI must be:
      // 1. Defined in your ElectroDB model (e.g., in stores/dynamodb/src/entities/index.ts).
      // 2. Provisioned in the actual DynamoDB table (e.g., via CDK/CloudFormation).
      // The query key object includes 'entity' as it's good practice with ElectroDB and single-table design,
      // aligning with how other GSIs are queried in this file.
      const result = await this.service.entities.workflow_snapshot.query
        .gsi2({ entity: 'workflow_snapshot', run_id: runId }) // Replace 'byRunId' with your actual GSI name
        .go();

      // If the GSI query returns multiple items (e.g., if run_id is not globally unique across all snapshots),
      // this will take the first one. The original scan logic also effectively took the first match found.
      // If run_id is guaranteed unique, result.data should contain at most one item.
      const matchingRunDbItem: WorkflowSnapshotDBItem | null =
        result.data && result.data.length > 0 ? result.data[0] : null;

      if (!matchingRunDbItem) {
        return null;
      }

      const snapshot = matchingRunDbItem.snapshot;
      return {
        workflowName: matchingRunDbItem.workflow_name,
        runId: matchingRunDbItem.run_id,
        snapshot,
        createdAt: new Date(matchingRunDbItem.createdAt),
        updatedAt: new Date(matchingRunDbItem.updatedAt),
        resourceId: matchingRunDbItem.resourceId,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DYNAMODB', 'GET_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId, workflowName: args?.workflowName || '' },
        },
        error,
      );
    }
  }

  async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    this.logger.debug('Deleting workflow run by ID', { runId, workflowName });

    try {
      await this.service.entities.workflow_snapshot
        .delete({
          entity: 'workflow_snapshot',
          workflow_name: workflowName,
          run_id: runId,
        })
        .go();
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DYNAMODB', 'DELETE_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId, workflowName },
        },
        error,
      );
    }
  }
}
