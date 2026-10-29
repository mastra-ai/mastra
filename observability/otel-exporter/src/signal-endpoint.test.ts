import { describe, expect, it } from 'vitest';
import { resolveHttpSignalEndpoint } from './signal-endpoint';

describe('HTTP signal URLs', () => {
  it.each([
    ['', '/v1/traces', '/v1/logs'],
    ['/', '/v1/traces', '/v1/logs'],
    ['/v1/traces/', '/v1/traces', '/v1/logs'],
    ['/v1/logs/', '/v1/traces', '/v1/logs'],
    ['/api/otel/traces', '/api/otel/traces', '/api/otel/logs'],
    ['/api/otel/traces///', '/api/otel/traces', '/api/otel/logs'],
    ['/api/ingest', '/api/ingest', '/api/ingest/v1/logs'],
    ['/v1/logs/otel', '/v1/logs/otel', '/v1/logs/otel/v1/logs'],
    ['/api/otel/traces?tenant=a%2Fb', '/api/otel/traces?tenant=a%2Fb', '/api/otel/logs?tenant=a%2Fb'],
    ['?tenant=acme', '/v1/traces?tenant=acme', '/v1/logs?tenant=acme'],
    ['/api/ingest?target=/traces', '/api/ingest?target=/traces', '/api/ingest/v1/logs?target=/traces'],
  ])('preserves custom paths and queries for %s (#28751)', (path, traces, logs) => {
    const origin = 'https://collector.example.com';
    expect(resolveHttpSignalEndpoint(origin + path, 'traces')).toBe(origin + traces);
    expect(resolveHttpSignalEndpoint(origin + path, 'logs')).toBe(origin + logs);
  });
});
