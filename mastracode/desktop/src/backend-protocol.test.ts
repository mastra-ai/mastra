import { describe, expect, it } from 'vitest';

import { parseDesktopBackendRequest, parseDesktopBackendResponse } from './backend-protocol.js';

describe('desktop backend protocol', () => {
  it('parses each request shape', () => {
    expect(
      parseDesktopBackendRequest({ type: 'start', requestId: '1', projectAccessFile: '/tmp/access.json' }),
    ).toEqual({
      type: 'start',
      requestId: '1',
      projectAccessFile: '/tmp/access.json',
    });
    expect(parseDesktopBackendRequest({ type: 'approve-project', requestId: '2', path: '/tmp/project' })).toEqual({
      type: 'approve-project',
      requestId: '2',
      path: '/tmp/project',
    });
    expect(parseDesktopBackendRequest({ type: 'close', requestId: '3' })).toEqual({
      type: 'close',
      requestId: '3',
    });
  });

  it('parses each response shape', () => {
    expect(
      parseDesktopBackendResponse({
        type: 'started',
        requestId: '1',
        bootstrapUrl: 'http://127.0.0.1:41731/bootstrap',
        origin: 'http://127.0.0.1:41731',
        port: 41731,
      }),
    ).toMatchObject({ type: 'started', port: 41731 });
    expect(parseDesktopBackendResponse({ type: 'approved-project', requestId: '2', path: '/tmp/project' })).toEqual({
      type: 'approved-project',
      requestId: '2',
      path: '/tmp/project',
    });
    expect(parseDesktopBackendResponse({ type: 'closed', requestId: '3' })).toEqual({
      type: 'closed',
      requestId: '3',
    });
    expect(parseDesktopBackendResponse({ type: 'error', requestId: '4', message: 'failed' })).toEqual({
      type: 'error',
      requestId: '4',
      message: 'failed',
    });
  });

  it('rejects malformed and out-of-range messages', () => {
    expect(() => parseDesktopBackendRequest({ type: 'close', requestId: '' })).toThrow('request envelope is invalid');
    expect(() => parseDesktopBackendRequest({ type: 'approve-project', requestId: '1', path: 42 })).toThrow(
      'request is invalid',
    );
    expect(() =>
      parseDesktopBackendResponse({
        type: 'started',
        requestId: '1',
        bootstrapUrl: 'http://127.0.0.1:70000/bootstrap',
        origin: 'http://127.0.0.1:70000',
        port: 70_000,
      }),
    ).toThrow('response is invalid');
  });
});
