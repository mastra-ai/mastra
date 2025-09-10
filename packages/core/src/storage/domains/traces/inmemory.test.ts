import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import type { StoreOperations } from '../operations';
import { TracesInMemory } from './inmemory';
import type { InMemoryTraces } from './inmemory';

describe('TracesInMemory', () => {
  let tracesStorage: TracesInMemory;
  let collection: InMemoryTraces;
  let operations: StoreOperations;

  beforeEach(() => {
    collection = new Map();
    operations = {
      batchInsert: async () => {},
    } as StoreOperations;
    tracesStorage = new TracesInMemory({ collection, operations });
  });

  afterEach(() => {
    collection.clear();
  });

  it('should filter traces by matching attributes', async () => {
    // Arrange: Create traces with different attributes
    const trace1 = {
      id: '1',
      name: 'test1',
      attributes: {
        service: 'auth',
        environment: 'prod',
      },
      createdAt: '2023-01-01T00:00:00Z',
    };

    const trace2 = {
      id: '2',
      name: 'test2',
      attributes: {
        service: 'auth',
        environment: 'dev',
      },
      createdAt: '2023-01-02T00:00:00Z',
    };

    const trace3 = {
      id: '3',
      name: 'test3',
      attributes: {
        service: 'payment',
        environment: 'prod',
      },
      createdAt: '2023-01-03T00:00:00Z',
    };

    collection.set('1', trace1);
    collection.set('2', trace2);
    collection.set('3', trace3);

    // Act: Filter traces with specific attributes
    const result = await tracesStorage.getTraces({
      attributes: {
        service: 'auth',
        environment: 'prod',
      },
      page: 0,
      perPage: 10,
    });

    // Assert: Verify only traces with exactly matching attributes are returned
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(trace1);
  });

  it('should filter traces by direct property matches', async () => {
    // Arrange: Create traces with different status values
    const trace1 = { id: '1', status: 'active', startTime: new Date().toISOString() };
    const trace2 = { id: '2', status: 'completed', startTime: new Date().toISOString() };
    const trace3 = { id: '3', status: 'active', startTime: new Date().toISOString() };

    collection.set(trace1.id, trace1);
    collection.set(trace2.id, trace2);
    collection.set(trace3.id, trace3);

    // Act: Filter traces by status
    const result = await tracesStorage.getTraces({
      filters: { status: 'active' },
      page: 0,
      perPage: 10,
    });

    // Assert: Only traces with matching status are returned
    expect(result).toHaveLength(2);
    expect(result.every(trace => trace.status === 'active')).toBe(true);
  });

  it('should handle multiple filter properties with AND logic', async () => {
    // Arrange: Create traces with different combinations of properties
    const trace1 = { id: '1', status: 'active', type: 'error', startTime: new Date().toISOString() };
    const trace2 = { id: '2', status: 'active', type: 'info', startTime: new Date().toISOString() };
    const trace3 = { id: '3', status: 'completed', type: 'error', startTime: new Date().toISOString() };

    collection.set(trace1.id, trace1);
    collection.set(trace2.id, trace2);
    collection.set(trace3.id, trace3);

    // Act: Filter traces by multiple properties
    const result = await tracesStorage.getTraces({
      filters: { status: 'active', type: 'error' },
      page: 0,
      perPage: 10,
    });

    // Assert: Only traces matching all criteria are returned
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('active');
    expect(result[0].type).toBe('error');
  });

  it('should return empty array when no traces match filter criteria', async () => {
    // Arrange: Add traces with known values
    const trace1 = { id: '1', status: 'active', startTime: new Date().toISOString() };
    const trace2 = { id: '2', status: 'completed', startTime: new Date().toISOString() };

    collection.set(trace1.id, trace1);
    collection.set(trace2.id, trace2);

    // Act: Filter with non-matching criteria
    const result = await tracesStorage.getTraces({
      filters: { status: 'nonexistent' },
      page: 0,
      perPage: 10,
    });

    // Assert: Empty array is returned
    expect(result).toHaveLength(0);
  });

  it('should use strict equality for number and boolean properties', async () => {
    // Arrange: Create traces with various types of values
    const trace1 = { id: '1', count: 1, active: true, startTime: new Date().toISOString() };
    const trace2 = { id: '2', count: '1', active: 1, startTime: new Date().toISOString() };
    const trace3 = { id: '3', count: 1, active: true, startTime: new Date().toISOString() };

    collection.set(trace1.id, trace1);
    collection.set(trace2.id, trace2);
    collection.set(trace3.id, trace3);

    // Act: Filter with specific types
    const result = await tracesStorage.getTraces({
      filters: { count: 1, active: true },
      page: 0,
      perPage: 10,
    });

    // Assert: Only exact type matches are returned
    expect(result).toHaveLength(2);
    expect(result.every(trace => trace.count === 1 && trace.active === true)).toBe(true);
  });

  it('should filter traces by fromDate', async () => {
    // Arrange: Create traces with different dates
    const trace1 = {
      id: '1',
      name: 'test1',
      createdAt: '2023-01-01T00:00:00Z',
      startTime: '2023-01-01T00:00:00Z',
    };

    const trace2 = {
      id: '2',
      name: 'test2',
      createdAt: '2023-01-15T00:00:00Z',
      startTime: '2023-01-15T00:00:00Z',
    };

    const trace3 = {
      id: '3',
      name: 'test3',
      createdAt: '2023-01-30T00:00:00Z',
      startTime: '2023-01-30T00:00:00Z',
    };

    collection.set('1', trace1);
    collection.set('2', trace2);
    collection.set('3', trace3);

    // Act: Filter traces with fromDate
    const fromDate = new Date('2023-01-15T00:00:00Z');
    const result = await tracesStorage.getTraces({
      fromDate,
      page: 0,
      perPage: 10,
    });

    // Assert: Verify only traces with createdAt >= fromDate are returned
    expect(result).toHaveLength(2);
    expect(result).toContainEqual(trace2);
    expect(result).toContainEqual(trace3);
    expect(result).not.toContainEqual(trace1);
  });

  it('should filter traces when name parameter is provided', async () => {
    // Arrange: Create traces with different names
    collection.set('1', {
      id: '1',
      name: 'test-trace-1',
      startTime: '2024-01-01T10:00:00Z',
      createdAt: '2024-01-01T10:00:00Z',
    });
    collection.set('2', {
      id: '2',
      name: 'test-trace-2',
      startTime: '2024-01-01T11:00:00Z',
      createdAt: '2024-01-01T11:00:00Z',
    });
    collection.set('3', {
      id: '3',
      name: 'other-trace',
      startTime: '2024-01-01T12:00:00Z',
      createdAt: '2024-01-01T12:00:00Z',
    });

    // Act: Retrieve traces filtered by name
    const result = await tracesStorage.getTraces({
      name: 'test',
      page: 0,
      perPage: 10,
    });

    // Assert: Verify filtering and sorting
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('test-trace-2'); // Most recent first
    expect(result[1].name).toBe('test-trace-1');
    expect(result.every(trace => trace.name.startsWith('test'))).toBe(true);
  });

  it('should filter traces when toDate parameter is provided', async () => {
    // Arrange: Create traces with different dates
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    collection.set('1', {
      id: '1',
      name: 'trace-1',
      startTime: twoDaysAgo.toISOString(),
      createdAt: twoDaysAgo.toISOString(),
    });
    collection.set('2', {
      id: '2',
      name: 'trace-2',
      startTime: yesterday.toISOString(),
      createdAt: yesterday.toISOString(),
    });
    collection.set('3', {
      id: '3',
      name: 'trace-3',
      startTime: today.toISOString(),
      createdAt: today.toISOString(),
    });

    // Act: Retrieve traces up to yesterday
    const result = await tracesStorage.getTraces({
      toDate: yesterday,
      page: 0,
      perPage: 10,
    });

    // Assert: Verify date filtering and sorting
    expect(result).toHaveLength(2);
    expect(new Date(result[0].createdAt)).toBeInstanceOf(Date);
    expect(new Date(result[0].createdAt).getTime()).toBeLessThanOrEqual(yesterday.getTime());
    expect(new Date(result[1].createdAt).getTime()).toBeLessThanOrEqual(yesterday.getTime());
    expect(result[0].id).toBe('2'); // Most recent first
    expect(result[1].id).toBe('1');
  });

  it('should filter traces by exact scope match', async () => {
    // Arrange: Create traces with different scopes
    const trace1 = {
      id: '1',
      name: 'trace-1',
      scope: 'test-scope-1',
      startTime: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    const trace2 = {
      id: '2',
      name: 'trace-2',
      scope: 'test-scope-1',
      startTime: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    const trace3 = {
      id: '3',
      name: 'trace-3',
      scope: 'test-scope-2',
      startTime: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    const trace4 = {
      id: '4',
      name: 'trace-4',
      scope: 'different-scope',
      startTime: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    collection.set('1', trace1);
    collection.set('2', trace2);
    collection.set('3', trace3);
    collection.set('4', trace4);

    // Act: Get traces filtered by scope
    const result = await tracesStorage.getTraces({
      scope: 'test-scope-1',
      page: 0,
      perPage: 10,
    });

    // Assert: Verify only matching traces are returned
    expect(result).toHaveLength(2);
    expect(result).toContainEqual(trace1);
    expect(result).toContainEqual(trace2);
    expect(result).not.toContainEqual(trace3);
    expect(result).not.toContainEqual(trace4);
  });

  it('should return empty array when no traces match scope', async () => {
    // Arrange: Create traces with different scopes
    const trace1 = {
      id: '1',
      name: 'trace-1',
      scope: 'test-scope-1',
      startTime: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    const trace2 = {
      id: '2',
      name: 'trace-2',
      scope: 'test-scope-2',
      startTime: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    collection.set('1', trace1);
    collection.set('2', trace2);

    // Act: Get traces with non-existent scope
    const result = await tracesStorage.getTraces({
      scope: 'non-existent-scope',
      page: 0,
      perPage: 10,
    });

    // Assert: Verify empty result
    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });
});
