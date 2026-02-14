import type { ExportedLog } from '@mastra/core/observability';
import { describe, expect, it } from 'vitest';

import { formatLogsForLoki } from './logs';

function makeLog(overrides: Partial<ExportedLog> = {}): ExportedLog {
  return {
    timestamp: new Date('2026-01-15T10:00:00.000Z'),
    level: 'info',
    message: 'Processing user request',
    ...overrides,
  };
}

describe('formatLogsForLoki', () => {
  it('should produce valid Loki push request structure', () => {
    const result = formatLogsForLoki([makeLog()], 'my-service');

    expect(result.streams).toBeDefined();
    expect(result.streams.length).toBeGreaterThan(0);

    const stream = result.streams[0]!;
    expect(stream.stream).toBeDefined();
    expect(stream.values).toBeDefined();
    expect(stream.values.length).toBe(1);
  });

  it('should include job and level labels', () => {
    const log = makeLog({ level: 'error' });
    const result = formatLogsForLoki([log], 'my-service');

    const stream = result.streams[0]!;
    expect(stream.stream['job']).toBe('my-service');
    expect(stream.stream['level']).toBe('error');
  });

  it('should use nanosecond timestamps', () => {
    const log = makeLog({ timestamp: new Date('2026-01-15T10:00:00.000Z') });
    const result = formatLogsForLoki([log], 'svc');

    const [timestamp] = result.streams[0]!.values[0]!;
    const expectedMs = new Date('2026-01-15T10:00:00.000Z').getTime();
    expect(timestamp).toBe(`${BigInt(expectedMs) * 1_000_000n}`);
  });

  it('should include message in log line JSON', () => {
    const log = makeLog({ message: 'Hello world' });
    const result = formatLogsForLoki([log], 'svc');

    const [, logLine] = result.streams[0]!.values[0]!;
    const parsed = JSON.parse(logLine);
    expect(parsed.message).toBe('Hello world');
  });

  it('should include trace correlation in log line', () => {
    const log = makeLog({
      traceId: 'trace-abc',
      spanId: 'span-def',
    });

    const result = formatLogsForLoki([log], 'svc');
    const [, logLine] = result.streams[0]!.values[0]!;
    const parsed = JSON.parse(logLine);

    expect(parsed.traceId).toBe('trace-abc');
    expect(parsed.spanId).toBe('span-def');
  });

  it('should include structured data in log line', () => {
    const log = makeLog({
      data: { latency_ms: 5000, endpoint: '/api/chat' },
    });

    const result = formatLogsForLoki([log], 'svc');
    const [, logLine] = result.streams[0]!.values[0]!;
    const parsed = JSON.parse(logLine);

    expect(parsed.data.latency_ms).toBe(5000);
    expect(parsed.data.endpoint).toBe('/api/chat');
  });

  it('should include metadata fields in log line', () => {
    const log = makeLog({
      metadata: {
        userId: 'user-123',
        sessionId: 'session-456',
        environment: 'production',
      },
    });

    const result = formatLogsForLoki([log], 'svc');
    const [, logLine] = result.streams[0]!.values[0]!;
    const parsed = JSON.parse(logLine);

    expect(parsed.userId).toBe('user-123');
    expect(parsed.sessionId).toBe('session-456');
  });

  it('should extract low-cardinality metadata as Loki labels', () => {
    const log = makeLog({
      metadata: {
        entityType: 'agent',
        entityName: 'support-agent',
        environment: 'staging',
      },
    });

    const result = formatLogsForLoki([log], 'svc');
    const stream = result.streams[0]!;

    expect(stream.stream['entity_type']).toBe('agent');
    expect(stream.stream['entity_name']).toBe('support-agent');
    expect(stream.stream['environment']).toBe('staging');
  });

  it('should group logs with same labels into same stream', () => {
    const logs = [
      makeLog({ level: 'info', message: 'First message' }),
      makeLog({ level: 'info', message: 'Second message' }),
    ];

    const result = formatLogsForLoki(logs, 'svc');

    // Both should be in the same stream since they have the same level
    expect(result.streams).toHaveLength(1);
    expect(result.streams[0]!.values).toHaveLength(2);
  });

  it('should separate logs with different labels into different streams', () => {
    const logs = [
      makeLog({ level: 'info', message: 'Info message' }),
      makeLog({ level: 'error', message: 'Error message' }),
    ];

    const result = formatLogsForLoki(logs, 'svc');

    // Different levels should create different streams
    expect(result.streams).toHaveLength(2);

    const infoStream = result.streams.find(s => s.stream['level'] === 'info');
    const errorStream = result.streams.find(s => s.stream['level'] === 'error');

    expect(infoStream).toBeDefined();
    expect(errorStream).toBeDefined();
    expect(infoStream!.values).toHaveLength(1);
    expect(errorStream!.values).toHaveLength(1);
  });

  it('should handle tags as a label', () => {
    const log = makeLog({ tags: ['production', 'experiment-v2'] });
    const result = formatLogsForLoki([log], 'svc');

    expect(result.streams[0]!.stream['tags']).toBe('production,experiment-v2');
  });

  it('should handle empty data and metadata gracefully', () => {
    const log = makeLog({
      data: undefined,
      metadata: undefined,
    });

    const result = formatLogsForLoki([log], 'svc');
    const [, logLine] = result.streams[0]!.values[0]!;
    const parsed = JSON.parse(logLine);

    expect(parsed.message).toBe('Processing user request');
    expect(parsed.data).toBeUndefined();
  });

  it('should handle multiple logs in a batch', () => {
    const logs = Array.from({ length: 10 }, (_, i) =>
      makeLog({ message: `Message ${i}`, level: 'info' }),
    );

    const result = formatLogsForLoki(logs, 'svc');

    // All same level → one stream with 10 entries
    expect(result.streams).toHaveLength(1);
    expect(result.streams[0]!.values).toHaveLength(10);
  });
});
