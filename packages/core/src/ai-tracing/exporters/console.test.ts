import { describe, expect, it, vi } from 'vitest';
import { AISpanType, AITracingEventType } from '../types';
import { ConsoleExporter } from './console';

describe('DefaultConsoleExporter', () => {
  it('should log span events with proper formatting', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    const exporter = new ConsoleExporter(logger as any);

    const mockSpan = {
      id: 'test-span-1',
      name: 'test-span',
      type: AISpanType.AGENT_RUN,
      startTime: new Date(),
      endTime: new Date(),
      traceId: 'trace-123',
      trace: { traceId: 'trace-123' },
      attributes: { agentId: 'agent-123', normalField: 'visible-data' },
    };

    await exporter.exportEvent({
      type: AITracingEventType.SPAN_STARTED,
      span: mockSpan as any,
    });

    // Should log with proper formatting (no filtering happens in exporter anymore)
    expect(logger.info).toHaveBeenCalledWith('🚀 SPAN_STARTED');
    expect(logger.info).toHaveBeenCalledWith('   Type: agent_run');
    expect(logger.info).toHaveBeenCalledWith('   Name: test-span');
    expect(logger.info).toHaveBeenCalledWith('   ID: test-span-1');
    expect(logger.info).toHaveBeenCalledWith('   Trace ID: trace-123');

    // Check that attributes are logged (filtering happens at processor level now)
    const attributesCall = logger.info.mock.calls.find(call => call[0].includes('Attributes:'));
    expect(attributesCall).toBeDefined();
    expect(attributesCall![0]).toContain('visible-data');
  });

  it('should log error for unknown events', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    const exporter = new ConsoleExporter(logger as any);

    await exporter.exportEvent({
      type: 'unknown_event' as any,
      span: {} as any,
    });

    expect(logger.warn).toHaveBeenCalledWith('Tracing event type not implemented: unknown_event');
  });
});
