import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import https from 'node:https';
import { createServer } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import {
  fetchPublicPage,
  nodePinnedTransport,
  type DnsResolver,
  type PinnedTransport,
} from '../src/mastra/lib/acquisition';
import { loadConfig } from '../src/mastra/config';
import { MonitorStore } from '../src/mastra/lib/store';
import { processSource } from '../src/mastra/workflows/source-processing';
import { diffContent, normalizeHtml } from '../src/mastra/lib/content';
import { validateMonitorInput } from '../src/mastra/schemas';

const publicDns: DnsResolver = async () => [{ address: '93.184.216.34', family: 4 }];
const bytes = (text: string) => new TextEncoder().encode(text);

describe('acquisition and semantic content', () => {
  it('rejects_robots_denied_redirect_before_request', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'monitor-robots-redirect-'));
    const store = MonitorStore.open(`file:${join(directory, 'monitor.db')}`);
    const config = loadConfig({ MONITOR_DATABASE_URL: `file:${join(directory, 'monitor.db')}` });
    const input = validateMonitorInput({
      monitorId: 'robots-monitor',
      profile: { name: 'Robots monitor', interests: ['pricing'] },
      sources: [
        { id: 'pricing', label: 'Pricing', url: 'https://public.example/pricing', kind: 'pricing', fetchMode: 'http' },
      ],
    });
    let redirectMode: 'none' | 'direct' | 'chain' = 'none';
    const requests: string[] = [];
    const transport: PinnedTransport = async ({ url }) => {
      requests.push(url.pathname);
      if (url.pathname === '/robots.txt')
        return { status: 302, headers: { location: '/robots-policy' }, body: bytes('') };
      if (url.pathname === '/robots-policy')
        return {
          status: 200,
          headers: { 'content-type': 'text/plain' },
          body: bytes('User-agent: *\nDisallow: /forbidden\nAllow: /'),
        };
      if (redirectMode !== 'none')
        return {
          status: 302,
          headers: { location: redirectMode === 'chain' && url.pathname === '/pricing' ? '/hop' : '/forbidden' },
          body: bytes(''),
        };
      return {
        status: 200,
        headers: { 'content-type': 'text/html' },
        body: bytes(
          '<main><h1>Pricing</h1><p>' +
            'Public pricing and clear product documentation for growing teams. '.repeat(8) +
            '</p></main>',
        ),
      };
    };
    try {
      const baselineRun = await store.beginRun(input.monitorId);
      await processSource(input, baselineRun.id, input.sources[0]!, { store, config, resolver: publicDns, transport });
      await store.finishRun(baselineRun, 'success', {});
      const baseline = await store.baseline(input.monitorId, 'pricing');
      for (const mode of ['direct', 'chain'] as const) {
        redirectMode = mode;
        requests.splice(0);
        const run = await store.beginRun(input.monitorId);
        await expect(
          processSource(input, run.id, input.sources[0]!, { store, config, resolver: publicDns, transport }),
        ).rejects.toThrow('ROBOTS_DENIED');
        expect(requests).not.toContain('/forbidden');
        expect(requests.filter(path => path === '/robots.txt')).toHaveLength(mode === 'direct' ? 2 : 3);
        expect((await store.baseline(input.monitorId, 'pricing'))?.id).toBe(baseline?.id);
        expect(await store.pendingForRun(run.id)).toEqual([]);
        await store.finishRun(run, 'failed', {});
      }
    } finally {
      await store.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.each(['', 'javascript', 'application/javascript\r\nX-Injected: yes', 'text/html-invalid'])(
    'rejects missing or invalid document MIME %j',
    async contentType => {
      await expect(
        fetchPublicPage('https://public.example/', {
          resolver: publicDns,
          transport: async () => ({
            status: 200,
            headers: { 'content-type': contentType },
            body: bytes('<main>public</main>'),
          }),
        }),
      ).rejects.toThrow('INVALID_CONTENT_TYPE');
    },
  );

  it('rejects_private_redirect_and_rebinding', async () => {
    const privateRedirect: PinnedTransport = async ({ url }) => ({
      status: 302,
      headers: { location: url.pathname === '/' ? 'http://127.0.0.1/private' : undefined },
      body: bytes(''),
    });
    await expect(
      fetchPublicPage('https://public.example/', { resolver: publicDns, transport: privateRedirect }),
    ).rejects.toThrow('UNSAFE_REDIRECT_HOST');

    let resolverCalls = 0;
    let transportCalls = 0;
    const sameHostRebinding: DnsResolver = async () => {
      resolverCalls += 1;
      return resolverCalls === 1 ? [{ address: '93.184.216.34', family: 4 }] : [{ address: '127.0.0.1', family: 4 }];
    };
    const sameHostRedirect: PinnedTransport = async () => {
      transportCalls += 1;
      return { status: 302, headers: { location: '/private' }, body: bytes('') };
    };
    await expect(
      fetchPublicPage('https://public.example/', { resolver: sameHostRebinding, transport: sameHostRedirect }),
    ).rejects.toThrow('UNSAFE_ADDRESS');
    expect({ resolverCalls, transportCalls }).toEqual({ resolverCalls: 2, transportCalls: 1 });

    const mixedAnswers: DnsResolver = async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '::ffff:127.0.0.1', family: 6 },
    ];
    await expect(
      fetchPublicPage('https://public.example/', { resolver: mixedAnswers, transport: privateRedirect }),
    ).rejects.toThrow('UNSAFE_ADDRESS');
    await expect(fetchPublicPage('http://localhost/', { transport: privateRedirect })).rejects.toThrow(
      'UNSAFE_ADDRESS',
    );
    await expect(fetchPublicPage('http://[::ffff:127.0.0.1]/', { transport: privateRedirect })).rejects.toThrow(
      'UNSAFE_ADDRESS',
    );

    const requestSpy = vi.spyOn(https, 'request').mockImplementation(((
      url: URL,
      options: any,
      callback: (response: EventEmitter) => void,
    ) => {
      const request = Object.assign(new EventEmitter(), {
        destroy: vi.fn(),
        setTimeout: vi.fn(),
        end: () => {
          const response = Object.assign(new EventEmitter(), {
            statusCode: 200,
            complete: true,
            headers: { 'content-type': 'text/html' },
          });
          callback(response);
          response.emit('data', Buffer.from('<main>public document</main>'));
          response.emit('end');
        },
      });
      return request;
    }) as any);
    try {
      const response = await nodePinnedTransport({
        url: new URL('https://public.example/pricing'),
        hostname: 'public.example',
        address: { address: '93.184.216.34', family: 4 },
        timeoutMs: 100,
      });
      const [requestedUrl, options] = requestSpy.mock.calls[0]!;
      let pinnedAddress: string | undefined;
      let pinnedFamily: number | undefined;
      const pinnedLookup = options.lookup;
      if (!pinnedLookup) throw new Error('PINNED_LOOKUP_MISSING');
      pinnedLookup('a-second-resolution-must-not-run', {}, (_error, address, family) => {
        pinnedAddress = typeof address === 'string' ? address : undefined;
        pinnedFamily = family;
      });
      expect(response.status).toBe(200);
      expect(requestedUrl).toMatchObject({ hostname: 'public.example' });
      expect(options).toMatchObject({ servername: 'public.example', headers: { Host: 'public.example' } });
      expect({ pinnedAddress, pinnedFamily }).toEqual({ pinnedAddress: '93.184.216.34', pinnedFamily: 4 });
      const allAddresses = vi.fn();
      pinnedLookup('a-second-resolution-must-not-run', { all: true }, allAddresses);
      expect(allAddresses).toHaveBeenCalledWith(null, [{ address: '93.184.216.34', family: 4 }]);

      await nodePinnedTransport({
        url: new URL('https://public.example/pricing'),
        hostname: 'public.example',
        address: { address: '2606:4700:4700::1111', family: 6 },
        timeoutMs: 100,
      });
      const ipv6Lookup = requestSpy.mock.calls[1]![1].lookup!;
      const ipv6All = vi.fn();
      const ipv6Single = vi.fn();
      ipv6Lookup('public.example', { all: true }, ipv6All);
      ipv6Lookup('public.example', {}, ipv6Single);
      expect(ipv6All).toHaveBeenCalledWith(null, [{ address: '2606:4700:4700::1111', family: 6 }]);
      expect(ipv6Single).toHaveBeenCalledWith(null, '2606:4700:4700::1111', 6);
    } finally {
      requestSpy.mockRestore();
    }
  });

  it('defers a valid HTTP-date Retry-After beyond the configured retry ceiling', async () => {
    const transport: PinnedTransport = async () => ({
      status: 429,
      headers: { 'retry-after': new Date(Date.now() + 60_000).toUTCString() },
      body: bytes('busy'),
    });
    await expect(fetchPublicPage('https://public.example/', { resolver: publicDns, transport })).rejects.toThrow(
      'RETRY_DEFERRED',
    );
  });

  it('preserves_price_table_and_section_evidence', () => {
    const before = normalizeHtml(`
      <main><h1>Plans</h1><p>Starter costs $19 per month.</p>
      <table><tr><th>Plan</th><th>Price</th></tr><tr><td>Pro</td><td>$59</td></tr></table>
      <ul><li>Available from 2026-10-01</li></ul></main>`);
    const after = normalizeHtml(`
      <main><h1>Plans</h1><p>Starter costs $29 per month.</p>
      <table><tr><th>Plan</th><th>Price</th></tr><tr><td>Pro</td><td>$49</td></tr></table>
      <ul><li>Available from 2026-10-01</li></ul></main>`);
    const evidence = diffContent(before, after);
    expect(after.text).toContain('$29');
    expect(after.text).toContain('Plan | Price');
    expect(after.text).toContain('Pro | $49');
    expect(after.text).toContain('2026-10-01');
    expect(evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          beforeText: 'Starter costs $19 per month.',
          afterText: 'Starter costs $29 per month.',
        }),
        expect.objectContaining({ beforeText: 'Pro | $59', afterText: 'Pro | $49' }),
      ]),
    );
  });

  it('preserves direct and container anchor destinations as exact change evidence without duplicates', () => {
    const directBefore = normalizeHtml('<main><a href="/v1/migration">Migration guide</a></main>');
    const directAfter = normalizeHtml('<main><a href="/v2/migration">Migration guide</a></main>');
    const containerBefore = normalizeHtml('<main><div><a href="/v1/migration">Migration guide</a></div></main>');
    const containerAfter = normalizeHtml('<main><div><a href="/v2/migration">Migration guide</a></div></main>');
    expect(directBefore.text).toBe('Migration guide </v1/migration>');
    expect(containerBefore.text).toBe(directBefore.text);
    expect(containerBefore.sections).toHaveLength(1);
    expect(normalizeHtml('<main><a href="">Visible label</a></main>').text).toBe('Visible label <>');
    expect(diffContent(directBefore, directAfter)).toEqual([
      expect.objectContaining({
        beforeText: 'Migration guide </v1/migration>',
        afterText: 'Migration guide </v2/migration>',
      }),
    ]);
    expect(diffContent(containerBefore, containerAfter)).toEqual([
      expect.objectContaining({
        beforeText: 'Migration guide </v1/migration>',
        afterText: 'Migration guide </v2/migration>',
      }),
    ]);
  });

  it('preserves nested layout text, local plan identity and same-section reorders', () => {
    const before = normalizeHtml(`
      <main>Welcome <span>to pricing</span><div><h2>Starter</h2><div><p>Starter <span>$19</span> includes reports.</p></div></div>
      <section><h2>Pro</h2><div><p>Pro <span>$49</span> includes exports.</p></div></section></main>`);
    const after = normalizeHtml(`
      <main>Welcome <span>to pricing</span><div><h2>Starter</h2><div><p>Starter <span>$49</span> includes reports.</p></div></div>
      <section><h2>Pro</h2><div><p>Pro <span>$19</span> includes exports.</p></div></section></main>`);
    expect(before.text).toContain('Welcome to pricing');
    expect(before.text).toContain('Starter $19 includes reports.');
    expect(before.text).toContain('Pro $49 includes exports.');
    expect(diffContent(before, after)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sectionKey: expect.stringContaining('heading:starter'),
          afterText: 'Starter $49 includes reports.',
        }),
        expect.objectContaining({
          sectionKey: expect.stringContaining('heading:pro'),
          afterText: 'Pro $19 includes exports.',
        }),
      ]),
    );

    const reorderedBefore = normalizeHtml('<main><h1>Features</h1><p>Exports</p><p>Reports</p></main>');
    const reorderedAfter = normalizeHtml('<main><h1>Features</h1><p>Reports</p><p>Exports</p></main>');
    expect(diffContent(reorderedBefore, reorderedAfter)).toEqual([]);
  });

  it('persists full changed block evidence when the bounded excerpt overflows', () => {
    const prefix = 'evidence '.repeat(1_200);
    const before = normalizeHtml(`<main><div>${prefix}old suffix</div></main>`);
    const after = normalizeHtml(`<main><div>${prefix}new suffix</div></main>`);
    const [evidence] = diffContent(before, after);
    expect(evidence?.afterText).toContain('new suffix');
    expect(evidence).toMatchObject({ excerptTruncated: true });
  });

  it('rejects invalid duplicate monitor sources before acquisition', () => {
    expect(() =>
      validateMonitorInput({
        monitorId: 'm',
        profile: { name: 'Operator', interests: ['pricing'] },
        sources: [
          { id: 'one', label: 'One', url: 'https://example.com/path', kind: 'pricing' },
          { id: 'two', label: 'Two', url: 'https://EXAMPLE.com/path#fragment', kind: 'blog', fetchMode: 'http' },
        ],
      }),
    ).toThrow('DUPLICATE_SOURCE_CONFLICT');
  });

  it('detects a declared non-English document during normalization', () => {
    expect(() =>
      validateMonitorInput({
        monitorId: 'duplicate-id',
        profile: { name: 'Operator', interests: ['pricing'] },
        sources: [
          { id: 'same', label: 'One', url: 'https://one.example/', kind: 'pricing' },
          { id: 'same', label: 'Two', url: 'https://two.example/', kind: 'pricing' },
        ],
      }),
    ).toThrow('DUPLICATE_SOURCE_ID');
    expect(
      normalizeHtml(
        '<html lang="fr"><main><p>Bonjour, le prix mensuel est de vingt-neuf euros avec assistance incluse.</p></main></html>',
      ).language,
    ).toBe('unsupported');
  });

  it('deduplicates compatible normalized source URLs', () => {
    const input = validateMonitorInput({
      monitorId: 'dedup',
      profile: { name: 'Operator', interests: ['pricing'] },
      sources: [
        { id: 'one', label: 'One', url: 'https://example.com/path', kind: 'pricing' },
        { id: 'two', label: 'Two', url: 'https://EXAMPLE.com/path#fragment', kind: 'pricing' },
      ],
    });
    expect(input.sources).toHaveLength(1);
  });
});

