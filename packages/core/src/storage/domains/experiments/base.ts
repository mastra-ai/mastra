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
   * When `filters` is set, returns `null` on tenancy mismatch (never throws,
   * so existence does not leak via error timing/text). Implementers must fold
   * the tenancy predicate into the SELECT, not filter in application code.
   */
  abstract getExperimentById(args: { id: string; filters?: ExperimentTenancyFilters }): Promise<Experiment | null>;
  abstract listExperiments(args: ListExperimentsInput): Promise<ListExperimentsOutput>;
  /**
   * Deletes an experiment and cascades to its results. Returns `true` if the
   * experiment row was deleted, `false` otherwise (missing id or tenancy miss).
   *
   * When `filters` is set, silent no-op on tenancy mismatch (never throws) —
   * a `false` result does not distinguish "no such id" from "wrong tenant" so
   * cross-tenant existence is not leaked. Implementers must fold the tenancy
   * predicate into the destructive DML itself — a pre-check followed by an
   * unscoped DELETE is unsafe under concurrent id reuse across tenants.
   *
   * When `filters` is omitted, implementations MAY skip the tenancy predicate
   * entirely (backward compat: callers explicitly opt out of scoping).
   */
  abstract deleteExperiment(args: { id: string; filters?: ExperimentTenancyFilters }): Promise<boolean>;

  // Results (per-item)
  abstract addExperimentResult(input: AddExperimentResultInput): Promise<ExperimentResult>;
  abstract updateExperimentResult(input: UpdateExperimentResultInput): Promise<ExperimentResult>;
  /**
   * When `filters` is set, returns `null` on tenancy mismatch (never throws).
   * Implementers must fold the tenancy predicate into the SELECT.
   */
  abstract getExperimentResultById(args: {
    id: string;
    filters?: ExperimentTenancyFilters;
  }): Promise<ExperimentResult | null>;
  abstract listExperimentResults(args: ListExperimentResultsInput): Promise<ListExperimentResultsOutput>;
  /**
   * Deletes all results for an experiment.
   *
   * When `filters` is set: returns `true` iff the parent experiment existed
   * under the tenancy scope and its result set was cleared. Returns `false`
   * on tenancy miss or when the parent does not exist — a `false` result does
   * not distinguish those, matching the parent `deleteExperiment` contract.
   * Silent no-op on tenancy mismatch (never throws). Result rows carry
   * `organizationId`/`projectId` from their parent, so implementers must fold
   * the tenancy predicate into the destructive DML — a parent pre-check
   * followed by an unscoped `DELETE WHERE experimentId = ?` is unsafe under
   * concurrent id reuse.
   *
   * When `filters` is omitted: returns `true` unconditionally after the DELETE
   * runs (even if the parent does not exist and zero rows were affected).
   * Implementations MAY skip the tenancy predicate entirely on this path —
   * leak-prevention is only material when a scope was supplied. This is why
   * pg/mysql/spanner take an unscoped fast path here while mongodb/libsql
   * fold the (empty) filter unconditionally — both are correct.
   */
  abstract deleteExperimentResults(args: {
    experimentId: string;
    filters?: ExperimentTenancyFilters;
  }): Promise<boolean>;

  // Aggregation
  abstract getReviewSummary(): Promise<ExperimentReviewCounts[]>;
}
