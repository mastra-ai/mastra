import { calculatePagination, normalizePerPage } from '../../base';
import type {
  Experiment,
  ExperimentResult,
  ExperimentReviewCounts,
  CreateExperimentInput,
  UpdateExperimentInput,
  AddExperimentResultInput,
  UpdateExperimentResultInput,
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
      agentVersion: input.agentVersion ?? null,
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
      totalItems: input.totalItems ?? existing.totalItems,
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

    // Apply filters
    if (args.datasetId) {
      experiments = experiments.filter(r => r.datasetId === args.datasetId);
    }
    if (args.targetType) {
      experiments = experiments.filter(r => r.targetType === args.targetType);
    }
    if (args.targetId) {
      experiments = experiments.filter(r => r.targetId === args.targetId);
    }
    if (args.agentVersion) {
      experiments = experiments.filter(r => r.agentVersion === args.agentVersion);
    }
    if (args.status) {
      experiments = experiments.filter(r => r.status === args.status);
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
      status: input.status ?? null,
      tags: input.tags ?? null,
      createdAt: now,
    };
    this.db.experimentResults.set(result.id, result);
    return result;
  }

  async updateExperimentResult(input: UpdateExperimentResultInput): Promise<ExperimentResult> {
    const existing = this.db.experimentResults.get(input.id);
    if (!existing) {
      throw new Error(`Experiment result not found: ${input.id}`);
    }
    if (input.experimentId && existing.experimentId !== input.experimentId) {
      throw new Error(`Experiment result ${input.id} does not belong to experiment ${input.experimentId}`);
    }
    const updated: ExperimentResult = {
      ...existing,
      status: input.status !== undefined ? input.status : existing.status,
      tags: input.tags !== undefined ? input.tags : existing.tags,
    };
    this.db.experimentResults.set(input.id, updated);
    return updated;
  }

  async getExperimentResultById(args: { id: string }): Promise<ExperimentResult | null> {
    return this.db.experimentResults.get(args.id) ?? null;
  }

  async listExperimentResults(args: ListExperimentResultsInput): Promise<ListExperimentResultsOutput> {
    let results = Array.from(this.db.experimentResults.values()).filter(r => r.experimentId === args.experimentId);

    // Apply filters
    if (args.traceId) {
      results = results.filter(r => r.traceId === args.traceId);
    }
    if (args.status) {
      results = results.filter(r => r.status === args.status);
    }

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

  async getReviewSummary(): Promise<ExperimentReviewCounts[]> {
    const counts = new Map<string, ExperimentReviewCounts>();

    for (const result of this.db.experimentResults.values()) {
      let entry = counts.get(result.experimentId);
      if (!entry) {
        entry = { experimentId: result.experimentId, total: 0, needsReview: 0, reviewed: 0, complete: 0 };
        counts.set(result.experimentId, entry);
      }
      entry.total++;
      if (result.status === 'needs-review') entry.needsReview++;
      else if (result.status === 'reviewed') entry.reviewed++;
      else if (result.status === 'complete') entry.complete++;
    }

    return Array.from(counts.values());
  }
}
