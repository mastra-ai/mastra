import { calculatePagination, normalizePerPage } from '../../base';
import type {
  Run,
  RunResult,
  CreateRunInput,
  UpdateRunInput,
  AddRunResultInput,
  ListRunsInput,
  ListRunsOutput,
  ListRunResultsInput,
  ListRunResultsOutput,
} from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import { RunsStorage } from './base';

export class RunsInMemory extends RunsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.runs.clear();
    this.db.runResults.clear();
  }

  // Run lifecycle
  async createRun(input: CreateRunInput): Promise<Run> {
    const now = new Date();
    const run: Run = {
      id: input.id ?? crypto.randomUUID(),
      datasetId: input.datasetId,
      datasetVersion: input.datasetVersion,
      targetType: input.targetType,
      targetId: input.targetId,
      status: 'pending',
      totalItems: input.totalItems,
      succeededCount: 0,
      failedCount: 0,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.db.runs.set(run.id, run);
    return run;
  }

  async updateRun(input: UpdateRunInput): Promise<Run> {
    const existing = this.db.runs.get(input.id);
    if (!existing) {
      throw new Error(`Run not found: ${input.id}`);
    }
    const updated: Run = {
      ...existing,
      status: input.status ?? existing.status,
      succeededCount: input.succeededCount ?? existing.succeededCount,
      failedCount: input.failedCount ?? existing.failedCount,
      startedAt: input.startedAt ?? existing.startedAt,
      completedAt: input.completedAt ?? existing.completedAt,
      updatedAt: new Date(),
    };
    this.db.runs.set(input.id, updated);
    return updated;
  }

  async getRunById(args: { id: string }): Promise<Run | null> {
    return this.db.runs.get(args.id) ?? null;
  }

  async listRuns(args: ListRunsInput): Promise<ListRunsOutput> {
    let runs = Array.from(this.db.runs.values());

    // Filter by datasetId if provided
    if (args.datasetId) {
      runs = runs.filter(r => r.datasetId === args.datasetId);
    }

    // Sort by createdAt descending (newest first)
    runs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const { page, perPage: perPageInput } = args.pagination;
    const perPage = normalizePerPage(perPageInput, 100);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? runs.length : start + perPage;

    return {
      runs: runs.slice(start, end),
      pagination: {
        total: runs.length,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : runs.length > end,
      },
    };
  }

  async deleteRun(args: { id: string }): Promise<void> {
    this.db.runs.delete(args.id);
    // Also delete associated results
    for (const [resultId, result] of this.db.runResults) {
      if (result.runId === args.id) {
        this.db.runResults.delete(resultId);
      }
    }
  }

  // Results (per-item)
  async addResult(input: AddRunResultInput): Promise<RunResult> {
    const now = new Date();
    const result: RunResult = {
      id: input.id ?? crypto.randomUUID(),
      runId: input.runId,
      itemId: input.itemId,
      itemVersion: input.itemVersion,
      input: input.input,
      output: input.output,
      expectedOutput: input.expectedOutput,
      latency: input.latency,
      error: input.error,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      retryCount: input.retryCount,
      createdAt: now,
    };
    this.db.runResults.set(result.id, result);
    return result;
  }

  async getResultById(args: { id: string }): Promise<RunResult | null> {
    return this.db.runResults.get(args.id) ?? null;
  }

  async listResults(args: ListRunResultsInput): Promise<ListRunResultsOutput> {
    let results = Array.from(this.db.runResults.values()).filter(r => r.runId === args.runId);

    // Sort by startedAt ascending (execution order)
    results.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

    const { page, perPage: perPageInput } = args.pagination;
    const perPage = normalizePerPage(perPageInput, 100);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? results.length : start + perPage;

    return {
      results: results.slice(start, end),
      pagination: {
        total: results.length,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : results.length > end,
      },
    };
  }

  async deleteResultsByRunId(args: { runId: string }): Promise<void> {
    for (const [resultId, result] of this.db.runResults) {
      if (result.runId === args.runId) {
        this.db.runResults.delete(resultId);
      }
    }
  }
}
