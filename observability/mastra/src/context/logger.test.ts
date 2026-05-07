/**
 * Unit tests for LoggerContextImpl
 */

import type { LogEvent } from '@mastra/core/observability';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ObservabilityBus } from '../bus';
import { LoggerContextImpl } from './logger';

describe('LoggerContextImpl', () => {
  let bus: ObservabilityBus;
  const emittedEvents: LogEvent[] = [];

  function captureEvents() {
    bus.emit = (event: any) => {
      if (event.type === 'log') {
        emittedEvents.push(event as LogEvent);
      }
    };
  }

  afterEach(async () => {
    emittedEvents.length = 0;
    await bus?.shutdown();
  });

  it('should emit log events with trace correlation', () => {
    bus = new ObservabilityBus();
    captureEvents();

    const logger = new LoggerContextImpl({
      traceId: 'trace-abc',
      spanId: 'span-123',
      correlationContext: {
        tags: ['tag-a'],
      },
      metadata: { runId: 'run-1', environment: 'test' },
      observabilityBus: bus,
      minLevel: 'info',
    });

    logger.info('test message', { key: 'value' });

    expect(emittedEvents).toHaveLength(1);
    const log = emittedEvents[0]!.log;
    expect(log.level).toBe('info');
    expect(log.message).toBe('test message');
    expect(log.data).toEqual({ key: 'value' });
    expect(log.traceId).toBe('trace-abc');
    expect(log.spanId).toBe('span-123');
    expect(log.correlationContext).toEqual({
      tags: ['tag-a'],
    });
    expect(log.metadata).toEqual({ runId: 'run-1', environment: 'test' });
  });

  it('should default to warn-level logging', () => {
    bus = new ObservabilityBus();
    captureEvents();

    const logger = new LoggerContextImpl({
      traceId: 'trace-1',
      spanId: 'span-1',
      observabilityBus: bus,
    });

    logger.debug('debug msg');
    logger.info('info msg');
    logger.warn('warn msg');
    logger.error('error msg');
    logger.fatal('fatal msg');

    expect(emittedEvents).toHaveLength(3);
    expect(emittedEvents.map(e => e.log.level)).toEqual(['warn', 'error', 'fatal']);
  });

  it('should emit all log levels when minimum level is debug', () => {
    bus = new ObservabilityBus();
    captureEvents();

    const logger = new LoggerContextImpl({
      traceId: 'trace-1',
      spanId: 'span-1',
      observabilityBus: bus,
      minLevel: 'debug',
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

  it('should work without trace context', () => {
    bus = new ObservabilityBus();
    captureEvents();

    const logger = new LoggerContextImpl({
      observabilityBus: bus,
    });

    logger.warn('no trace context');

    expect(emittedEvents).toHaveLength(1);
    const log = emittedEvents[0]!.log;
    expect(log.correlationContext).toBeUndefined();
    expect(log.metadata).toBeUndefined();
  });

  it('should emit data as undefined when not provided', () => {
    bus = new ObservabilityBus();
    captureEvents();

    const logger = new LoggerContextImpl({
      observabilityBus: bus,
    });

    logger.warn('no data');

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
      traceId: 'trace-1',
      spanId: 'span-1',
      observabilityBus: bus,
    });

    logger.warn('routed log');

    expect(onLogEvent).toHaveBeenCalledTimes(1);
    expect(onLogEvent.mock.calls[0]![0].log.message).toBe('routed log');
  });

  it('should include metadata in emitted logs', () => {
    bus = new ObservabilityBus();
    captureEvents();

    const logger = new LoggerContextImpl({
      traceId: 'trace-1',
      spanId: 'span-1',
      observabilityBus: bus,
      metadata: {
        entity_type: 'agent',
        entity_name: 'researcher',
        parent_type: 'workflow_run',
        parent_name: 'my-workflow',
        runId: 'run-1',
      },
    });

    logger.warn('with metadata');

    const log = emittedEvents[0]!.log;
    expect(log.metadata).toEqual({
      entity_type: 'agent',
      entity_name: 'researcher',
      parent_type: 'workflow_run',
      parent_name: 'my-workflow',
      runId: 'run-1',
    });
  });

  it('should include tags in emitted logs', () => {
    bus = new ObservabilityBus();
    captureEvents();

    const logger = new LoggerContextImpl({
      observabilityBus: bus,
      correlationContext: {
        tags: ['root-tag-1', 'root-tag-2'],
      },
    });

    logger.warn('with tags');

    const log = emittedEvents[0]!.log;
    expect(log.correlationContext).toEqual({
      tags: ['root-tag-1', 'root-tag-2'],
    });
  });

  it('should fall back to deprecated traceId and spanId on correlationContext', () => {
    bus = new ObservabilityBus();
    captureEvents();

    const logger = new LoggerContextImpl({
      observabilityBus: bus,
      correlationContext: {
        traceId: 'legacy-trace',
        spanId: 'legacy-span',
        tags: ['tag-a'],
      },
    });

    logger.warn('legacy trace context');

    const log = emittedEvents[0]!.log;
    expect(log.traceId).toBe('legacy-trace');
    expect(log.spanId).toBe('legacy-span');
    expect(log.correlationContext).toEqual({
      traceId: 'legacy-trace',
      spanId: 'legacy-span',
      tags: ['tag-a'],
    });
  });
});
