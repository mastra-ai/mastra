import { describe, expect, it } from 'vitest';

import {
  buildExportedLog,
  buildExportedSpan,
  decodeResourceLogs,
  decodeResourceSpans,
  otlpSeverityToLogLevel,
} from './otlp';

const TRACE_ID = '11111111111111111111111111111111';
const PARENT_SPAN_ID = 'aaaaaaaaaaaaaaaa';
const CHILD_SPAN_ID = 'bbbbbbbbbbbbbbbb';

function spansPayload(spans: unknown[]) {
  return {
    resourceSpans: [{ scopeSpans: [{ spans }] }],
  };
}

function logsPayload(logRecords: unknown[]) {
  return {
    resourceLogs: [{ scopeLogs: [{ logRecords }] }],
  };
}

describe('decodeResourceSpans', () => {
  it('decodes a single span with all common fields', () => {
    const decoded = decodeResourceSpans(
      spansPayload([
        {
          traceId: TRACE_ID,
          spanId: CHILD_SPAN_ID,
          parentSpanId: PARENT_SPAN_ID,
          name: 'fetch user',
          startTimeUnixNano: '1700000000000000000',
          endTimeUnixNano: '1700000000500000000',
          attributes: [
            { key: 'http.method', value: { stringValue: 'GET' } },
            { key: 'http.status_code', value: { intValue: 200 } },
          ],
          status: { code: 1 },
        },
      ]),
    );
    expect(decoded).toHaveLength(1);
    const span = decoded[0]!;
    expect(span.traceId).toBe(TRACE_ID);
    expect(span.spanId).toBe(CHILD_SPAN_ID);
    expect(span.parentSpanId).toBe(PARENT_SPAN_ID);
    expect(span.name).toBe('fetch user');
    expect(span.startTime.getTime()).toBe(1700000000000);
    expect(span.endTime?.getTime()).toBe(1700000000500);
    expect(span.attributes).toEqual({ 'http.method': 'GET', 'http.status_code': 200 });
    expect(span.statusCode).toBe(1);
  });

  it('returns empty array on malformed payloads', () => {
    expect(decodeResourceSpans(undefined)).toEqual([]);
    expect(decodeResourceSpans(null)).toEqual([]);
    expect(decodeResourceSpans({})).toEqual([]);
    expect(decodeResourceSpans({ resourceSpans: 'not-an-array' })).toEqual([]);
  });

  it('skips spans missing required fields', () => {
    const decoded = decodeResourceSpans(
      spansPayload([{ traceId: TRACE_ID, spanId: CHILD_SPAN_ID }, { name: 'orphan' }, null]),
    );
    expect(decoded).toEqual([]);
  });

  it('preserves error status code and message', () => {
    const decoded = decodeResourceSpans(
      spansPayload([
        {
          traceId: TRACE_ID,
          spanId: CHILD_SPAN_ID,
          name: 'failed',
          startTimeUnixNano: '0',
          status: { code: 2, message: 'boom' },
        },
      ]),
    );
    expect(decoded[0]?.statusCode).toBe(2);
    expect(decoded[0]?.statusMessage).toBe('boom');
  });
});

describe('decodeResourceLogs', () => {
  it('decodes log records with body and attributes', () => {
    const decoded = decodeResourceLogs(
      logsPayload([
        {
          traceId: TRACE_ID,
          spanId: CHILD_SPAN_ID,
          timeUnixNano: '1700000000000000000',
          severityText: 'INFO',
          severityNumber: 9,
          body: { stringValue: 'hello' },
          attributes: [{ key: 'user', value: { stringValue: 'alice' } }],
        },
      ]),
    );
    expect(decoded).toHaveLength(1);
    expect(decoded[0]).toMatchObject({
      traceId: TRACE_ID,
      spanId: CHILD_SPAN_ID,
      severityText: 'INFO',
      severityNumber: 9,
      body: 'hello',
      attributes: { user: 'alice' },
    });
  });

  it('skips logs missing traceId', () => {
    expect(decodeResourceLogs(logsPayload([{ body: { stringValue: 'no trace' } }]))).toEqual([]);
  });
});

describe('otlpSeverityToLogLevel', () => {
  it('maps text severities case-insensitively', () => {
    expect(otlpSeverityToLogLevel('INFO', undefined)).toBe('info');
    expect(otlpSeverityToLogLevel('debug', undefined)).toBe('debug');
    expect(otlpSeverityToLogLevel('WARN', undefined)).toBe('warn');
    expect(otlpSeverityToLogLevel('Error', undefined)).toBe('error');
    expect(otlpSeverityToLogLevel('FATAL', undefined)).toBe('fatal');
  });

  it('falls back to severity number ranges', () => {
    expect(otlpSeverityToLogLevel(undefined, 5)).toBe('debug');
    expect(otlpSeverityToLogLevel(undefined, 9)).toBe('info');
    expect(otlpSeverityToLogLevel(undefined, 13)).toBe('warn');
    expect(otlpSeverityToLogLevel(undefined, 17)).toBe('error');
    expect(otlpSeverityToLogLevel(undefined, 22)).toBe('fatal');
  });

  it('defaults to info when nothing is provided', () => {
    expect(otlpSeverityToLogLevel(undefined, undefined)).toBe('info');
  });
});

describe('buildExportedSpan', () => {
  it('produces an ExportedSpan with isRootSpan correct', () => {
    const span = buildExportedSpan({
      traceId: TRACE_ID,
      spanId: CHILD_SPAN_ID,
      parentSpanId: PARENT_SPAN_ID,
      name: 'child',
      startTime: new Date(0),
    });
    expect(span.id).toBe(CHILD_SPAN_ID);
    expect(span.parentSpanId).toBe(PARENT_SPAN_ID);
    expect(span.isRootSpan).toBe(false);
  });

  it('marks orphan spans as root', () => {
    const span = buildExportedSpan({
      traceId: TRACE_ID,
      spanId: CHILD_SPAN_ID,
      name: 'standalone',
      startTime: new Date(0),
    });
    expect(span.isRootSpan).toBe(true);
  });
});

describe('buildExportedLog', () => {
  it('coerces non-string body via String()', () => {
    const log = buildExportedLog({
      traceId: TRACE_ID,
      timestamp: new Date(0),
      body: 42,
    });
    expect(log.message).toBe('42');
  });

  it('handles missing body cleanly', () => {
    const log = buildExportedLog({
      traceId: TRACE_ID,
      timestamp: new Date(0),
    });
    expect(log.message).toBe('');
  });
});
