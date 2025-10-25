import { describe, it, beforeEach, expect } from 'vitest';
import type { Trace } from '../../../telemetry';
import type { StoreOperations } from '../operations';
import type { InMemoryTraces } from './inmemory';
import { TracesInMemory } from './inmemory';

describe('getTraces', () => {
  let tracesStorage: TracesInMemory;
  let collection: InMemoryTraces;
  let operations: StoreOperations;

  beforeEach(() => {
    collection = new Map();
    operations = { batchInsert: async () => {} } as unknown as StoreOperations;
    tracesStorage = new TracesInMemory({ collection, operations });
  });

  it('should return traces sorted by startTime in descending order', async () => {
    // Arrange: Create traces with different timestamps
    const trace1: Trace = {
      id: '1',
      startTime: new Date('2024-01-01T10:00:00Z').toISOString(),
      createdAt: new Date().toISOString(),
    } as unknown as Trace;
    const trace2: Trace = {
      id: '2',
      startTime: new Date('2024-01-01T11:00:00Z').toISOString(),
      createdAt: new Date().toISOString(),
    } as unknown as Trace;
    const trace3: Trace = {
      id: '3',
      startTime: new Date('2024-01-01T09:00:00Z').toISOString(),
      createdAt: new Date().toISOString(),
    } as unknown as Trace;

    // Add traces in random order
    collection.set(trace1.id, trace1);
    collection.set(trace3.id, trace3);
    collection.set(trace2.id, trace2);

    // Act: Get traces
    const result = await tracesStorage.getTraces({});

    // Assert: Verify chronological order (newest first)
    expect(result.traces).toHaveLength(3);
    expect(result.traces[0].id).toBe('2'); // 11:00
    expect(result.traces[1].id).toBe('1'); // 10:00
    expect(result.traces[2].id).toBe('3'); // 09:00
  });

  it('should set hasMore=true when more traces exist beyond current page', async () => {
    // Arrange: Create more traces than the page size
    const traces = Array.from({ length: 15 }, (_, i) => ({
      id: i.toString(),
      startTime: new Date(`2024-01-01T${10 + i}:00:00Z`).toISOString(),
      createdAt: new Date().toISOString(),
    })) as unknown as Trace[];

    traces.forEach(trace => collection.set(trace.id, trace));

    // Act: Get first page with size of 10
    const result = await tracesStorage.getTraces({
      perPage: 10,
      page: 0,
    });

    // Assert: Verify hasMore indicates additional traces
    expect(result.hasMore).toBe(true);
  });

  it('should set hasMore=false when no traces exist beyond current page', async () => {
    // Arrange: Create exactly 5 traces
    const traces = Array.from({ length: 5 }, (_, i) => ({
      id: i.toString(),
      startTime: new Date(`2024-01-01T${10 + i}:00:00Z`).toISOString(),
      createdAt: new Date().toISOString(),
    })) as unknown as Trace[];

    traces.forEach(trace => collection.set(trace.id, trace));

    // Act: Get page with size matching total trace count
    const result = await tracesStorage.getTraces({
      perPage: 5,
      page: 0,
    });

    // Assert: Verify hasMore indicates no additional traces
    expect(result.hasMore).toBe(false);
    expect(result.traces).toHaveLength(5);
  });

  it('should return correct pagination metadata fields', async () => {
    // Arrange: Create 15 traces
    const traces = Array.from({ length: 15 }, (_, i) => ({
      id: i.toString(),
      startTime: new Date(`2024-01-01T${10 + i}:00:00Z`).toISOString(),
      createdAt: new Date().toISOString(),
    })) as unknown as Trace[];

    traces.forEach(trace => collection.set(trace.id, trace));

    // Act: Get specific page with defined size
    const result = await tracesStorage.getTraces({
      page: 1,
      perPage: 5,
    });

    // Assert: Verify pagination metadata
    expect(result.total).toBe(15);
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(5);
  });

  it('should return second page (indices 10-19) when requesting page 1', async () => {
    // Arrange: Setup 25 traces with known timestamps for deterministic sorting
    const baseTime = new Date('2024-01-01T00:00:00Z');
    Array.from({ length: 25 }, (_, i) => {
      const traceId = `trace_${i.toString().padStart(2, '0')}`;
      const trace: Trace = {
        id: traceId,
        startTime: new Date(baseTime.getTime() + (24 - i) * 3600000).toISOString(), // Descending order
        createdAt: new Date().toISOString(),
      } as unknown as Trace;
      collection.set(traceId, trace);
    });

    // Act: Get traces for page 1
    const result = await tracesStorage.getTraces({
      page: 1,
      perPage: 10,
    });

    // Assert: Verify exact content of page 1
    expect(result.traces).toHaveLength(10);
    expect(result.traces.map(t => t.id)).toEqual([
      'trace_10',
      'trace_11',
      'trace_12',
      'trace_13',
      'trace_14',
      'trace_15',
      'trace_16',
      'trace_17',
      'trace_18',
      'trace_19',
    ]);

    // Verify timestamps are correct
    const firstTrace = result.traces[0];
    const lastTrace = result.traces[result.traces.length - 1];
    expect(new Date(firstTrace.startTime).getTime()).toBe(baseTime.getTime() + 14 * 3600000);
    expect(new Date(lastTrace.startTime).getTime()).toBe(baseTime.getTime() + 5 * 3600000);
  });

  it('should return first page (indices 0-9) when requesting page 0', async () => {
    // Arrange: Setup 25 traces with known timestamps for deterministic sorting
    const baseTime = new Date('2024-01-01T00:00:00Z');
    Array.from({ length: 25 }, (_, i) => {
      const traceId = `trace_${i.toString().padStart(2, '0')}`;
      const trace: Trace = {
        id: traceId,
        startTime: new Date(baseTime.getTime() + (24 - i) * 3600000).toISOString(), // Descending order
        createdAt: new Date().toISOString(),
      } as unknown as Trace;
      collection.set(traceId, trace);
    });

    // Act: Get traces for page 0
    const result = await tracesStorage.getTraces({
      page: 0,
      perPage: 10,
    });

    // Assert: Verify exact content of page 0
    expect(result.traces).toHaveLength(10);
    expect(result.traces.map(t => t.id)).toEqual([
      'trace_00',
      'trace_01',
      'trace_02',
      'trace_03',
      'trace_04',
      'trace_05',
      'trace_06',
      'trace_07',
      'trace_08',
      'trace_09',
    ]);

    // Verify timestamps are correct
    const firstTrace = result.traces[0];
    const lastTrace = result.traces[result.traces.length - 1];
    expect(new Date(firstTrace.startTime).getTime()).toBe(baseTime.getTime() + 24 * 3600000);
    expect(new Date(lastTrace.startTime).getTime()).toBe(baseTime.getTime() + 15 * 3600000);
  });

  it('should return partial page when requesting final page', async () => {
    // Arrange: Setup 25 traces with known timestamps for deterministic sorting
    const baseTime = new Date('2024-01-01T00:00:00Z');
    Array.from({ length: 25 }, (_, i) => {
      const traceId = `trace_${i.toString().padStart(2, '0')}`;
      const trace: Trace = {
        id: traceId,
        startTime: new Date(baseTime.getTime() + (24 - i) * 3600000).toISOString(), // Descending order
        createdAt: new Date().toISOString(),
      } as unknown as Trace;
      collection.set(traceId, trace);
    });

    // Act: Get traces for page 2
    const result = await tracesStorage.getTraces({
      page: 2,
      perPage: 10,
    });

    // Assert: Verify exact content of final page
    expect(result.traces).toHaveLength(5);
    expect(result.traces.map(t => t.id)).toEqual(['trace_20', 'trace_21', 'trace_22', 'trace_23', 'trace_24']);

    // Verify timestamps are correct
    const firstTrace = result.traces[0];
    const lastTrace = result.traces[result.traces.length - 1];
    expect(new Date(firstTrace.startTime).getTime()).toBe(baseTime.getTime() + 4 * 3600000);
    expect(new Date(lastTrace.startTime).getTime()).toBe(baseTime.getTime());
  });
});
