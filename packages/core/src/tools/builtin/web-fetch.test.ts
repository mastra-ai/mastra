import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dnsLookup: vi.fn(),
  httpRequest: vi.fn(),
  httpsRequest: vi.fn(),
}));

vi.mock('node:dns', () => ({
  lookup: mocks.dnsLookup,
}));

vi.mock('node:http', async () => {
  const actual = await vi.importActual<typeof import('node:http')>('node:http');
  return {
    ...actual,
    default: {
      ...(actual as any),
      request: mocks.httpRequest,
    },
  };
});

vi.mock('node:https', async () => {
  const actual = await vi.importActual<typeof import('node:https')>('node:https');
  return {
    ...actual,
    default: {
      ...(actual as any),
      request: mocks.httpsRequest,
    },
  };
});

import { webFetchTool as exportedWebFetchTool } from '../index';
import { webFetchTool } from './web-fetch';

function allowPublicDns(address = '93.184.216.34') {
  mocks.dnsLookup.mockImplementation((_hostname, options, callback) => {
    if (options.all) {
      callback(null, [{ address, family: 4 }]);
      return;
    }

    callback(null, address, 4);
  });
}

function mockRequest(
  response: Readable & {
    statusCode?: number;
    statusMessage?: string;
    headers: Record<string, string | string[] | undefined>;
  },
) {
  const request = new EventEmitter() as EventEmitter & { end: () => void; destroy: (error?: Error) => void };
  request.end = vi.fn(() => {
    const options = mocks.httpsRequest.mock.calls.at(-1)?.[1] ?? mocks.httpRequest.mock.calls.at(-1)?.[1];
    options.lookup('example.com', {}, (error: Error | null) => {
      if (error) {
        request.emit('error', error);
        return;
      }

      mocks.httpsRequest.mock.calls.at(-1)?.[2](response);
      mocks.httpRequest.mock.calls.at(-1)?.[2](response);
    });
  });
  request.destroy = vi.fn(error => {
    if (error) {
      request.emit('error', error);
    }
  });

  mocks.httpsRequest.mockReturnValue(request);
  mocks.httpRequest.mockReturnValue(request);

  return request;
}

function createResponse(
  chunks: string[],
  init: { statusCode?: number; statusMessage?: string; headers?: Record<string, string | string[]> } = {},
) {
  const response = Readable.from(chunks) as Readable & {
    statusCode?: number;
    statusMessage?: string;
    headers: Record<string, string | string[] | undefined>;
  };
  response.statusCode = init.statusCode ?? 200;
  response.statusMessage = init.statusMessage ?? 'OK';
  response.headers = init.headers ?? {};
  vi.spyOn(response, 'destroy');

  return response;
}

