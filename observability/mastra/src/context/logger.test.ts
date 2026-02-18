/**
 * Unit tests for LoggerContextImpl
 */

import { SpanType } from '@mastra/core/observability';
import type { LogEvent, AnySpan } from '@mastra/core/observability';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ObservabilityBus } from '../bus';
import { LoggerContextImpl } from './logger';

function createMockSpan(overrides: Partial<AnySpan> = {}): AnySpan {
  return {
    id: 'span-123',
    traceId: 'trace-abc',
    name: 'test-span',
    type: SpanType.AGENT_RUN,
    isEvent: false,
    startTime: new Date(),
    metadata: { runId: 'run-1', environment: 'test' },
    tags: ['tag-a'],
    ...overrides,
  } as AnySpan;
}

describe('LoggerContextImpl', () => {
  let bus: ObservabilityBus;
  const emittedEvents: LogEvent[] = [];

  function captureEvents() {
    bus.emit = (event: any) => {
      if (event.type === 'log') {
        emittedEvents.push(event as LogEvent);
      }
      // Don't call super.emit to avoid buffering complexity in tests
    };
  }

  afterEach(async () => {
    emittedEvents.length = 0;
    await bus?.shutdown();
  });

  it('should emit log events with trace correlation', () => {
    bus = new ObservabilityBus();
    captureEvents();

    const span = createMockSpan();
    const logger = new LoggerContextImpl({
      currentSpan: span,
      observabilityBus: bus,
    });

    logger.info('test message', { key: 'value' });

    expect(emittedEvents).toHaveLength(1);
    const log = emittedEvents[0]!.log;
    expect(log.level).toBe('info');
    expect(log.message).toBe('test message');
    expect(log.data).toEqual({ key: 'value' });
    expect(log.traceId).toBe('trace-abc');
    expect(log.spanId).toBe('span-123');
    expect(log.tags).toEqual(['tag-a']);
    expect(log.metadata).toEqual({ runId: 'run-1', environment: 'test' });
  });

  it('should emit all log levels', () => {
    bus = new ObservabilityBus();
    captureEvents();

    const logger = new LoggerContextImpl({
      currentSpan: createMockSpan(),
      observabilityBus: bus,
    });

    logger.debug('debug msg');
    logger.info('info msg');
    logger.warn('warn msg');
    logger.error('error msg');
    logger.fatal('fatal msg');

    expect(emittedEvents).toHaveLength(5);
    expect(emittedEvents.map(e => e.log.level)).toEqual(['debug', 'info', 'warn', 'error', 'fatal']);
  });

  it('should filter logs below minimum level', () => {
    bus = new ObservabilityBus();
    captureEvents();

    const logger = new LoggerContextImpl({
      currentSpan: createMockSpan(),
      observabilityBus: bus,
      minLevel: 'warn',
    });

    logger.debug('should be filtered');
    logger.info('should be filtered');
    logger.warn('should pass');
    logger.error('should pass');
    logger.fatal('should pass');

    expect(emittedEvents).toHaveLength(3);
    expect(emittedEvents.map(e => e.log.level)).toEqual(['warn', 'error', 'fatal']);
  });

  it('should work without a current span (direct logger)', () => {
    bus = new ObservabilityBus();
    captureEvents();

    const logger = new LoggerContextImpl({
      currentSpan: undefined,
      observabilityBus: bus,
    });

    logger.info('no trace context');

    expect(emittedEvents).toHaveLength(1);
    const log = emittedEvents[0]!.log;
    expect(log.traceId).toBeUndefined();
    expect(log.spanId).toBeUndefined();
    expect(log.metadata).toBeUndefined();
  });

  it('should emit data as undefined when not provided', () => {
    bus = new ObservabilityBus();
    captureEvents();

    const logger = new LoggerContextImpl({
      currentSpan: createMockSpan(),
      observabilityBus: bus,
    });

    logger.info('no data');

    expect(emittedEvents[0]!.log.data).toBeUndefined();
  });

  it('should route log events to exporters via bus', () => {
    bus = new ObservabilityBus();
    const onLogEvent = vi.fn();
    bus.registerExporter({
      name: 'test-exporter',
      onLogEvent,
      exportTracingEvent: vi.fn().mockResolvedValue(undefined),
      flush: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
    });

    const logger = new LoggerContextImpl({
      currentSpan: createMockSpan(),
      observabilityBus: bus,
    });

    logger.info('routed log');

    expect(onLogEvent).toHaveBeenCalledTimes(1);
    expect(onLogEvent.mock.calls[0]![0].log.message).toBe('routed log');
  });
});
