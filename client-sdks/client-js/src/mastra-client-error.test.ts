import { describe, expect, it } from 'vitest';
import { getServerError, MastraClientError } from './types';

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

describe('getServerError', () => {
  it('returns the plain { error, code, metadata } object from the response body', () => {
    const error = new MastraClientError(404, 'Not Found', 'HTTP error! status: 404', {
      error: 'Agent not found',
      code: 'AGENT_NOT_FOUND',
      metadata: { agentId: 'missing' },
    });

    expect(getServerError(error)).toStrictEqual({
      error: 'Agent not found',
      code: 'AGENT_NOT_FOUND',
      metadata: { agentId: 'missing' },
    });
    expect(getServerError(error, 'GET /agents/:agentId')).toStrictEqual(getServerError(error));
  });

  it('omits metadata when the server sends none', () => {
    const error = new MastraClientError(401, 'Unauthorized', 'HTTP error! status: 401', {
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED',
    });

    expect(getServerError(error)).toStrictEqual({ error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED' });
  });

  it('reads the message from bodies that use `message` instead of `error`', () => {
    const error = new MastraClientError(422, 'Unprocessable Entity', 'HTTP error! status: 422', {
      code: 'TRACE_QUERY_INVALID',
      message: 'The trace query is invalid',
      issues: [],
    });

    expect(getServerError(error)).toStrictEqual({ error: 'The trace query is invalid', code: 'TRACE_QUERY_INVALID' });
  });

  it.each([
    ['a client error without a code', new MastraClientError(500, 'Internal Server Error', 'boom', 'boom')],
    ['a network failure', new TypeError('fetch failed')],
    ['a lookalike object', { error: 'x', code: 'AGENT_NOT_FOUND', metadata: { agentId: 'x' } }],
    ['undefined', undefined],
  ])('is undefined for %s', (_label, value) => {
    expect(getServerError(value)).toBeUndefined();
    expect(getServerError(value, 'GET /agents/:agentId')).toBeUndefined();
  });
});
