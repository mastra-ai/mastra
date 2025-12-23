import { createSampleScore } from '@internal/storage-test-utils';
import { Mastra } from '@mastra/core/mastra';
import type { MastraStorage, TraceRecord } from '@mastra/core/storage';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import * as errorHandler from './error';
import {
  getTraceHandler,
  getTracesPaginatedHandler,
  GET_TRACES_PAGINATED_ROUTE,
  listScoresBySpan,
  scoreTracesHandler,
} from './observability';
import { createTestServerContext } from './test-utils';

// Mock scoreTraces
vi.mock('@mastra/core/evals/scoreTraces', () => ({
  scoreTraces: vi.fn(),
}));

// Mock the error handler
vi.mock('./error', () => ({
  handleError: vi.fn(error => {
    throw error; // Re-throw for testing, or return error response as needed
  }),
}));

// Mock Mastra instance
const createMockMastra = (storage?: Partial<MastraStorage>): Mastra =>
  ({
    getStorage: vi.fn(() => storage as MastraStorage),
    getScorerById: vi.fn(),
    getLogger: vi.fn(() => ({ warn: vi.fn(), error: vi.fn() })),
  }) as any;

// Mock observability store
const createMockObservabilityStore = () => ({
  getTrace: vi.fn(),
  getTracesPaginated: vi.fn(),
});

// Mock scores store
const createMockScoresStore = () => ({
  listScoresBySpan: vi.fn(),
});

// Mock storage instance with getStore pattern
const createMockStorage = (
  observabilityStore = createMockObservabilityStore(),
  scoresStore = createMockScoresStore(),
): Partial<MastraStorage> => ({
  getStore: vi.fn((domain: string) => {
    if (domain === 'observability') return Promise.resolve(observabilityStore);
    if (domain === 'scores') return Promise.resolve(scoresStore);
    return Promise.resolve(undefined);
  }),
});