describe('webFetchTool', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches a URL and returns response metadata', async () => {
    allowPublicDns();
    mockRequest(
      createResponse(['Hello world'], {
        statusCode: 200,
        statusMessage: 'OK',
        headers: { 'content-type': 'text/plain' },
      }),
    );

    const result = await (webFetchTool as any).execute({ url: 'https://example.com/page' }, {});

    expect(mocks.httpsRequest).toHaveBeenCalledWith(
      new URL('https://example.com/page'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'user-agent': 'Mastra Web Fetch Tool/1.0',
        }),
      }),
      expect.any(Function),
    );
    expect(result).toEqual({
      content: 'Hello world',
      truncated: false,
      status: 200,
      statusText: 'OK',
      contentType: 'text/plain',
      url: 'https://example.com/page',
      ok: true,
    });
  });

  it('stops reading oversized streaming response bodies', async () => {
    allowPublicDns();
    const response = createResponse(['a'.repeat(100_001)], { statusCode: 200 });
    mockRequest(response);

    const result = await (webFetchTool as any).execute({ url: 'https://example.com/large' }, {});

    expect(result.content).toHaveLength(100_000);
    expect(result.truncated).toBe(true);
    expect(response.destroy).toHaveBeenCalled();
  });

  it('returns non-2xx responses without marking them as tool errors', async () => {
    allowPublicDns();
    mockRequest(createResponse(['Not found'], { statusCode: 404, statusMessage: 'Not Found' }));

    const result = await (webFetchTool as any).execute({ url: 'https://example.com/missing' }, {});

    expect(result).toMatchObject({
      content: 'Not found',
      status: 404,
      statusText: 'Not Found',
      ok: false,
    });
    expect(result.isError).toBeUndefined();
  });

  it('rejects non-HTTP URLs', async () => {
    const result = await (webFetchTool as any).execute({ url: 'file:///etc/passwd' }, {});

    expect(mocks.httpsRequest).not.toHaveBeenCalled();
    expect(result).toEqual({
      content: 'Failed to fetch URL: only HTTP and HTTPS URLs are supported.',
      isError: true,
    });
  });

  it('rejects private hostnames before connecting', async () => {
    const result = await (webFetchTool as any).execute({ url: 'http://localhost:8080' }, {});

    expect(mocks.httpRequest).not.toHaveBeenCalled();
    expect(result).toEqual({
      content: 'Failed to fetch URL: URL resolves to a private or reserved address.',
      isError: true,
    });
  });

  it.each([
    'http://[::1]/',
    'http://[0:0:0:0:0:0:0:1]/',
    'http://[fc00::1]/',
    'http://[0:0:0:0:0:ffff:127.0.0.1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:7f00:1]/',
  ])('rejects private IPv6 literal %s before connecting', async url => {
    const result = await (webFetchTool as any).execute({ url }, {});

    expect(mocks.httpRequest).not.toHaveBeenCalled();
    expect(result).toEqual({
      content: 'Failed to fetch URL: URL resolves to a private or reserved address.',
      isError: true,
    });
  });

  it('rejects private addresses returned by DNS lookup', async () => {
    mocks.dnsLookup.mockImplementation((_hostname, _options, callback) => callback(null, '127.0.0.1', 4));
    mockRequest(createResponse(['internal'], { statusCode: 200 }));

    const result = await (webFetchTool as any).execute({ url: 'https://example.com' }, {});

    expect(result).toEqual({
      content: 'Failed to fetch URL: URL resolves to a private or reserved address.',
      isError: true,
    });
  });

  it('preserves DNS lookup options and rejects blocked addresses in all results', async () => {
    mocks.dnsLookup.mockImplementation((_hostname, options, callback) => {
      expect(options.all).toBe(true);
      callback(null, [
        { address: '93.184.216.34', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ]);
    });

    const request = mockRequest(createResponse(['internal'], { statusCode: 200 }));
    request.end = vi.fn(() => {
      const options = mocks.httpsRequest.mock.calls.at(-1)?.[1];
      options.lookup('example.com', { all: true }, (error: Error | null) => {
        if (error) {
          request.emit('error', error);
        }
      });
    });

    const result = await (webFetchTool as any).execute({ url: 'https://example.com' }, {});

    expect(result).toEqual({
      content: 'Failed to fetch URL: URL resolves to a private or reserved address.',
      isError: true,
    });
  });

  it('validates redirect targets before following them', async () => {
    allowPublicDns();
    const response = createResponse([], {
      statusCode: 302,
      statusMessage: 'Found',
      headers: { location: 'http://169.254.169.254/latest/meta-data' },
    });
    response.resume = vi.fn();
    mockRequest(response);

    const result = await (webFetchTool as any).execute({ url: 'https://example.com/redirect' }, {});

    expect(response.resume).toHaveBeenCalled();
    expect(result).toEqual({
      content: 'Failed to fetch URL: URL resolves to a private or reserved address.',
      isError: true,
    });
  });

  it('returns request errors as tool errors', async () => {
    allowPublicDns();
    const request = new EventEmitter() as EventEmitter & { end: () => void; destroy: (error?: Error) => void };
    request.end = vi.fn(() => request.emit('error', new Error('network down')));
    request.destroy = vi.fn();
    mocks.httpsRequest.mockReturnValue(request);

    const result = await (webFetchTool as any).execute({ url: 'https://example.com' }, {});

    expect(result).toEqual({
      content: 'Failed to fetch URL: network down',
      isError: true,
    });
  });

  it('is exported from the tools index', () => {
    expect(exportedWebFetchTool).toBe(webFetchTool);
  });
});
