import type { AgentCase, ArrayDatasetConfig } from '../types';
import { BaseDatasetSource } from './dataset-source';

/**
 * Dataset source from an in-memory array of cases.
 */
export class ArraySource extends BaseDatasetSource {
  private cases: AgentCase[];

  constructor(cases: AgentCase[]) {
    super();
    this.cases = cases;
  }

  async *streamCases(): AsyncIterable<AgentCase> {
    for (const case_ of this.cases) {
      yield case_;
    }
  }

  async getCases(): Promise<AgentCase[]> {
    return [...this.cases];
  }

  async getCount(): Promise<number> {
    return this.cases.length;
  }
}

/**
 * Create an ArraySource from config.
 */
export function createArraySource(config: ArrayDatasetConfig): ArraySource {
  return new ArraySource(config.cases);
}
