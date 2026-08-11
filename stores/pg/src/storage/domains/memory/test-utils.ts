import type { QueryResult } from 'pg';
import type { DbClient, QueryValues, TxClient } from '../../client';

/**
 * One query that a fake client received.
 */
export type RecordedQuery = {
  query: string;
  values?: QueryValues;
};

/**
 * Base fake `DbClient` for the memory-domain tests.
 *
 * Every method throws by default. A test subclass overrides only the methods
 * that the code path under test calls, so a new method on the `DbClient`
 * interface has to be added here once instead of once per test file.
 */
export class RecordingDbClientBase implements DbClient {
  readonly $pool = {} as DbClient['$pool'];
  readonly queries: RecordedQuery[] = [];

  connect(): Promise<never> {
    throw new Error('not implemented');
  }

  async none(_query: string, _values?: QueryValues): Promise<null> {
    throw new Error('not implemented');
  }

  async one<T = any>(_query: string, _values?: QueryValues): Promise<T> {
    throw new Error('not implemented');
  }

  async oneOrNone<T = any>(_query: string, _values?: QueryValues): Promise<T | null> {
    throw new Error('not implemented');
  }

  async any<T = any>(_query: string, _values?: QueryValues): Promise<T[]> {
    throw new Error('not implemented');
  }

  async manyOrNone<T = any>(_query: string, _values?: QueryValues): Promise<T[]> {
    throw new Error('not implemented');
  }

  async many<T = any>(_query: string, _values?: QueryValues): Promise<T[]> {
    throw new Error('not implemented');
  }

  async query(_query: string, _values?: QueryValues): Promise<QueryResult> {
    throw new Error('not implemented');
  }

  async tx<T>(_callback: (t: TxClient) => Promise<T>): Promise<T> {
    throw new Error('not implemented');
  }
}
