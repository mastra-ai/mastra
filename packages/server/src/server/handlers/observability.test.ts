import { createSampleScore } from '@internal/storage-test-utils';
import type { Mastra } from '@mastra/core/mastra';
import { SpanType } from '@mastra/core/observability';
import type { MastraStorage, TraceRecord, SpanRecord } from '@mastra/core/storage';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import * as errorHandler from './error';
import { LIST_TRACES_ROUTE, GET_TRACE_ROUTE, SCORE_TRACES_ROUTE, LIST_SCORES_BY_SPAN_ROUTE } from './observability';
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

// Mock Mastra instance
const createMockMastra = (storage?: Partial<MastraStorage>): Mastra =>
  ({
    getStorage: vi.fn(() => storage as MastraStorage),
    getScorerById: vi.fn(),
    getLogger: vi.fn(() => ({ warn: vi.fn(), error: vi.fn() })),
  }) as unknown as Mastra;

// Mock storage instance
const createMockStorage = (): Partial<MastraStorage> => ({
  getTrace: vi.fn(),
  listTraces: vi.fn(),
  listScoresBySpan: vi.fn(),
});

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
  isEvent: false,
  startedAt: new Date('2024-01-01T00:00:00Z'),
  endedAt: new Date('2024-01-01T00:01:00Z'),
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: null,
  ...overrides,
});

describe('Observability Route Handlers', () => {
  let mockStorage: ReturnType<typeof createMockStorage>;
  let mockMastra: Mastra;
  let handleErrorSpy: ReturnType<typeof vi.mocked<typeof errorHandler.handleError>>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = createMockStorage();
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

      (mockStorage.getTrace as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrace);

      const result = await GET_TRACE_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        traceId: 'test-trace-123',
      });

      expect(result).toEqual(mockTrace);
      expect(mockStorage.getTrace).toHaveBeenCalledWith({ traceId: 'test-trace-123' });
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should throw 404 when trace not found', async () => {
      (mockStorage.getTrace as ReturnType<typeof vi.fn>).mockResolvedValue(null);

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
      (mockStorage.getTrace as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

      await expect(
        GET_TRACE_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          traceId: 'test-trace-123',
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, 'Error getting trace');
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

      (mockStorage.listTraces as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await LIST_TRACES_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
      });

      expect(result).toEqual(mockResult);
      expect(mockStorage.listTraces).toHaveBeenCalledWith({
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

      (mockStorage.listTraces as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await LIST_TRACES_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        entityType: 'AGENT',
        page: 1,
        perPage: 10,
        field: 'startedAt',
        direction: 'DESC',
      });

      expect(result).toEqual(mockResult);
      expect(mockStorage.listTraces).toHaveBeenCalledWith({
        filters: { entityType: 'AGENT' },
        pagination: { page: 1, perPage: 10 },
        orderBy: { field: 'startedAt', direction: 'DESC' },
      });
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
      (mockStorage.listTraces as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

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

      (mockStorage.listScoresBySpan as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await LIST_SCORES_BY_SPAN_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        traceId: 'test-trace-1',
        spanId: 'test-span-1',
        page: 0,
        perPage: 10,
      });

      expect(mockStorage.listScoresBySpan).toHaveBeenCalledWith({
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
      (mockStorage.listScoresBySpan as ReturnType<typeof vi.fn>).mockRejectedValue(storageError);

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
});
