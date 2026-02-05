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
import { StorageDomain } from '../base';

/**
 * Abstract base class for dataset runs storage domain.
 * Provides the contract for run lifecycle and result tracking.
 */
export abstract class RunsStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'RUNS',
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    // Default no-op - subclasses override
  }

  // Run lifecycle
  abstract createRun(input: CreateRunInput): Promise<Run>;
  abstract updateRun(input: UpdateRunInput): Promise<Run>;
  abstract getRunById(args: { id: string }): Promise<Run | null>;
  abstract listRuns(args: ListRunsInput): Promise<ListRunsOutput>;
  abstract deleteRun(args: { id: string }): Promise<void>;

  // Results (per-item)
  abstract addResult(input: AddRunResultInput): Promise<RunResult>;
  abstract getResultById(args: { id: string }): Promise<RunResult | null>;
  abstract listResults(args: ListRunResultsInput): Promise<ListRunResultsOutput>;
  abstract deleteResultsByRunId(args: { runId: string }): Promise<void>;
}
