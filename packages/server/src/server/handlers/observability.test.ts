import { createSampleScore } from '@internal/storage-test-utils';
import type { Mastra } from '@mastra/core/mastra';
import { EntityType, SpanType } from '@mastra/core/observability';
import type {
  MastraCompositeStore,
  TraceRecord,
  SpanRecord,
  GetTraceLightResponse,
  LightSpanRecord,
} from '@mastra/core/storage';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import * as errorHandler from './error';
import {
  LIST_TRACES_ROUTE,
  GET_TRACE_ROUTE,
  GET_TRACE_LIGHT_ROUTE,
  GET_SPAN_ROUTE,
  SCORE_TRACES_ROUTE,
  LIST_SCORES_BY_SPAN_ROUTE,
} from './observability';
import { NEW_ROUTES } from './observability-new-endpoints';
import { createTestServerContext } from './test-utils';

// Mock scoreTraces
vi.mock('@mastra/core/evals/scoreTraces', () => ({
  scoreTraces: vi.fn(),
}));

// Mock the error handler
vi.mock('./error', () => ({
  handleError: vi.fn(error => {
    throw error;
  }),
}));

// Mock observability store
const createMockObservabilityStore = () => ({
  getTrace: vi.fn(),
  getTraceLight: vi.fn(),
  getSpan: vi.fn(),
  listTraces: vi.fn(),
  listLogs: vi.fn(),
  listScores: vi.fn(),
  createScore: vi.fn(),
  getScoreById: vi.fn(),
  getScoreAggregate: vi.fn(),
  getScoreBreakdown: vi.fn(),
  getScoreTimeSeries: vi.fn(),
  getScorePercentiles: vi.fn(),
  listFeedback: vi.fn(),
  createFeedback: vi.fn(),
  getFeedbackAggregate: vi.fn(),
  getFeedbackBreakdown: vi.fn(),
  getFeedbackTimeSeries: vi.fn(),
  getFeedbackPercentiles: vi.fn(),
  getMetricAggregate: vi.fn(),
  getMetricBreakdown: vi.fn(),
  getMetricTimeSeries: vi.fn(),
  getMetricPercentiles: vi.fn(),
  getMetricNames: vi.fn(),
  getMetricLabelKeys: vi.fn(),
  getMetricLabelValues: vi.fn(),
  getEntityTypes: vi.fn(),
  getEntityNames: vi.fn(),
  getServiceNames: vi.fn(),
  getEnvironments: vi.fn(),
  getTags: vi.fn(),
});

// Mock scores store
const createMockScoresStore = () => ({
  listScoresBySpan: vi.fn(),
});

// Mock storage with getStore method
const createMockStorage = (
  observabilityStore: ReturnType<typeof createMockObservabilityStore>,
  scoresStore: ReturnType<typeof createMockScoresStore>,
): Partial<MastraCompositeStore> => ({
  getStore: vi.fn((domain: string) => {
    if (domain === 'observability') return Promise.resolve(observabilityStore);
    if (domain === 'scores') return Promise.resolve(scoresStore);
    return Promise.resolve(undefined);
  }) as MastraCompositeStore['getStore'],
});

// Mock Mastra instance
const createMockMastra = (storage?: Partial<MastraCompositeStore>): Mastra =>
  ({
    getStorage: vi.fn(() => storage as MastraCompositeStore),
    getScorerById: vi.fn(),
    getLogger: vi.fn(() => ({ warn: vi.fn(), error: vi.fn() })),
  }) as unknown as Mastra;

// Sample span for testing
const createSampleSpan = (overrides: Partial<SpanRecord> = {}): SpanRecord => ({
  traceId: 'test-trace-123',
  spanId: 'test-span-456',
  parentSpanId: null,
  name: 'test-span',
  entityType: null,
  entityId: null,
  entityName: null,
  userId: null,
  organizationId: null,
  resourceId: null,
  runId: null,
  sessionId: null,
  threadId: null,
  requestId: null,
  environment: null,
  source: null,
  serviceName: null,
  scope: null,
  spanType: SpanType.GENERIC,
  attributes: null,
  metadata: null,
  tags: null,
  links: null,
  input: null,
  output: null,
  error: null,
  requestContext: null,
  isEvent: false,
  startedAt: new Date('2024-01-01T00:00:00Z'),
  endedAt: new Date('2024-01-01T00:01:00Z'),
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: null,
  ...overrides,
});

