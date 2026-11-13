import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createEmptyWorkflowSnapshot,
  createStorageErrorId,
  matchesExpectedWorkflowStatus,
  mergeWorkflowStepResult,
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
import { SurrealDBConnector } from '../../../shared/connector';
import type { SurrealDBDomainConfig } from '../../../shared/connector';
import { WORKFLOWS_SCHEMA } from '../../schema';
import { toDate, totalFrom } from '../utils';

/** Optimistic-concurrency retries for read-merge-write updates of one run. */
const MAX_CAS_ATTEMPTS = 50;

type WorkflowRow = {
  workflowName: string;
  runId: string;
  resourceId?: string;
  snapshot: WorkflowRunState | string | null;
  status?: string;
  version?: number;
  createdAt: unknown;
  updatedAt: unknown;
};

/** The run's record id: `mastra_workflow_snapshot:[workflowName, runId]`. */
const RUN_RECORD = `type::record('${TABLE_WORKFLOW_SNAPSHOT}', [$workflowName, $runId])`;

/** Snapshots are stored as plain JSON values, like the SQL stores. */
function toJsonValue<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function parseSnapshot(snapshot: WorkflowRow['snapshot']): WorkflowRunState | null {
  if (typeof snapshot === 'string') return JSON.parse(snapshot) as WorkflowRunState;
  return snapshot ?? null;
}

