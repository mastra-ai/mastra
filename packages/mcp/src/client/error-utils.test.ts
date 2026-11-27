import { ProtocolError, SdkErrorCode, SdkHttpError } from '@modelcontextprotocol/client';
import { describe, expect, it } from 'vitest';

import {
  getMCPDiscoveryErrorDetails,
  isReconnectableMCPError,
  isRecoverableTaskPollError,
  isUnsentRequestError,
} from './error-utils';

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
      getMCPDiscoveryErrorDetails(Object.assign(new Error('legacy status'), { statusCode: 429, code: 'RATE_LIMITED' })),
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

  it('treats a structured SDK HTTP 4xx as reconnectable even when the message omits the status', () => {
    for (const status of [400, 401, 403, 404]) {
      const error = new SdkHttpError(
        SdkErrorCode.ClientHttpNotImplemented,
        'Error POSTing to endpoint: Session not found',
        { status },
      );
      // The real status lives only at `data.status`; the body text never quotes it.
      expect(error.message).not.toContain(`HTTP ${status}`);
      expect(isReconnectableMCPError(error), String(status)).toBe(true);
    }
  });

  it('lets structured status and numeric codes win over a misleading message', () => {
    // A structured 500 must not reconnect just because its body text quotes a status we retry.
    expect(
      isReconnectableMCPError(
        new SdkHttpError(SdkErrorCode.ClientHttpNotImplemented, 'Error POSTing to endpoint (HTTP 404): backend down', {
          status: 500,
        }),
      ),
    ).toBe(false);
    expect(
      isReconnectableMCPError(
        new SdkHttpError(SdkErrorCode.ClientHttpNotImplemented, 'Error POSTing to endpoint: Connection closed', {
          status: 500,
        }),
      ),
    ).toBe(false);

    // A JSON-RPC error came from the server's handler, so it never reconnects, whatever it quotes.
    expect(isReconnectableMCPError(new ProtocolError(-32603, 'Error POSTing to endpoint (HTTP 404): gone'))).toBe(false);
  });

  it('keeps a numeric JSON-RPC code when a string code and HTTP status sit in error data', () => {
    // A ProtocolError holds its JSON-RPC code numerically on the error itself, while an upstream
    // payload can put its own string code and an HTTP status in `data`. The numeric protocol code
    // must survive extraction so this stays non-reconnectable, instead of the structured 404 in
    // `data.status` authorizing a reconnect the server's handler already rejected.
    const protocolError = new ProtocolError(-32603, 'Error POSTing to endpoint (HTTP 404): upstream failed', {
      code: 'UPSTREAM_HTTP_ERROR',
      status: 404,
    });

    expect(getMCPDiscoveryErrorDetails(protocolError)).toMatchObject({ httpStatus: 404, code: -32603 });
    expect(isReconnectableMCPError(protocolError)).toBe(false);
  });

  it('classifies structured statuses by status value, not by how the status was attached', () => {
    const httpError = (status: number) =>
      new SdkHttpError(SdkErrorCode.ClientHttpNotImplemented, 'Error POSTing to endpoint: rejected', { status });

    // Statuses just outside the retried 4xx set keep their own verdicts.
    for (const status of [405, 409, 410, 422, 429]) {
      expect(isReconnectableMCPError(httpError(status)), String(status)).toBe(false);
    }
    // 3xx and out-of-band values are neither retried nor mistaken for 4xx.
    for (const status of [301, 599]) {
      expect(isReconnectableMCPError(httpError(status)), String(status)).toBe(false);
    }

    // The walk reaches a wrapped cause, so a cause that contradicts the outer
    // message decides the verdict: this 500 is not retried even though the
    // wrapped 404 would have qualified on its own.
    const wrappedInCause = new Error('Error POSTing to endpoint (HTTP 404): gateway said so');
    wrappedInCause.cause = httpError(500);
    expect(isReconnectableMCPError(wrappedInCause)).toBe(false);
    expect(isReconnectableMCPError(wrappedInCause.cause as Error)).toBe(false);

    // Prototype-less error data still carries the status through the record lookup.
    const prototypeLess = Object.assign(
      new Error('Error POSTing to endpoint'),
      { code: SdkErrorCode.ClientHttpNotImplemented },
      Object.create(null, { data: { value: { status: 404 }, enumerable: true } }),
    );
    expect(isReconnectableMCPError(prototypeLess)).toBe(true);
  });
});

describe('isUnsentRequestError', () => {
  const fetchFailed = (code: string, message: string) =>
    new TypeError('fetch failed', { cause: Object.assign(new Error(message), { code }) });

  it.each([
    ['not connected', new Error('Not connected'), true],
    ['refused connection', fetchFailed('ECONNREFUSED', 'connect ECONNREFUSED 127.0.0.1:1'), true],
    ['unknown host', fetchFailed('ENOTFOUND', 'getaddrinfo ENOTFOUND mcp.invalid'), true],
    ['HTTP 404 from the endpoint', new Error('Error POSTing to endpoint (HTTP 404): Session not found'), true],
    ['socket reset after sending', fetchFailed('UND_ERR_SOCKET', 'other side closed'), false],
    ['response cut off', new Error('TypeError: terminated'), false],
    ['transport closed', new Error('Connection closed'), false],
    ['not reconnectable', new Error('Validation failed'), false],
    ['JSON-RPC error quoting a refused connection', new ProtocolError(-32603, 'connect ECONNREFUSED 10.0.0.2:5432'), false],
    [
      'JSON-RPC error whose data carries a string code and structured 404',
      new ProtocolError(-32603, 'Error POSTing to endpoint (HTTP 404): gone', {
        code: 'UPSTREAM_HTTP_ERROR',
        status: 404,
      }),
      false,
    ],
    [
      'HTTP 500 whose body quotes a refused connection',
      new SdkHttpError(SdkErrorCode.ClientHttpNotImplemented, 'Error POSTing to endpoint: connect ECONNREFUSED 10.0.0.2:5432', {
        status: 500,
      }),
      false,
    ],
    [
      'HTTP 404 with structured status',
      new SdkHttpError(SdkErrorCode.ClientHttpNotImplemented, 'Error POSTing to endpoint (HTTP 404)', { status: 404 }),
      true,
    ],
  ])('%s -> %s', (_label, error, unsent) => {
    expect(isUnsentRequestError(error)).toBe(unsent);
  });
});

describe('isRecoverableTaskPollError', () => {
  const httpError = (status: number) =>
    new SdkHttpError(SdkErrorCode.ClientHttpNotImplemented, `Error POSTing to endpoint (HTTP ${status})`, { status });

  it('retries gateway errors while a server restarts behind a proxy', () => {
    for (const status of [502, 503, 504]) {
      expect(isRecoverableTaskPollError(httpError(status)), String(status)).toBe(true);
      expect(isRecoverableTaskPollError(new Error('poll failed', { cause: httpError(status) })), String(status)).toBe(
        true,
      );
    }
    expect(isReconnectableMCPError(httpError(503))).toBe(false);
  });

  it('keeps the reconnectable failures and rejects other server errors', () => {
    expect(isRecoverableTaskPollError(new Error('connect ECONNREFUSED 127.0.0.1:1'))).toBe(true);
    expect(isRecoverableTaskPollError(httpError(500))).toBe(false);
    expect(isRecoverableTaskPollError(new Error('Task not found'))).toBe(false);
    expect(isRecoverableTaskPollError('fetch failed')).toBe(false);
  });
});