describe('Observability Handlers', () => {
  let mockObservabilityStore: ReturnType<typeof createMockObservabilityStore>;
  let mockScoresStore: ReturnType<typeof createMockScoresStore>;
  let mockMastra: Mastra;
  let handleErrorSpy: ReturnType<typeof vi.mocked<typeof errorHandler.handleError>>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockObservabilityStore = createMockObservabilityStore();
    mockScoresStore = createMockScoresStore();
    const mockStorage = createMockStorage(mockObservabilityStore, mockScoresStore);
    mockMastra = createMockMastra(mockStorage);
    handleErrorSpy = vi.mocked(errorHandler.handleError);
    handleErrorSpy.mockImplementation(error => {
      throw error;
    });
  });

  describe('GET_TRACE_ROUTE', () => {
    it('should return trace when found', async () => {
      const mockTrace: TraceRecord = {
        traceId: 'test-trace-123',
        spans: [createSampleSpan()],
      };

      (mockObservabilityStore.getTrace as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrace);

      const result = await GET_TRACE_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        traceId: 'test-trace-123',
      });

      expect(result).toEqual(mockTrace);
      expect(mockObservabilityStore.getTrace).toHaveBeenCalledWith({ traceId: 'test-trace-123' });
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should throw 404 when trace not found', async () => {
      (mockObservabilityStore.getTrace as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        GET_TRACE_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          traceId: 'non-existent-trace',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await GET_TRACE_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          traceId: 'non-existent-trace',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(404);
        expect((error as HTTPException).message).toBe("Trace with ID 'non-existent-trace' not found");
      }
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        GET_TRACE_ROUTE.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          traceId: 'test-trace-123',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await GET_TRACE_ROUTE.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          traceId: 'test-trace-123',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not available');
      }
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Database connection failed');
      (mockObservabilityStore.getTrace as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        GET_TRACE_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          traceId: 'test-trace-123',
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, 'Error getting trace');
    });
  });

  describe('GET_TRACE_LIGHT_ROUTE', () => {
    const createLightSpan = (overrides: Partial<LightSpanRecord> = {}): LightSpanRecord => ({
      traceId: 'test-trace-123',
      spanId: 'test-span-456',
      parentSpanId: null,
      name: 'test-span',
      spanType: SpanType.GENERIC,
      isEvent: false,
      error: null,
      entityType: null,
      entityId: null,
      entityName: null,
      startedAt: new Date('2024-01-01T00:00:00Z'),
      endedAt: new Date('2024-01-01T00:01:00Z'),
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: null,
      ...overrides,
    });

    it('should return lightweight trace when found', async () => {
      const mockTrace: GetTraceLightResponse = {
        traceId: 'test-trace-123',
        spans: [createLightSpan()],
      };

      (mockObservabilityStore.getTraceLight as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrace);

      const result = await GET_TRACE_LIGHT_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        traceId: 'test-trace-123',
      });

      expect(result).toEqual(mockTrace);
      expect(mockObservabilityStore.getTraceLight).toHaveBeenCalledWith({ traceId: 'test-trace-123' });
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should throw 404 when trace not found', async () => {
      (mockObservabilityStore.getTraceLight as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        GET_TRACE_LIGHT_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          traceId: 'non-existent-trace',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await GET_TRACE_LIGHT_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          traceId: 'non-existent-trace',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(404);
        expect((error as HTTPException).message).toBe("Trace with ID 'non-existent-trace' not found");
      }
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        GET_TRACE_LIGHT_ROUTE.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          traceId: 'test-trace-123',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await GET_TRACE_LIGHT_ROUTE.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          traceId: 'test-trace-123',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not available');
      }
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Database connection failed');
      (mockObservabilityStore.getTraceLight as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        GET_TRACE_LIGHT_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          traceId: 'test-trace-123',
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, 'Error getting lightweight trace');
    });
  });

  describe('GET_SPAN_ROUTE', () => {
    it('should return span when found', async () => {
      const mockSpan = { span: createSampleSpan() };

      (mockObservabilityStore.getSpan as ReturnType<typeof vi.fn>).mockResolvedValue(mockSpan);

      const result = await GET_SPAN_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        traceId: 'test-trace-123',
        spanId: 'test-span-456',
      });

      expect(result).toEqual(mockSpan);
      expect(mockObservabilityStore.getSpan).toHaveBeenCalledWith({
        traceId: 'test-trace-123',
        spanId: 'test-span-456',
      });
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should throw 404 when span not found', async () => {
      (mockObservabilityStore.getSpan as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        GET_SPAN_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          traceId: 'test-trace-123',
          spanId: 'non-existent-span',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await GET_SPAN_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          traceId: 'test-trace-123',
          spanId: 'non-existent-span',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(404);
        expect((error as HTTPException).message).toBe('Span not found');
      }
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        GET_SPAN_ROUTE.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          traceId: 'test-trace-123',
          spanId: 'test-span-456',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await GET_SPAN_ROUTE.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          traceId: 'test-trace-123',
          spanId: 'test-span-456',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not available');
      }
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Database connection failed');
      (mockObservabilityStore.getSpan as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        GET_SPAN_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          traceId: 'test-trace-123',
          spanId: 'test-span-456',
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, 'Error getting span');
    });
  });

  describe('LIST_TRACES_ROUTE', () => {
    it('should return paginated results with default parameters', async () => {
      const mockResult = {
        pagination: {
          total: 0,
          page: 0,
          perPage: 10,
          hasMore: false,
        },
        spans: [],
      };

      (mockObservabilityStore.listTraces as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await LIST_TRACES_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.listTraces).toHaveBeenCalledWith({
        filters: {},
        pagination: {},
        orderBy: {},
      });
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should pass filters, pagination, and orderBy to storage', async () => {
      const mockResult = {
        pagination: {
          total: 5,
          page: 1,
          perPage: 10,
          hasMore: false,
        },
        spans: [createSampleSpan()],
      };

      (mockObservabilityStore.listTraces as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await LIST_TRACES_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        entityType: 'AGENT',
        page: 1,
        perPage: 10,
        field: 'startedAt',
        direction: 'DESC',
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.listTraces).toHaveBeenCalledWith({
        filters: { entityType: 'AGENT' },
        pagination: { page: 1, perPage: 10 },
        orderBy: { field: 'startedAt', direction: 'DESC' },
      });
    });

    it('should pass metadata filter to storage for key-value filtering', async () => {
      const mockResult = {
        pagination: { total: 1, page: 0, perPage: 10, hasMore: false },
        spans: [createSampleSpan({ metadata: { organizationId: 'org_abc', userId: 'user_123' } })],
      };

      (mockObservabilityStore.listTraces as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      // Handler receives already-parsed objects (query param parsing happens at HTTP layer)
      const result = await LIST_TRACES_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        metadata: { organizationId: 'org_abc' },
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.listTraces).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            metadata: { organizationId: 'org_abc' },
          }),
        }),
      );
    });

    it('should pass tags filter to storage for tag-based filtering', async () => {
      const mockResult = {
        pagination: { total: 1, page: 0, perPage: 10, hasMore: false },
        spans: [createSampleSpan({ tags: ['agent:paletteAgent', 'env:production'] })],
      };

      (mockObservabilityStore.listTraces as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await LIST_TRACES_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        tags: ['agent:paletteAgent'],
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.listTraces).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            tags: ['agent:paletteAgent'],
          }),
        }),
      );
    });

    it('should pass status filter to storage for error-only filtering', async () => {
      const mockResult = {
        pagination: { total: 1, page: 0, perPage: 10, hasMore: false },
        spans: [createSampleSpan({ error: 'something went wrong' })],
      };

      (mockObservabilityStore.listTraces as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await LIST_TRACES_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        status: 'error',
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.listTraces).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            status: 'error',
          }),
        }),
      );
    });

    it('should pass hasChildError filter for traces with errored child spans', async () => {
      const mockResult = {
        pagination: { total: 1, page: 0, perPage: 10, hasMore: false },
        spans: [createSampleSpan()],
      };

      (mockObservabilityStore.listTraces as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await LIST_TRACES_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        hasChildError: true,
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.listTraces).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            hasChildError: true,
          }),
        }),
      );
    });

    it('should pass combined metadata, tags, and status filters together', async () => {
      const mockResult = {
        pagination: { total: 1, page: 0, perPage: 10, hasMore: false },
        spans: [
          createSampleSpan({
            metadata: { organizationId: 'org_abc' },
            tags: ['agent:paletteAgent'],
            error: 'timeout',
          }),
        ],
      };

      (mockObservabilityStore.listTraces as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await LIST_TRACES_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        metadata: { organizationId: 'org_abc' },
        tags: ['agent:paletteAgent'],
        status: 'error',
        entityType: 'agent',
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.listTraces).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            metadata: { organizationId: 'org_abc' },
            tags: ['agent:paletteAgent'],
            status: 'error',
            entityType: 'agent',
          }),
        }),
      );
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        LIST_TRACES_ROUTE.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await LIST_TRACES_ROUTE.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not available');
      }
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Database query failed');
      (mockObservabilityStore.listTraces as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        LIST_TRACES_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, 'Error listing traces');
    });
  });

  describe('SCORE_TRACES_ROUTE', () => {
    let scoreTracesMock: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      const scoresModule = vi.mocked(await import('@mastra/core/evals/scoreTraces'));
      scoreTracesMock = scoresModule.scoreTraces as ReturnType<typeof vi.fn>;
      scoreTracesMock.mockClear();
    });

    it('should score traces successfully with valid request', async () => {
      (mockMastra.getScorerById as ReturnType<typeof vi.fn>).mockReturnValue({
        config: {
          id: 'test-scorer',
          name: 'test-scorer',
        },
      });
      scoreTracesMock.mockResolvedValue(undefined);

      const result = await SCORE_TRACES_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        scorerName: 'test-scorer',
        targets: [{ traceId: 'trace-123' }, { traceId: 'trace-456' }],
      });

      expect(result).toEqual({
        message: 'Scoring started for 2 traces',
        traceCount: 2,
        status: 'success',
      });

      expect(mockMastra.getScorerById).toHaveBeenCalledWith('test-scorer');
      expect(scoreTracesMock).toHaveBeenCalledWith({
        scorerId: 'test-scorer',
        targets: [{ traceId: 'trace-123' }, { traceId: 'trace-456' }],
        mastra: mockMastra,
      });
    });

    it('should return singular message for single trace', async () => {
      (mockMastra.getScorerById as ReturnType<typeof vi.fn>).mockReturnValue({
        config: { id: 'test-scorer', name: 'test-scorer' },
      });
      scoreTracesMock.mockResolvedValue(undefined);

      const result = await SCORE_TRACES_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        scorerName: 'test-scorer',
        targets: [{ traceId: 'trace-123' }],
      });

      expect(result).toEqual({
        message: 'Scoring started for 1 trace',
        traceCount: 1,
        status: 'success',
      });
    });

    it('should throw 404 when scorer is not found', async () => {
      (mockMastra.getScorerById as ReturnType<typeof vi.fn>).mockReturnValue(null);

      await expect(
        SCORE_TRACES_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          scorerName: 'non-existent-scorer',
          targets: [{ traceId: 'trace-123' }],
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await SCORE_TRACES_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          scorerName: 'non-existent-scorer',
          targets: [{ traceId: 'trace-123' }],
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(404);
        expect((error as HTTPException).message).toBe("Scorer 'non-existent-scorer' not found");
      }
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        SCORE_TRACES_ROUTE.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          scorerName: 'test-scorer',
          targets: [{ traceId: 'trace-123' }],
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await SCORE_TRACES_ROUTE.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          scorerName: 'test-scorer',
          targets: [{ traceId: 'trace-123' }],
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not available');
      }
    });

    it('should handle scoreTraces errors gracefully (fire-and-forget)', async () => {
      (mockMastra.getScorerById as ReturnType<typeof vi.fn>).mockReturnValue({
        config: { id: 'test-scorer', name: 'test-scorer' },
      });

      const processingError = new Error('Processing failed');
      scoreTracesMock.mockRejectedValue(processingError);

      // Should still return success response since processing is fire-and-forget
      const result = await SCORE_TRACES_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        scorerName: 'test-scorer',
        targets: [{ traceId: 'trace-123' }],
      });

      expect(result).toEqual({
        message: 'Scoring started for 1 trace',
        traceCount: 1,
        status: 'success',
      });
    });

    it('should use scorer config id when available', async () => {
      (mockMastra.getScorerById as ReturnType<typeof vi.fn>).mockReturnValue({
        config: {
          id: 'scorer-id-123',
          name: 'scorer-display-name',
        },
      });
      scoreTracesMock.mockResolvedValue(undefined);

      await SCORE_TRACES_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        scorerName: 'test-scorer',
        targets: [{ traceId: 'trace-123' }],
      });

      expect(scoreTracesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scorerId: 'scorer-id-123',
        }),
      );
    });

    it('should fall back to scorer config name when id is not available', async () => {
      (mockMastra.getScorerById as ReturnType<typeof vi.fn>).mockReturnValue({
        config: {
          name: 'scorer-display-name',
        },
      });
      scoreTracesMock.mockResolvedValue(undefined);

      await SCORE_TRACES_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        scorerName: 'test-scorer',
        targets: [{ traceId: 'trace-123' }],
      });

      expect(scoreTracesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scorerId: 'scorer-display-name',
        }),
      );
    });
  });

  describe('LIST_SCORES_BY_SPAN_ROUTE', () => {
    it('should get scores by span successfully', async () => {
      const mockScores = [
        createSampleScore({ traceId: 'test-trace-1', spanId: 'test-span-1', scorerId: 'test-scorer' }),
      ];
      const mockResult = {
        scores: mockScores,
        pagination: {
          total: 1,
          page: 0,
          perPage: 10,
          hasMore: false,
        },
      };

      (mockScoresStore.listScoresBySpan as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await LIST_SCORES_BY_SPAN_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        traceId: 'test-trace-1',
        spanId: 'test-span-1',
        page: 0,
        perPage: 10,
      });

      expect(mockScoresStore.listScoresBySpan).toHaveBeenCalledWith({
        traceId: 'test-trace-1',
        spanId: 'test-span-1',
        pagination: { page: 0, perPage: 10 },
      });

      expect(result.scores).toHaveLength(1);
      expect(result.pagination).toEqual({
        total: 1,
        page: 0,
        perPage: 10,
        hasMore: false,
      });
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        LIST_SCORES_BY_SPAN_ROUTE.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          traceId: 'test-trace-1',
          spanId: 'test-span-1',
          page: 0,
          perPage: 10,
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await LIST_SCORES_BY_SPAN_ROUTE.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          traceId: 'test-trace-1',
          spanId: 'test-span-1',
          page: 0,
          perPage: 10,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not available');
      }
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Database query failed');
      (mockScoresStore.listScoresBySpan as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        LIST_SCORES_BY_SPAN_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          traceId: 'test-trace-1',
          spanId: 'test-span-1',
          page: 0,
          perPage: 10,
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, 'Error getting scores by span');
    });
  });

  describe('LIST_LOGS_ROUTE', () => {
    it('should return paginated results with default parameters', async () => {
      const mockResult = {
        pagination: {
          total: 0,
          page: 0,
          perPage: 10,
          hasMore: false,
        },
        logs: [],
      };

      (mockObservabilityStore.listLogs as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.LIST_LOGS.handler({
        ...createTestServerContext({ mastra: mockMastra }),
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.listLogs).toHaveBeenCalledWith({
        filters: {},
        pagination: {},
        orderBy: {},
      });
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should pass filters, pagination, and orderBy to storage', async () => {
      const mockResult = {
        pagination: {
          total: 3,
          page: 1,
          perPage: 5,
          hasMore: false,
        },
        logs: [
          {
            timestamp: new Date('2024-01-01T00:00:00Z'),
            level: 'error',
            message: 'Something went wrong',
          },
        ],
      };

      (mockObservabilityStore.listLogs as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.LIST_LOGS.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        level: 'error',
        page: 1,
        perPage: 5,
        field: 'timestamp',
        direction: 'DESC',
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.listLogs).toHaveBeenCalledWith({
        filters: { level: 'error' },
        pagination: { page: 1, perPage: 5 },
        orderBy: { field: 'timestamp', direction: 'DESC' },
      });
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        NEW_ROUTES.LIST_LOGS.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await NEW_ROUTES.LIST_LOGS.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not available');
      }
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Database query failed');
      (mockObservabilityStore.listLogs as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        NEW_ROUTES.LIST_LOGS.handler({
          ...createTestServerContext({ mastra: mockMastra }),
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, "Error calling: 'list logs'");
    });
  });

  describe('LIST_SCORES_ROUTE', () => {
    it('should return paginated results with default parameters', async () => {
      const mockResult = {
        pagination: {
          total: 0,
          page: 0,
          perPage: 10,
          hasMore: false,
        },
        scores: [],
      };

      (mockObservabilityStore.listScores as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.LIST_SCORES.handler({
        ...createTestServerContext({ mastra: mockMastra }),
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.listScores).toHaveBeenCalledWith({
        filters: {},
        pagination: {},
        orderBy: {},
      });
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should pass filters, pagination, and orderBy to storage', async () => {
      const mockResult = {
        pagination: {
          total: 2,
          page: 0,
          perPage: 10,
          hasMore: false,
        },
        scores: [
          {
            timestamp: new Date('2024-01-01T00:00:00Z'),
            traceId: 'trace-1',
            scorerId: 'accuracy',
            score: 0.95,
          },
        ],
      };

      (mockObservabilityStore.listScores as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.LIST_SCORES.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        scorerId: 'accuracy',
        page: 0,
        perPage: 10,
        field: 'timestamp',
        direction: 'DESC',
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.listScores).toHaveBeenCalledWith({
        filters: { scorerId: 'accuracy' },
        pagination: { page: 0, perPage: 10 },
        orderBy: { field: 'timestamp', direction: 'DESC' },
      });
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        NEW_ROUTES.LIST_SCORES.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await NEW_ROUTES.LIST_SCORES.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not available');
      }
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Database query failed');
      (mockObservabilityStore.listScores as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        NEW_ROUTES.LIST_SCORES.handler({
          ...createTestServerContext({ mastra: mockMastra }),
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, "Error calling: 'list scores'");
    });
  });

  describe('GET_SCORE_ROUTE', () => {
    it('should get a score directly by scoreId', async () => {
      const mockScore = {
        scoreId: 'score-123',
        timestamp: new Date('2024-01-01T00:00:00Z'),
        scorerId: 'accuracy',
        score: 0.95,
      };

      (mockObservabilityStore.getScoreById as ReturnType<typeof vi.fn>).mockResolvedValue(mockScore);

      const result = await NEW_ROUTES.GET_SCORE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        scoreId: 'score-123',
      });

      expect(result).toEqual({ score: mockScore });
      expect(mockObservabilityStore.getScoreById).toHaveBeenCalledWith('score-123');
      expect(mockObservabilityStore.listScores).not.toHaveBeenCalled();
    });
  });

  describe('CREATE_SCORE_ROUTE', () => {
    it('should create a score successfully', async () => {
      (mockObservabilityStore.createScore as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const scoreData = {
        traceId: 'trace-123',
        spanId: 'span-456',
        scorerId: 'accuracy',
        score: 0.95,
        reason: 'High accuracy match',
      };

      const result = await NEW_ROUTES.CREATE_SCORE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        score: scoreData,
      });

      expect(result).toEqual({ success: true });
      expect(mockObservabilityStore.createScore).toHaveBeenCalledWith({
        score: expect.objectContaining({ ...scoreData, scoreId: expect.any(String), timestamp: expect.any(Date) }),
      });
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should preserve a caller-supplied scoreId', async () => {
      (mockObservabilityStore.createScore as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const scoreData = {
        scoreId: 'score-from-client',
        traceId: 'trace-123',
        spanId: 'span-456',
        scorerId: 'accuracy',
        score: 0.95,
        reason: 'High accuracy match',
      };

      await NEW_ROUTES.CREATE_SCORE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        score: scoreData,
      });

      expect(mockObservabilityStore.createScore).toHaveBeenCalledWith({
        score: expect.objectContaining({ ...scoreData, timestamp: expect.any(Date) }),
      });
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        NEW_ROUTES.CREATE_SCORE.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          score: {
            traceId: 'trace-123',
            scorerId: 'accuracy',
            score: 0.9,
          },
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await NEW_ROUTES.CREATE_SCORE.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          score: {
            traceId: 'trace-123',
            scorerId: 'accuracy',
            score: 0.9,
          },
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not available');
      }
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Database insert failed');
      (mockObservabilityStore.createScore as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        NEW_ROUTES.CREATE_SCORE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          score: {
            traceId: 'trace-123',
            scorerId: 'accuracy',
            score: 0.9,
          },
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, "Error calling: 'create a score'");
    });
  });

  describe('LIST_FEEDBACK_ROUTE', () => {
    it('should return paginated results with default parameters', async () => {
      const mockResult = {
        pagination: {
          total: 0,
          page: 0,
          perPage: 10,
          hasMore: false,
        },
        feedback: [],
      };

      (mockObservabilityStore.listFeedback as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.LIST_FEEDBACK.handler({
        ...createTestServerContext({ mastra: mockMastra }),
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.listFeedback).toHaveBeenCalledWith({
        filters: {},
        pagination: {},
        orderBy: {},
      });
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should pass filters, pagination, and orderBy to storage', async () => {
      const mockResult = {
        pagination: {
          total: 1,
          page: 0,
          perPage: 10,
          hasMore: false,
        },
        feedback: [
          {
            timestamp: new Date('2024-01-01T00:00:00Z'),
            traceId: 'trace-1',
            source: 'user',
            feedbackType: 'thumbs',
            value: 1,
          },
        ],
      };

      (mockObservabilityStore.listFeedback as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.LIST_FEEDBACK.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        feedbackType: 'thumbs',
        source: 'user',
        page: 0,
        perPage: 10,
        field: 'timestamp',
        direction: 'ASC',
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.listFeedback).toHaveBeenCalledWith({
        filters: { feedbackType: 'thumbs', source: 'user' },
        pagination: { page: 0, perPage: 10 },
        orderBy: { field: 'timestamp', direction: 'ASC' },
      });
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        NEW_ROUTES.LIST_FEEDBACK.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await NEW_ROUTES.LIST_FEEDBACK.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not available');
      }
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Database query failed');
      (mockObservabilityStore.listFeedback as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        NEW_ROUTES.LIST_FEEDBACK.handler({
          ...createTestServerContext({ mastra: mockMastra }),
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, "Error calling: 'list feedback'");
    });
  });

  describe('CREATE_FEEDBACK_ROUTE', () => {
    it('should create feedback successfully', async () => {
      (mockObservabilityStore.createFeedback as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const feedbackData = {
        traceId: 'trace-123',
        spanId: 'span-456',
        source: 'user',
        feedbackType: 'thumbs',
        value: 1,
        comment: 'Great response!',
      };

      const result = await NEW_ROUTES.CREATE_FEEDBACK.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        feedback: feedbackData,
      });

      expect(result).toEqual({ success: true });
      expect(mockObservabilityStore.createFeedback).toHaveBeenCalledWith({
        feedback: expect.objectContaining({
          ...feedbackData,
          feedbackId: expect.any(String),
          timestamp: expect.any(Date),
        }),
      });
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should preserve a caller-supplied feedbackId', async () => {
      (mockObservabilityStore.createFeedback as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const feedbackData = {
        feedbackId: 'feedback-from-client',
        traceId: 'trace-123',
        spanId: 'span-456',
        source: 'user',
        feedbackType: 'thumbs',
        value: 1,
        comment: 'Great response!',
      };

      await NEW_ROUTES.CREATE_FEEDBACK.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        feedback: feedbackData,
      });

      expect(mockObservabilityStore.createFeedback).toHaveBeenCalledWith({
        feedback: expect.objectContaining({ ...feedbackData, timestamp: expect.any(Date) }),
      });
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        NEW_ROUTES.CREATE_FEEDBACK.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          feedback: {
            traceId: 'trace-123',
            source: 'user',
            feedbackType: 'thumbs',
            value: 1,
          },
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await NEW_ROUTES.CREATE_FEEDBACK.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          feedback: {
            traceId: 'trace-123',
            source: 'user',
            feedbackType: 'thumbs',
            value: 1,
          },
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not available');
      }
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Database insert failed');
      (mockObservabilityStore.createFeedback as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        NEW_ROUTES.CREATE_FEEDBACK.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          feedback: {
            traceId: 'trace-123',
            source: 'user',
            feedbackType: 'thumbs',
            value: 1,
          },
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, "Error calling: 'create feedback'");
    });
  });

  describe('GET_METRIC_AGGREGATE_ROUTE', () => {
    it('should return metric aggregate successfully', async () => {
      const mockResult = {
        value: 42.5,
        estimatedCost: 1.23,
        costUnit: 'usd',
        previousValue: null,
        previousEstimatedCost: null,
        changePercent: null,
        costChangePercent: null,
      };

      (mockObservabilityStore.getMetricAggregate as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_METRIC_AGGREGATE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        name: ['latency'],
        aggregation: 'avg',
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getMetricAggregate).toHaveBeenCalledWith({
        name: ['latency'],
        aggregation: 'avg',
      });
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should pass compare period and filters to storage', async () => {
      const mockResult = {
        value: 100,
        estimatedCost: 2.5,
        costUnit: 'usd',
        previousValue: 80,
        previousEstimatedCost: 2,
        changePercent: 25,
        costChangePercent: 25,
      };

      (mockObservabilityStore.getMetricAggregate as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_METRIC_AGGREGATE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        name: ['latency'],
        aggregation: 'avg',
        comparePeriod: 'previous_period',
        filters: { entityType: EntityType.AGENT },
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getMetricAggregate).toHaveBeenCalledWith({
        name: ['latency'],
        aggregation: 'avg',
        comparePeriod: 'previous_period',
        filters: { entityType: EntityType.AGENT },
      });
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        NEW_ROUTES.GET_METRIC_AGGREGATE.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          name: ['latency'],
          aggregation: 'avg',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await NEW_ROUTES.GET_METRIC_AGGREGATE.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          name: ['latency'],
          aggregation: 'avg',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not available');
      }
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Aggregation query failed');
      (mockObservabilityStore.getMetricAggregate as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        NEW_ROUTES.GET_METRIC_AGGREGATE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          name: ['latency'],
          aggregation: 'avg',
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, "Error calling: 'get metric aggregate'");
    });
  });

  describe('GET_SCORE_AGGREGATE_ROUTE', () => {
    it('should return score aggregate successfully', async () => {
      const mockResult = {
        value: 0.82,
        previousValue: 0.8,
        changePercent: 2.5,
      };

      (mockObservabilityStore.getScoreAggregate as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_SCORE_AGGREGATE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        scorerId: 'relevance',
        scoreSource: 'manual',
        aggregation: 'avg',
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getScoreAggregate).toHaveBeenCalledWith({
        scorerId: 'relevance',
        scoreSource: 'manual',
        aggregation: 'avg',
      });
    });
  });

  describe('GET_SCORE_BREAKDOWN_ROUTE', () => {
    it('should return score breakdown successfully', async () => {
      const mockResult = {
        groups: [{ dimensions: { experimentId: 'exp-1' }, value: 0.82 }],
      };

      (mockObservabilityStore.getScoreBreakdown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_SCORE_BREAKDOWN.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        scorerId: 'relevance',
        groupBy: ['experimentId'],
        aggregation: 'avg',
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getScoreBreakdown).toHaveBeenCalledWith({
        scorerId: 'relevance',
        groupBy: ['experimentId'],
        aggregation: 'avg',
      });
    });
  });

  describe('GET_SCORE_TIME_SERIES_ROUTE', () => {
    it('should return score time series successfully', async () => {
      const mockResult = {
        series: [
          {
            name: 'relevance|manual',
            points: [{ timestamp: new Date('2024-01-01T00:00:00Z'), value: 0.82 }],
          },
        ],
      };

      (mockObservabilityStore.getScoreTimeSeries as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_SCORE_TIME_SERIES.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        scorerId: 'relevance',
        scoreSource: 'manual',
        interval: '1h',
        aggregation: 'avg',
        groupBy: ['experimentId'],
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getScoreTimeSeries).toHaveBeenCalledWith({
        scorerId: 'relevance',
        scoreSource: 'manual',
        interval: '1h',
        aggregation: 'avg',
        groupBy: ['experimentId'],
      });
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Score time series query failed');
      (mockObservabilityStore.getScoreTimeSeries as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        NEW_ROUTES.GET_SCORE_TIME_SERIES.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          scorerId: 'relevance',
          interval: '1h',
          aggregation: 'avg',
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, "Error calling: 'get score time series'");
    });
  });

  describe('GET_SCORE_PERCENTILES_ROUTE', () => {
    it('should return score percentiles successfully', async () => {
      const mockResult = {
        series: [
          {
            percentile: 0.5,
            points: [{ timestamp: new Date('2024-01-01T00:00:00Z'), value: 0.82 }],
          },
        ],
      };

      (mockObservabilityStore.getScorePercentiles as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_SCORE_PERCENTILES.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        scorerId: 'relevance',
        scoreSource: 'manual',
        percentiles: [0.5],
        interval: '1h',
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getScorePercentiles).toHaveBeenCalledWith({
        scorerId: 'relevance',
        scoreSource: 'manual',
        percentiles: [0.5],
        interval: '1h',
      });
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Score percentile query failed');
      (mockObservabilityStore.getScorePercentiles as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        NEW_ROUTES.GET_SCORE_PERCENTILES.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          scorerId: 'relevance',
          percentiles: [0.5],
          interval: '1h',
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, "Error calling: 'get score percentiles'");
    });
  });

  describe('GET_FEEDBACK_AGGREGATE_ROUTE', () => {
    it('should return feedback aggregate successfully', async () => {
      const mockResult = {
        value: 4.5,
        previousValue: 4.2,
        changePercent: 7.14,
      };

      (mockObservabilityStore.getFeedbackAggregate as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_FEEDBACK_AGGREGATE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        feedbackType: 'rating',
        feedbackSource: 'user',
        aggregation: 'avg',
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getFeedbackAggregate).toHaveBeenCalledWith({
        feedbackType: 'rating',
        feedbackSource: 'user',
        aggregation: 'avg',
      });
    });
  });

  describe('GET_FEEDBACK_BREAKDOWN_ROUTE', () => {
    it('should return feedback breakdown successfully', async () => {
      const mockResult = {
        groups: [{ dimensions: { entityName: 'agent-a' }, value: 4.5 }],
      };

      (mockObservabilityStore.getFeedbackBreakdown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_FEEDBACK_BREAKDOWN.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        feedbackType: 'rating',
        groupBy: ['entityName'],
        aggregation: 'avg',
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getFeedbackBreakdown).toHaveBeenCalledWith({
        feedbackType: 'rating',
        groupBy: ['entityName'],
        aggregation: 'avg',
      });
    });
  });

  describe('GET_FEEDBACK_TIME_SERIES_ROUTE', () => {
    it('should return feedback time series successfully', async () => {
      const mockResult = {
        series: [
          {
            name: 'rating|user',
            points: [{ timestamp: new Date('2024-01-01T00:00:00Z'), value: 4.5 }],
          },
        ],
      };

      (mockObservabilityStore.getFeedbackTimeSeries as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_FEEDBACK_TIME_SERIES.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        feedbackType: 'rating',
        feedbackSource: 'user',
        interval: '1h',
        aggregation: 'avg',
        groupBy: ['entityName'],
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getFeedbackTimeSeries).toHaveBeenCalledWith({
        feedbackType: 'rating',
        feedbackSource: 'user',
        interval: '1h',
        aggregation: 'avg',
        groupBy: ['entityName'],
      });
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Feedback time series query failed');
      (mockObservabilityStore.getFeedbackTimeSeries as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        NEW_ROUTES.GET_FEEDBACK_TIME_SERIES.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          feedbackType: 'rating',
          interval: '1h',
          aggregation: 'avg',
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, "Error calling: 'get feedback time series'");
    });
  });

  describe('GET_FEEDBACK_PERCENTILES_ROUTE', () => {
    it('should return feedback percentiles successfully', async () => {
      const mockResult = {
        series: [
          {
            percentile: 0.5,
            points: [{ timestamp: new Date('2024-01-01T00:00:00Z'), value: 4.5 }],
          },
        ],
      };

      (mockObservabilityStore.getFeedbackPercentiles as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_FEEDBACK_PERCENTILES.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        feedbackType: 'rating',
        feedbackSource: 'user',
        percentiles: [0.5],
        interval: '1h',
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getFeedbackPercentiles).toHaveBeenCalledWith({
        feedbackType: 'rating',
        feedbackSource: 'user',
        percentiles: [0.5],
        interval: '1h',
      });
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Feedback percentile query failed');
      (mockObservabilityStore.getFeedbackPercentiles as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        NEW_ROUTES.GET_FEEDBACK_PERCENTILES.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          feedbackType: 'rating',
          percentiles: [0.5],
          interval: '1h',
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, "Error calling: 'get feedback percentiles'");
    });
  });

  describe('GET_METRIC_BREAKDOWN_ROUTE', () => {
    it('should return metric breakdown successfully', async () => {
      const mockResult = {
        groups: [
          { dimensions: { entityType: 'agent' }, value: 50, estimatedCost: 1.5, costUnit: 'usd' },
          { dimensions: { entityType: 'workflow_run' }, value: 30, estimatedCost: 0.9, costUnit: 'usd' },
        ],
      };

      (mockObservabilityStore.getMetricBreakdown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_METRIC_BREAKDOWN.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        name: ['latency'],
        groupBy: ['entityType'],
        aggregation: 'avg',
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getMetricBreakdown).toHaveBeenCalledWith({
        name: ['latency'],
        groupBy: ['entityType'],
        aggregation: 'avg',
      });
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        NEW_ROUTES.GET_METRIC_BREAKDOWN.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          name: ['latency'],
          groupBy: ['entityType'],
          aggregation: 'avg',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await NEW_ROUTES.GET_METRIC_BREAKDOWN.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          name: ['latency'],
          groupBy: ['entityType'],
          aggregation: 'avg',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not available');
      }
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Breakdown query failed');
      (mockObservabilityStore.getMetricBreakdown as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        NEW_ROUTES.GET_METRIC_BREAKDOWN.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          name: ['latency'],
          groupBy: ['entityType'],
          aggregation: 'avg',
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, "Error calling: 'get metric breakdown'");
    });
  });

  describe('GET_METRIC_TIME_SERIES_ROUTE', () => {
    it('should return metric time series successfully', async () => {
      const mockResult = {
        series: [
          {
            name: 'latency',
            costUnit: 'usd',
            points: [
              { timestamp: new Date('2024-01-01T00:00:00Z'), value: 100, estimatedCost: 1.0 },
              { timestamp: new Date('2024-01-01T01:00:00Z'), value: 120, estimatedCost: 1.2 },
            ],
          },
        ],
      };

      (mockObservabilityStore.getMetricTimeSeries as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_METRIC_TIME_SERIES.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        name: ['latency'],
        interval: '1h',
        aggregation: 'avg',
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getMetricTimeSeries).toHaveBeenCalledWith({
        name: ['latency'],
        interval: '1h',
        aggregation: 'avg',
      });
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should pass groupBy and filters to storage', async () => {
      const mockResult = { series: [] };

      (mockObservabilityStore.getMetricTimeSeries as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_METRIC_TIME_SERIES.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        name: ['latency'],
        interval: '5m',
        aggregation: 'sum',
        groupBy: ['entityType'],
        filters: { entityType: EntityType.AGENT },
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getMetricTimeSeries).toHaveBeenCalledWith({
        name: ['latency'],
        interval: '5m',
        aggregation: 'sum',
        groupBy: ['entityType'],
        filters: { entityType: EntityType.AGENT },
      });
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        NEW_ROUTES.GET_METRIC_TIME_SERIES.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          name: ['latency'],
          interval: '1h',
          aggregation: 'avg',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await NEW_ROUTES.GET_METRIC_TIME_SERIES.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          name: ['latency'],
          interval: '1h',
          aggregation: 'avg',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not available');
      }
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Time series query failed');
      (mockObservabilityStore.getMetricTimeSeries as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        NEW_ROUTES.GET_METRIC_TIME_SERIES.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          name: ['latency'],
          interval: '1h',
          aggregation: 'avg',
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, "Error calling: 'get metric time series'");
    });
  });

  describe('GET_METRIC_PERCENTILES_ROUTE', () => {
    it('should return metric percentiles successfully', async () => {
      const mockResult = {
        series: [
          {
            percentile: 0.5,
            points: [
              { timestamp: new Date('2024-01-01T00:00:00Z'), value: 100 },
              { timestamp: new Date('2024-01-01T01:00:00Z'), value: 110 },
            ],
          },
          {
            percentile: 0.99,
            points: [
              { timestamp: new Date('2024-01-01T00:00:00Z'), value: 500 },
              { timestamp: new Date('2024-01-01T01:00:00Z'), value: 520 },
            ],
          },
        ],
      };

      (mockObservabilityStore.getMetricPercentiles as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_METRIC_PERCENTILES.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        name: 'latency',
        percentiles: [0.5, 0.99],
        interval: '1h',
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getMetricPercentiles).toHaveBeenCalledWith({
        name: 'latency',
        percentiles: [0.5, 0.99],
        interval: '1h',
      });
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        NEW_ROUTES.GET_METRIC_PERCENTILES.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          name: 'latency',
          percentiles: [0.5, 0.99],
          interval: '1h',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await NEW_ROUTES.GET_METRIC_PERCENTILES.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          name: 'latency',
          percentiles: [0.5, 0.99],
          interval: '1h',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not available');
      }
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Percentile query failed');
      (mockObservabilityStore.getMetricPercentiles as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        NEW_ROUTES.GET_METRIC_PERCENTILES.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          name: 'latency',
          percentiles: [0.5, 0.99],
          interval: '1h',
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, "Error calling: 'get metric percentiles'");
    });
  });

  describe('GET_METRIC_NAMES_ROUTE', () => {
    it('should return metric names successfully with no params', async () => {
      const mockResult = {
        names: ['latency', 'token_count', 'error_rate'],
      };

      (mockObservabilityStore.getMetricNames as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_METRIC_NAMES.handler({
        ...createTestServerContext({ mastra: mockMastra }),
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getMetricNames).toHaveBeenCalledWith({});
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should pass prefix and limit params to storage', async () => {
      const mockResult = {
        names: ['latency_p50', 'latency_p99'],
      };

      (mockObservabilityStore.getMetricNames as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_METRIC_NAMES.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        prefix: 'latency',
        limit: 10,
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getMetricNames).toHaveBeenCalledWith({
        prefix: 'latency',
        limit: 10,
      });
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        NEW_ROUTES.GET_METRIC_NAMES.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await NEW_ROUTES.GET_METRIC_NAMES.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not available');
      }
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Discovery query failed');
      (mockObservabilityStore.getMetricNames as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        NEW_ROUTES.GET_METRIC_NAMES.handler({
          ...createTestServerContext({ mastra: mockMastra }),
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, "Error calling: 'get metric names'");
    });
  });

  describe('GET_METRIC_LABEL_KEYS_ROUTE', () => {
    it('should return metric label keys successfully', async () => {
      const mockResult = {
        keys: ['model', 'provider', 'region'],
      };

      (mockObservabilityStore.getMetricLabelKeys as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_METRIC_LABEL_KEYS.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        metricName: 'latency',
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getMetricLabelKeys).toHaveBeenCalledWith({
        metricName: 'latency',
      });
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        NEW_ROUTES.GET_METRIC_LABEL_KEYS.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          metricName: 'latency',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await NEW_ROUTES.GET_METRIC_LABEL_KEYS.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          metricName: 'latency',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not available');
      }
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Label keys query failed');
      (mockObservabilityStore.getMetricLabelKeys as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        NEW_ROUTES.GET_METRIC_LABEL_KEYS.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          metricName: 'latency',
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, "Error calling: 'get metric label keys'");
    });
  });

  describe('GET_METRIC_LABEL_VALUES_ROUTE', () => {
    it('should return metric label values successfully', async () => {
      const mockResult = {
        values: ['gpt-4', 'gpt-3.5-turbo', 'claude-3'],
      };

      (mockObservabilityStore.getMetricLabelValues as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_METRIC_LABEL_VALUES.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        metricName: 'latency',
        labelKey: 'model',
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getMetricLabelValues).toHaveBeenCalledWith({
        metricName: 'latency',
        labelKey: 'model',
      });
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should pass optional prefix and limit to storage', async () => {
      const mockResult = {
        values: ['gpt-4', 'gpt-3.5-turbo'],
      };

      (mockObservabilityStore.getMetricLabelValues as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_METRIC_LABEL_VALUES.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        metricName: 'latency',
        labelKey: 'model',
        prefix: 'gpt',
        limit: 5,
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getMetricLabelValues).toHaveBeenCalledWith({
        metricName: 'latency',
        labelKey: 'model',
        prefix: 'gpt',
        limit: 5,
      });
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        NEW_ROUTES.GET_METRIC_LABEL_VALUES.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          metricName: 'latency',
          labelKey: 'model',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await NEW_ROUTES.GET_METRIC_LABEL_VALUES.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
          metricName: 'latency',
          labelKey: 'model',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not available');
      }
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Label values query failed');
      (mockObservabilityStore.getMetricLabelValues as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        NEW_ROUTES.GET_METRIC_LABEL_VALUES.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          metricName: 'latency',
          labelKey: 'model',
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, "Error calling: 'get label values'");
    });
  });

  describe('GET_ENTITY_TYPES_ROUTE', () => {
    it('should return entity types successfully', async () => {
      const mockResult = {
        entityTypes: ['agent', 'workflow_run', 'tool'],
      };

      (mockObservabilityStore.getEntityTypes as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_ENTITY_TYPES.handler({
        ...createTestServerContext({ mastra: mockMastra }),
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getEntityTypes).toHaveBeenCalledWith({});
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        NEW_ROUTES.GET_ENTITY_TYPES.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await NEW_ROUTES.GET_ENTITY_TYPES.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not available');
      }
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Entity types query failed');
      (mockObservabilityStore.getEntityTypes as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        NEW_ROUTES.GET_ENTITY_TYPES.handler({
          ...createTestServerContext({ mastra: mockMastra }),
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, "Error calling: 'get entity types'");
    });
  });

  describe('GET_ENTITY_NAMES_ROUTE', () => {
    it('should return entity names successfully with no params', async () => {
      const mockResult = {
        names: ['my-agent', 'my-workflow', 'other-agent'],
      };

      (mockObservabilityStore.getEntityNames as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_ENTITY_NAMES.handler({
        ...createTestServerContext({ mastra: mockMastra }),
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getEntityNames).toHaveBeenCalledWith({});
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should pass entityType filter to storage', async () => {
      const mockResult = {
        names: ['my-agent', 'other-agent'],
      };

      (mockObservabilityStore.getEntityNames as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_ENTITY_NAMES.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        entityType: 'agent',
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getEntityNames).toHaveBeenCalledWith({
        entityType: 'agent',
      });
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        NEW_ROUTES.GET_ENTITY_NAMES.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await NEW_ROUTES.GET_ENTITY_NAMES.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not available');
      }
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Entity names query failed');
      (mockObservabilityStore.getEntityNames as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        NEW_ROUTES.GET_ENTITY_NAMES.handler({
          ...createTestServerContext({ mastra: mockMastra }),
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, "Error calling: 'get entity names'");
    });
  });

  describe('GET_SERVICE_NAMES_ROUTE', () => {
    it('should return service names successfully', async () => {
      const mockResult = {
        serviceNames: ['api-gateway', 'worker-service', 'auth-service'],
      };

      (mockObservabilityStore.getServiceNames as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_SERVICE_NAMES.handler({
        ...createTestServerContext({ mastra: mockMastra }),
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getServiceNames).toHaveBeenCalledWith({});
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        NEW_ROUTES.GET_SERVICE_NAMES.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await NEW_ROUTES.GET_SERVICE_NAMES.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not available');
      }
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Service names query failed');
      (mockObservabilityStore.getServiceNames as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        NEW_ROUTES.GET_SERVICE_NAMES.handler({
          ...createTestServerContext({ mastra: mockMastra }),
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, "Error calling: 'get service names'");
    });
  });

  describe('GET_ENVIRONMENTS_ROUTE', () => {
    it('should return environments successfully', async () => {
      const mockResult = {
        environments: ['production', 'staging', 'development'],
      };

      (mockObservabilityStore.getEnvironments as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_ENVIRONMENTS.handler({
        ...createTestServerContext({ mastra: mockMastra }),
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getEnvironments).toHaveBeenCalledWith({});
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        NEW_ROUTES.GET_ENVIRONMENTS.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await NEW_ROUTES.GET_ENVIRONMENTS.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not available');
      }
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Environments query failed');
      (mockObservabilityStore.getEnvironments as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        NEW_ROUTES.GET_ENVIRONMENTS.handler({
          ...createTestServerContext({ mastra: mockMastra }),
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, "Error calling: 'get environments'");
    });
  });

  describe('GET_TAGS_ROUTE', () => {
    it('should return tags successfully with no params', async () => {
      const mockResult = {
        tags: ['production', 'high-priority', 'experiment-a'],
      };

      (mockObservabilityStore.getTags as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_TAGS.handler({
        ...createTestServerContext({ mastra: mockMastra }),
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getTags).toHaveBeenCalledWith({});
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should pass entityType filter to storage', async () => {
      const mockResult = {
        tags: ['agent-tag-1', 'agent-tag-2'],
      };

      (mockObservabilityStore.getTags as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await NEW_ROUTES.GET_TAGS.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        entityType: 'agent',
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getTags).toHaveBeenCalledWith({
        entityType: 'agent',
      });
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        NEW_ROUTES.GET_TAGS.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await NEW_ROUTES.GET_TAGS.handler({
          ...createTestServerContext({ mastra: mastraWithoutStorage }),
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not available');
      }
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Tags query failed');
      (mockObservabilityStore.getTags as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        NEW_ROUTES.GET_TAGS.handler({
          ...createTestServerContext({ mastra: mockMastra }),
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, "Error calling: 'get tags'");
    });
  });
});
