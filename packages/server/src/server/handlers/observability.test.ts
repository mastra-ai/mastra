import type { Mastra } from '@mastra/core/mastra';
import type { MastraStorage, AITraceRecord } from '@mastra/core/storage';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import * as errorHandler from './error';
import { getAITraceHandler, getAITracesPaginatedHandler, scoreTracesHandler } from './observability';

// Mock processTraceScoring
vi.mock('@mastra/core/scores', () => ({
  processTraceScoring: vi.fn(),
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
    getScorerByName: vi.fn(),
    getLogger: vi.fn(() => ({ warn: vi.fn(), error: vi.fn() })),
  }) as any;

// Mock storage instance
const createMockStorage = (): Partial<MastraStorage> => ({
  getAITrace: vi.fn(),
  getAITracesPaginated: vi.fn(),
});

describe('Observability Handlers', () => {
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

  describe('getAITraceHandler', () => {
    it('should return trace when found', async () => {
      const mockTrace: AITraceRecord = {
        traceId: 'test-trace-123',
        spans: [],
      };

      (mockStorage.getAITrace as any).mockResolvedValue(mockTrace);

      const result = await getAITraceHandler({
        mastra: mockMastra,
        traceId: 'test-trace-123',
      });

      expect(result).toEqual(mockTrace);
      expect(mockStorage.getAITrace).toHaveBeenCalledWith('test-trace-123');
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should throw 404 when trace not found', async () => {
      (mockStorage.getAITrace as any).mockResolvedValue(null);

      await expect(
        getAITraceHandler({
          mastra: mockMastra,
          traceId: 'non-existent-trace',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await getAITraceHandler({
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
        getAITraceHandler({
          mastra: mockMastra,
          traceId: '',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await getAITraceHandler({
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
        getAITraceHandler({
          mastra: mastraWithoutStorage,
          traceId: 'test-trace-123',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await getAITraceHandler({
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
      (mockStorage.getAITrace as any).mockRejectedValue(storageError);

      await expect(
        getAITraceHandler({
          mastra: mockMastra,
          traceId: 'test-trace-123',
        }),
      ).rejects.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(storageError, 'Error getting AI trace');
    });
  });

  describe('getAITracesPaginatedHandler', () => {
    it('should return paginated results with valid parameters', async () => {
      const mockResult = {
        traces: [],
        totalItems: 0,
        totalPages: 0,
        currentPage: 1,
        perPage: 10,
      };

      (mockStorage.getAITracesPaginated as any).mockResolvedValue(mockResult);

      const result = await getAITracesPaginatedHandler({
        mastra: mockMastra,
        body: {
          filters: { name: 'test' },
          pagination: { page: 1, perPage: 10 },
        },
      });

      expect(result).toEqual(mockResult);
      expect(mockStorage.getAITracesPaginated).toHaveBeenCalledWith({
        filters: { name: 'test' },
        pagination: { page: 1, perPage: 10 },
      });
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('should work with minimal body parameters', async () => {
      const mockResult = {
        traces: [],
        totalItems: 0,
        totalPages: 0,
        currentPage: 1,
        perPage: 20,
      };

      (mockStorage.getAITracesPaginated as any).mockResolvedValue(mockResult);

      const result = await getAITracesPaginatedHandler({
        mastra: mockMastra,
        body: {
          filters: {},
          pagination: {},
        },
      });

      expect(result).toEqual(mockResult);
      expect(mockStorage.getAITracesPaginated).toHaveBeenCalledWith({
        filters: {},
        pagination: {},
      });
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        getAITracesPaginatedHandler({
          mastra: mastraWithoutStorage,
          body: { filters: {}, pagination: {} },
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await getAITracesPaginatedHandler({
          mastra: mastraWithoutStorage,
          body: { filters: {}, pagination: {} },
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect(error.status).toBe(500);
        expect(error.message).toBe('Storage is not available');
      }
    });

    it('should throw 400 when body is missing', async () => {
      await expect(
        getAITracesPaginatedHandler({
          mastra: mockMastra,
          // body is undefined
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await getAITracesPaginatedHandler({
          mastra: mockMastra,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect(error.status).toBe(400);
        expect(error.message).toBe('Request body is required');
      }
    });

    describe('pagination validation', () => {
      it('should throw 400 when page is negative', async () => {
        await expect(
          getAITracesPaginatedHandler({
            mastra: mockMastra,
            body: {
              filters: {},
              pagination: { page: -1, perPage: 10 },
            },
          }),
        ).rejects.toThrow(HTTPException);

        try {
          await getAITracesPaginatedHandler({
            mastra: mockMastra,
            body: {
              filters: {},
              pagination: { page: -1, perPage: 10 },
            },
          });
        } catch (error) {
          expect(error).toBeInstanceOf(HTTPException);
          expect(error.status).toBe(400);
          expect(error.message).toBe('Page must be a non-negative integer');
        }
      });

      it('should throw 400 when perPage is negative', async () => {
        await expect(
          getAITracesPaginatedHandler({
            mastra: mockMastra,
            body: {
              filters: {},
              pagination: { page: 1, perPage: -1 },
            },
          }),
        ).rejects.toThrow(HTTPException);

        try {
          await getAITracesPaginatedHandler({
            mastra: mockMastra,
            body: {
              filters: {},
              pagination: { page: 1, perPage: -1 },
            },
          });
        } catch (error) {
          expect(error).toBeInstanceOf(HTTPException);
          expect(error.status).toBe(400);
          expect(error.message).toBe('Per page must be a non-negative integer');
        }
      });

      it('should allow page and perPage of 0', async () => {
        const mockResult = { traces: [], totalItems: 0, totalPages: 0, currentPage: 0, perPage: 0 };
        (mockStorage.getAITracesPaginated as any).mockResolvedValue(mockResult);

        const result = await getAITracesPaginatedHandler({
          mastra: mockMastra,
          body: {
            filters: {},
            pagination: { page: 0, perPage: 0 },
          },
        });

        expect(result).toEqual(mockResult);
        expect(mockStorage.getAITracesPaginated).toHaveBeenCalledWith({
          filters: {},
          pagination: { page: 0, perPage: 0 },
        });
      });
    });

    describe('date range validation', () => {
      it('should accept valid Date objects', async () => {
        const mockResult = { traces: [], totalItems: 0, totalPages: 0, currentPage: 1, perPage: 10 };
        (mockStorage.getAITracesPaginated as any).mockResolvedValue(mockResult);

        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-01-31');

        const result = await getAITracesPaginatedHandler({
          mastra: mockMastra,
          body: {
            filters: {},
            pagination: {
              dateRange: { start: startDate, end: endDate },
              page: 1,
              perPage: 10,
            },
          },
        });

        expect(result).toEqual(mockResult);
        expect(mockStorage.getAITracesPaginated).toHaveBeenCalledWith({
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
          getAITracesPaginatedHandler({
            mastra: mockMastra,
            body: {
              filters: {},
              pagination: {
                dateRange: { start: 'invalid-date' as any },
                page: 1,
                perPage: 10,
              },
            },
          }),
        ).rejects.toThrow(HTTPException);

        try {
          await getAITracesPaginatedHandler({
            mastra: mockMastra,
            body: {
              filters: {},
              pagination: {
                dateRange: { start: 'invalid-date' as any },
                page: 1,
                perPage: 10,
              },
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
          getAITracesPaginatedHandler({
            mastra: mockMastra,
            body: {
              filters: {},
              pagination: {
                dateRange: { end: 'invalid-date' as any },
                page: 1,
                perPage: 10,
              },
            },
          }),
        ).rejects.toThrow(HTTPException);

        try {
          await getAITracesPaginatedHandler({
            mastra: mockMastra,
            body: {
              filters: {},
              pagination: {
                dateRange: { end: 'invalid-date' as any },
                page: 1,
                perPage: 10,
              },
            },
          });
        } catch (error) {
          expect(error).toBeInstanceOf(HTTPException);
          expect(error.status).toBe(400);
          expect(error.message).toBe('Invalid date format in date range');
        }
      });
    });

    it('should call handleError when storage throws', async () => {
      const storageError = new Error('Database query failed');
      (mockStorage.getAITracesPaginated as any).mockRejectedValue(storageError);

      await expect(
        getAITracesPaginatedHandler({
          mastra: mockMastra,
          body: { filters: {}, pagination: {} },
        }),
      ).rejects.toThrow();
    });
  });

  describe('scoreTracesHandler', () => {
    let processTraceScoringMock: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      const scoresModule = vi.mocked(await import('@mastra/core/scores'));
      processTraceScoringMock = scoresModule.processTraceScoring as any;
      processTraceScoringMock.mockClear();
    });

    it('should score traces successfully with valid request', async () => {
      const mockScorer = { name: 'test-scorer', run: vi.fn() };
      (mockMastra.getScorerByName as any).mockReturnValue(mockScorer);
      processTraceScoringMock.mockResolvedValue(undefined);

      const requestBody = {
        scorerName: 'test-scorer',
        targets: [{ traceId: 'trace-123' }, { traceId: 'trace-456' }],
      };

      const result = await scoreTracesHandler({
        mastra: mockMastra,
        body: requestBody,
      });

      expect(result).toEqual({
        message: 'Scoring started for 2 traces',
        traceCount: 2,
        status: 'initiated',
      });

      expect(mockMastra.getScorerByName).toHaveBeenCalledWith('test-scorer');
      expect(processTraceScoringMock).toHaveBeenCalledWith({
        scorer: mockScorer,
        targets: requestBody.targets,
        storage: mockStorage,
        logger: expect.any(Object),
      });
    });

    it('should throw 400 when request body is missing', async () => {
      await expect(
        scoreTracesHandler({
          mastra: mockMastra,
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await scoreTracesHandler({
          mastra: mockMastra,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect(error.status).toBe(400);
        expect(error.message).toBe('Request body is required');
      }
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
          body: {
            scorerName: 'test-scorer',
            targets: [],
          },
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await scoreTracesHandler({
          mastra: mockMastra,
          body: {
            scorerName: 'test-scorer',
            targets: [],
          },
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect(error.status).toBe(400);
        expect(error.message).toBe('At least one target is required');
      }
    });

    it('should throw 404 when scorer is not found', async () => {
      (mockMastra.getScorerByName as any).mockReturnValue(null);

      await expect(
        scoreTracesHandler({
          mastra: mockMastra,
          body: {
            scorerName: 'non-existent-scorer',
            targets: [{ traceId: 'trace-123' }],
          },
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await scoreTracesHandler({
          mastra: mockMastra,
          body: {
            scorerName: 'non-existent-scorer',
            targets: [{ traceId: 'trace-123' }],
          },
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
          body: {
            scorerName: 'test-scorer',
            targets: [{ traceId: 'trace-123' }],
          },
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await scoreTracesHandler({
          mastra: mastraWithoutStorage,
          body: {
            scorerName: 'test-scorer',
            targets: [{ traceId: 'trace-123' }],
          },
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect(error.status).toBe(500);
        expect(error.message).toBe('Storage is not available');
      }
    });

    it('should handle processTraceScoring errors gracefully', async () => {
      const mockScorer = { name: 'test-scorer', run: vi.fn() };
      (mockMastra.getScorerByName as any).mockReturnValue(mockScorer);

      const processingError = new Error('Processing failed');
      processTraceScoringMock.mockRejectedValue(processingError);

      // Should still return success response since processing is fire-and-forget
      const result = await scoreTracesHandler({
        mastra: mockMastra,
        body: {
          scorerName: 'test-scorer',
          targets: [{ traceId: 'trace-123' }],
        },
      });

      expect(result).toEqual({
        message: 'Scoring started for 1 traces',
        traceCount: 1,
        status: 'initiated',
      });
    });
  });
});
