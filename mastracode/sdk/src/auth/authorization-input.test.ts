import { describe, expect, it } from 'vitest';
import { parseAuthorizationInput } from './authorization-input.js';

describe('parseAuthorizationInput', () => {
  it('returns empty for blank input', () => {
    expect(parseAuthorizationInput('')).toEqual({});
    expect(parseAuthorizationInput('   ')).toEqual({});
  });

  it('parses a full redirect URL', () => {
    expect(parseAuthorizationInput('https://example.com/callback?code=abc&state=xyz')).toEqual({
      code: 'abc',
      state: 'xyz',
    });
  });

  it('parses a URL without a state', () => {
    expect(parseAuthorizationInput('https://example.com/callback?code=abc')).toEqual({
      code: 'abc',
      state: undefined,
    });
  });

  it('parses the code#state form', () => {
    expect(parseAuthorizationInput('abc#xyz')).toEqual({ code: 'abc', state: 'xyz' });
  });

  it('parses a raw query string', () => {
    expect(parseAuthorizationInput('code=abc&state=xyz')).toEqual({ code: 'abc', state: 'xyz' });
  });

  it('treats anything else as a bare code', () => {
    expect(parseAuthorizationInput('  abc  ')).toEqual({ code: 'abc' });
  });
});
