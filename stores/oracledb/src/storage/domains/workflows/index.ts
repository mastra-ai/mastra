import { ErrorCategory } from '@mastra/core/error';
import {
  normalizePerPage,
  TABLE_WORKFLOW_SNAPSHOT,
  WorkflowsStorage,
} from '@mastra/core/storage';
import type {
  StorageListWorkflowRunsInput,
  UpdateWorkflowStateOptions,
  WorkflowRun,
  WorkflowRuns,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';

import { isOracleErrorCode, jsonBind } from '../../../shared/connection';
import { indexNameForTable, qualifyName } from '../../../vector/identifiers';
import { OracleDB, createOracleIndex, filterIndexesForTables } from '../../db';
import type { OracleCreateIndexOptions, OracleTxClient } from '../../db';
import { createOracleStorageError, toDate } from '../../domain-utils';
import type { OracleDomainConfig } from '../../types';

// Workflows persist resumable run snapshots in Oracle JSON and lock rows before
// patching step results so concurrent updates do not lose state.
const STORE_NAME = 'ORACLEDB';

const WORKFLOW_CREATED_AT = '"createdAt"';
const WORKFLOW_UPDATED_AT = '"updatedAt"';
const WORKFLOW_RESOURCE_ID = '"resourceId"';

type WorkflowRow = {
  workflowName: string;
  runId: string;
  resourceId?: string | null;
  snapshot: unknown;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export class WorkflowsOracle extends WorkflowsStorage {
  // Workflow state is a JSON snapshot keyed by workflow name + run id.
  static readonly MANAGED_TABLES = [TABLE_WORKFLOW_SNAPSHOT] as const;

  private readonly db: OracleDB;
  private readonly schemaName?: string;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes: OracleCreateIndexOptions[];

  constructor(config: OracleDomainConfig) {
    super();
    this.db = new OracleDB(config);
    this.schemaName = config.schemaName;
    this.skipDefaultIndexes = config.skipDefaultIndexes;
    this.indexes = filterIndexesForTables(config.indexes, WorkflowsOracle.MANAGED_TABLES);
  }

  supportsConcurrentUpdates(): boolean {
    // Row-level locks protect JSON snapshot patches, so independent steps can
    // update the same workflow run without clobbering each other.
    return true;
  }

  async init(): Promise<void> {
    await this.createTables();
    await this.createIndexes();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable(TABLE_WORKFLOW_SNAPSHOT);
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
      return await this.db.tx(async client => {
        await this.ensureWorkflowRunRow(client, workflowName, runId);

        // Lock the row before patching the JSON snapshot so concurrent step updates do not overwrite each other.
        const existing = await client.one<{ snapshot: unknown; resourceId?: string | null }>(
          `SELECT snapshot AS "snapshot", ${WORKFLOW_RESOURCE_ID} AS "resourceId" FROM ${this.table()} WHERE workflow_name = :workflowName AND run_id = :runId FOR UPDATE`,
          { workflowName, runId },
        );

        const snapshot = parseSnapshot(existing.snapshot);
        snapshot.context[stepId] = result;
        snapshot.requestContext = { ...(snapshot.requestContext ?? {}), ...requestContext };

        await client.none(this.workflowMergeSql(), {
          workflowName,
          runId,
          resourceId: existing?.resourceId ?? null,
          snapshot: jsonBind(snapshot),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return snapshot.context;
      });
    } catch (error) {
      throw this.storageError('UPDATE_WORKFLOW_RESULTS', 'FAILED', { workflowName, runId, stepId }, error);
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
      return await this.db.tx(async client => {
        // State updates patch top-level snapshot fields and require a pre-existing
        // run row; result updates create a default row when needed.
        const existing = await client.oneOrNone<{ snapshot: unknown }>(
          `SELECT snapshot AS "snapshot" FROM ${this.table()} WHERE workflow_name = :workflowName AND run_id = :runId FOR UPDATE`,
          { workflowName, runId },
        );
        if (!existing) return undefined;

        const snapshot = parseSnapshot(existing.snapshot);
        if (!snapshot?.context) {
          throw new Error(`Snapshot not found for runId ${runId}`);
        }

        const updatedSnapshot = { ...snapshot, ...opts };
        await client.none(
          `UPDATE ${this.table()} SET snapshot = :snapshot, ${WORKFLOW_UPDATED_AT} = :updatedAt WHERE workflow_name = :workflowName AND run_id = :runId`,
          { workflowName, runId, snapshot: jsonBind(updatedSnapshot), updatedAt: new Date() },
        );
        return updatedSnapshot;
      });
    } catch (error) {
      throw this.storageError('UPDATE_WORKFLOW_STATE', 'FAILED', { workflowName, runId }, error);
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
      // Persisting a snapshot is an upsert because workflows may suspend/resume
      // the same run multiple times.
      await this.db.none(this.workflowMergeSql(), {
        workflowName,
        runId,
        resourceId: resourceId ?? null,
        snapshot: jsonBind(snapshot),
        createdAt: createdAt ?? now,
        updatedAt: updatedAt ?? now,
      });
    } catch (error) {
      throw this.storageError('PERSIST_WORKFLOW_SNAPSHOT', 'FAILED', { workflowName, runId }, error);
    }
  }

  async loadWorkflowSnapshot({ workflowName, runId }: { workflowName: string; runId: string }): Promise<WorkflowRunState | null> {
    try {
      const row = await this.db.oneOrNone<{ snapshot: unknown }>(
        `SELECT snapshot AS "snapshot" FROM ${this.table()} WHERE workflow_name = :workflowName AND run_id = :runId`,
        { workflowName, runId },
      );
      return row ? parseSnapshot(row.snapshot) : null;
    } catch (error) {
      throw this.storageError('LOAD_WORKFLOW_SNAPSHOT', 'FAILED', { workflowName, runId }, error);
    }
  }

  async listWorkflowRuns({
    workflowName,
    fromDate,
    toDate,
    perPage,
    page,
    resourceId,
    status,
  }: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    try {
      const { whereClause, binds } = this.workflowWhereClause({ workflowName, fromDate, toDate, resourceId, status });
      const usePagination = typeof perPage === 'number' && typeof page === 'number';
      const normalizedPerPage = usePagination ? normalizePerPage(perPage, Number.MAX_SAFE_INTEGER) : 0;
      const offset = usePagination ? page! * normalizedPerPage : 0;

      const count = usePagination
        ? Number(
            (
              await this.db.one<{ count: number }>(`SELECT COUNT(*) AS "count" FROM ${this.table()} ${whereClause}`, binds)
            ).count ?? 0,
          )
        : 0;

      const rows = await this.db.manyOrNone<WorkflowRow>(
        `${this.workflowSelect()} FROM ${this.table()} ${whereClause} ORDER BY ${WORKFLOW_CREATED_AT} DESC ${
          usePagination ? 'OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY' : ''
        }`,
        usePagination ? { ...binds, offset, limit: normalizedPerPage } : binds,
      );

      const runs = rows.map(row => this.parseWorkflowRun(row));
      return { runs, total: usePagination ? count : runs.length };
    } catch (error) {
      throw this.storageError('LIST_WORKFLOW_RUNS', 'FAILED', { workflowName: workflowName ?? 'all' }, error);
    }
  }

  async getWorkflowRunById({ runId, workflowName }: { runId: string; workflowName?: string }): Promise<WorkflowRun | null> {
    try {
      const conditions = ['run_id = :runId'];
      const binds: Record<string, unknown> = { runId };
      if (workflowName) {
        conditions.push('workflow_name = :workflowName');
        binds.workflowName = workflowName;
      }

      const rows = await this.db.manyOrNone<WorkflowRow>(
        `${this.workflowSelect()} FROM ${this.table()} WHERE ${conditions.join(' AND ')} ORDER BY ${WORKFLOW_CREATED_AT} DESC FETCH FIRST 1 ROWS ONLY`,
        binds,
      );
      return rows[0] ? this.parseWorkflowRun(rows[0]) : null;
    } catch (error) {
      throw this.storageError('GET_WORKFLOW_RUN_BY_ID', 'FAILED', { runId, workflowName: workflowName ?? '' }, error);
    }
  }

  async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    try {
      await this.db.none(`DELETE FROM ${this.table()} WHERE workflow_name = :workflowName AND run_id = :runId`, {
        workflowName,
        runId,
      });
    } catch (error) {
      throw this.storageError('DELETE_WORKFLOW_RUN_BY_ID', 'FAILED', { runId, workflowName }, error);
    }
  }

  private async createTables(): Promise<void> {
    await this.db.executeDdl(
      `
      CREATE TABLE ${this.table()} (
        workflow_name VARCHAR2(512) NOT NULL,
        run_id VARCHAR2(512) NOT NULL,
        ${WORKFLOW_RESOURCE_ID} VARCHAR2(512),
        snapshot JSON NOT NULL,
        ${WORKFLOW_CREATED_AT} TIMESTAMP WITH TIME ZONE NOT NULL,
        ${WORKFLOW_UPDATED_AT} TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT ${this.constraint('MASTRA_WORKFLOW_SNAPSHOT_PK')} PRIMARY KEY (workflow_name, run_id)
      )`,
      [-955],
    );

    await this.db.executeDdl(
      `ALTER TABLE ${this.table()} ADD (${WORKFLOW_RESOURCE_ID} VARCHAR2(512))`,
      [-1430],
    );
  }

  private async createIndexes(): Promise<void> {
    await this.db.withConnection(async connection => {
      if (!this.skipDefaultIndexes) {
        for (const index of this.defaultIndexes()) {
          try {
            await createOracleIndex(connection, index, this.schemaName);
          } catch (error) {
            this.logger?.warn?.(`Failed to create Oracle default index ${index.name}:`, error);
          }
        }
      }

      for (const index of this.indexes) {
        await createOracleIndex(connection, index, this.schemaName);
      }
    });
  }

  private defaultIndexes(): OracleCreateIndexOptions[] {
    return [
      {
        name: this.indexName('MASTRA_WORKFLOW_NAME_CREATED_IDX'),
        table: TABLE_WORKFLOW_SNAPSHOT,
        columns: ['workflow_name', 'createdAt'],
      },
      {
        name: this.indexName('MASTRA_WORKFLOW_RESOURCE_CREATED_IDX'),
        table: TABLE_WORKFLOW_SNAPSHOT,
        columns: ['resourceId', 'createdAt'],
      },
      {
        name: this.indexName('MASTRA_WORKFLOW_STATUS_IDX'),
        table: TABLE_WORKFLOW_SNAPSHOT,
        columns: ["JSON_VALUE(snapshot, '$.status' RETURNING VARCHAR2(64) NULL ON ERROR)"],
      },
    ];
  }

  private workflowMergeSql(): string {
    return `
      MERGE INTO ${this.table()} target
      USING (
        SELECT
          :workflowName AS workflow_name,
          :runId AS run_id,
          :resourceId AS resource_id,
          :snapshot AS snapshot,
          :createdAt AS created_at,
          :updatedAt AS updated_at
        FROM dual
      ) source
      ON (target.workflow_name = source.workflow_name AND target.run_id = source.run_id)
      WHEN MATCHED THEN UPDATE SET
        target.${WORKFLOW_RESOURCE_ID} = source.resource_id,
        target.snapshot = source.snapshot,
        target.${WORKFLOW_UPDATED_AT} = source.updated_at
      WHEN NOT MATCHED THEN INSERT (
        workflow_name,
        run_id,
        ${WORKFLOW_RESOURCE_ID},
        snapshot,
        ${WORKFLOW_CREATED_AT},
        ${WORKFLOW_UPDATED_AT}
      ) VALUES (
        source.workflow_name,
        source.run_id,
        source.resource_id,
        source.snapshot,
        source.created_at,
        source.updated_at
      )`;
  }

  private async ensureWorkflowRunRow(client: OracleTxClient, workflowName: string, runId: string): Promise<void> {
    const now = new Date();
    try {
      // Step-result updates may arrive before a full snapshot is persisted.
      // Seed a minimal row so JSON patching always has a target.
      await client.none(
        `INSERT INTO ${this.table()} (
          workflow_name,
          run_id,
          ${WORKFLOW_RESOURCE_ID},
          snapshot,
          ${WORKFLOW_CREATED_AT},
          ${WORKFLOW_UPDATED_AT}
        ) VALUES (
          :workflowName,
          :runId,
          :resourceId,
          :snapshot,
          :createdAt,
          :updatedAt
        )`,
        {
          workflowName,
          runId,
          resourceId: null,
          snapshot: jsonBind(createDefaultSnapshot(runId)),
          createdAt: now,
          updatedAt: now,
        },
      );
    } catch (error) {
      if (!isOracleErrorCode(error, [-1])) throw error;
    }
  }

  private workflowWhereClause(args: {
    workflowName?: string;
    fromDate?: Date;
    toDate?: Date;
    resourceId?: string;
    status?: string;
  }): { whereClause: string; binds: Record<string, unknown> } {
    const conditions: string[] = [];
    const binds: Record<string, unknown> = {};
    // Status lives inside the JSON snapshot; identifiers/resource/time remain
    // scalar columns for the common workflow list filters.
    if (args.workflowName) {
      conditions.push('workflow_name = :workflowName');
      binds.workflowName = args.workflowName;
    }
    if (args.resourceId) {
      conditions.push(`${WORKFLOW_RESOURCE_ID} = :resourceId`);
      binds.resourceId = args.resourceId;
    }
    if (args.status) {
      conditions.push(`JSON_VALUE(snapshot, '$.status' RETURNING VARCHAR2(64) NULL ON ERROR) = :status`);
      binds.status = args.status;
    }
    if (args.fromDate) {
      conditions.push(`${WORKFLOW_CREATED_AT} >= :fromDate`);
      binds.fromDate = args.fromDate;
    }
    if (args.toDate) {
      conditions.push(`${WORKFLOW_CREATED_AT} <= :toDate`);
      binds.toDate = args.toDate;
    }

    return { whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', binds };
  }

  private workflowSelect(): string {
    return `SELECT workflow_name AS "workflowName", run_id AS "runId", ${WORKFLOW_RESOURCE_ID} AS "resourceId", snapshot AS "snapshot", ${WORKFLOW_CREATED_AT} AS "createdAt", ${WORKFLOW_UPDATED_AT} AS "updatedAt"`;
  }

  private parseWorkflowRun(row: WorkflowRow): WorkflowRun {
    return {
      workflowName: String(row.workflowName),
      runId: String(row.runId),
      resourceId: row.resourceId === null || row.resourceId === undefined ? undefined : String(row.resourceId),
      snapshot: parseSnapshot(row.snapshot),
      createdAt: toDate(row.createdAt),
      updatedAt: toDate(row.updatedAt),
    };
  }

  private table(): string {
    return qualifyName(TABLE_WORKFLOW_SNAPSHOT, this.schemaName);
  }

  private indexName(indexName: string): string {
    return indexNameForTable(indexName, 'IDX');
  }

  private constraint(name: string): string {
    return indexNameForTable(name, 'CONSTRAINT');
  }

  private storageError(
    operation: string,
    reason: string,
    details: Record<string, string | number | boolean | undefined>,
    cause: unknown,
    category: ErrorCategory = ErrorCategory.THIRD_PARTY,
  ) {
    return createOracleStorageError({ storeName: STORE_NAME, operation, reason, details, cause, category });
  }
}

function createDefaultSnapshot(runId: string): WorkflowRunState {
  return {
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
}

function parseSnapshot(value: unknown): WorkflowRunState {
  if (typeof value === 'string') return JSON.parse(value) as WorkflowRunState;
  if (Buffer.isBuffer(value)) return JSON.parse(value.toString('utf8')) as WorkflowRunState;
  if (value && typeof value === 'object') return value as WorkflowRunState;
  throw new Error('Workflow snapshot is empty or invalid');
}
