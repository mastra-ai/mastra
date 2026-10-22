import { describe, expect, it } from 'vitest';
import { isRouteError, isServerError, MastraClientError, matchRouteError, matchServerError } from './types';

describe('MastraClientError code and metadata', () => {
  it('reads the code and metadata from the response body', () => {
    const error = new MastraClientError(404, 'Not Found', 'HTTP error! status: 404', {
      error: 'Agent with id does-not-exist not found',
      code: 'AGENT_NOT_FOUND',
      metadata: { agentId: 'does-not-exist' },
    });

    expect({ code: error.code, metadata: error.metadata }).toEqual({
      code: 'AGENT_NOT_FOUND',
      metadata: { agentId: 'does-not-exist' },
    });
  });

  it('omits metadata when the server sends none', () => {
    const error = new MastraClientError(401, 'Unauthorized', 'HTTP error! status: 401', {
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED',
    });

    expect(error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(error.metadata).toBeUndefined();
  });

  it('drops metadata that is not a plain object', () => {
    const error = new MastraClientError(400, 'Bad Request', 'HTTP error! status: 400', {
      code: 'REQUEST_VALIDATION_FAILED',
      metadata: ['not', 'an', 'object'],
    });

    expect(error.code).toBe('REQUEST_VALIDATION_FAILED');
    expect(error.metadata).toBeUndefined();
  });

  it.each([
    ['no body', undefined],
    ['a string body', 'Internal Server Error'],
    ['a body without a code', { error: 'boom' }],
    ['a body with a non-string code', { code: 42 }],
  ])('is undefined for %s', (_label, body) => {
    const error = new MastraClientError(500, 'Internal Server Error', 'HTTP error! status: 500', body);
    expect(error.code).toBeUndefined();
    expect(error.metadata).toBeUndefined();
  });
});

describe('isServerError / isRouteError', () => {
  it('accepts a client error carrying a business code', () => {
    const error = new MastraClientError(404, 'Not Found', 'HTTP error! status: 404', {
      error: 'Agent not found',
      code: 'AGENT_NOT_FOUND',
      metadata: { agentId: 'missing' },
    });

    expect(isServerError(error)).toBe(true);
    expect(isRouteError(error, 'GET /agents/:agentId')).toBe(true);
  });

  it.each([
    ['a client error without a code', new MastraClientError(500, 'Internal Server Error', 'boom', 'boom')],
    ['a plain Error', new Error('boom')],
    ['a lookalike object', { code: 'AGENT_NOT_FOUND', metadata: { agentId: 'x' } }],
    ['undefined', undefined],
  ])('rejects %s', (_label, value) => {
    expect(isServerError(value)).toBe(false);
    expect(isRouteError(value, 'GET /agents/:agentId')).toBe(false);
  });
});

describe('matchServerError / matchRouteError', () => {
  const notFound = new MastraClientError(404, 'Not Found', 'HTTP error! status: 404', {
    error: 'Agent not found',
    code: 'AGENT_NOT_FOUND',
    metadata: { agentId: 'missing' },
  });

  it('calls the handler for the error code with the error', () => {
    const result = matchRouteError(notFound, 'GET /agents/:agentId', {
      AGENT_NOT_FOUND: e => `unknown ${e.metadata.agentId}`,
      default: () => 'default',
    });
    expect(result).toBe('unknown missing');
  });

  it('falls back to default for unhandled codes and non-server errors', () => {
    const network = new TypeError('fetch failed');
    expect(matchServerError(notFound, { WORKFLOW_NOT_FOUND: () => 'workflow', default: () => 'default' })).toBe(
      'default',
    );
    expect(matchServerError(network, { AGENT_NOT_FOUND: () => 'agent', default: e => e })).toBe(network);
  });

  it('rethrows when nothing matches and there is no default', () => {
    const network = new TypeError('fetch failed');
    const handlers = { AGENT_NOT_FOUND: () => 'agent' } as Parameters<typeof matchServerError<string>>[1];
    expect(() => matchServerError(network, handlers)).toThrow(network);
  });
});
