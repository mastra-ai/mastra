import type {
  Experiment,
  ExperimentResult,
  ExperimentReviewCounts,
  ExperimentTenancyFilters,
  CreateExperimentInput,
  UpdateExperimentInput,
  AddExperimentResultInput,
  UpdateExperimentResultInput,
  ListExperimentsInput,
  ListExperimentsOutput,
  ListExperimentResultsInput,
  ListExperimentResultsOutput,
} from '../../types';
import { StorageDomain } from '../base';

/**
 * Abstract base class for dataset experiments storage domain.
 * Provides the contract for experiment lifecycle and result tracking.
 */
export abstract class ExperimentsStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'EXPERIMENTS',
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    // Default no-op - subclasses override
  }

  // Experiment lifecycle
  abstract createExperiment(input: CreateExperimentInput): Promise<Experiment>;
  abstract updateExperiment(input: UpdateExperimentInput): Promise<Experiment>;
  /**
   * Fetch an experiment by ID. When `filters` is provided, the row is only
   * returned if it also matches the tenancy filters — returns `null` on
   * mismatch (never throws, to avoid leaking existence across tenants via
   * error timing/text). Mirrors the datasets getter contract (MASTRA-4438).
   */
  abstract getExperimentById(args: { id: string; filters?: ExperimentTenancyFilters }): Promise<Experiment | null>;
  abstract listExperiments(args: ListExperimentsInput): Promise<ListExperimentsOutput>;
  abstract deleteExperiment(args: { id: string }): Promise<void>;

  // Results (per-item)
  abstract addExperimentResult(input: AddExperimentResultInput): Promise<ExperimentResult>;
  abstract updateExperimentResult(input: UpdateExperimentResultInput): Promise<ExperimentResult>;
  /**
   * Fetch an experiment result by ID. When `filters` is provided, the row is
   * only returned if it also matches the tenancy filters — returns `null` on
   * mismatch (never throws, to avoid leaking existence across tenants via
   * error timing/text).
   */
  abstract getExperimentResultById(args: {
    id: string;
    filters?: ExperimentTenancyFilters;
  }): Promise<ExperimentResult | null>;
  abstract listExperimentResults(args: ListExperimentResultsInput): Promise<ListExperimentResultsOutput>;
  abstract deleteExperimentResults(args: { experimentId: string }): Promise<void>;

  // Aggregation
  abstract getReviewSummary(): Promise<ExperimentReviewCounts[]>;
}
