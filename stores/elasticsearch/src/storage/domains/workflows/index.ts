import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  normalizePerPage,
  TABLE_WORKFLOW_SNAPSHOT,
  matchesExpectedWorkflowStatus,
  WorkflowsStorage,
  ensureDate,
} from '@mastra/core/storage';
import type {
  StorageListWorkflowRunsInput,
  WorkflowRun,
  WorkflowRuns,
  UpdateWorkflowStateOptions,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';

import { ElasticSearchDB } from '../../db';
import type { ElasticSearchDomainConfig } from '../../db';
import { getKey } from '../utils';

type WorkflowSnapshotRecord = {
  namespace: string;
  workflow_name: string;
  run_id: string;
  resourceId?: string;
  snapshot: WorkflowRunState;
  createdAt: string | Date;
  updatedAt: string | Date;
};

function parseWorkflowRun(row: Record<string, unknown>): WorkflowRun {
  let parsedSnapshot: WorkflowRunState | string = row.snapshot as string;
  if (typeof parsedSnapshot === 'string') {
    try {
      parsedSnapshot = JSON.parse(row.snapshot as string) as WorkflowRunState;
    } catch (e) {
      console.warn(`Failed to parse snapshot for workflow ${row.workflow_name}: ${e}`);
    }
  }

  return {
    workflowName: row.workflow_name as string,
    runId: row.run_id as string,
    snapshot: parsedSnapshot,
    createdAt: ensureDate(row.createdAt as string | Date)!,
    updatedAt: ensureDate(row.updatedAt as string | Date)!,
    resourceId: row.resourceId as string | undefined,
  };
}

export class WorkflowsElasticSearch extends WorkflowsStorage {
  private db: ElasticSearchDB;

  constructor(config: ElasticSearchDomainConfig) {
    super();
    this.db = new ElasticSearchDB({ client: config.client });
  }

  public supportsConcurrentUpdates(): boolean {
    return false;
  }

  public async dangerouslyClearAll(): Promise<void> {
    await this.db.deleteData({ tableName: TABLE_WORKFLOW_SNAPSHOT });
  }

  /** Canonical document id for a workflow run snapshot: exactly one per run. */
  private snapshotKey(params: { namespace?: string; workflowName: string; runId: string }): string {
    return getKey(TABLE_WORKFLOW_SNAPSHOT, {
      namespace: params.namespace ?? 'workflows',
      workflow_name: params.workflowName,
      run_id: params.runId,
    });
  }

  /** Prefix covering documents older versions wrote under `:resourceId:<id>`. */
  private legacySnapshotKeyPrefix(params: { namespace?: string; workflowName: string; runId: string }): string {
    return `${this.snapshotKey(params)}:resourceId:`;
  }

  /** Whether `key` is the canonical (non-legacy) document id for `record`. */
  private isCanonicalSnapshotKey(key: string, record: WorkflowSnapshotRecord): boolean {
    return (
      key ===
      this.snapshotKey({
        namespace: record.namespace ?? 'workflows',
        workflowName: record.workflow_name,
        runId: record.run_id,
      })
    );
  }

  /**
   * Resolve a run's snapshot document, preferring the canonical key and falling
   * back to the `:resourceId:<id>` documents written by older versions.
   */
  private async getSnapshotRecord(params: {
    namespace?: string;
    workflowName: string;
    runId: string;
  }): Promise<{ key: string; record: WorkflowSnapshotRecord } | null> {
    const canonicalKey = this.snapshotKey(params);
    const canonical = await this.db.getByKey<WorkflowSnapshotRecord>({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      key: canonicalKey,
    });
    if (canonical) {
      return { key: canonicalKey, record: canonical };
    }

    const legacyEntries = await this.db.listAllEntries<WorkflowSnapshotRecord>({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      keyPrefix: this.legacySnapshotKeyPrefix(params),
    });
    if (legacyEntries.length === 0) {
      return null;
    }

    // A run may have several legacy documents (one per resourceId it was written
    // under); pick the most recently updated one, deterministically.
    legacyEntries.sort((a, b) => {
      const aTime = ensureDate(a.value.updatedAt)?.getTime() ?? 0;
      const bTime = ensureDate(b.value.updatedAt)?.getTime() ?? 0;
      if (aTime !== bTime) {
        return bTime - aTime;
      }
      return a.key.localeCompare(b.key);
    });
    return { key: legacyEntries[0]!.key, record: legacyEntries[0]!.value };
  }

  public async updateWorkflowResults({
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
    result: StepResult<unknown, unknown, unknown, unknown>;
    requestContext: Record<string, unknown>;
    state?: Record<string, unknown>;
  }): Promise<Record<string, StepResult<unknown, unknown, unknown, unknown>>> {
    try {
      const existingRecord = (await this.getSnapshotRecord({ namespace: 'workflows', workflowName, runId }))?.record;

      const existingSnapshot = existingRecord?.snapshot;
      let snapshot = existingSnapshot;

      if (!snapshot) {
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
      }

      snapshot.context[stepId] = result;
      if (state !== undefined) {
        (snapshot.context as Record<string, unknown>).__state = state;
      }
      snapshot.requestContext = { ...snapshot.requestContext, ...requestContext };

      await this.persistWorkflowSnapshot({
        namespace: 'workflows',
        workflowName,
        runId,
        resourceId: existingRecord?.resourceId,
        snapshot,
        createdAt: existingRecord?.createdAt ? ensureDate(existingRecord.createdAt) : undefined,
      });

      return snapshot.context;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('ELASTICSEARCH', 'UPDATE_WORKFLOW_RESULTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId, stepId },
        },
        error,
      );
    }
  }

  public async updateWorkflowState({
    workflowName,
    runId,
    opts,
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
  }): Promise<WorkflowRunState | undefined> {
    try {
      const existingRecord = (await this.getSnapshotRecord({ namespace: 'workflows', workflowName, runId }))?.record;

      const existingSnapshot = existingRecord?.snapshot;

      if (!existingSnapshot || !existingSnapshot.context) {
        return undefined;
      }

      // Best-effort only: this store reports `supportsConcurrentUpdates() === false`, so the
      // read and the write are not a single critical section.
      const { expectedStatus, ...state } = opts;
      if (!matchesExpectedWorkflowStatus(existingSnapshot.status, expectedStatus)) {
        return undefined;
      }

      const updatedSnapshot = { ...existingSnapshot, ...state };

      await this.persistWorkflowSnapshot({
        namespace: 'workflows',
        workflowName,
        runId,
        resourceId: existingRecord?.resourceId,
        snapshot: updatedSnapshot,
        createdAt: existingRecord?.createdAt ? ensureDate(existingRecord.createdAt) : undefined,
      });

      return updatedSnapshot;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('ELASTICSEARCH', 'UPDATE_WORKFLOW_STATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId },
        },
        error,
      );
    }
  }

  public async persistWorkflowSnapshot(params: {
    namespace?: string;
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
  }): Promise<void> {
    const { namespace = 'workflows', workflowName, runId, resourceId, snapshot, createdAt, updatedAt } = params;
    try {
      // Reuse the existing document's createdAt and resourceId so an update keeps
      // the run's identity, whether it currently lives under the canonical key or
      // a legacy `:resourceId:` key.
      let existing: WorkflowSnapshotRecord | undefined;
      if (!createdAt || resourceId === undefined) {
        existing = (await this.getSnapshotRecord({ namespace, workflowName, runId }))?.record;
      }

      const finalCreatedAt = createdAt ?? (existing?.createdAt ? ensureDate(existing.createdAt) : new Date());

      await this.db.insert({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        record: {
          namespace,
          workflow_name: workflowName,
          run_id: runId,
          resourceId: resourceId ?? existing?.resourceId,
          snapshot,
          createdAt: finalCreatedAt,
          updatedAt: updatedAt ?? new Date(),
        },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('ELASTICSEARCH', 'PERSIST_WORKFLOW_SNAPSHOT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            namespace,
            workflowName,
            runId,
          },
        },
        error,
      );
    }
  }

  public async loadWorkflowSnapshot(params: {
    namespace: string;
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    const { namespace = 'workflows', workflowName, runId } = params;
    try {
      const existing = await this.getSnapshotRecord({ namespace, workflowName, runId });
      return existing?.record.snapshot ?? null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('ELASTICSEARCH', 'LOAD_WORKFLOW_SNAPSHOT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            namespace,
            workflowName,
            runId,
          },
        },
        error,
      );
    }
  }

  public async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    try {
      const entries = await this.db.listAllEntries<Record<string, unknown>>({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keyPrefix: getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace: 'workflows' }),
      });

      // A run can have more than one document (a canonical one plus legacy
      // `:resourceId:` copies). Collapse them per run, preferring the canonical.
      const matches = new Map<string, { canonical: boolean; record: Record<string, unknown> }>();
      for (const entry of entries) {
        const value = entry.value;
        if (value === null || value === undefined || typeof value !== 'object' || !('workflow_name' in value)) {
          continue;
        }
        if (value.run_id !== runId) {
          continue;
        }
        if (workflowName && value.workflow_name !== workflowName) {
          continue;
        }
        const record = value as WorkflowSnapshotRecord;
        const canonical = this.isCanonicalSnapshotKey(entry.key, record);
        const dedupKey = `${record.workflow_name}:${record.run_id}`;
        const current = matches.get(dedupKey);
        if (!current || (!current.canonical && canonical)) {
          matches.set(dedupKey, { canonical, record: value });
        }
      }

      const data = matches.values().next().value?.record;
      if (!data) {
        return null;
      }

      return parseWorkflowRun(data);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('ELASTICSEARCH', 'GET_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            namespace: 'workflows',
            runId,
            workflowName: workflowName || '',
          },
        },
        error,
      );
    }
  }

  public async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    const key = this.snapshotKey({ namespace: 'workflows', workflowName, runId });
    try {
      // Remove the canonical document plus any legacy `:resourceId:` copies for
      // this exact run. The `:resourceId:` suffix keeps neighbouring runs out of
      // the prefix match.
      const legacyEntries = await this.db.listAllEntries<unknown>({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keyPrefix: `${key}:resourceId:`,
      });
      await this.db.deleteMany({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: [key, ...legacyEntries.map(entry => entry.key)],
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('ELASTICSEARCH', 'DELETE_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            namespace: 'workflows',
            runId,
            workflowName,
          },
        },
        error,
      );
    }
  }

  public async listWorkflowRuns({
    workflowName,
    fromDate,
    toDate,
    perPage,
    page,
    resourceId,
    status,
  }: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    try {
      if (page !== undefined && page < 0) {
        throw new MastraError(
          {
            id: createStorageErrorId('ELASTICSEARCH', 'LIST_WORKFLOW_RUNS', 'INVALID_PAGE'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { page },
          },
          new Error('page must be >= 0'),
        );
      }

      const normalizedFrom = fromDate ? ensureDate(fromDate) : undefined;
      const normalizedTo = toDate ? ensureDate(toDate) : undefined;

      let keyPrefix = getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace: 'workflows' });
      if (workflowName) {
        keyPrefix = getKey(TABLE_WORKFLOW_SNAPSHOT, { namespace: 'workflows', workflow_name: workflowName }) + ':';
      }
      const entries = await this.db.listAllEntries<Record<string, unknown>>({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keyPrefix,
      });

      // Collapse canonical and legacy `:resourceId:` documents for the same run,
      // keeping the canonical one so a run is listed once.
      const byRun = new Map<string, { canonical: boolean; record: Record<string, unknown> }>();
      for (const { key, value } of entries) {
        if (value === null || value === undefined || typeof value !== 'object' || !('workflow_name' in value)) {
          continue;
        }
        if (workflowName && value.workflow_name !== workflowName) {
          continue;
        }
        if (resourceId && value.resourceId !== resourceId) {
          continue;
        }
        const record = value as WorkflowSnapshotRecord;
        const dedupKey = `${record.workflow_name}:${record.run_id}`;
        const canonical = this.isCanonicalSnapshotKey(key, record);
        const current = byRun.get(dedupKey);
        if (!current || (!current.canonical && canonical)) {
          byRun.set(dedupKey, { canonical, record: value });
        }
      }

      let runs = [...byRun.values()]
        .map(({ record }) => parseWorkflowRun(record))
        .filter(w => {
          if (normalizedFrom && w.createdAt < normalizedFrom) {
            return false;
          }
          if (normalizedTo && w.createdAt > normalizedTo) {
            return false;
          }
          if (status) {
            let snapshot = w.snapshot;
            if (typeof snapshot === 'string') {
              try {
                snapshot = JSON.parse(snapshot) as WorkflowRunState;
              } catch (e) {
                console.warn(`Failed to parse snapshot for workflow ${w.workflowName}: ${e}`);
                return false;
              }
            }
            return snapshot.status === status;
          }
          return true;
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const total = runs.length;

      if (typeof perPage === 'number' && typeof page === 'number') {
        const normalizedPerPage = normalizePerPage(perPage, Number.MAX_SAFE_INTEGER);
        const offset = page * normalizedPerPage;
        runs = runs.slice(offset, offset + normalizedPerPage);
      }

      return { runs, total };
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('ELASTICSEARCH', 'LIST_WORKFLOW_RUNS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            namespace: 'workflows',
            workflowName: workflowName || '',
            resourceId: resourceId || '',
          },
        },
        error,
      );
    }
  }
}
