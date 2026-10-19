import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

/** Returns the full text of each `<callee>(...)` call in `source`. */
function findCalls(source: string, callee: string): string[] {
  const calls: string[] = [];
  for (let start = source.indexOf(callee); start !== -1; start = source.indexOf(callee, start + 1)) {
    let depth = 0;
    let end = start + callee.length - 1;
    do {
      if (source[end] === '(') depth++;
      if (source[end] === ')') depth--;
      end++;
    } while (depth > 0 && end < source.length);
    calls.push(source.slice(start, end));
  }
  return calls;
}

describe('built-in server code', () => {
  // `code` is optional for compatibility with custom routes, so built-in throw sites are checked here instead.
  const serverDir = join(__dirname, '..');
  const sources = readdirSync(serverDir, { recursive: true, encoding: 'utf8' })
    .filter(file => file.endsWith('.ts') && !file.endsWith('.d.ts') && !file.includes('.test.'))
    .map(file => ({ file, source: readFileSync(join(serverDir, file), 'utf8') }));

  it('passes a business code to every HTTPException and handleError call', () => {
    const missing = sources.flatMap(({ file, source }) =>
      [...findCalls(source, 'new HTTPException('), ...findCalls(source, 'handleError(')]
        // Skip the definition and wrappers forwarding a `HandleErrorFallback`, whose `code` is required by its type.
        .filter(call => !call.includes('code') && !/^handleError\(\w+(: unknown|, fallback\))/.test(call))
        .map(call => `${file}: ${call.slice(0, 80)}`),
    );
    expect(missing).toEqual([]);
  });
});
