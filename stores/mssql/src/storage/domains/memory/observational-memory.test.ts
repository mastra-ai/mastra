import type { BufferedObservationChunk, ObservationalMemoryRecord } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { MemoryMSSQL } from '.';

type QueryResult = { recordset?: Record<string, any>[]; rowsAffected?: number[] };
type QueryHandler = (query: string, params: Record<string, unknown>) => QueryResult;

const OM_TABLE = '[mastra_observational_memory]';

/**
 * Mock mssql pool: each request() gets a fresh param bag (like the real driver)
 * and every query is logged with a snapshot of the params bound at execution
 * time. Transactions expose request() per the mssql API.
 */
function createMockStorage(handler: QueryHandler) {
  const queries: string[] = [];
  const paramsAtQuery: Record<string, unknown>[] = [];

  const makeRequest = () => {
    const params: Record<string, unknown> = {};
    return {
      input: (name: string, value: unknown) => {
        params[name] = value;
      },
      query: async (query: string) => {
        queries.push(query);
        paramsAtQuery.push({ ...params });
        return handler(query, { ...params });
      },
    };
  };

  const pool = {
    request: makeRequest,
    transaction: () => ({
      begin: async () => {},
      commit: async () => {},
      rollback: async () => {},
      request: makeRequest,
    }),
  };

  return { storage: new MemoryMSSQL({ pool: pool as any }), queries, paramsAtQuery };
}

// Raw DB row fixture: JSON columns as strings, counts as strings (NVARCHAR),
// BIT flags mixed booleans/numbers — exercises every branch of parseOMRow.
const OM_ROW: Record<string, any> = {
  id: 'om-row-1',
  lookupKey: 'thread:t1',
  scope: 'thread',
  threadId: 't1',
  resourceId: 'r1',
  activeObservations: 'obs-1\nobs-2',
  activeObservationsPendingUpdate: 'pending text',
  originType: 'initial',
  config: JSON.stringify({ observationThreshold: 100 }),
  generationCount: 3,
  lastObservedAt: '2024-01-02T00:00:00.000Z',
  lastReflectionAt: null,
  pendingMessageTokens: '12',
  totalTokensObserved: '120',
  observationTokenCount: '34',
  observedMessageIds: '["m1"]',
  bufferedObservationChunks:
    '[{"id":"ombuf-1","cycleId":"cycle-1","observations":"buffered","tokenCount":5,"messageIds":["m0"],"messageTokens":50,"lastObservedAt":"2024-01-02T09:00:00.000Z","createdAt":"2024-01-02T09:00:00.000Z"}]',
  bufferedObservationTokens: '55',
  bufferedReflection: null,
  bufferedReflectionTokens: null,
  bufferedReflectionInputTokens: '40',
  reflectedObservationLineCount: '3',
  isObserving: true,
  isReflecting: false,
  isBufferingObservation: 1,
  isBufferingReflection: 0,
  lastBufferedAtTokens: '77',
  lastBufferedAtTime: '2024-01-03T00:00:00.000Z',
  observedTimezone: 'UTC',
  metadata: '{"k":"v"}',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-04T00:00:00.000Z',
};

function baseRecord(overrides: Partial<ObservationalMemoryRecord> = {}): ObservationalMemoryRecord {
  return {
    id: 'om-1',
    scope: 'thread',
    threadId: 't1',
    resourceId: 'r1',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    originType: 'initial',
    generationCount: 0,
    activeObservations: '',
    totalTokensObserved: 0,
    observationTokenCount: 0,
    pendingMessageTokens: 0,
    isReflecting: false,
    isObserving: false,
    isBufferingObservation: false,
    isBufferingReflection: false,
    lastBufferedAtTokens: 0,
    lastBufferedAtTime: null,
    config: { observationThreshold: 100 },
    ...overrides,
  };
}

function chunk(overrides: Partial<BufferedObservationChunk> = {}): BufferedObservationChunk {
  return {
    id: 'ombuf-x',
    cycleId: 'cycle-x',
    observations: 'chunk content',
    tokenCount: 10,
    messageIds: ['m1'],
    messageTokens: 100,
    lastObservedAt: new Date('2024-01-02T10:00:00.000Z'),
    createdAt: new Date('2024-01-02T10:00:00.000Z'),
    ...overrides,
  };
}

