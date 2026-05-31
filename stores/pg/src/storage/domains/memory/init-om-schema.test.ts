import { beforeEach, describe, expect, it, vi } from 'vitest';

const createTable = vi.fn().mockResolvedValue(undefined);
const alterTable = vi.fn().mockResolvedValue(undefined);
const noneQuery = vi.fn().mockResolvedValue(undefined);
const createDefaultIndexes = vi.fn().mockResolvedValue(undefined);
const createCustomIndexes = vi.fn().mockResolvedValue(undefined);

const mockClient = { none: noneQuery };

vi.mock('../../db', () => {
  class PgDB {
    createTable = createTable;
    alterTable = alterTable;
    client = mockClient;
    constructor(_opts: any) {}
  }

  return {
    PgDB,
    resolvePgConfig: vi.fn(() => ({
      client: mockClient,
      schemaName: 'public',
      skipDefaultIndexes: false,
      indexes: [],
    })),
    generateTableSQL: vi.fn(),
    generateIndexSQL: vi.fn(),
    getSchemaName: vi.fn((s: string) => `"${s || 'public'}"`),
    getTableName: vi.fn(({ indexName, schemaName }: { indexName: string; schemaName?: string }) =>
      schemaName ? `${schemaName}."${indexName}"` : `"${indexName}"`,
    ),
  };
});

vi.mock('@mastra/core/storage', async () => {
  const TABLE_SCHEMAS = {
    mastra_messages: { id: { type: 'text', primaryKey: true } },
    mastra_resources: { id: { type: 'text', primaryKey: true } },
    mastra_threads: { id: { type: 'text', primaryKey: true } },
    mastra_workflow_snapshot: {},
    mastra_spans: {},
  };

  class MemoryStorage {
    createDefaultIndexes = createDefaultIndexes;
    createCustomIndexes = createCustomIndexes;
  }

  return {
    MemoryStorage,
    normalizePerPage: vi.fn(),
    calculatePagination: vi.fn(),
    TABLE_MESSAGES: 'mastra_messages',
    TABLE_RESOURCES: 'mastra_resources',
    TABLE_THREADS: 'mastra_threads',
    TABLE_SCHEMAS,
    TABLE_WORKFLOW_SNAPSHOT: 'mastra_workflow_snapshot',
    TABLE_SPANS: 'mastra_spans',
    createStorageErrorId: vi.fn((_a: string, _b: string, _c: string) => `${_a}_${_b}_${_c}`),
    getSqlType: vi.fn(() => 'text'),
    getDefaultValue: vi.fn(() => null),
    OBSERVATIONAL_MEMORY_TABLE_SCHEMA: {
      mastra_observational_memory: { id: { type: 'text', primaryKey: true } },
    },
  };
});

vi.mock('@mastra/core/error', () => ({
  MastraError: class MastraError extends Error {
    constructor(opts: any, cause?: any) {
      super(opts.text ?? String(opts));
      this.cause = cause;
    }
  },
  ErrorDomain: { STORAGE: 'STORAGE' },
  ErrorCategory: { USER: 'USER', THIRD_PARTY: 'THIRD_PARTY', SYSTEM: 'SYSTEM' },
}));

vi.mock('@mastra/core/agent', () => ({
  MessageList: class MessageList {},
}));

vi.mock('@mastra/core/utils', () => ({
  parseSqlIdentifier: vi.fn((x: string) => x),
}));

beforeEach(() => {
  vi.clearAllMocks();
  createTable.mockResolvedValue(undefined);
  alterTable.mockResolvedValue(undefined);
  noneQuery.mockResolvedValue(undefined);
  createDefaultIndexes.mockResolvedValue(undefined);
  createCustomIndexes.mockResolvedValue(undefined);
});

describe('MemoryPG.init() uses module-level createRequire for OM schema (no dynamic import)', () => {
  it('creates the OM table when OBSERVATIONAL_MEMORY_TABLE_SCHEMA is available', async () => {
    const { MemoryPG } = await import('./index');
    const instance = new MemoryPG({ client: mockClient as any });
    await instance.init();

    const tableNames = createTable.mock.calls.map((c: any[]) => c[0]?.tableName as string);
    expect(tableNames).toContain('mastra_observational_memory');
  });

  it('calls alterTable for OM migration columns after creating the OM table', async () => {
    const { MemoryPG } = await import('./index');
    const instance = new MemoryPG({ client: mockClient as any });
    await instance.init();
    const alterCalls = alterTable.mock.calls.map((c: any[]) => c[0]?.tableName as string);
    expect(alterCalls).toContain('mastra_observational_memory');
  });
});
