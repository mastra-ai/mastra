import { createSampleScore, createRootSpan } from '@internal/storage-test-utils';
import { createScorer } from '@mastra/core/evals';
import { Mastra } from '@mastra/core/mastra';
import type { ObservabilityStorageBase, EvalsStorageBase } from '@mastra/core/storage';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import { getTraceHandler, getTracesPaginatedHandler, listScoresBySpan, scoreTracesHandler } from './observability';

// Mock scoreTraces - this is an external async function that runs in background
vi.mock('@mastra/core/evals/scoreTraces', () => ({
  scoreTraces: vi.fn(),
}));

describe('Observability Handlers', () => {
  let storage: InMemoryStore;
  let observabilityStorage: ObservabilityStorageBase;
  let evalsStorage: EvalsStorageBase;
  let mastra: Mastra;

  beforeEach(async () => {
    vi.clearAllMocks();
    storage = new InMemoryStore();
    const observabilityStore = await storage.getStore('observability');
    expect(observabilityStore).toBeDefined();
    if (!observabilityStore) {
      throw new Error('Observability storage is not defined');
    }
    observabilityStorage = observabilityStore;

    const evalsStore = await storage.getStore('evals');
    expect(evalsStore).toBeDefined();
    if (!evalsStore) {
      throw new Error('Evals storage is not defined');
    }
    evalsStorage = evalsStore;

    mastra = new Mastra({
      logger: false,
      storage,
      scorers: {
        'test-scorer': createScorer({
          id: 'test-scorer',
          name: 'test-scorer',
          description: 'A test scorer',
        }).generateScore(() => 0.5),
      },
    });
  });

  describe('getTraceHandler', () => {
    it('should return trace when found', async () => {
      const span = createRootSpan({ name: 'test-root-span', scope: 'test-scope', traceId: 'test-trace-123' });
      await observabilityStorage.createSpan(span);

      const result = await getTraceHandler({
        mastra,
        traceId: 'test-trace-123',
      });

      expect(result).toBeDefined();
      expect(result.traceId).toBe('test-trace-123');
      expect(result.spans).toHaveLength(1);
      expect(result.spans[0]!.spanId).toBe(span.spanId);
    });

    it('should throw 404 when trace not found', async () => {
      await expect(
        getTraceHandler({
          mastra,
          traceId: 'non-existent-trace',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await getTraceHandler({
          mastra,
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
          mastra,
          traceId: '',
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await getTraceHandler({
          mastra,
          traceId: '',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect(error.status).toBe(400);
        expect(error.message).toBe('Trace ID is required');
      }
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = new Mastra({
        logger: false,
      });

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
        expect(error.message).toBe('Mastra Storage: Observability store is not configured.');
      }
    });

    it('should handle storage errors gracefully', async () => {
      const storageError = new Error('Database connection failed');
      observabilityStorage.getTrace = vi.fn().mockRejectedValue(storageError);

      await expect(
        getTraceHandler({
          mastra,
          traceId: 'test-trace-123',
        }),
      ).rejects.toThrow();
    });
  });

  describe('getTracesPaginatedHandler', () => {
    it('should return paginated results with valid parameters', async () => {
      const span1 = createRootSpan({ name: 'span-1', scope: 'test-scope' });
      const span2 = createRootSpan({ name: 'span-2', scope: 'test-scope' });
      await observabilityStorage.createSpan(span1);
      await observabilityStorage.createSpan(span2);

      const result = await getTracesPaginatedHandler({
        mastra,
        body: {
          filters: { name: 'span-1' },
          pagination: { page: 0, perPage: 10 },
        },
      });

      expect(result).toBeDefined();
      expect(result.spans).toBeDefined();
      expect(Array.isArray(result.spans)).toBe(true);
    });

    it('should work with minimal body parameters', async () => {
      const result = await getTracesPaginatedHandler({
        mastra,
        body: {
          filters: {},
          pagination: {},
        },
      });

      expect(result).toBeDefined();
      expect(result.spans).toBeDefined();
      expect(Array.isArray(result.spans)).toBe(true);
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = new Mastra({
        logger: false,
      });

      await expect(
        getTracesPaginatedHandler({
          mastra: mastraWithoutStorage,
          body: { filters: {}, pagination: {} },
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await getTracesPaginatedHandler({
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
        getTracesPaginatedHandler({
          mastra,
          // body is undefined
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await getTracesPaginatedHandler({
          mastra,
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
          getTracesPaginatedHandler({
            mastra,
            body: {
              filters: {},
              pagination: { page: -1, perPage: 10 },
            },
          }),
        ).rejects.toThrow(HTTPException);

        try {
          await getTracesPaginatedHandler({
            mastra,
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
          getTracesPaginatedHandler({
            mastra,
            body: {
              filters: {},
              pagination: { page: 1, perPage: -1 },
            },
          }),
        ).rejects.toThrow(HTTPException);

        try {
          await getTracesPaginatedHandler({
            mastra,
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
        const result = await getTracesPaginatedHandler({
          mastra,
          body: {
            filters: {},
            pagination: { page: 0, perPage: 0 },
          },
        });

        expect(result).toBeDefined();
        expect(result.spans).toBeDefined();
      });
    });

    describe('date range validation', () => {
      it('should accept valid Date objects', async () => {
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-01-31');

        const result = await getTracesPaginatedHandler({
          mastra,
          body: {
            filters: {},
            pagination: {
              dateRange: { start: startDate, end: endDate },
              page: 0,
              perPage: 10,
            },
          },
        });

        expect(result).toBeDefined();
        expect(result.spans).toBeDefined();
      });

      it('should throw 400 when start date is invalid', async () => {
        await expect(
          getTracesPaginatedHandler({
            mastra,
            body: {
              filters: {},
              pagination: {
                dateRange: { start: 'invalid-date' as any },
                page: 0,
                perPage: 10,
              },
            },
          }),
        ).rejects.toThrow(HTTPException);

        try {
          await getTracesPaginatedHandler({
            mastra,
            body: {
              filters: {},
              pagination: {
                dateRange: { start: 'invalid-date' as any },
                page: 0,
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
          getTracesPaginatedHandler({
            mastra,
            body: {
              filters: {},
              pagination: {
                dateRange: { end: 'invalid-date' as any },
                page: 0,
                perPage: 10,
              },
            },
          }),
        ).rejects.toThrow(HTTPException);

        try {
          await getTracesPaginatedHandler({
            mastra,
            body: {
              filters: {},
              pagination: {
                dateRange: { end: 'invalid-date' as any },
                page: 0,
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

    it('should handle storage errors gracefully', async () => {
      const storageError = new Error('Database query failed');
      observabilityStorage.getTracesPaginated = vi.fn().mockRejectedValue(storageError);

      await expect(
        getTracesPaginatedHandler({
          mastra,
          body: { filters: {}, pagination: {} },
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
      scoreTracesMock.mockResolvedValue(undefined);

      const requestBody = {
        scorerName: 'test-scorer',
        targets: [{ traceId: 'trace-123' }, { traceId: 'trace-456' }],
      };

      const result = await scoreTracesHandler({
        mastra,
        body: requestBody,
      });

      expect(result).toEqual({
        message: 'Scoring started for 2 traces',
        traceCount: 2,
        status: 'success',
      });

      expect(scoreTracesMock).toHaveBeenCalledWith({
        scorerId: 'test-scorer',
        targets: requestBody.targets,
        mastra,
      });
    });

    it('should throw 400 when request body is missing', async () => {
      await expect(
        scoreTracesHandler({
          mastra,
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await scoreTracesHandler({
          mastra,
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
          mastra,
          // @ts-ignore - expected to throw
          body: {
            targets: [{ traceId: 'trace-123' }],
          },
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await scoreTracesHandler({
          mastra,
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
          mastra,
          body: {
            scorerName: 'test-scorer',
            targets: [],
          },
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await scoreTracesHandler({
          mastra,
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
      const mastraWithoutScorer = new Mastra({
        logger: false,
        storage,
      });

      await expect(
        scoreTracesHandler({
          mastra: mastraWithoutScorer,
          body: {
            scorerName: 'non-existent-scorer',
            targets: [{ traceId: 'trace-123' }],
          },
        }),
      ).rejects.toThrow(HTTPException);

      try {
        await scoreTracesHandler({
          mastra: mastraWithoutScorer,
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
      const mastraWithoutStorage = new Mastra({
        logger: false,
      });

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

    it('should handle scoreTraces errors gracefully', async () => {
      const processingError = new Error('Processing failed');
      scoreTracesMock.mockRejectedValue(processingError);

      // Should still return success response since processing is fire-and-forget
      const result = await scoreTracesHandler({
        mastra,
        body: {
          scorerName: 'test-scorer',
          targets: [{ traceId: 'trace-123' }],
        },
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
      const mockScore = createSampleScore({ traceId: 'test-trace-1', spanId: 'test-span-1', scorerId: 'test-scorer' });
      await evalsStorage.saveScore(mockScore);

      const pagination = { page: 0, perPage: 10 };

      const result = await listScoresBySpan({
        mastra,
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
          pagination,
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should handle API errors with status codes', async () => {
      const pagination = { page: 0, perPage: 10 };
      const apiError = {
        message: 'Span not found',
        status: 404,
      };

      evalsStorage.listScoresBySpan = vi.fn().mockRejectedValue(apiError);

      try {
        await listScoresBySpan({
          mastra,
          traceId: 'test-trace-1',
          spanId: 'test-span-1',
          pagination,
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
          mastra,
          traceId: '',
          spanId: 'test-span-1',
          pagination,
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should throw error when spanId is missing', async () => {
      const pagination = { page: 0, perPage: 10 };

      await expect(
        listScoresBySpan({
          mastra,
          traceId: 'test-trace-1',
          spanId: '',
          pagination,
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should throw error when both traceId and spanId are missing', async () => {
      const pagination = { page: 0, perPage: 10 };

      await expect(
        listScoresBySpan({
          mastra,
          traceId: '',
          spanId: '',
          pagination,
        }),
      ).rejects.toThrow(HTTPException);
    });
  });
});
