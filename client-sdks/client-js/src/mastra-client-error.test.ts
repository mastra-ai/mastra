import { describe, expect, it } from 'vitest';
import { MastraClientError } from './types';

describe('MastraClientError.problem', () => {
  it('reads the problem code and metadata from the response body', () => {
    const error = new MastraClientError(404, 'Not Found', 'HTTP error! status: 404', {
      error: 'Agent with id does-not-exist not found',
      problem: { code: 'AGENT_NOT_FOUND', metadata: { agentId: 'does-not-exist' } },
    });

    expect(error.problem).toEqual({ code: 'AGENT_NOT_FOUND', metadata: { agentId: 'does-not-exist' } });
  });

  it('omits metadata when the server sends none', () => {
    const error = new MastraClientError(401, 'Unauthorized', 'HTTP error! status: 401', {
      error: 'Authentication required',
      problem: { code: 'AUTHENTICATION_REQUIRED' },
    });

    expect(error.problem).toEqual({ code: 'AUTHENTICATION_REQUIRED' });
  });

  it('drops metadata that is not a plain object', () => {
    const error = new MastraClientError(400, 'Bad Request', 'HTTP error! status: 400', {
      problem: { code: 'REQUEST_VALIDATION_FAILED', metadata: ['not', 'an', 'object'] },
    });

    expect(error.problem).toEqual({ code: 'REQUEST_VALIDATION_FAILED' });
  });

  it.each([
    ['no body', undefined],
    ['a string body', 'Internal Server Error'],
    ['a body without problem', { error: 'boom' }],
    ['a problem without a string code', { problem: { code: 42 } }],
  ])('is undefined for %s', (_label, body) => {
    expect(
      new MastraClientError(500, 'Internal Server Error', 'HTTP error! status: 500', body).problem,
    ).toBeUndefined();
  });
});