describe('Observability Handlers', () => {
  let mockObservabilityStore: ReturnType<typeof createMockObservabilityStore>;
  let mockScoresStore: ReturnType<typeof createMockScoresStore>;
  let mockStorage: ReturnType<typeof createMockStorage>;
  let mockMastra: Mastra;
  let handleErrorSpy: ReturnType<typeof vi.mocked<typeof errorHandler.handleError>>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockObservabilityStore = createMockObservabilityStore();
    mockScoresStore = createMockScoresStore();
    mockStorage = createMockStorage(mockObservabilityStore, mockScoresStore);
    mockMastra = createMockMastra(mockStorage);
    handleErrorSpy = vi.mocked(errorHandler.handleError);
    handleErrorSpy.mockImplementation(error => {
      throw error;
    });
  });

  describe('getTraceHandler', () => {
    it('should return trace when found', async () => {
      const mockTrace: TraceRecord = {
        traceId: 'test-trace-123',
        spans: [],
      };

      (mockObservabilityStore.getTrace as any).mockResolvedValue(mockTrace);

      const result = await getTraceHandler({
        mastra: mockMastra,
        traceId: 'test-trace-123',
      });

      expect(result).toEqual(mockTrace);
      expect(mockObservabilityStore.getTrace).toHaveBeenCalledWith('test-trace-123');
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should throw 404 when trace not found', async () => {
      (mockObservabilityStore.getTrace as any).mockResolvedValue(null);

      await expect(
        getTraceHandler({
          mastra: mockMastra,
          traceId: 'non-existent-trace',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await getTraceHandler({
          mastra: mockMastra,
          traceId: 'non-existent-trace',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect(error.status).toBe(404);
        expect(error.message).toBe("Trace with ID 'non-existent-trace' not found");
      }
    });

    it('should throw 400 when traceId is empty string', async () => {
      await expect(
        getTraceHandler({
          mastra: mockMastra,
          traceId: '',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await getTraceHandler({
          mastra: mockMastra,
          traceId: '',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect(error.status).toBe(400);
        expect(error.message).toBe('Trace ID is required');
      }
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        getTraceHandler({
          mastra: mastraWithoutStorage,
          traceId: 'test-trace-123',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await getTraceHandler({
          mastra: mastraWithoutStorage,
          traceId: 'test-trace-123',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect(error.status).toBe(500);
        expect(error.message).toBe('Storage is not available');
      }
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Database connection failed');
      (mockObservabilityStore.getTrace as any).mockRejectedValue(storageError);

      await expect(
        getTraceHandler({
          mastra: mockMastra,
          traceId: 'test-trace-123',
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, 'Error getting trace');
    });
  });

  describe('getTracesPaginatedHandler', () => {
    it('should return paginated results with valid parameters', async () => {
      const mockResult = {
        traces: [],
        totalItems: 0,
        totalPages: 0,
        currentPage: 1,
        perPage: 10,
      };

      (mockObservabilityStore.getTracesPaginated as any).mockResolvedValue(mockResult);

      const result = await getTracesPaginatedHandler({
        mastra: mockMastra,
        filters: { name: 'test' },
        pagination: { page: 1, perPage: 10 },
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getTracesPaginated).toHaveBeenCalledWith({
        filters: { name: 'test' },
        pagination: { page: 1, perPage: 10 },
      });
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should work without filters or pagination', async () => {
      const mockResult = {
        traces: [],
        totalItems: 0,
        totalPages: 0,
        currentPage: 1,
        perPage: 20,
      };

      (mockObservabilityStore.getTracesPaginated as any).mockResolvedValue(mockResult);

      const result = await getTracesPaginatedHandler({
        mastra: mockMastra,
      });

      expect(result).toEqual(mockResult);
      expect(mockObservabilityStore.getTracesPaginated).toHaveBeenCalledWith({});
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        getTracesPaginatedHandler({
          mastra: mastraWithoutStorage,
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await getTracesPaginatedHandler({
          mastra: mastraWithoutStorage,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect(error.status).toBe(500);
        expect(error.message).toBe('Storage is not available');
      }
    });

    describe('pagination validation', () => {
      it('should throw 400 when page is negative', async () => {
        await expect(
          getTracesPaginatedHandler({
            mastra: mockMastra,
            pagination: { page: -1, perPage: 10 },
          }),
        ).rejects.toThrow(HTTPException);

        try {
          await getTracesPaginatedHandler({
            mastra: mockMastra,
            pagination: { page: -1, perPage: 10 },
          });
        } catch (error) {
          expect(error).toBeInstanceOf(HTTPException);
          expect(error.status).toBe(400);
          expect(error.message).toBe('Page must be a non-negative integer');
        }
      });

      it('should throw 400 when perPage is negative', async () => {
        await expect(
          getTracesPaginatedHandler({
            mastra: mockMastra,
            pagination: { page: 1, perPage: -1 },
          }),
        ).rejects.toThrow(HTTPException);

        try {
          await getTracesPaginatedHandler({
            mastra: mockMastra,
            pagination: { page: 1, perPage: -1 },
          });
        } catch (error) {
          expect(error).toBeInstanceOf(HTTPException);
          expect(error.status).toBe(400);
          expect(error.message).toBe('Per page must be a non-negative integer');
        }
      });

      it('should allow page and perPage of 0', async () => {
        const mockResult = { traces: [], totalItems: 0, totalPages: 0, currentPage: 0, perPage: 0 };
        (mockObservabilityStore.getTracesPaginated as any).mockResolvedValue(mockResult);

        const result = await getTracesPaginatedHandler({
          mastra: mockMastra,
          pagination: { page: 0, perPage: 0 },
        });

        expect(result).toEqual(mockResult);
        expect(mockObservabilityStore.getTracesPaginated).toHaveBeenCalledWith({
          pagination: { page: 0, perPage: 0 },
        });
      });
    });

    describe('date range validation', () => {
      it('should accept valid Date objects', async () => {
        const mockResult = { traces: [], totalItems: 0, totalPages: 0, currentPage: 1, perPage: 10 };
        (mockObservabilityStore.getTracesPaginated as any).mockResolvedValue(mockResult);

        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-01-31');

        const result = await getTracesPaginatedHandler({
          mastra: mockMastra,
          filters: {},
          pagination: {
            dateRange: { start: startDate, end: endDate },
            page: 1,
            perPage: 10,
          },
        });

        expect(result).toEqual(mockResult);
        expect(mockObservabilityStore.getTracesPaginated).toHaveBeenCalledWith({
          filters: {},
          pagination: {
            dateRange: { start: startDate, end: endDate },
            page: 1,
            perPage: 10,
          },
        });
      });

      it('should throw 400 when start date is invalid', async () => {
        await expect(
          getTracesPaginatedHandler({
            mastra: mockMastra,
            pagination: {
              dateRange: { start: 'invalid-date' as any },
              page: 1,
              perPage: 10,
            },
          }),
        ).rejects.toThrow(HTTPException);

        try {
          await getTracesPaginatedHandler({
            mastra: mockMastra,
            pagination: {
              dateRange: { start: 'invalid-date' as any },
              page: 1,
              perPage: 10,
            },
          });
        } catch (error) {
          expect(error).toBeInstanceOf(HTTPException);
          expect(error.status).toBe(400);
          expect(error.message).toBe('Invalid date format in date range');
        }
      });

      it('should throw 400 when end date is invalid', async () => {
        await expect(
          getTracesPaginatedHandler({
            mastra: mockMastra,
            pagination: {
              dateRange: { end: 'invalid-date' as any },
              page: 1,
              perPage: 10,
            },
          }),
        ).rejects.toThrow(HTTPException);

        try {
          await getTracesPaginatedHandler({
            mastra: mockMastra,
            pagination: {
              dateRange: { end: 'invalid-date' as any },
              page: 1,
              perPage: 10,
            },
          });
        } catch (error) {
          expect(error).toBeInstanceOf(HTTPException);
          expect(error.status).toBe(400);
          expect(error.message).toBe('Invalid date format in date range');
        }
      });

      it('should handle dateRange from JSON query parameter (route-level test)', async () => {
        const mockResult = {
          traces: [],
          totalItems: 0,
          totalPages: 0,
          currentPage: 1,
          perPage: 10,
        };

        (mockObservabilityStore.getTracesPaginated as any).mockResolvedValue(mockResult);

        // Simulate how the route receives dateRange as JSON string from query params
        const dateRangeJson = JSON.stringify({
          start: '2024-01-01T00:00:00.000Z',
          end: '2024-01-31T23:59:59.999Z',
        });

        const result = await GET_TRACES_PAGINATED_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          page: 1,
          perPage: 10,
          dateRange: dateRangeJson,
        });

        expect(result).toEqual(mockResult);
        // After the fix, this should be called with properly converted Date objects
        expect(mockObservabilityStore.getTracesPaginated).toHaveBeenCalled();
      });
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Database query failed');
      (mockObservabilityStore.getTracesPaginated as any).mockRejectedValue(storageError);

      await expect(
        getTracesPaginatedHandler({
          mastra: mockMastra,
        }),
      ).rejects.toThrow();
    });
  });

  describe('scoreTracesHandler', () => {
    let scoreTracesMock: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      const scoresModule = vi.mocked(await import('@mastra/core/evals/scoreTraces'));
      scoreTracesMock = scoresModule.scoreTraces as any;
      scoreTracesMock.mockClear();
    });

    it('should score traces successfully with valid request', async () => {
      (mockMastra.getScorerById as any).mockReturnValue({
        config: {
          id: 'test-scorer',
          name: 'test-scorer',
        },
      });
      scoreTracesMock.mockResolvedValue(undefined);

      const requestBody = {
        scorerName: 'test-scorer',
        targets: [{ traceId: 'trace-123' }, { traceId: 'trace-456' }],
      };

      const result = await scoreTracesHandler({
        mastra: mockMastra,
        ...requestBody,
      });

      expect(result).toEqual({
        message: 'Scoring started for 2 traces',
        traceCount: 2,
        status: 'success',
      });

      expect(mockMastra.getScorerById).toHaveBeenCalledWith('test-scorer');
      expect(scoreTracesMock).toHaveBeenCalledWith({
        scorerId: 'test-scorer',
        targets: requestBody.targets,
        mastra: mockMastra,
      });
    });

    it('should throw 400 when scorerId is missing', async () => {
      await expect(
        scoreTracesHandler({
          mastra: mockMastra,
          // @ts-ignore - expected to throw
          body: {
            targets: [{ traceId: 'trace-123' }],
          },
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await scoreTracesHandler({
          mastra: mockMastra,
          // @ts-ignore - expect to return 400
          body: {
            targets: [{ traceId: 'trace-123' }],
          },
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect(error.status).toBe(400);
        expect(error.message).toBe('Scorer ID is required');
      }
    });

    it('should throw 400 when targets array is empty', async () => {
      await expect(
        scoreTracesHandler({
          mastra: mockMastra,
          scorerName: 'test-scorer',
          targets: [],
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await scoreTracesHandler({
          mastra: mockMastra,
          scorerName: 'test-scorer',
          targets: [],
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect(error.status).toBe(400);
        expect(error.message).toBe('At least one target is required');
      }
    });

    it('should throw 404 when scorer is not found', async () => {
      (mockMastra.getScorerById as any).mockReturnValue(null);

      await expect(
        scoreTracesHandler({
          mastra: mockMastra,
          scorerName: 'non-existent-scorer',
          targets: [{ traceId: 'trace-123' }],
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await scoreTracesHandler({
          mastra: mockMastra,
          scorerName: 'non-existent-scorer',
          targets: [{ traceId: 'trace-123' }],
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect(error.status).toBe(404);
        expect(error.message).toBe("Scorer 'non-existent-scorer' not found");
      }
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        scoreTracesHandler({
          mastra: mastraWithoutStorage,
          scorerName: 'test-scorer',
          targets: [{ traceId: 'trace-123' }],
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await scoreTracesHandler({
          mastra: mastraWithoutStorage,
          scorerName: 'test-scorer',
          targets: [{ traceId: 'trace-123' }],
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect(error.status).toBe(500);
        expect(error.message).toBe('Storage is not available');
      }
    });

    it('should handle scoreTraces errors gracefully', async () => {
      (mockMastra.getScorerById as any).mockReturnValue({
        config: {
          id: 'test-scorer',
          name: 'test-scorer',
        },
      });

      const processingError = new Error('Processing failed');
      scoreTracesMock.mockRejectedValue(processingError);

      // Should still return success response since processing is fire-and-forget
      const result = await scoreTracesHandler({
        mastra: mockMastra,
        scorerName: 'test-scorer',
        targets: [{ traceId: 'trace-123' }],
      });

      expect(result).toEqual({
        message: 'Scoring started for 1 trace',
        traceCount: 1,
        status: 'success',
      });
    });
  });

  describe('listScoresBySpan', () => {
    it('should get scores by span successfully', async () => {
      const mockScores = [
        createSampleScore({ traceId: 'test-trace-1', spanId: 'test-span-1', scorerId: 'test-scorer' }),
      ];
      const pagination = { page: 0, perPage: 10 };

      // Mock the scores store method to return our test data
      (mockScoresStore.listScoresBySpan as any).mockResolvedValue({
        scores: mockScores,
        pagination: {
          total: 1,
          page: 0,
          perPage: 10,
          hasMore: false,
        },
      });

      const result = await listScoresBySpan({
        mastra: mockMastra,
        traceId: 'test-trace-1',
        spanId: 'test-span-1',
        ...pagination,
      });

      expect(mockScoresStore.listScoresBySpan).toHaveBeenCalledWith({
        traceId: 'test-trace-1',
        spanId: 'test-span-1',
        pagination,
      });

      expect(result.scores).toHaveLength(1);

      expect(result.pagination).toEqual({
        total: 1,
        page: 0,
        perPage: 10,
        hasMore: false,
      });
    });

    it('should throw an error when storage method is not available', async () => {
      const pagination = { page: 0, perPage: 10 };
      const mastraWithoutStorage = new Mastra({
        logger: false,
      });

      await expect(
        listScoresBySpan({
          mastra: mastraWithoutStorage,
          traceId: 'test-trace-1',
          spanId: 'test-span-1',
          ...pagination,
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should handle API errors with status codes', async () => {
      const pagination = { page: 0, perPage: 10 };
      const apiError = {
        message: 'Span not found',
        status: 404,
      };

      (mockScoresStore.listScoresBySpan as any).mockRejectedValue(apiError);

      try {
        await listScoresBySpan({
          mastra: mockMastra,
          traceId: 'test-trace-1',
          spanId: 'test-span-1',
          ...pagination,
        });
      } catch (error) {
        expect(error.status).toBe(404);
        expect(error.message).toBe('Span not found');
      }
    });

    it('should throw error when traceId is missing', async () => {
      const pagination = { page: 0, perPage: 10 };

      await expect(
        listScoresBySpan({
          mastra: mockMastra,
          traceId: '',
          spanId: 'test-span-1',
          ...pagination,
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should throw error when spanId is missing', async () => {
      const pagination = { page: 0, perPage: 10 };

      await expect(
        listScoresBySpan({
          mastra: mockMastra,
          traceId: 'test-trace-1',
          spanId: '',
          ...pagination,
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should throw error when both traceId and spanId are missing', async () => {
      const pagination = { page: 0, perPage: 10 };

      await expect(
        listScoresBySpan({
          mastra: mockMastra,
          traceId: '',
          spanId: '',
          ...pagination,
        }),
      ).rejects.toThrow(HTTPException);
    });
  });
});
