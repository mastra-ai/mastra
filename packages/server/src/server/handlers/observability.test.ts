import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mastra } from '@mastra/core/mastra';
import type { MastraStorage } from '@mastra/core/storage';
import type { AITrace } from '@mastra/core/storage';
import { AISpanType } from '@mastra/core/ai-tracing';
import { HTTPException } from '../http-exception';
import { getAITraceHandler, getAITracesPaginatedHandler } from './observability';

// Utility function to create test spans with sensible defaults
const createTestSpan = (overrides: Partial<any> = {}) => ({
  id: 'test-trace-test-span',
  traceId: 'test-trace',
  spanId: 'test-span',
  parentSpanId: null,
  name: 'test-span',
  spanType: AISpanType.AGENT_RUN,
  scope: null,
  attributes: {},
  metadata: {},
  events: null,
  links: null,
  other: null,
  startTime: Date.now(),
  endTime: Date.now(),
  createdAt: new Date(),
  input: null,
  output: null,
  error: null,
  ...overrides,
});

// Mock Mastra instance
const createMockMastra = (storage?: Partial<MastraStorage>): Mastra =>
  ({
    getStorage: vi.fn(() => storage as MastraStorage),
  }) as any;

// Mock storage instance with only the methods we need
const createMockStorage = (): Partial<MastraStorage> => ({
  getAITrace: vi.fn(),
  getAITracesPaginated: vi.fn(),
});