it.each([false, true])('settles a real HTTP response when complete=%s and removes abort listeners', async complete => {
  const body = '<main>Public pricing</main>';
  const server = createServer((_request, response) => {
    response.writeHead(200, {
      'Content-Type': 'text/html',
      'Content-Length': complete ? Buffer.byteLength(body) : 5000,
    });
    response.write(body);
    if (complete) response.end();
    else setTimeout(() => response.destroy(), 10);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('TEST_SERVER_ADDRESS');
  const controller = new AbortController();
  const removeListener = vi.spyOn(controller.signal, 'removeEventListener');
  let timer: NodeJS.Timeout | undefined;
  try {
    const result = await Promise.race([
      nodePinnedTransport({
        url: new URL(`http://transport.example:${address.port}/`),
        hostname: 'transport.example',
        address: { address: '127.0.0.1', family: 4 },
        timeoutMs: 200,
        abortSignal: controller.signal,
      }).then(
        response => ({ response }),
        error => ({ error }),
      ),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('TRANSPORT_DID_NOT_SETTLE')), 1000);
      }),
    ]);
    if (complete) {
      expect(result).toHaveProperty('response.status', 200);
      expect('response' in result && Buffer.from(result.response.body).toString()).toBe(body);
    } else {
      expect(result).toMatchObject({ error: { code: 'HTTP_INCOMPLETE_RESPONSE', retryable: true } });
    }
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
  } finally {
    clearTimeout(timer);
    removeListener.mockRestore();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
