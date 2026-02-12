import { calculatePagination, normalizePerPage } from '../../base';
import type {
  Experiment,
  ExperimentResult,
  CreateExperimentInput,
  UpdateExperimentInput,
  AddExperimentResultInput,
  ListExperimentsInput,
  ListExperimentsOutput,
  ListExperimentResultsInput,
  ListExperimentResultsOutput,
} from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import { ExperimentsStorage } from './base';

export class ExperimentsInMemory extends ExperimentsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.experiments.clear();
    this.db.experimentResults.clear();
  }

  // Experiment lifecycle
  async createExperiment(input: CreateExperimentInput): Promise<Experiment> {
    const now = new Date();
    const experiment: Experiment = {
      id: input.id ?? crypto.randomUUID(),
      datasetId: input.datasetId,
      datasetVersion: input.datasetVersion,
      targetType: input.targetType,
      targetId: input.targetId,
      name: input.name,
      description: input.description,
      metadata: input.metadata,
      status: 'pending',
      totalItems: input.totalItems,
      succeededCount: 0,
      failedCount: 0,
      skippedCount: 0,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.db.experiments.set(experiment.id, experiment);
    return experiment;
  }

  async updateExperiment(input: UpdateExperimentInput): Promise<Experiment> {
    const existing = this.db.experiments.get(input.id);
    if (!existing) {
      throw new Error(`Experiment not found: ${input.id}`);
    }
    const updated: Experiment = {
      ...existing,
      status: input.status ?? existing.status,
      succeededCount: input.succeededCount ?? existing.succeededCount,
      failedCount: input.failedCount ?? existing.failedCount,
      skippedCount: input.skippedCount ?? existing.skippedCount,
      startedAt: input.startedAt ?? existing.startedAt,
      completedAt: input.completedAt ?? existing.completedAt,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      metadata: input.metadata ?? existing.metadata,
      updatedAt: new Date(),
    };
    this.db.experiments.set(input.id, updated);
    return updated;
  }

  async getExperimentById(args: { id: string }): Promise<Experiment | null> {
    return this.db.experiments.get(args.id) ?? null;
  }

  async listExperiments(args: ListExperimentsInput): Promise<ListExperimentsOutput> {
    let experiments = Array.from(this.db.experiments.values());

    // Filter by datasetId if provided
    if (args.datasetId) {
      experiments = experiments.filter(r => r.datasetId === args.datasetId);
    }

    // Sort by createdAt descending (newest first)
    experiments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const { page, perPage: perPageInput } = args.pagination;
    const perPage = normalizePerPage(perPageInput, 100);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? experiments.length : start + perPage;

    return {
      experiments: experiments.slice(start, end),
      pagination: {
        total: experiments.length,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : experiments.length > end,
      },
    };
  }

  async deleteExperiment(args: { id: string }): Promise<void> {
    this.db.experiments.delete(args.id);
    // Also delete associated results
    for (const [resultId, result] of this.db.experimentResults) {
      if (result.experimentId === args.id) {
        this.db.experimentResults.delete(resultId);
      }
    }
  }

  // Results (per-item)
  async addExperimentResult(input: AddExperimentResultInput): Promise<ExperimentResult> {
    const now = new Date();
    const result: ExperimentResult = {
      id: input.id ?? crypto.randomUUID(),
      experimentId: input.experimentId,
      itemId: input.itemId,
      itemDatasetVersion: input.itemDatasetVersion,
      input: input.input,
      output: input.output,
      groundTruth: input.groundTruth,
      error: input.error,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      retryCount: input.retryCount,
      traceId: input.traceId ?? null,
      createdAt: now,
    };
    this.db.experimentResults.set(result.id, result);
    return result;
  }

  async getExperimentResultById(args: { id: string }): Promise<ExperimentResult | null> {
    return this.db.experimentResults.get(args.id) ?? null;
  }

  async listExperimentResults(args: ListExperimentResultsInput): Promise<ListExperimentResultsOutput> {
    let results = Array.from(this.db.experimentResults.values()).filter(r => r.experimentId === args.experimentId);

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

  async deleteExperimentResults(args: { experimentId: string }): Promise<void> {
    for (const [resultId, result] of this.db.experimentResults) {
      if (result.experimentId === args.experimentId) {
        this.db.experimentResults.delete(resultId);
      }
    }
  }
}
