/**
 * Legacy API Tests for Observability Handlers
 * ============================================
 *
 * These tests verify backward compatibility with the old API from main branch.
 *
 * Key transformations tested:
 * - dateRange -> startedAt
 * - name="agent run: 'x'" -> entityId='x', entityType='agent'
 * - name="workflow run: 'x'" -> entityId='x', entityType='workflow_run'
 * - entityType='workflow' -> entityType='workflow_run'
 */

import type { Mastra } from '@mastra/core/mastra';
import type { MastraStorage } from '@mastra/core/storage';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as errorHandler from './error';
import { LIST_TRACES_ROUTE } from './observability';
import { createTestServerContext } from './test-utils';

// Mock the error handler
vi.mock('./error', () => ({
  handleError: vi.fn(error => {
    throw error;
  }),
}));

// Mock observability store
const createMockObservabilityStore = () => ({
  getTrace: vi.fn(),
  listTraces: vi.fn(),
});

// Mock storage with getStore method
const createMockStorage = (
  observabilityStore: ReturnType<typeof createMockObservabilityStore>,
): Partial<MastraStorage> => ({
  getStore: vi.fn((domain: string) => {
    if (domain === 'observability') return Promise.resolve(observabilityStore);
    return Promise.resolve(undefined);
  }) as MastraStorage['getStore'],
});

// Mock Mastra instance
const createMockMastra = (storage?: Partial<MastraStorage>): Mastra =>
  ({
    getStorage: vi.fn(() => storage as MastraStorage),
    getScorerById: vi.fn(),
    getLogger: vi.fn(() => ({ warn: vi.fn(), error: vi.fn() })),
  }) as unknown as Mastra;

