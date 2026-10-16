import { describe, expect, it } from 'vitest';
import { SERVER_ERROR_CODES, isServerErrorCode, isServerProblem } from './index';

const HTTP_STATUS_NAMES = [
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'UNPROCESSABLE_ENTITY',
  'TOO_MANY_REQUESTS',
  'INTERNAL_SERVER_ERROR',
  'NOT_IMPLEMENTED',
  'BAD_GATEWAY',
  'SERVICE_UNAVAILABLE',
  'GATEWAY_TIMEOUT',
];

describe('SERVER_ERROR_CODES', () => {
  it('maps every key to itself', () => {
    for (const [key, value] of Object.entries(SERVER_ERROR_CODES)) {
      expect(value).toBe(key);
    }
  });

  it('uses UPPER_SNAKE keys', () => {
    for (const key of Object.keys(SERVER_ERROR_CODES)) {
      expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  it('never restates a bare HTTP status', () => {
    for (const name of HTTP_STATUS_NAMES) {
      expect(SERVER_ERROR_CODES).not.toHaveProperty(name);
    }
  });
});

describe('isServerErrorCode', () => {
  it('accepts catalog codes only', () => {
    expect(isServerErrorCode('AGENT_NOT_FOUND')).toBe(true);
    expect(isServerErrorCode('NOT_A_CODE')).toBe(false);
    expect(isServerErrorCode('toString')).toBe(false);
    expect(isServerErrorCode(42)).toBe(false);
  });
});

describe('isServerProblem', () => {
  it('accepts a problem without metadata', () => {
    expect(isServerProblem({ code: 'AGENT_NOT_FOUND' })).toBe(true);
  });

  it('accepts a problem with plain-object metadata', () => {
    expect(isServerProblem({ code: 'AGENT_NOT_FOUND', metadata: { agentId: 'a' } })).toBe(true);
  });

  it('rejects a missing or unknown code', () => {
    expect(isServerProblem({})).toBe(false);
    expect(isServerProblem({ code: 'NOT_FOUND' })).toBe(false);
  });

  it('rejects non-object metadata', () => {
    expect(isServerProblem({ code: 'AGENT_NOT_FOUND', metadata: 'x' })).toBe(false);
    expect(isServerProblem({ code: 'AGENT_NOT_FOUND', metadata: ['x'] })).toBe(false);
    expect(isServerProblem({ code: 'AGENT_NOT_FOUND', metadata: null })).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(isServerProblem(null)).toBe(false);
    expect(isServerProblem('AGENT_NOT_FOUND')).toBe(false);
  });
});