describe('Observability Handlers', () => {
  let mockStorage: ReturnType<typeof createMockStorage>;
  let mockMastra: Mastra;

  beforeEach(() => {
    mockStorage = createMockStorage();
    mockMastra = createMockMastra(mockStorage);
  });

  describe('getAITraceHandler', () => {
    it('should return a trace when found', async () => {
      const mockTrace: AITrace = {
        traceId: 'test-trace-123',
        spans: [
          createTestSpan({
            id: 'test-trace-123-test-span-456',
            traceId: 'test-trace-123',
            spanId: 'test-span-456',
            name: 'test-span',
          }),
        ],
      };

      (mockStorage.getAITrace as any).mockResolvedValue(mockTrace);

      const result = await getAITraceHandler({
        mastra: mockMastra,
        traceId: 'test-trace-123',
      });

      expect(result).toEqual(mockTrace);
      expect(mockStorage.getAITrace).toHaveBeenCalledWith('test-trace-123');
    });

    it('should return a complex trace with multiple levels of child spans', async () => {
      const mockComplexTrace: AITrace = {
        traceId: 'workflow-trace-456',
        spans: [
          // Root span
          createTestSpan({
            id: 'workflow-trace-456-root-789',
            traceId: 'workflow-trace-456',
            spanId: 'root-789',
            parentSpanId: null,
            name: 'workflow run: my-workflow',
            spanType: AISpanType.WORKFLOW_RUN,
            startTime: Date.now() - 10000,
            endTime: Date.now(),
            createdAt: new Date(Date.now() - 10000),
          }),
          // First child span
          createTestSpan({
            id: 'workflow-trace-456-step1-abc',
            traceId: 'workflow-trace-456',
            spanId: 'step1-abc',
            parentSpanId: 'root-789',
            name: 'workflow step: step-1',
            spanType: AISpanType.WORKFLOW_STEP,
            startTime: Date.now() - 8000,
            endTime: Date.now() - 2000,
            createdAt: new Date(Date.now() - 8000),
          }),
          // Second child span
          createTestSpan({
            id: 'workflow-trace-456-agent-def',
            traceId: 'workflow-trace-456',
            spanId: 'agent-def',
            parentSpanId: 'root-789',
            name: 'agent run: my-agent',
            spanType: AISpanType.AGENT_RUN,
            startTime: Date.now() - 7000,
            endTime: Date.now() - 1000,
            createdAt: new Date(Date.now() - 7000),
          }),
          // Grandchild span 1
          createTestSpan({
            id: 'workflow-trace-456-llm-ghi',
            traceId: 'workflow-trace-456',
            spanId: 'llm-ghi',
            parentSpanId: 'agent-def',
            name: 'llm generate: gpt-4',
            spanType: AISpanType.LLM_GENERATION,
            startTime: Date.now() - 6000,
            endTime: Date.now() - 2000,
            createdAt: new Date(Date.now() - 6000),
          }),
          // Grandchild span 2
          createTestSpan({
            id: 'workflow-trace-456-tool-jkl',
            traceId: 'workflow-trace-456',
            spanId: 'tool-jkl',
            parentSpanId: 'agent-def',
            name: 'tool: my-tool',
            spanType: AISpanType.TOOL_CALL,
            startTime: Date.now() - 5000,
            endTime: Date.now() - 3000,
            createdAt: new Date(Date.now() - 5000),
          }),
        ],
      };

      (mockStorage.getAITrace as any).mockResolvedValue(mockComplexTrace);

      const result = await getAITraceHandler({
        mastra: mockMastra,
        traceId: 'workflow-trace-456',
      });

      expect(result).toEqual(mockComplexTrace);
      expect(result.traceId).toBe('workflow-trace-456');
      expect(result.spans).toHaveLength(5);

      // Verify root span
      const rootSpan = result.spans.find(span => span.parentSpanId === null);
      expect(rootSpan).toBeDefined();
      expect(rootSpan?.name).toBe('workflow run: my-workflow');
      expect(rootSpan?.spanType).toBe(AISpanType.WORKFLOW_RUN);
      expect(rootSpan?.spanId).toBe('root-789');

      // Verify child spans (should reference parent's spanId, not full database ID)
      const childSpans = result.spans.filter(span => span.parentSpanId === 'root-789');
      expect(childSpans).toHaveLength(2);
      expect(childSpans.some(span => span.name === 'workflow step: step-1')).toBe(true);
      expect(childSpans.some(span => span.name === 'agent run: my-agent')).toBe(true);

      // Verify grandchild spans (should reference parent's spanId, not full database ID)
      const grandchildSpans = result.spans.filter(span => span.parentSpanId === 'agent-def');
      expect(grandchildSpans).toHaveLength(2);
      expect(grandchildSpans.some(span => span.name === 'llm generate: gpt-4')).toBe(true);
      expect(grandchildSpans.some(span => span.name === 'tool: my-tool')).toBe(true);

      // Verify span hierarchy integrity
      expect(result.spans.every(span => span.traceId === 'workflow-trace-456')).toBe(true);

      // Verify parent-child relationships are valid (using spanIds, not full database IDs)
      const spanIds = result.spans.map(span => span.spanId);
      result.spans.forEach(span => {
        if (span.parentSpanId) {
          expect(spanIds).toContain(span.parentSpanId);
        }
      });

      expect(mockStorage.getAITrace).toHaveBeenCalledWith('workflow-trace-456');
    });

    it('should throw 404 when trace not found', async () => {
      (mockStorage.getAITrace as any).mockResolvedValue(null);

      await expect(
        getAITraceHandler({
          mastra: mockMastra,
          traceId: 'non-existent-trace',
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should throw 400 when traceId is missing', async () => {
      await expect(
        getAITraceHandler({
          mastra: mockMastra,
          traceId: '',
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should throw 500 when storage is not available', async () => {
      const mastraWithoutStorage = createMockMastra(undefined);

      await expect(
        getAITraceHandler({
          mastra: mastraWithoutStorage,
          traceId: 'test-trace-123',
        }),
      ).rejects.toThrow(HTTPException);
    });
  });

  describe('getAITracesPaginatedHandler', () => {
    it('should return paginated traces with valid parameters', async () => {
      const mockResult = {
        spans: [],
        total: 0,
        page: 0,
        perPage: 10,
        hasMore: false,
      };

      (mockStorage.getAITracesPaginated as any).mockResolvedValue(mockResult);

      const result = await getAITracesPaginatedHandler({
        mastra: mockMastra,
        body: {
          page: 0,
          perPage: 10,
          filters: {},
        },
      });

      expect(result).toEqual(mockResult);
      expect(mockStorage.getAITracesPaginated).toHaveBeenCalledWith({
        page: 0,
        perPage: 10,
        filters: {},
      });
    });

    it('should use default pagination values', async () => {
      const mockResult = {
        spans: [],
        total: 0,
        page: 0,
        perPage: 10,
        hasMore: false,
      };

      (mockStorage.getAITracesPaginated as any).mockResolvedValue(mockResult);

      const result = await getAITracesPaginatedHandler({
        mastra: mockMastra,
        body: {},
      });

      expect(result).toEqual(mockResult);
      expect(mockStorage.getAITracesPaginated).toHaveBeenCalledWith({
        page: 0,
        perPage: 10,
        filters: undefined,
      });
    });

    it('should throw 400 when page is negative', async () => {
      await expect(
        getAITracesPaginatedHandler({
          mastra: mockMastra,
          body: {
            page: -1,
            perPage: 10,
          },
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should throw 400 when perPage is too small', async () => {
      await expect(
        getAITracesPaginatedHandler({
          mastra: mockMastra,
          body: {
            page: 0,
            perPage: 0,
          },
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should throw 400 when perPage is too large', async () => {
      await expect(
        getAITracesPaginatedHandler({
          mastra: mockMastra,
          body: {
            page: 0,
            perPage: 1001,
          },
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should validate date range when provided', async () => {
      await expect(
        getAITracesPaginatedHandler({
          mastra: mockMastra,
          body: {
            page: 0,
            perPage: 10,
            filters: {
              dateRange: {
                start: '2023-01-01',
                end: '2022-12-31', // End before start
              },
            },
          },
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should throw 400 when body is missing', async () => {
      await expect(
        getAITracesPaginatedHandler({
          mastra: mockMastra,
        }),
      ).rejects.toThrow(HTTPException);
    });
  });
});
