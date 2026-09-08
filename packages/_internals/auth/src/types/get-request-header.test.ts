import { describe, expect, it } from 'vitest';

import { getRequestHeader } from './index';

describe('getRequestHeader', () => {
  it('reads from a fetch Request', () => {
    const request = new Request('http://localhost/', {
      headers: { Cookie: 'session=abc', Authorization: 'Bearer tok' },
    });

    expect(getRequestHeader(request, 'cookie')).toBe('session=abc');
    expect(getRequestHeader(request, 'authorization')).toBe('Bearer tok');
  });

  it('reads from Hono-like request.raw', () => {
    const raw = new Request('http://localhost/', {
      headers: { Cookie: 'session=raw' },
    });

    expect(getRequestHeader({ raw, header: () => undefined }, 'cookie')).toBe('session=raw');
  });

  it('reads from Headers without throwing', () => {
    const headers = new Headers({ Cookie: 'session=headers' });
    expect(getRequestHeader({ headers, header: () => undefined }, 'cookie')).toBe('session=headers');
  });

  it('uses header() for Express-like requests (plain headers object)', () => {
    const request = {
      headers: { cookie: 'session=express', authorization: 'Bearer tok' } as Record<
        string,
        string | string[] | undefined
      >,
      header(name: string) {
        const value = this.headers[name.toLowerCase()];
        return Array.isArray(value) ? value[0] : value;
      },
    };

    // Previously threw: TypeError: request.headers.get is not a function
    expect(getRequestHeader(request, 'cookie')).toBe('session=express');
    expect(getRequestHeader(request, 'authorization')).toBe('Bearer tok');
  });

  it('reads plain header objects when header() is absent', () => {
    const request = {
      headers: { cookie: 'session=plain', 'x-api-key': ['first', 'second'] },
    };

    expect(getRequestHeader(request, 'Cookie')).toBe('session=plain');
    expect(getRequestHeader(request, 'x-api-key')).toBe('first');
  });

  it('reads mixed-case plain-object keys case-insensitively', () => {
    const request = {
      headers: { Authorization: 'Bearer tok', Cookie: 'session=Mixed' },
    };

    expect(getRequestHeader(request, 'authorization')).toBe('Bearer tok');
    expect(getRequestHeader(request, 'COOKIE')).toBe('session=Mixed');
  });

  it('returns null when the header is missing', () => {
    expect(getRequestHeader(new Request('http://localhost/'), 'cookie')).toBeNull();
    expect(getRequestHeader({ headers: {} }, 'cookie')).toBeNull();
  });
});
