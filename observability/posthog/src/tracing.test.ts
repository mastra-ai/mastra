import { SpanType } from '@mastra/core/observability';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { PosthogExporter } from './tracing';

// Mock PostHog client
const mockCapture = vi.fn();
const mockShutdown = vi.fn();
const mockPostHogConstructor = vi.fn();

vi.mock('posthog-node', () => {
  return {
    PostHog: class {
      constructor(...args: any[]) {
        mockPostHogConstructor(...args);
      }
      capture = mockCapture;
      shutdown = mockShutdown;
    },
  };
});

describe('PosthogExporter', () => {
  let exporter: PosthogExporter;
  const validConfig = { apiKey: 'test-key' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (exporter) {
      await exporter.shutdown();
    }
  });

  // --- Initialization Tests ---
  describe('Initialization', () => {
    it('should initialize with valid config', () => {
      exporter = new PosthogExporter(validConfig);
      expect(mockPostHogConstructor).toHaveBeenCalledWith(
        'test-key',
        expect.objectContaining({
          host: 'https://us.i.posthog.com',
          flushAt: 20,
          flushInterval: 10000,
        }),
      );
    });

    it('should disable when missing API key', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      exporter = new PosthogExporter({ apiKey: '' });
      expect(mockPostHogConstructor).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should use custom host if provided', () => {
      exporter = new PosthogExporter({ ...validConfig, host: 'https://eu.i.posthog.com' });
      expect(mockPostHogConstructor).toHaveBeenCalledWith(
        'test-key',
        expect.objectContaining({
          host: 'https://eu.i.posthog.com',
        }),
      );
    });

    it('should auto-configure serverless defaults', () => {
      exporter = new PosthogExporter({ ...validConfig, serverless: true });
      expect(mockPostHogConstructor).toHaveBeenCalledWith(
        'test-key',
        expect.objectContaining({
          flushAt: 10,
          flushInterval: 2000,
        }),
      );
    });

    it('should allow manual overrides in serverless mode', () => {
      exporter = new PosthogExporter({
        ...validConfig,
        serverless: true,
        flushAt: 50,
      });
      expect(mockPostHogConstructor).toHaveBeenCalledWith(
        'test-key',
        expect.objectContaining({
          flushAt: 50,
          flushInterval: 2000,
        }),
      );
    });
  });

  // --- Span Lifecycle Tests ---
  describe('Span Lifecycle', () => {
    const mockSpan = {
      id: 'span-1',
      traceId: 'trace-1',
      type: SpanType.GENERIC,
      name: 'test-span',
      startTime: Date.now(),
      endTime: Date.now() + 100, // 100ms duration
      attributes: {},
      metadata: {},
    };

    it('should cache span on start', async () => {
      exporter = new PosthogExporter(validConfig);

      await exporter.exportTracingEvent({
        type: 'span_started',
        exportedSpan: mockSpan as any,
      });

      // Access private traceMap for verification (casting to any)
      const traceMap = (exporter as any).traceMap;
      expect(traceMap.has(mockSpan.traceId)).toBe(true);
      const traceData = traceMap.get(mockSpan.traceId);
      expect(traceData.spans.has(mockSpan.id)).toBe(true);
    });

    it('should capture event on end', async () => {
      exporter = new PosthogExporter(validConfig);

      // Start
      await exporter.exportTracingEvent({
        type: 'span_started',
        exportedSpan: mockSpan as any,
      });

      // End
      await exporter.exportTracingEvent({
        type: 'span_ended',
        exportedSpan: mockSpan as any,
      });

      expect(mockCapture).toHaveBeenCalledTimes(1);
      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          event: '$ai_span',
          distinctId: 'anonymous',
          properties: expect.objectContaining({
            $ai_trace_id: mockSpan.traceId,
            $ai_span_id: mockSpan.id,
            $ai_latency: expect.closeTo(0.1, 1), // ~0.1s
          }),
        }),
      );
    });

    it('should cleanup span from cache after capture', async () => {
      exporter = new PosthogExporter(validConfig);

      // Start
      await exporter.exportTracingEvent({
        type: 'span_started',
        exportedSpan: mockSpan as any,
      });

      // End
      await exporter.exportTracingEvent({
        type: 'span_ended',
        exportedSpan: mockSpan as any,
      });

      const traceMap = (exporter as any).traceMap;
      // Trace should be gone if it was the only span
      expect(traceMap.has(mockSpan.traceId)).toBe(false);
    });

    it('should handle missing start event gracefully', async () => {
      exporter = new PosthogExporter(validConfig);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Only End
      await exporter.exportTracingEvent({
        type: 'span_ended',
        exportedSpan: mockSpan as any,
      });

      expect(mockCapture).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // --- Distinct ID Resolution Tests ---
  describe('Distinct ID Resolution', () => {
    it('should use userId from metadata if present', async () => {
      exporter = new PosthogExporter(validConfig);
      const spanWithUser = {
        ...{
          id: 'span-user',
          traceId: 'trace-user',
          type: SpanType.GENERIC,
          name: 'user-span',
          startTime: Date.now(),
          endTime: Date.now() + 100,
          attributes: {},
        },
        metadata: { userId: 'user-123' },
      };

      await exporter.exportTracingEvent({
        type: 'span_started',
        exportedSpan: spanWithUser as any,
      });

      await exporter.exportTracingEvent({
        type: 'span_ended',
        exportedSpan: spanWithUser as any,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          distinctId: 'user-123',
        }),
      );
    });

    it('should use configured defaultDistinctId', async () => {
      exporter = new PosthogExporter({ ...validConfig, defaultDistinctId: 'system' });
      const spanNoUser = {
        id: 'span-anon',
        traceId: 'trace-anon',
        type: SpanType.GENERIC,
        name: 'anon-span',
        startTime: Date.now(),
        endTime: Date.now() + 100,
        attributes: {},
        metadata: {},
      };

      await exporter.exportTracingEvent({
        type: 'span_started',
        exportedSpan: spanNoUser as any,
      });

      await exporter.exportTracingEvent({
        type: 'span_ended',
        exportedSpan: spanNoUser as any,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          distinctId: 'system',
        }),
      );
    });
  });

  // --- Cleanup Tests ---
  describe('Cleanup', () => {
    it('should clear resources on shutdown', async () => {
      exporter = new PosthogExporter(validConfig);

      // Add some data
      await exporter.exportTracingEvent({
        type: 'span_started',
        exportedSpan: {
          id: 's1',
          traceId: 't1',
          startTime: Date.now(),
          type: SpanType.GENERIC,
        } as any,
      });

      await exporter.shutdown();

      expect(mockShutdown).toHaveBeenCalled();
      const traceMap = (exporter as any).traceMap;
      expect(traceMap.size).toBe(0);
    });
  });
});
