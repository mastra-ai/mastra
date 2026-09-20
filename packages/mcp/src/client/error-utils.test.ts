import { SdkErrorCode, SdkHttpError } from '@modelcontextprotocol/client';
import { describe, expect, it } from 'vitest';

import { getMCPDiscoveryErrorDetails, isReconnectableMCPError } from './error-utils';

describe('getMCPDiscoveryErrorDetails', () => {
  it('preserves MCP SDK 2 HTTP status and transport code through wrapped causes', () => {
    const transportError = new SdkHttpError(
      SdkErrorCode.ClientHttpNotImplemented,
      'Error POSTing to endpoint: temporarily unavailable',
      { status: 503 },
    );
    const wrapped = new Error('Failed to connect to MCP server unavailable', { cause: transportError });

    expect(getMCPDiscoveryErrorDetails(wrapped)).toEqual({
      message: 'Failed to connect to MCP server unavailable (HTTP 503)',
      httpStatus: 503,
      code: SdkErrorCode.ClientHttpNotImplemented,
    });
  });

  it('recognizes legacy status fields and data-wrapped status', () => {
    expect(
      getMCPDiscoveryErrorDetails(
        Object.assign(new Error('legacy status'), { statusCode: 429, code: 'RATE_LIMITED' }),
      ),
    ).toEqual({
      message: 'legacy status (HTTP 429)',
      httpStatus: 429,
      code: 'RATE_LIMITED',
    });

    expect(
      getMCPDiscoveryErrorDetails(
        Object.assign(new Error('serialized SDK error'), {
          data: { status: 401, code: 'CLIENT_HTTP_UNAUTHORIZED' },
        }),
      ),
    ).toEqual({
      message: 'serialized SDK error (HTTP 401)',
      httpStatus: 401,
      code: 'CLIENT_HTTP_UNAUTHORIZED',
    });
  });

  it('preserves numeric codes without treating them as HTTP status fields', () => {
    expect(getMCPDiscoveryErrorDetails(Object.assign(new Error('payment required'), { code: 402 }))).toEqual({
      message: 'payment required',
      code: 402,
    });

    expect(getMCPDiscoveryErrorDetails(Object.assign(new Error('method missing'), { code: -32601 }))).toEqual({
      message: 'method missing',
      code: -32601,
    });
  });

  it('does not duplicate an existing HTTP marker', () => {
    expect(
      getMCPDiscoveryErrorDetails(Object.assign(new Error('endpoint failed (HTTP 503)'), { status: 503 })),
    ).toEqual({
      message: 'endpoint failed (HTTP 503)',
      httpStatus: 503,
    });
  });

  it('stops at cause cycles and the maximum cause depth', () => {
    const first = new Error('cycle root') as Error & { cause?: unknown };
    const second = Object.assign(new Error('cycle child'), { status: 502, cause: first });
    first.cause = second;

    expect(getMCPDiscoveryErrorDetails(first)).toEqual({
      message: 'cycle root (HTTP 502)',
      httpStatus: 502,
    });

    const root = new Error('deep root') as Error & { cause?: unknown };
    let cursor = root;
    for (let depth = 0; depth < 8; depth++) {
      const next = new Error(`cause ${depth}`) as Error & { cause?: unknown; status?: number };
      cursor.cause = next;
      cursor = next;
    }
    (cursor as Error & { status?: number }).status = 504;

    expect(getMCPDiscoveryErrorDetails(root)).toEqual({ message: 'deep root' });
  });

  it('does not throw when third-party error accessors or string conversion throw', () => {
    const inaccessible = new Proxy(Object.create(null) as object, {
      get() {
        throw new Error('access denied');
      },
    });

    expect(getMCPDiscoveryErrorDetails(inaccessible)).toEqual({ message: 'Unknown error' });

    const partial = new Error('request failed');
    Object.defineProperty(partial, 'status', {
      get() {
        throw new Error('status unavailable');
      },
    });
    Object.defineProperty(partial, 'code', {
      get() {
        throw new Error('code unavailable');
      },
    });

    expect(getMCPDiscoveryErrorDetails(partial)).toEqual({ message: 'request failed' });
  });
});

describe('isReconnectableMCPError', () => {
  it('treats transport-level failures as reconnectable', () => {
    for (const message of [
      'Not connected',
      'Error POSTing to endpoint (HTTP 404): no healthy backend',
      'connect ECONNREFUSED 127.0.0.1:1',
      'fetch failed',
      'Connection closed',
      'TypeError: terminated',
    ]) {
      expect(isReconnectableMCPError(new Error(message)), message).toBe(true);
    }
  });

  it('does not reconnect on legacy session or SSE wording, tool errors or non-errors', () => {
    for (const message of [
      'Session expired for object 42',
      'No valid session ID provided',
      'Server not initialized',
      'SSE stream disconnected',
      'Validation failed',
    ]) {
      expect(isReconnectableMCPError(new Error(message)), message).toBe(false);
    }
    expect(isReconnectableMCPError('fetch failed')).toBe(false);
    expect(isReconnectableMCPError(undefined)).toBe(false);
  });
});