describe('Legacy Observability API - Backward Compatibility', () => {
  let mockObservabilityStore: ReturnType<typeof createMockObservabilityStore>;
  let mockMastra: Mastra;
  let handleErrorSpy: ReturnType<typeof vi.mocked<typeof errorHandler.handleError>>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockObservabilityStore = createMockObservabilityStore();
    const mockStorage = createMockStorage(mockObservabilityStore);
    mockMastra = createMockMastra(mockStorage);
    handleErrorSpy = vi.mocked(errorHandler.handleError);
    handleErrorSpy.mockImplementation(error => {
      throw error;
    });
  });

  describe('Legacy dateRange parameter', () => {
    it('should transform dateRange to startedAt', async () => {
      const mockResult = {
        pagination: { total: 0, page: 0, perPage: 10, hasMore: false },
        spans: [],
      };

      (mockObservabilityStore.listTraces as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const startDate = new Date('2024-01-01T00:00:00.000Z');
      const endDate = new Date('2024-01-31T23:59:59.999Z');

      await LIST_TRACES_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        dateRange: { start: startDate, end: endDate },
      });

      expect(mockObservabilityStore.listTraces).toHaveBeenCalledWith({
        filters: {
          startedAt: { start: startDate, end: endDate },
        },
        pagination: {},
        orderBy: {},
      });
    });

    it('should not override startedAt if already provided', async () => {
      const mockResult = {
        pagination: { total: 0, page: 0, perPage: 10, hasMore: false },
        spans: [],
      };

      (mockObservabilityStore.listTraces as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const oldDate = new Date('2024-01-01T00:00:00.000Z');
      const newDate = new Date('2024-06-01T00:00:00.000Z');

      await LIST_TRACES_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        dateRange: { start: oldDate },
        startedAt: { start: newDate }, // New param takes precedence
      });

      expect(mockObservabilityStore.listTraces).toHaveBeenCalledWith({
        filters: {
          startedAt: { start: newDate },
        },
        pagination: {},
        orderBy: {},
      });
    });
  });

  describe('Legacy name parameter', () => {
    it('should transform name="agent run: \'x\'" to entityId and entityType', async () => {
      const mockResult = {
        pagination: { total: 0, page: 0, perPage: 10, hasMore: false },
        spans: [],
      };

      (mockObservabilityStore.listTraces as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      await LIST_TRACES_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        name: "agent run: 'my-agent-id'",
      });

      expect(mockObservabilityStore.listTraces).toHaveBeenCalledWith({
        filters: {
          entityId: 'my-agent-id',
          entityType: 'agent',
        },
        pagination: {},
        orderBy: {},
      });
    });

    it('should transform name="workflow run: \'x\'" to entityId and entityType=workflow_run', async () => {
      const mockResult = {
        pagination: { total: 0, page: 0, perPage: 10, hasMore: false },
        spans: [],
      };

      (mockObservabilityStore.listTraces as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      await LIST_TRACES_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        name: "workflow run: 'my-workflow-id'",
      });

      expect(mockObservabilityStore.listTraces).toHaveBeenCalledWith({
        filters: {
          entityId: 'my-workflow-id',
          entityType: 'workflow_run',
        },
        pagination: {},
        orderBy: {},
      });
    });

    it('should not transform name if entityId is already provided', async () => {
      const mockResult = {
        pagination: { total: 0, page: 0, perPage: 10, hasMore: false },
        spans: [],
      };

      (mockObservabilityStore.listTraces as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      await LIST_TRACES_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        name: "agent run: 'old-agent'",
        entityId: 'new-agent', // Explicit entityId takes precedence
      });

      expect(mockObservabilityStore.listTraces).toHaveBeenCalledWith({
        filters: {
          entityId: 'new-agent',
        },
        pagination: {},
        orderBy: {},
      });
    });

    it('should ignore name if it does not match expected pattern', async () => {
      const mockResult = {
        pagination: { total: 0, page: 0, perPage: 10, hasMore: false },
        spans: [],
      };

      (mockObservabilityStore.listTraces as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      await LIST_TRACES_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        name: 'some-random-name', // Doesn't match pattern
      });

      expect(mockObservabilityStore.listTraces).toHaveBeenCalledWith({
        filters: {},
        pagination: {},
        orderBy: {},
      });
    });
  });

  describe('Legacy entityType=workflow parameter', () => {
    it('should transform entityType=workflow to entityType=workflow_run', async () => {
      const mockResult = {
        pagination: { total: 0, page: 0, perPage: 10, hasMore: false },
        spans: [],
      };

      (mockObservabilityStore.listTraces as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      await LIST_TRACES_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        entityType: 'workflow' as any, // Old value
        entityId: 'my-workflow',
      });

      expect(mockObservabilityStore.listTraces).toHaveBeenCalledWith({
        filters: {
          entityId: 'my-workflow',
          entityType: 'workflow_run',
        },
        pagination: {},
        orderBy: {},
      });
    });
  });

  describe('Combined legacy parameters', () => {
    it('should handle all legacy parameters together', async () => {
      const mockResult = {
        pagination: { total: 0, page: 1, perPage: 5, hasMore: false },
        spans: [],
      };

      (mockObservabilityStore.listTraces as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const startDate = new Date('2024-01-01T00:00:00.000Z');
      const endDate = new Date('2024-01-31T23:59:59.999Z');

      await LIST_TRACES_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        page: 1,
        perPage: 5,
        dateRange: { start: startDate, end: endDate },
        spanType: 'agent_run',
      });

      expect(mockObservabilityStore.listTraces).toHaveBeenCalledWith({
        filters: {
          startedAt: { start: startDate, end: endDate },
          spanType: 'agent_run',
        },
        pagination: { page: 1, perPage: 5 },
        orderBy: {},
      });
    });
  });

  describe('New API still works', () => {
    it('should work with new startedAt parameter directly', async () => {
      const mockResult = {
        pagination: { total: 0, page: 0, perPage: 10, hasMore: false },
        spans: [],
      };

      (mockObservabilityStore.listTraces as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const startDate = new Date('2024-01-01T00:00:00.000Z');

      await LIST_TRACES_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        startedAt: { start: startDate },
        entityId: 'my-agent',
        entityType: 'agent',
      });

      expect(mockObservabilityStore.listTraces).toHaveBeenCalledWith({
        filters: {
          startedAt: { start: startDate },
          entityId: 'my-agent',
          entityType: 'agent',
        },
        pagination: {},
        orderBy: {},
      });
    });

    it('should work with orderBy parameter', async () => {
      const mockResult = {
        pagination: { total: 0, page: 0, perPage: 10, hasMore: false },
        spans: [],
      };

      (mockObservabilityStore.listTraces as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      await LIST_TRACES_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        field: 'endedAt',
        direction: 'ASC',
      });

      expect(mockObservabilityStore.listTraces).toHaveBeenCalledWith({
        filters: {},
        pagination: {},
        orderBy: { field: 'endedAt', direction: 'ASC' },
      });
    });
  });
});
