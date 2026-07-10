import type { lookup as defaultLookup } from 'node:dns/promises';
import type { IncomingHttpHeaders } from 'node:http';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import { __testing } from './web-fetch.js';

function publicLookup(address = '93.184.216.34') {
  return vi.fn().mockResolvedValue([{ address, family: 4 }]) as unknown as typeof defaultLookup;
}

function response(options: {
  statusCode?: number;
  statusMessage?: string;
  headers?: IncomingHttpHeaders;
  body?: string;
}) {
  const dispose = vi.fn();
  return {
    statusCode: options.statusCode ?? 200,
    statusMessage: options.statusMessage ?? 'OK',
    headers: options.headers ?? { 'content-type': 'application/json' },
    body: Readable.from([Buffer.from(options.body ?? '{"ok":true}')]),
    dispose,
  };
}

describe('fetchPublicUrl', () => {
  it('blocks local destinations before opening a connection', async () => {
    const transport = vi.fn();

    await expect(__testing.fetchPublicUrl('http://localhost:4111/private', { transport })).rejects.toThrow(
      'blocked a local, private, or reserved destination',
    );
    expect(transport).not.toHaveBeenCalled();
  });

  it('blocks public hostnames that resolve to a private address', async () => {
    const transport = vi.fn();

    await expect(
      __testing.fetchPublicUrl('https://example.com', {
        lookup: publicLookup('10.0.0.5'),
        transport,
      }),
    ).rejects.toThrow('resolved to a local, private, or reserved address');
    expect(transport).not.toHaveBeenCalled();
  });

  it('pins requests to the validated address and returns exact JSON', async () => {
    const transport = vi.fn().mockResolvedValue(
      response({
        headers: { 'content-type': 'application/vnd.github+json' },
        body: '{"stargazers_count":26018}',
      }),
    );

    const result = await __testing.fetchPublicUrl('https://api.github.com/repos/mastra-ai/mastra', {
      lookup: publicLookup(),
      transport,
    });

    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        address: '93.184.216.34',
        servername: 'api.github.com',
      }),
    );
    expect(result).toContain('Status: 200 OK');
    expect(result).toContain('{"stargazers_count":26018}');
  });

  it('revalidates redirected destinations', async () => {
    const redirect = response({
      statusCode: 302,
      statusMessage: 'Found',
      headers: { location: 'http://127.0.0.1:4111/private' },
    });
    const transport = vi.fn().mockResolvedValue(redirect);

    await expect(
      __testing.fetchPublicUrl('https://example.com/start', {
        lookup: publicLookup(),
        transport,
      }),
    ).rejects.toThrow('blocked a local, private, or reserved destination');
    expect(redirect.dispose).toHaveBeenCalledOnce();
    expect(transport).toHaveBeenCalledOnce();
  });
});