describe('MemoryMSSQL observational memory', () => {
  describe('getObservationalMemory', () => {
    it('selects the latest generation by thread lookup key and parses the row', async () => {
      const { storage, queries, paramsAtQuery } = createMockStorage(query =>
        query.includes(`SELECT TOP 1 * FROM ${OM_TABLE}`) ? { recordset: [OM_ROW] } : { recordset: [] },
      );

      const record = await storage.getObservationalMemory('t1', 'r1');

      expect(queries).toHaveLength(1);
      expect(queries[0]).toContain(`SELECT TOP 1 * FROM ${OM_TABLE}`);
      expect(queries[0]).toContain('WHERE [lookupKey] = @lookupKey');
      expect(queries[0]).toContain('ORDER BY [generationCount] DESC');
      expect(paramsAtQuery[0]).toEqual({ lookupKey: 'thread:t1' });

      expect(record).not.toBeNull();
      expect(record!.id).toBe('om-row-1');
      expect(record!.scope).toBe('thread');
      expect(record!.threadId).toBe('t1');
      expect(record!.resourceId).toBe('r1');
      expect(record!.createdAt).toEqual(new Date('2024-01-01T00:00:00.000Z'));
      expect(record!.updatedAt).toEqual(new Date('2024-01-04T00:00:00.000Z'));
      expect(record!.lastObservedAt).toEqual(new Date('2024-01-02T00:00:00.000Z'));
      expect(record!.originType).toBe('initial');
      expect(record!.generationCount).toBe(3);
      expect(record!.activeObservations).toBe('obs-1\nobs-2');
      expect(record!.bufferedObservations).toBe('pending text');
      expect(record!.bufferedObservationChunks).toEqual(JSON.parse(OM_ROW.bufferedObservationChunks as string));
      expect(record!.bufferedObservationTokens).toBe(55);
      expect(record!.bufferedReflectionInputTokens).toBe(40);
      expect(record!.reflectedObservationLineCount).toBe(3);
      expect(record!.observedMessageIds).toEqual(['m1']);
      expect(record!.totalTokensObserved).toBe(120);
      expect(record!.observationTokenCount).toBe(34);
      expect(record!.pendingMessageTokens).toBe(12);
      expect(record!.isObserving).toBe(true);
      expect(record!.isReflecting).toBe(false);
      expect(record!.isBufferingObservation).toBe(true);
      expect(record!.isBufferingReflection).toBe(false);
      expect(record!.lastBufferedAtTokens).toBe(77);
      expect(record!.lastBufferedAtTime).toEqual(new Date('2024-01-03T00:00:00.000Z'));
      expect(record!.config).toEqual({ observationThreshold: 100 });
      expect(record!.metadata).toEqual({ k: 'v' });
      expect(record!.observedTimezone).toBe('UTC');
    });

    it('uses a resource lookup key when threadId is null', async () => {
      const { storage, paramsAtQuery } = createMockStorage(() => ({ recordset: [] }));

      await storage.getObservationalMemory(null, 'r1');

      expect(paramsAtQuery[0]).toEqual({ lookupKey: 'resource:r1' });
    });

    it('returns null when no record exists', async () => {
      const { storage } = createMockStorage(() => ({ recordset: [] }));

      const record = await storage.getObservationalMemory('missing', 'r1');

      expect(record).toBeNull();
    });
  });

  describe('getObservationalMemoryHistory', () => {
    it('applies the default limit with pagination SQL', async () => {
      const { storage, queries, paramsAtQuery } = createMockStorage(() => ({ recordset: [] }));

      await storage.getObservationalMemoryHistory('t1', 'r1');

      expect(queries[0]).toContain('ORDER BY [generationCount] DESC OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY');
      expect(paramsAtQuery[0]).toEqual({ lookupKey: 'thread:t1', limit: 10 });
    });

    it('binds from/to filters with generated param names', async () => {
      const { storage, queries, paramsAtQuery } = createMockStorage(() => ({ recordset: [] }));
      const from = new Date('2024-01-01T00:00:00.000Z');
      const to = new Date('2024-01-02T00:00:00.000Z');

      await storage.getObservationalMemoryHistory('t1', 'r1', 10, { from, to });

      expect(queries[0]).toContain('[createdAt] >= @from2');
      expect(queries[0]).toContain('[createdAt] <= @to3');
      expect(paramsAtQuery[0]).toEqual({
        lookupKey: 'thread:t1',
        from2: from.toISOString(),
        to3: to.toISOString(),
        limit: 10,
      });
    });

    it('replaces the offset placeholder when an offset is given', async () => {
      const { storage, queries, paramsAtQuery } = createMockStorage(() => ({ recordset: [] }));

      await storage.getObservationalMemoryHistory('t1', 'r1', 10, { offset: 5 });

      expect(queries[0]).toContain('OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY');
      expect(paramsAtQuery[0]).toMatchObject({ offset: 5, limit: 10 });
    });

    it('returns an empty array when there is no history', async () => {
      const { storage } = createMockStorage(() => ({ recordset: [] }));

      const history = await storage.getObservationalMemoryHistory('t1', 'r1');

      expect(history).toEqual([]);
    });
  });

  describe('initializeObservationalMemory', () => {
    const input = {
      threadId: 't1' as string | null,
      resourceId: 'r1',
      scope: 'thread' as const,
      config: { observationThreshold: 100 },
      observedTimezone: 'UTC',
    };

    it('inserts an initial record and returns it', async () => {
      const { storage, queries, paramsAtQuery } = createMockStorage(() => ({ rowsAffected: [1] }));

      const record = await storage.initializeObservationalMemory({ ...input, threadId: 't1' });

      expect(record.id).toBeTruthy();
      expect(record.scope).toBe('thread');
      expect(record.threadId).toBe('t1');
      expect(record.originType).toBe('initial');
      expect(record.generationCount).toBe(0);
      expect(record.activeObservations).toBe('');
      expect(record.isReflecting).toBe(false);
      expect(record.isObserving).toBe(false);
      expect(record.config).toEqual(input.config);
      expect(record.observedTimezone).toBe('UTC');
      expect(record.createdAt).toBeInstanceOf(Date);

      expect(queries).toHaveLength(1);
      expect(queries[0]).toContain(`INSERT INTO ${OM_TABLE}`);
      expect(queries[0]).toContain('[activeObservationsPendingUpdate]');
      expect(queries[0]).toContain('[lastBufferedAtTokens]');
      expect(paramsAtQuery[0]).toMatchObject({
        id: record.id,
        lookupKey: 'thread:t1',
        scope: 'thread',
        threadId: 't1',
        originType: 'initial',
        config: JSON.stringify(input.config),
        generationCount: 0,
        isObserving: false,
        isReflecting: false,
        observedTimezone: 'UTC',
      });
    });

    it('uses a resource lookup key and null threadId for resource scope', async () => {
      const { storage, paramsAtQuery } = createMockStorage(() => ({ rowsAffected: [1] }));

      await storage.initializeObservationalMemory({ ...input, threadId: null, scope: 'resource' });

      expect(paramsAtQuery[0]).toMatchObject({ lookupKey: 'resource:r1', threadId: null, scope: 'resource' });
    });
  });

  describe('insertObservationalMemoryRecord', () => {
    it('inserts every column including buffered reflection state', async () => {
      const { storage, queries, paramsAtQuery } = createMockStorage(() => ({ rowsAffected: [1] }));
      const record = baseRecord({
        id: 'om-insert',
        generationCount: 2,
        lastObservedAt: new Date('2024-01-02T00:00:00.000Z'),
        observedMessageIds: ['m1'],
        bufferedObservationChunks: [chunk({ id: 'ombuf-a', cycleId: 'cycle-a' })],
        bufferedReflection: 'REF',
        bufferedReflectionTokens: 15,
        bufferedReflectionInputTokens: 40,
        reflectedObservationLineCount: 3,
        metadata: { k: 'v' },
        observedTimezone: 'UTC',
      });

      await storage.insertObservationalMemoryRecord(record);

      expect(queries[0]).toContain(`INSERT INTO ${OM_TABLE}`);
      expect(queries[0]).toContain('[observedMessageIds], [bufferedObservationChunks]');
      expect(queries[0]).toContain(
        '[bufferedReflection], [bufferedReflectionTokens], [bufferedReflectionInputTokens]',
      );
      expect(paramsAtQuery[0]).toMatchObject({
        id: 'om-insert',
        lookupKey: 'thread:t1',
        observedMessageIds: '["m1"]',
        bufferedObservationChunks: JSON.stringify([chunk({ id: 'ombuf-a', cycleId: 'cycle-a' })]),
        bufferedReflection: 'REF',
        bufferedReflectionTokens: 15,
        bufferedReflectionInputTokens: 40,
        reflectedObservationLineCount: 3,
        metadata: '{"k":"v"}',
        lastObservedAt: '2024-01-02T00:00:00.000Z',
      });
    });
  });

  describe('updateActiveObservations', () => {
    const input = {
      id: 'om-1',
      observations: 'new obs',
      tokenCount: 30,
      lastObservedAt: new Date('2024-01-02T00:00:00.000Z'),
      observedMessageIds: ['m1', 'm2'],
    };

    it('overwrites active observations and accumulates total tokens', async () => {
      const { storage, queries, paramsAtQuery } = createMockStorage(() => ({ rowsAffected: [1] }));

      await storage.updateActiveObservations(input);

      expect(queries[0]).toContain('[pendingMessageTokens] = 0');
      expect(queries[0]).toContain('[totalTokensObserved] = [totalTokensObserved] + @tokenCount');
      expect(paramsAtQuery[0]).toMatchObject({
        id: 'om-1',
        activeObservations: 'new obs',
        tokenCount: 30,
        observationTokenCount: 30,
        observedMessageIds: '["m1","m2"]',
        lastObservedAt: '2024-01-02T00:00:00.000Z',
      });
    });

    it('throws NOT_FOUND when the record does not exist', async () => {
      const { storage } = createMockStorage(() => ({ rowsAffected: [0] }));

      await expect(storage.updateActiveObservations(input)).rejects.toMatchObject({
        id: 'MASTRA_STORAGE_MSSQL_UPDATE_ACTIVE_OBSERVATIONS_NOT_FOUND',
      });
    });
  });

  describe('createReflectionGeneration', () => {
    it('inserts a new reflection generation and returns the record', async () => {
      const { storage, queries, paramsAtQuery } = createMockStorage(() => ({ rowsAffected: [1] }));
      const currentRecord = baseRecord({
        generationCount: 2,
        totalTokensObserved: 120,
        lastObservedAt: new Date('2024-01-02T00:00:00.000Z'),
        metadata: { k: 'v' },
        observedTimezone: 'UTC',
      });

      const record = await storage.createReflectionGeneration({
        currentRecord,
        reflection: 'REFLECTION TEXT',
        tokenCount: 30,
      });

      expect(record.id).not.toBe(currentRecord.id);
      expect(record.originType).toBe('reflection');
      expect(record.generationCount).toBe(3);
      expect(record.activeObservations).toBe('REFLECTION TEXT');
      expect(record.observationTokenCount).toBe(30);
      expect(record.pendingMessageTokens).toBe(0);
      expect(record.metadata).toEqual({ k: 'v' });
      expect(record.observedTimezone).toBe('UTC');

      expect(queries[0]).toContain(`INSERT INTO ${OM_TABLE}`);
      expect(paramsAtQuery[0]).toMatchObject({
        lookupKey: 'thread:t1',
        originType: 'reflection',
        generationCount: 3,
        activeObservations: 'REFLECTION TEXT',
        metadata: '{"k":"v"}',
      });
      expect(paramsAtQuery[0].lastReflectionAt).toBeTruthy();
    });
  });

  describe('flag and token updates', () => {
    const cases = [
      {
        name: 'setReflectingFlag',
        run: (s: MemoryMSSQL) => s.setReflectingFlag('om-1', true),
        sqlFragment: '[isReflecting] = @isReflecting',
        boundParams: { isReflecting: true },
        notFoundId: 'MASTRA_STORAGE_MSSQL_SET_REFLECTING_FLAG_NOT_FOUND',
      },
      {
        name: 'setObservingFlag',
        run: (s: MemoryMSSQL) => s.setObservingFlag('om-1', false),
        sqlFragment: '[isObserving] = @isObserving',
        boundParams: { isObserving: false },
        notFoundId: 'MASTRA_STORAGE_MSSQL_SET_OBSERVING_FLAG_NOT_FOUND',
      },
      {
        name: 'setBufferingReflectionFlag',
        run: (s: MemoryMSSQL) => s.setBufferingReflectionFlag('om-1', true),
        sqlFragment: '[isBufferingReflection] = @isBufferingReflection',
        boundParams: { isBufferingReflection: true },
        notFoundId: 'MASTRA_STORAGE_MSSQL_SET_BUFFERING_REFLECTION_FLAG_NOT_FOUND',
      },
      {
        name: 'setPendingMessageTokens',
        run: (s: MemoryMSSQL) => s.setPendingMessageTokens('om-1', 250),
        sqlFragment: '[pendingMessageTokens] = @pendingMessageTokens',
        boundParams: { pendingMessageTokens: 250 },
        notFoundId: 'MASTRA_STORAGE_MSSQL_SET_PENDING_MESSAGE_TOKENS_NOT_FOUND',
      },
    ];

    for (const c of cases) {
      it(`${c.name} updates the record by id`, async () => {
        const { storage, queries, paramsAtQuery } = createMockStorage(() => ({ rowsAffected: [1] }));

        await c.run(storage);

        expect(queries).toHaveLength(1);
        expect(queries[0]).toContain(c.sqlFragment);
        expect(queries[0]).toContain('WHERE id = @id');
        expect(paramsAtQuery[0]).toMatchObject({ ...c.boundParams, id: 'om-1' });
      });

      it(`${c.name} throws NOT_FOUND when the record does not exist`, async () => {
        const { storage } = createMockStorage(() => ({ rowsAffected: [0] }));

        await expect(c.run(storage)).rejects.toMatchObject({ id: c.notFoundId });
      });
    }

    it('setBufferingObservationFlag binds lastBufferedAtTokens when provided', async () => {
      const { storage, queries, paramsAtQuery } = createMockStorage(() => ({ rowsAffected: [1] }));

      await storage.setBufferingObservationFlag('om-1', true, 500);

      expect(queries[0]).toContain('[lastBufferedAtTokens] = @lastBufferedAtTokens');
      expect(paramsAtQuery[0]).toMatchObject({ isBufferingObservation: true, lastBufferedAtTokens: 500, id: 'om-1' });
    });

    it('setBufferingObservationFlag omits lastBufferedAtTokens when not provided', async () => {
      const { storage, queries, paramsAtQuery } = createMockStorage(() => ({ rowsAffected: [1] }));

      await storage.setBufferingObservationFlag('om-1', false);

      expect(queries[0]).not.toContain('lastBufferedAtTokens');
      expect(paramsAtQuery[0]).not.toHaveProperty('lastBufferedAtTokens');
    });

    it('setBufferingObservationFlag throws NOT_FOUND when the record does not exist', async () => {
      const { storage } = createMockStorage(() => ({ rowsAffected: [0] }));

      await expect(storage.setBufferingObservationFlag('om-1', true)).rejects.toMatchObject({
        id: 'MASTRA_STORAGE_MSSQL_SET_BUFFERING_OBSERVATION_FLAG_NOT_FOUND',
      });
    });
  });

  describe('clearObservationalMemory', () => {
    it('deletes every generation for the lookup key', async () => {
      const { storage, queries, paramsAtQuery } = createMockStorage(() => ({ rowsAffected: [3] }));

      await storage.clearObservationalMemory('t1', 'r1');

      expect(queries[0]).toBe(`DELETE FROM ${OM_TABLE} WHERE [lookupKey] = @lookupKey`);
      expect(paramsAtQuery[0]).toEqual({ lookupKey: 'thread:t1' });
    });
  });

  describe('updateObservationalMemoryConfig', () => {
    const existing = { observationThreshold: 100, summarization: { enabled: true, maxTokens: 500 } };

    it('deep-merges the new config into the stored config', async () => {
      const { storage, queries, paramsAtQuery } = createMockStorage(query =>
        query.includes('SELECT config FROM')
          ? { recordset: [{ config: JSON.stringify(existing) }] }
          : { rowsAffected: [1] },
      );

      await storage.updateObservationalMemoryConfig({
        id: 'om-1',
        config: { summarization: { maxTokens: 800 }, reflectionThreshold: 2000 },
      });

      expect(queries).toHaveLength(2);
      expect(queries[0]).toContain('SELECT config FROM');
      expect(queries[1]).toContain('UPDATE');
      const updated = JSON.parse(paramsAtQuery[1]!.config as string);
      expect(updated).toEqual({
        observationThreshold: 100,
        summarization: { enabled: true, maxTokens: 800 },
        reflectionThreshold: 2000,
      });
      expect(paramsAtQuery[1]).toMatchObject({ id: 'om-1' });
    });

    it('throws NOT_FOUND when the record does not exist', async () => {
      const { storage } = createMockStorage(() => ({ recordset: [] }));

      await expect(storage.updateObservationalMemoryConfig({ id: 'om-1', config: {} })).rejects.toMatchObject({
        id: 'MASTRA_STORAGE_MSSQL_UPDATE_OM_CONFIG_NOT_FOUND',
      });
    });
  });

  describe('updateBufferedObservations', () => {
    const input = {
      id: 'om-1',
      chunk: {
        cycleId: 'cycle-b',
        observations: 'chunk B content',
        tokenCount: 5,
        messageIds: ['b1'],
        messageTokens: 120,
        lastObservedAt: new Date('2024-01-02T11:00:00.000Z'),
      },
      lastBufferedAtTime: new Date('2024-01-02T11:30:00.000Z'),
    };

    it('appends the new chunk to the persisted buffer', async () => {
      const chunkA = chunk({ id: 'ombuf-a', cycleId: 'cycle-a' });
      const { storage, queries, paramsAtQuery } = createMockStorage(query =>
        query.includes('SELECT [bufferedObservationChunks] FROM')
          ? { recordset: [{ bufferedObservationChunks: JSON.stringify([chunkA]) }] }
          : { rowsAffected: [1] },
      );

      await storage.updateBufferedObservations(input);

      expect(queries).toHaveLength(2);
      expect(queries[1]).toContain('[bufferedObservationChunks] = @bufferedObservationChunks');
      expect(queries[1]).toContain('COALESCE(@lastBufferedAtTime, [lastBufferedAtTime])');
      const updatedChunks = JSON.parse(paramsAtQuery[1]!.bufferedObservationChunks as string);
      expect(updatedChunks).toHaveLength(2);
      expect(updatedChunks[0].id).toBe('ombuf-a');
      expect(updatedChunks[1].cycleId).toBe('cycle-b');
      expect(updatedChunks[1].id).toMatch(/^ombuf-/);
      expect(updatedChunks[1].createdAt).toBeTruthy();
      expect(paramsAtQuery[1]).toMatchObject({
        id: 'om-1',
        lastBufferedAtTime: '2024-01-02T11:30:00.000Z',
      });
    });

    it('binds null lastBufferedAtTime when not provided', async () => {
      const chunkA = chunk({ id: 'ombuf-a', cycleId: 'cycle-a' });
      const { storage, paramsAtQuery } = createMockStorage(query =>
        query.includes('SELECT [bufferedObservationChunks] FROM')
          ? { recordset: [{ bufferedObservationChunks: JSON.stringify([chunkA]) }] }
          : { rowsAffected: [1] },
      );

      await storage.updateBufferedObservations({ id: 'om-1', chunk: input.chunk });

      expect(paramsAtQuery[1]!.lastBufferedAtTime).toBeNull();
    });

    it('throws NOT_FOUND when the record does not exist', async () => {
      const { storage } = createMockStorage(() => ({ recordset: [] }));

      await expect(storage.updateBufferedObservations(input)).rejects.toMatchObject({
        id: 'MASTRA_STORAGE_MSSQL_UPDATE_BUFFERED_OBSERVATIONS_NOT_FOUND',
      });
    });
  });

  describe('swapBufferedToActive', () => {
    // threshold 1000, ratio 0.5 -> retention floor 500; pending 900 -> target 400.
    // chunkA (300) lands under target; chunkB cumulative (600) overshoots but leaves
    // only 300 remaining (< min remaining 500), so only chunkA is activated.
    const chunkA = chunk({
      id: 'ombuf-a',
      cycleId: 'cycle-a',
      observations: 'chunk A content',
      tokenCount: 10,
      messageIds: ['a1', 'a2'],
      messageTokens: 300,
    });
    const chunkB = chunk({
      id: 'ombuf-b',
      cycleId: 'cycle-b',
      observations: 'chunk B content',
      tokenCount: 5,
      messageIds: ['b1'],
      messageTokens: 300,
      lastObservedAt: new Date('2024-01-02T11:00:00.000Z'),
    });

    const swapInput = {
      id: 'om-1',
      activationRatio: 0.5,
      messageTokensThreshold: 1000,
      currentPendingTokens: 900,
      lastObservedAt: new Date('2024-01-05T00:00:00.000Z'),
    };

    function swapRow(overrides: Record<string, any> = {}): Record<string, any> {
      return {
        id: 'om-1',
        lookupKey: 'thread:t1',
        scope: 'thread',
        threadId: 't1',
        resourceId: 'r1',
        activeObservations: '',
        observationTokenCount: '0',
        pendingMessageTokens: '900',
        bufferedObservationChunks: JSON.stringify([chunkA, chunkB]),
        updatedAt: '2024-01-01T00:00:00.000Z',
        ...overrides,
      };
    }

    it('activates the boundary chunk that satisfies the retention target', async () => {
      const { storage, queries, paramsAtQuery } = createMockStorage(query =>
        query.includes(`SELECT * FROM ${OM_TABLE} WHERE id = @id`) ? { recordset: [swapRow()] } : { rowsAffected: [1] },
      );

      const result = await storage.swapBufferedToActive(swapInput);

      expect(result.chunksActivated).toBe(1);
      expect(result.messageTokensActivated).toBe(300);
      expect(result.observationTokensActivated).toBe(10);
      expect(result.messagesActivated).toBe(2);
      expect(result.activatedCycleIds).toEqual(['cycle-a']);
      expect(result.activatedMessageIds).toEqual(['a1', 'a2']);
      expect(result.observations).toBe('chunk A content');
      expect(result.perChunk).toEqual([
        {
          cycleId: 'cycle-a',
          messageTokens: 300,
          observationTokens: 10,
          messageCount: 2,
          observations: 'chunk A content',
        },
      ]);

      expect(queries[0]).toContain(`SELECT * FROM ${OM_TABLE} WHERE id = @id`);
      expect(queries[1]).toContain(`UPDATE ${OM_TABLE}`);
      // Guard against racing with a concurrent buffer reset.
      expect(queries[1]).toContain('AND [bufferedObservationChunks] IS NOT NULL');
      expect(queries[1]).toContain(`AND [bufferedObservationChunks] != '[]'`);
      expect(paramsAtQuery[1]).toMatchObject({
        id: 'om-1',
        activeObservations: 'chunk A content',
        observationTokenCount: 10,
        pendingMessageTokens: 600,
        bufferedObservationChunks: JSON.stringify([chunkB]),
        lastObservedAt: '2024-01-05T00:00:00.000Z',
      });
    });

    it('appends activated content to existing active observations with a boundary separator', async () => {
      const { storage, paramsAtQuery } = createMockStorage(query =>
        query.includes(`SELECT * FROM ${OM_TABLE} WHERE id = @id`)
          ? { recordset: [swapRow({ activeObservations: 'existing', observationTokenCount: '25' })] }
          : { rowsAffected: [1] },
      );

      await storage.swapBufferedToActive(swapInput);

      expect(paramsAtQuery[1]!.activeObservations).toBe(
        'existing\n\n--- message boundary (2024-01-05T00:00:00.000Z) ---\n\nchunk A content',
      );
      expect(paramsAtQuery[1]!.observationTokenCount).toBe(35);
    });

    it('returns an empty result without an UPDATE when nothing is buffered', async () => {
      const { storage, queries } = createMockStorage(query =>
        query.includes(`SELECT * FROM ${OM_TABLE} WHERE id = @id`)
          ? { recordset: [swapRow({ bufferedObservationChunks: null })] }
          : { rowsAffected: [1] },
      );

      const result = await storage.swapBufferedToActive(swapInput);

      expect(result.chunksActivated).toBe(0);
      expect(result.activatedCycleIds).toEqual([]);
      expect(queries).toHaveLength(1);
    });

    it('returns an empty result when the guarded UPDATE affects no rows', async () => {
      const { storage } = createMockStorage(query =>
        query.includes(`SELECT * FROM ${OM_TABLE} WHERE id = @id`) ? { recordset: [swapRow()] } : { rowsAffected: [0] },
      );

      const result = await storage.swapBufferedToActive(swapInput);

      expect(result.chunksActivated).toBe(0);
      expect(result.messageTokensActivated).toBe(0);
    });

    it('throws NOT_FOUND when the record does not exist', async () => {
      const { storage } = createMockStorage(() => ({ recordset: [] }));

      await expect(storage.swapBufferedToActive(swapInput)).rejects.toMatchObject({
        id: 'MASTRA_STORAGE_MSSQL_SWAP_BUFFERED_TO_ACTIVE_NOT_FOUND',
      });
    });
  });

  describe('updateBufferedReflection', () => {
    const input = {
      id: 'om-1',
      reflection: 'REF',
      tokenCount: 15,
      inputTokenCount: 40,
      reflectedObservationLineCount: 3,
    };

    it('concatenates via CASE and accumulates reflection tokens in SQL', async () => {
      const { storage, queries, paramsAtQuery } = createMockStorage(() => ({ rowsAffected: [1] }));

      await storage.updateBufferedReflection(input);

      expect(queries[0]).toContain("WHEN [bufferedReflection] IS NOT NULL AND [bufferedReflection] != ''");
      expect(queries[0]).toContain('[bufferedReflection] + CHAR(10) + CHAR(10) + @reflection');
      expect(queries[0]).toContain(
        '[bufferedReflectionTokens] = COALESCE([bufferedReflectionTokens], 0) + @tokenCount',
      );
      expect(queries[0]).toContain(
        '[bufferedReflectionInputTokens] = COALESCE([bufferedReflectionInputTokens], 0) + @inputTokenCount',
      );
      expect(paramsAtQuery[0]).toMatchObject({
        id: 'om-1',
        reflection: 'REF',
        tokenCount: 15,
        inputTokenCount: 40,
        reflectedObservationLineCount: 3,
      });
    });

    it('throws NOT_FOUND when the record does not exist', async () => {
      const { storage } = createMockStorage(() => ({ rowsAffected: [0] }));

      await expect(storage.updateBufferedReflection(input)).rejects.toMatchObject({
        id: 'MASTRA_STORAGE_MSSQL_UPDATE_BUFFERED_REFLECTION_NOT_FOUND',
      });
    });
  });

  describe('swapBufferedReflectionToActive', () => {
    const reflectionRow: Record<string, any> = {
      id: 'om-1',
      lookupKey: 'thread:t1',
      scope: 'thread',
      threadId: 't1',
      resourceId: 'r1',
      activeObservations: 'line1\nline2\nline3',
      bufferedReflection: 'REFLECTED SUMMARY',
      reflectedObservationLineCount: '1',
      bufferedReflectionTokens: '15',
      bufferedReflectionInputTokens: null,
      pendingMessageTokens: '0',
      totalTokensObserved: '120',
      observationTokenCount: '20',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const currentRecord = baseRecord({ generationCount: 2, totalTokensObserved: 120 });

    it('creates a reflection generation replacing already-reflected lines, then clears the buffer', async () => {
      const { storage, queries, paramsAtQuery } = createMockStorage(query =>
        query.includes(`SELECT * FROM ${OM_TABLE} WHERE id = @id`)
          ? { recordset: [reflectionRow] }
          : { rowsAffected: [1] },
      );

      const record = await storage.swapBufferedReflectionToActive({ currentRecord, tokenCount: 25 });

      // 1) SELECT current row, 2) INSERT new generation, 3) clear buffered columns
      expect(queries).toHaveLength(3);
      expect(queries[1]).toContain(`INSERT INTO ${OM_TABLE}`);
      expect(paramsAtQuery[1]).toMatchObject({
        lookupKey: 'thread:t1',
        originType: 'reflection',
        generationCount: 3,
        activeObservations: 'REFLECTED SUMMARY\n\nline2\nline3',
      });
      expect(queries[2]).toContain('[bufferedReflection] = NULL');
      expect(queries[2]).toContain('[reflectedObservationLineCount] = NULL');

      expect(record.originType).toBe('reflection');
      expect(record.generationCount).toBe(3);
      expect(record.activeObservations).toBe('REFLECTED SUMMARY\n\nline2\nline3');
    });

    it('throws NO_CONTENT when there is no buffered reflection', async () => {
      const { storage } = createMockStorage(query =>
        query.includes(`SELECT * FROM ${OM_TABLE} WHERE id = @id`)
          ? { recordset: [{ ...reflectionRow, bufferedReflection: null }] }
          : { rowsAffected: [1] },
      );

      await expect(storage.swapBufferedReflectionToActive({ currentRecord, tokenCount: 25 })).rejects.toMatchObject({
        id: 'MASTRA_STORAGE_MSSQL_SWAP_BUFFERED_REFLECTION_TO_ACTIVE_NO_CONTENT',
      });
    });

    it('throws NOT_FOUND when the record does not exist', async () => {
      const { storage } = createMockStorage(() => ({ recordset: [] }));

      await expect(storage.swapBufferedReflectionToActive({ currentRecord, tokenCount: 25 })).rejects.toMatchObject({
        id: 'MASTRA_STORAGE_MSSQL_SWAP_BUFFERED_REFLECTION_TO_ACTIVE_NOT_FOUND',
      });
    });
  });
});