function parseRun(row: WorkflowRow): WorkflowRun {
  return {
    workflowName: row.workflowName,
    runId: row.runId,
    resourceId: row.resourceId,
    snapshot: parseSnapshot(row.snapshot) ?? (row.snapshot as WorkflowRunState),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

export class WorkflowsStorageSurrealDB extends WorkflowsStorage {
  #connector: SurrealDBConnector;

  constructor(config: SurrealDBDomainConfig) {
    super();
    this.#connector = SurrealDBConnector.from(config);
  }

  async init(): Promise<void> {
    await this.#connector.ensureDatabase();
    await this.#connector.query(WORKFLOWS_SCHEMA);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#connector.query(`DELETE ${TABLE_WORKFLOW_SNAPSHOT}`);
  }

  supportsConcurrentUpdates(): boolean {
    return true;
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
      // A re-persist (e.g. on resume) keeps the stored resourceId and createdAt unless new ones are given.
      await this.#connector.query(
        `UPSERT ${RUN_RECORD} SET
           workflowName = $workflowName,
           runId = $runId,
           resourceId = $resourceId ?? resourceId,
           snapshot = $snapshot,
           status = $status,
           createdAt = $createdAt ?? createdAt ?? $now,
           updatedAt = $updatedAt ?? $now,
           version = (version ?? 0) + 1
         RETURN NONE`,
        {
          workflowName,
          runId,
          resourceId: resourceId ?? undefined,
          snapshot: toJsonValue(snapshot),
          status: snapshot?.status ?? undefined,
          createdAt: createdAt ? toDate(createdAt) : undefined,
          updatedAt: updatedAt ? toDate(updatedAt) : undefined,
          now: new Date(),
        },
      );
    } catch (error) {
      throw this.#error('PERSIST_WORKFLOW_SNAPSHOT', error, { workflowName, runId });
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
      const [snapshot] = await this.#connector.query<[WorkflowRow['snapshot'] | undefined]>(
        `RETURN (SELECT VALUE snapshot FROM ONLY ${RUN_RECORD})`,
        { workflowName, runId },
      );
      return parseSnapshot(snapshot ?? null);
    } catch (error) {
      throw this.#error('LOAD_WORKFLOW_SNAPSHOT', error, { workflowName, runId });
    }
  }

  /**
   * Read-merge-write guarded by the row's `version`, so concurrent step results for the same
   * run never overwrite each other: a write whose version moved underneath it is retried
   * against the fresh snapshot.
   */
  async #updateSnapshot<T>(
    workflowName: string,
    runId: string,
    apply: (snapshot: WorkflowRunState) => { snapshot: WorkflowRunState; result: T } | null,
  ): Promise<{ found: boolean; result?: T }> {
    for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
      const [row] = await this.#connector.query<[Pick<WorkflowRow, 'snapshot' | 'version'> | undefined]>(
        `SELECT snapshot, version FROM ONLY ${RUN_RECORD}`,
        { workflowName, runId },
      );
      if (!row) return { found: false };

      const snapshot = parseSnapshot(row.snapshot) ?? createEmptyWorkflowSnapshot(runId);
      const applied = apply(snapshot);
      if (!applied) return { found: true };

      const [written] = await this.#connector.query<[number | undefined]>(
        `UPDATE ONLY ${RUN_RECORD}
           SET snapshot = $snapshot, status = $status, updatedAt = $now, version = (version ?? 0) + 1
           WHERE (version ?? 0) = $version
           RETURN VALUE version`,
        {
          workflowName,
          runId,
          snapshot: toJsonValue(applied.snapshot),
          status: applied.snapshot.status ?? undefined,
          version: row.version ?? 0,
          now: new Date(),
        },
      );
      if (written !== undefined && written !== null) return { found: true, result: applied.result };
    }
    throw new Error(`Too many concurrent updates to workflow run ${workflowName}/${runId}`);
  }

  async updateWorkflowResults({
    workflowName,
    runId,
    stepId,
    result,
    requestContext,
    state,
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
    state?: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    try {
      const { result: context } = await this.#updateSnapshot(workflowName, runId, snapshot => ({
        result: mergeWorkflowStepResult({ snapshot, stepId, result, requestContext, state }),
        snapshot,
      }));
      return context ?? {};
    } catch (error) {
      throw this.#error('UPDATE_WORKFLOW_RESULTS', error, { workflowName, runId, stepId });
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
      const { expectedStatus, ...state } = opts;
      const { result } = await this.#updateSnapshot(workflowName, runId, snapshot => {
        if (!matchesExpectedWorkflowStatus(snapshot.status, expectedStatus)) return null;
        const updated = { ...snapshot, ...state } as WorkflowRunState;
        return { snapshot: updated, result: updated };
      });
      return result;
    } catch (error) {
      throw this.#error('UPDATE_WORKFLOW_STATE', error, { workflowName, runId });
    }
  }

  async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    try {
      const [row] = workflowName
        ? await this.#connector.query<[WorkflowRow | undefined]>(`SELECT * FROM ONLY ${RUN_RECORD}`, {
            workflowName,
            runId,
          })
        : await this.#connector.query<[WorkflowRow | undefined]>(
            `SELECT * FROM ONLY ${TABLE_WORKFLOW_SNAPSHOT} WHERE runId = $runId ORDER BY createdAt DESC LIMIT 1`,
            { runId },
          );
      return row ? parseRun(row) : null;
    } catch (error) {
      throw this.#error('GET_WORKFLOW_RUN_BY_ID', error, { runId, workflowName: workflowName ?? '' });
    }
  }

  async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    try {
      await this.#connector.query(`DELETE ${RUN_RECORD}`, { workflowName, runId });
    } catch (error) {
      throw this.#error('DELETE_WORKFLOW_RUN_BY_ID', error, { runId, workflowName });
    }
  }

  async listWorkflowRuns({
    workflowName,
    fromDate,
    toDate: to,
    perPage,
    page,
    resourceId,
    threadId,
    status,
  }: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    if (page !== undefined && page < 0) {
      throw new MastraError({
        id: createStorageErrorId('SURREALDB', 'LIST_WORKFLOW_RUNS', 'INVALID_PAGE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'page must be >= 0',
        details: { page },
      });
    }

    try {
      const where: string[] = [];
      const bindings: Record<string, unknown> = {};
      if (workflowName) {
        where.push('workflowName = $workflowName');
        bindings.workflowName = workflowName;
      }
      if (resourceId) {
        where.push('resourceId = $resourceId');
        bindings.resourceId = resourceId;
      }
      if (status) {
        where.push('status = $status');
        bindings.status = status;
      }
      if (fromDate) {
        where.push('createdAt >= $fromDate');
        bindings.fromDate = toDate(fromDate);
      }
      if (to) {
        where.push('createdAt <= $toDate');
        bindings.toDate = toDate(to);
      }
      if (threadId) {
        // Mirrors getSnapshotMemoryInfo: the durable loop's fixed path, or a suspended step's stream state.
        where.push(
          `(snapshot.context.input.messageListState.memoryInfo.threadId = $threadId
            OR object::values(snapshot.context ?? {})[WHERE status = 'suspended'].suspendPayload.__streamState.messageList.memoryInfo.threadId CONTAINS $threadId)`,
        );
        bindings.threadId = threadId;
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
      const paginate = perPage !== undefined && page !== undefined;
      const limit = paginate ? normalizePerPage(perPage, Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
      bindings.limit = limit;
      bindings.offset = paginate ? page * limit : 0;

      const [rows, count] = await this.#connector.query<[WorkflowRow[], unknown]>(
        `SELECT * FROM ${TABLE_WORKFLOW_SNAPSHOT} ${whereClause} ORDER BY createdAt DESC LIMIT $limit START $offset;
         SELECT count() AS count FROM ${TABLE_WORKFLOW_SNAPSHOT} ${whereClause} GROUP ALL;`,
        bindings,
      );
      return { runs: rows.map(parseRun), total: totalFrom(count) };
    } catch (error) {
      throw this.#error('LIST_WORKFLOW_RUNS', error, { workflowName: workflowName ?? '' });
    }
  }

  #error(operation: string, error: unknown, details?: Record<string, string | number>): MastraError {
    if (error instanceof MastraError) return error;
    return new MastraError(
      {
        id: createStorageErrorId('SURREALDB', operation, 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        details,
      },
      error,
    );
  }
}
