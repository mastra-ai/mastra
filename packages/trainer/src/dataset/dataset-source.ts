import type { AgentCase } from '../types';

/**
 * Interface for dataset sources that provide training cases.
 */
export interface DatasetSource {
  /**
   * Stream training cases from the source.
   */
  streamCases(): AsyncIterable<AgentCase>;

  /**
   * Get all cases as an array (for smaller datasets).
   */
  getCases(): Promise<AgentCase[]>;

  /**
   * Get the total count of cases (if known).
   */
  getCount?(): Promise<number | undefined>;
}

/**
 * Base class for dataset sources with common functionality.
 */
export abstract class BaseDatasetSource implements DatasetSource {
  abstract streamCases(): AsyncIterable<AgentCase>;

  async getCases(): Promise<AgentCase[]> {
    const cases: AgentCase[] = [];
    for await (const case_ of this.streamCases()) {
      cases.push(case_);
    }
    return cases;
  }

  async getCount(): Promise<number | undefined> {
    return undefined;
  }
}
