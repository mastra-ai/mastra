import { describe, expect, it } from 'vitest';
import { formatOmError } from '../error';
import { createBufferingFailedMarker, createObservationFailedMarker } from '../markers';

const providerError = () =>
  Object.assign(new Error('Bad Request'), {
    statusCode: 400,
    responseBody: JSON.stringify({
      error: { message: 'Unsupported parameter: temperature', type: 'invalid_request_error' },
      request: { prompt: 'private conversation', apiKey: 'secret-key' },
    }),
    url: 'https://provider.invalid?key=secret-key',
    requestBodyValues: { prompt: 'private conversation' },
    responseHeaders: { authorization: 'Bearer secret-key' },
  });

const diagnostic = 'Bad Request: HTTP 400: Unsupported parameter: temperature';

describe('formatOmError', () => {
  it('extracts provider diagnostics without serializing request metadata or the entire response', () => {
    expect(formatOmError(providerError())).toBe(diagnostic);
  });

  it.each([
    {
      provider: 'Anthropic',
      statusCode: 529,
      responseBody: {
        type: 'error',
        error: { type: 'overloaded_error', message: 'Synthetic provider overload' },
        request_id: 'private-request-id',
      },
      diagnostic: 'Synthetic provider overload',
    },
    {
      provider: 'Gemini',
      statusCode: 429,
      responseBody: {
        error: {
          code: 429,
          status: 'RESOURCE_EXHAUSTED',
          message: 'Synthetic quota exhausted',
          details: [{ metadata: { consumer: 'private-project-id', apiKey: 'secret-key' } }],
        },
      },
      diagnostic: 'Synthetic quota exhausted',
    },
  ])(
    'preserves $provider diagnostics without including other response fields',
    ({ statusCode, responseBody, diagnostic }) => {
      const error = Object.assign(new Error('Provider request failed'), {
        statusCode,
        responseBody: JSON.stringify(responseBody),
      });
      expect(formatOmError(error)).toBe(`Provider request failed: HTTP ${statusCode}: ${diagnostic}`);

      // SDKs may also copy the provider diagnostic into the outer error message.
      error.message = diagnostic;
      expect(formatOmError(error)).toBe(`${diagnostic}: HTTP ${statusCode}`);
    },
  );

  it('preserves Codex string details without including other response fields', () => {
    const error = Object.assign(new Error('Bad Request'), {
      statusCode: 400,
      responseBody: JSON.stringify({
        detail: 'Synthetic Codex rejection for diagnostic testing',
        request: { prompt: 'private conversation', apiKey: 'secret-key' },
      }),
    });
    const expected = 'Bad Request: HTTP 400: Synthetic Codex rejection for diagnostic testing';
    expect(formatOmError(error)).toBe(expected);
    for (const createMarker of [createBufferingFailedMarker, createObservationFailedMarker]) {
      const marker = createMarker({
        cycleId: 'cycle',
        operationType: 'observation',
        startedAt: new Date().toISOString(),
        tokensAttempted: 100,
        error,
        recordId: 'record',
        threadId: 'thread',
      });
      expect(JSON.parse(JSON.stringify(marker)).data.error).toBe(expected);
    }
  });

  it.each([null, 400, { message: 'private conversation' }, [{ input: 'secret-key' }]])(
    'ignores non-string provider details: %j',
    detail => {
      const error = Object.assign(new Error('Bad Request'), { responseBody: JSON.stringify({ detail }) });
      expect(formatOmError(error)).toBe('Bad Request');
    },
  );

  it('preserves nested causes and plain serialized errors', () => {
    expect(formatOmError(new Error('Observer failed', { cause: providerError() }))).toBe(
      `Observer failed: ${diagnostic}`,
    );
    expect(formatOmError({ message: 'Observer failed', error: providerError() })).toBe(
      `Observer failed: ${diagnostic}`,
    );
  });

  it('handles top-level and string provider error messages', () => {
    for (const body of [{ message: 'Model unavailable' }, { error: 'Model unavailable' }]) {
      expect(formatOmError(Object.assign(new Error('Bad Request'), { responseBody: JSON.stringify(body) }))).toBe(
        'Bad Request: Model unavailable',
      );
    }
  });

  it('does not include malformed, HTML, or unrecognized response bodies', () => {
    for (const responseBody of [
      'secret-key',
      '<html>private proxy response</html>',
      '{',
      '{"prompt":"private"}',
      'null',
    ]) {
      expect(formatOmError(Object.assign(new Error('Bad Request'), { responseBody }))).toBe('Bad Request');
    }
  });

  it('deduplicates messages and terminates cyclic causes', () => {
    const error = Object.assign(new Error('Bad Request'), { cause: providerError() });
    Object.assign(error.cause, { cause: error });
    expect(formatOmError(error)).toBe(diagnostic);
  });

  it('bounds the displayed diagnostic', () => {
    const result = formatOmError(
      Object.assign(new Error('Bad Request'), { responseBody: JSON.stringify({ message: 'x'.repeat(4000) }) }),
    );
    expect(result).toHaveLength(2000);
    expect(result.endsWith('...')).toBe(true);
  });

  it.each([new Error('timeout'), 'timeout', { message: 'timeout' }])('preserves ordinary messages', error => {
    expect(formatOmError(error)).toBe('timeout');
  });

  it('handles non-error values', () => {
    expect(formatOmError(null)).toBe('null');
    expect(formatOmError(undefined)).toBe('Unknown error');
    expect(formatOmError({})).toBe('Unknown error');
  });
});

const malformedErrors = [
  ...['message', 'statusCode', 'responseBody', 'cause', 'error'].map(property => ({
    name: `throwing ${property} getter`,
    create: () =>
      Object.defineProperty({}, property, {
        get() {
          throw new Error('getter failed');
        },
      }),
  })),
  {
    name: 'throwing Proxy',
    create: () =>
      new Proxy(
        {},
        {
          get() {
            throw new Error('trap failed');
          },
        },
      ),
  },
  {
    name: 'revoked Proxy',
    create: () => {
      const { proxy, revoke } = Proxy.revocable({}, {});
      revoke();
      return proxy;
    },
  },
];

describe.each(malformedErrors)('$name', ({ create }) => {
  it('falls back without throwing during formatting', () => {
    expect(formatOmError(create())).toBe('Unknown error');
    expect(formatOmError(new Error('Wrapper', { cause: create() }))).toBe('Wrapper');
    expect(formatOmError(Object.assign(providerError(), { cause: create() }))).toBe(diagnostic);
  });

  it.each([createBufferingFailedMarker, createObservationFailedMarker])(
    'still creates a failure marker',
    createMarker => {
      const marker = createMarker({
        cycleId: 'cycle',
        operationType: 'observation',
        startedAt: new Date().toISOString(),
        tokensAttempted: 100,
        error: create(),
        recordId: 'record',
        threadId: 'thread',
      });
      expect(JSON.parse(JSON.stringify(marker)).data.error).toBe('Unknown error');
    },
  );
});

describe.each([createBufferingFailedMarker, createObservationFailedMarker])(
  'OM failure marker diagnostics',
  createMarker => {
    it.each(['observation', 'reflection'] as const)('preserves %s diagnostics across JSON transport', operationType => {
      const marker = createMarker({
        cycleId: 'cycle',
        operationType,
        startedAt: new Date().toISOString(),
        tokensAttempted: 100,
        error: providerError(),
        recordId: 'record',
        threadId: 'thread',
      });
      expect(JSON.parse(JSON.stringify(marker)).data.error).toBe(diagnostic);
    });
  },
);
