import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mastra/core/error', () => ({
  ErrorCategory: { USER: 'USER', THIRD_PARTY: 'THIRD_PARTY' },
  ErrorDomain: { MASTRA_VECTOR: 'MASTRA_VECTOR' },
  MastraError: class MastraError extends Error {
    constructor(
      public metadata: any,
      error?: Error,
    ) {
      super(error?.message ?? 'MastraError');
    }
  },
}));

vi.mock('@mastra/core/utils', () => ({
  parseSqlIdentifier: (name: string) => name,
}));

vi.mock('@mastra/core/vector', () => ({
  MastraVector: class MastraVector {
    id: string;
    disableInit: boolean;
    logger = { debug: vi.fn(), info: vi.fn(), error: vi.fn(), warn: vi.fn(), trackException: vi.fn() };
    constructor({ id, disableInit }: { id: string; disableInit?: boolean }) {
      this.id = id;
      this.disableInit = disableInit ?? false;
    }
  },
  validateTopK: () => {},
  validateUpsertInput: () => {},
}));

vi.mock('@mastra/core/vector/filter', () => ({
  BaseFilterTranslator: class {
    static DEFAULT_OPERATORS = {};
    translate(filter: any) {
      return filter;
    }
    isEmpty(filter: any) {
      return !filter || (typeof filter === 'object' && Object.keys(filter).length === 0);
    }
    validateFilter() {}
    isPrimitive() {
      return false;
    }
  },
}));

import type { PgVectorConfig } from '../shared/config';
import { PgVector } from '.';

type QueryCall = { text: string; values?: any[] };

const queryHistory: QueryCall[] = [];

const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};

vi.mock('pg', () => {
  class MockPool {
    public options: any;
    public connect = vi.fn(async () => mockClient);
    public end = vi.fn(async () => {});
    public on = vi.fn().mockReturnThis();

    constructor(options: any) {
      this.options = options;
    }
  }

  return { Pool: MockPool };
});

describe('PgVector disableInit', () => {
  const baseConfig: PgVectorConfig & { id: string } = {
    connectionString: 'postgresql://postgres:postgres@localhost:5432/mastra',
    id: 'pg-vector-disable-init-test',
  };

  let listIndexesSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryHistory.length = 0;
    mockClient.query.mockImplementation(async (text: any, values?: any[]) => {
      const sql = typeof text === 'string' ? text : text?.text || '';
      queryHistory.push({ text: sql, values });
      return { rows: [] };
    });
    mockClient.release.mockReset();
    listIndexesSpy = vi.spyOn(PgVector.prototype, 'listIndexes').mockResolvedValue([]);
  });

  afterEach(() => {
    listIndexesSpy.mockRestore();
    mockClient.query.mockReset();
  });

  it('exposes disableInit field forwarded from config', () => {
    const vectorStore = new PgVector({ ...baseConfig, disableInit: true });
    expect(vectorStore.disableInit).toBe(true);
  });

  it('does not issue any DDL from createIndex when disableInit is true', async () => {
    const vectorStore = new PgVector({ ...baseConfig, disableInit: true });
    await (vectorStore as any).cacheWarmupPromise;

    queryHistory.length = 0;
    mockClient.query.mockClear();
    const connectMock = ((vectorStore as any).pool as { connect: ReturnType<typeof vi.fn> }).connect;
    connectMock.mockClear();

    await vectorStore.createIndex({ indexName: 'memory_messages', dimension: 1536 });

    expect(connectMock).not.toHaveBeenCalled();
    expect(mockClient.query).not.toHaveBeenCalled();
    expect(queryHistory.some(call => /CREATE\s+(TABLE|INDEX|EXTENSION|SCHEMA)/i.test(call.text))).toBe(false);
  });

  it('does not issue any DDL from createIndex when MASTRA_DISABLE_STORAGE_INIT is true', async () => {
    const originalEnv = process.env.MASTRA_DISABLE_STORAGE_INIT;
    process.env.MASTRA_DISABLE_STORAGE_INIT = 'true';
    try {
      const vectorStore = new PgVector(baseConfig);
      await (vectorStore as any).cacheWarmupPromise;

      queryHistory.length = 0;
      mockClient.query.mockClear();
      const connectMock = ((vectorStore as any).pool as { connect: ReturnType<typeof vi.fn> }).connect;
      connectMock.mockClear();

      await vectorStore.createIndex({ indexName: 'memory_messages', dimension: 1536 });

      expect(connectMock).not.toHaveBeenCalled();
      expect(mockClient.query).not.toHaveBeenCalled();
      expect(queryHistory.some(call => /CREATE\s+(TABLE|INDEX|EXTENSION|SCHEMA)/i.test(call.text))).toBe(false);
    } finally {
      if (originalEnv === undefined) {
        delete process.env.MASTRA_DISABLE_STORAGE_INIT;
      } else {
        process.env.MASTRA_DISABLE_STORAGE_INIT = originalEnv;
      }
    }
  });

  it('still issues DDL from createIndex when disableInit is false (default)', async () => {
    const vectorStore = new PgVector(baseConfig);
    await (vectorStore as any).cacheWarmupPromise;

    queryHistory.length = 0;
    mockClient.query.mockClear();

    await vectorStore.createIndex({ indexName: 'memory_messages', dimension: 1536, buildIndex: false });

    expect(queryHistory.some(call => /CREATE TABLE/i.test(call.text))).toBe(true);
  });
});
