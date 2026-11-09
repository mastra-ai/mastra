import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { createSocket } from 'node:dgram';
import { createServer } from 'node:http';
import type { Socket } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';
import StagehandWebSocket from 'ws';

import { SOURCE_LIMITS } from '../src/mastra/config';
import type { DnsResolver, PinnedTransport } from '../src/mastra/lib/acquisition';
import { renderPublicPage } from '../src/mastra/lib/browser';

const publicDns: DnsResolver = async () => [{ address: '93.184.216.34', family: 4 }];
const closers: Array<() => Promise<void>> = [];

function trackSockets(sockets: Set<Socket>) {
  return (socket: Socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  };
}

function closeServer(server: ReturnType<typeof createServer>, sockets: Set<Socket>) {
  sockets.forEach(socket => socket.destroy());
  return new Promise<void>(resolve => server.close(() => resolve()));
}

type CdpMessage = {
  id?: number;
  method?: string;
  params?: { contextId?: number; expression?: string };
};

function cdpMessage(value: unknown) {
  try {
    return JSON.parse(String(value)) as CdpMessage;
  } catch {
    return undefined;
  }
}

async function observeCdpMessages<T>(operation: () => Promise<T>, usePageWorld = false) {
  const NativeWebSocket = globalThis.WebSocket;
  const originalSend = StagehandWebSocket.prototype.send;
  const originalEmit = StagehandWebSocket.prototype.emit;
  const directReceivedBytes: number[] = [];
  const captureRequestIds = new Set<number>();
  const stagehandCaptureResponseBytes: number[] = [];
  globalThis.WebSocket = class extends NativeWebSocket {
    constructor(...args: ConstructorParameters<typeof WebSocket>) {
      super(...args);
      this.addEventListener('message', event => directReceivedBytes.push(Buffer.byteLength(String(event.data))));
    }
  };
  StagehandWebSocket.prototype.send = function (this: StagehandWebSocket, ...args: any[]) {
    const message = cdpMessage(args[0]);
    if (
      message?.method === 'Runtime.evaluate' &&
      message.params?.expression?.includes('document.documentElement.outerHTML')
    ) {
      if (message.id !== undefined) captureRequestIds.add(message.id);
      if (usePageWorld) {
        delete message.params.contextId;
        args[0] = JSON.stringify(message);
      }
    }
    return Reflect.apply(originalSend, this, args) as void;
  } as typeof StagehandWebSocket.prototype.send;
  StagehandWebSocket.prototype.emit = function (this: StagehandWebSocket, ...args: any[]) {
    if (args[0] === 'message') {
      const message = cdpMessage(args[1]);
      if (message?.id !== undefined && captureRequestIds.delete(message.id)) {
        stagehandCaptureResponseBytes.push(Buffer.byteLength(String(args[1])));
      }
    }
    return Reflect.apply(originalEmit, this, args) as boolean;
  } as typeof StagehandWebSocket.prototype.emit;
  try {
    return { value: await operation(), directReceivedBytes, stagehandCaptureResponseBytes };
  } finally {
    globalThis.WebSocket = NativeWebSocket;
    StagehandWebSocket.prototype.send = originalSend;
    StagehandWebSocket.prototype.emit = originalEmit;
  }
}

afterEach(async () => Promise.allSettled(closers.splice(0).map(close => close())));

describe('real Chrome browser egress boundary', () => {
  it('stagehand_download_uses_compatible_undici', async () => {
    const stagehandRequire = createRequire(createRequire(import.meta.url).resolve('@browserbasehq/stagehand'));
    const providerUtilsPath = stagehandRequire.resolve('@ai-sdk/provider-utils');
    // A fresh Node process retains Node's native global fetch. Public test-endpoint requests exercise
    // the real overridden Agent; a test-only DNS hook deterministically proves its private-IP denial.
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        '--input-type=commonjs',
        '-e',
        `
      const assert = require('node:assert/strict');
      const { createRequire } = require('node:module');
      const dns = require('node:dns');
      const { createServer } = require('node:http');
      const nativeFetch = globalThis.fetch;
      const providerRequire = createRequire(process.argv[1]);
      const undici = providerRequire('undici');
      assert.equal(providerRequire('undici/package.json').version, '6.28.1');
      const originalUndiciFetch = undici.fetch;
      let dispatched = 0;
      undici.fetch = (...args) => { dispatched += 1; return originalUndiciFetch(...args); };
      const originalLookup = dns.lookup;
      let deniedLookups = 0;
      dns.lookup = (hostname, options, callback) => {
        if (hostname === 'private-download.example') {
          deniedLookups += 1;
          return callback(null, [{ address: '127.0.0.1', family: 4 }]);
        }
        return originalLookup(hostname, options, callback);
      };
      const { fetchWithValidatedRedirects, readResponseWithSizeLimit } = providerRequire(process.argv[1]);
      const server = createServer((_request, response) => response.end('private target'));
      let privateConnections = 0;
      server.on('connection', socket => { privateConnections += 1; socket.destroy(); });
      server.listen(0, '127.0.0.1', async () => {
        try {
          const port = server.address().port;
          const fetchUrl = url => fetchWithValidatedRedirects({ url, abortSignal: AbortSignal.timeout(15000) });
          const publicUrl = 'https://httpbingo.org/base64/U3RhZ2VoYW5kIGRvd25sb2FkIGV2aWRlbmNlLg==';
          const response = await fetchUrl(publicUrl);
          assert.equal(response.status, 200);
          const bytes = await readResponseWithSizeLimit({ response, url: publicUrl, maxBytes: 4096 });
          assert.equal(Buffer.from(bytes).toString(), 'Stagehand download evidence.');
          const oversized = await fetchUrl(publicUrl);
          await assert.rejects(readResponseWithSizeLimit({ response: oversized, url: publicUrl, maxBytes: 8 }), /maximum size/);
          await assert.rejects(fetchUrl('http://127.0.0.1:' + port), /not allowed/);
          await assert.rejects(fetchUrl('http://private-download.example:' + port), error =>
            /disallowed IP address/.test(String(error.cause ?? error)));
          const redirectUrl = 'https://httpbin.org/redirect-to?url=' + encodeURIComponent('http://127.0.0.1:' + port);
          await assert.rejects(fetchUrl(redirectUrl), /not allowed/);
          assert.equal(deniedLookups, 1);
          assert.equal(privateConnections, 0);
          assert.equal(globalThis.fetch, nativeFetch);
          assert.equal(dispatched, 4);
          console.log(JSON.stringify({ publicDownload: true, sizeBound: true, privateDenied: true, redirectDenied: true, dispatched }));
        } catch (error) {
          console.error(error);
          process.exitCode = 1;
        } finally {
          dns.lookup = originalLookup;
          undici.fetch = originalUndiciFetch;
          server.close(() => process.exit(process.exitCode ?? 0));
        }
      });
    `,
        providerUtilsPath,
      ],
      { timeout: 55000, maxBuffer: 16384 },
    );
    expect(JSON.parse(stdout)).toEqual({
      publicDownload: true,
      sizeBound: true,
      privateDenied: true,
      redirectDenied: true,
      dispatched: 4,
    });
  }, 60_000);

  it('renders_extensionless_modules_with_validated_content_type', async () => {
    const transported: string[] = [];
    const transport: PinnedTransport = async ({ url }) => {
      transported.push(url.pathname);
      return {
        status: 200,
        headers: {
          'content-type': url.pathname === '/module' ? 'application/javascript; charset=utf-8' : 'text/javascript',
        },
        body: Buffer.from(
          url.pathname === '/module'
            ? "import { evidence } from '/dependency.mjs'; document.querySelector('#evidence').textContent = evidence;"
            : "export const evidence = 'Starter plan now costs $29, with exact rendered module evidence.';",
        ),
      };
    };
    const result = await renderPublicPage(
      {
        url: 'https://public.example/main',
        status: 200,
        contentType: 'text/html',
        retries: 0,
        durationMs: 0,
        html: '<main><h1>Pricing</h1><p id="evidence">Loading...</p><script type="module" src="/module"></script></main>',
      },
      { resolver: publicDns, transport },
    );
    expect(result.html).toContain('Starter plan now costs $29, with exact rendered module evidence.');
    expect(transported).toEqual(['/module', '/dependency.mjs']);
  }, 30_000);

  it.each(['', 'text/plain', 'application/javascript-invalid'])(
    'does not execute a module with unvalidated MIME %j',
    async contentType => {
      const result = await renderPublicPage(
        {
          url: 'https://public.example/main',
          status: 200,
          contentType: 'text/html',
          retries: 0,
          durationMs: 0,
          html: '<main><p id="evidence">Original evidence</p><script type="module" src="/module"></script></main>',
        },
        {
          resolver: publicDns,
          transport: async () => ({
            status: 200,
            headers: { 'content-type': contentType },
            body: Buffer.from("document.querySelector('#evidence').textContent = 'Injected evidence';"),
          }),
        },
      );
      expect(result.html).toContain('Original evidence');
      expect(result.html).not.toContain('Injected evidence');
    },
    30_000,
  );

  it('blocks_browser_private_subrequests', async () => {
    const targetRequests: string[] = [];
    let udpMessages = 0;
    let udpV6Messages = 0;
    let tcpConnections = 0;
    let tcpV6Connections = 0;
    const targetSockets = new Set<Socket>();
    const targetV6Sockets = new Set<Socket>();
    const privateTarget = createServer((request, response) => {
      targetRequests.push(request.url ?? 'unknown');
      response.writeHead(200).end('private');
    });
    const privateV6Target = createServer((request, response) => {
      targetRequests.push(`ipv6:${request.url ?? 'unknown'}`);
      response.writeHead(200).end('private');
    });
    const privateUdpTarget = createSocket('udp4');
    const privateUdpV6Target = createSocket('udp6');
    privateUdpTarget.on('message', () => {
      udpMessages += 1;
    });
    privateUdpV6Target.on('message', () => {
      udpV6Messages += 1;
    });
    privateTarget.on('connection', socket => {
      tcpConnections += 1;
      trackSockets(targetSockets)(socket);
    });
    privateV6Target.on('connection', socket => {
      tcpV6Connections += 1;
      trackSockets(targetV6Sockets)(socket);
    });
    await new Promise<void>(resolve => privateTarget.listen(0, '127.0.0.1', resolve));
    await new Promise<void>(resolve => privateV6Target.listen(0, '::1', resolve));
    await new Promise<void>(resolve => privateUdpTarget.bind(0, '127.0.0.1', resolve));
    await new Promise<void>(resolve => privateUdpV6Target.bind(0, '::1', resolve));
    closers.push(
      () => closeServer(privateTarget, targetSockets),
      () => closeServer(privateV6Target, targetV6Sockets),
      () => new Promise<void>(resolve => privateUdpTarget.close(() => resolve())),
      () => new Promise<void>(resolve => privateUdpV6Target.close(() => resolve())),
    );
    const targetAddress = privateTarget.address();
    const targetV6Address = privateV6Target.address();
    const udpAddress = privateUdpTarget.address();
    const udpV6Address = privateUdpV6Target.address();
    if (
      !targetAddress ||
      typeof targetAddress === 'string' ||
      !targetV6Address ||
      typeof targetV6Address === 'string' ||
      typeof udpAddress === 'string' ||
      typeof udpV6Address === 'string'
    ) {
      throw new Error('TEST_SERVER_ADDRESS_MISSING');
    }
    const ipv4 = `http://127.0.0.1:${targetAddress.port}`;
    const ipv6 = `http://[::1]:${targetV6Address.port}`;
    const transportedUrls: string[] = [];
    let rebindLookups = 0;
    const rebindingResolver: DnsResolver = async hostname => {
      expect(hostname).toBe('public.example');
      rebindLookups += 1;
      return rebindLookups === 1 ? [{ address: '93.184.216.34', family: 4 }] : [{ address: '127.0.0.1', family: 4 }];
    };
    const transport: PinnedTransport = async ({ url }) => {
      transportedUrls.push(url.href);
      if (url.pathname === '/form.js') {
        return {
          status: 200,
          headers: { 'content-type': 'application/javascript' },
          body: Buffer.from(
            `const form = document.createElement('form'); form.action = '${ipv4}/form'; form.method = 'post'; document.body.append(form); form.submit(); const link = document.createElement('a'); link.href = '${ipv4}/download'; link.download = 'x'; document.body.append(link); link.click();`,
          ),
        };
      }
      if (url.pathname !== '/rebind.js' || url.search !== '?first') throw new Error('UNEXPECTED_BROWSER_RESOURCE');
      return {
        status: 200,
        headers: { 'content-type': 'application/javascript' },
        body: Buffer.from(`
          const rebind = document.createElement('script'); rebind.src = '/rebind.js?second'; document.body.append(rebind);
          const crossOrigin = document.createElement('script'); crossOrigin.src = 'https://other.example/public.js'; document.body.append(crossOrigin);
          fetch('${ipv4}/fetch').catch(() => undefined);
          new Image().src = '${ipv4}/image';
          const frame = document.createElement('iframe'); frame.src = '${ipv4}/frame'; document.body.append(frame);
          window.open('${ipv4}/popup', '_blank');
          try { new Worker(URL.createObjectURL(new Blob(['fetch("${ipv4}/worker")']))); } catch {}
          try { new WebSocket('ws://127.0.0.1:${targetAddress.port}/socket'); } catch {}
          try { if ('WebTransport' in globalThis) new WebTransport('https://127.0.0.1:${targetAddress.port}/transport'); } catch {}
          try {
            const peer = new RTCPeerConnection({ iceServers: [
              { urls: 'stun:127.0.0.1:${udpAddress.port}' },
              { urls: 'stun:[::1]:${udpV6Address.port}' },
              { urls: 'turn:127.0.0.1:${targetAddress.port}?transport=tcp' },
            ] });
            peer.createDataChannel('x');
            peer.createOffer().then(offer => peer.setLocalDescription(offer));
          } catch {}
          document.body.insertAdjacentHTML('beforeend', '<p id="rendered">rendered exact evidence</p>');
          fetch('${ipv6}/metadata').catch(() => undefined);
          fetch('http://169.254.169.254/latest/meta-data').catch(() => undefined);
          fetch('http://rebind.example/rebound').catch(() => undefined);
        `),
      };
    };
    const result = await renderPublicPage(
      {
        url: 'https://public.example/main',
        status: 200,
        contentType: 'text/html',
        retries: 0,
        durationMs: 0,
        html: '<main><h1>Browser boundary</h1><script src="/rebind.js?first"></script></main>',
      },
      { resolver: rebindingResolver, transport },
    );
    expect(result.html).toContain('rendered exact evidence');
    expect(rebindLookups).toBe(2);
    expect(transportedUrls).toEqual(['https://public.example/rebind.js?first']);
    expect(targetRequests).toEqual([]);
    expect(tcpConnections).toBe(0);
    expect(tcpV6Connections).toBe(0);
    expect(udpMessages).toBe(0);
    expect(udpV6Messages).toBe(0);
    await expect(
      renderPublicPage(
        {
          url: 'https://public.example/form',
          status: 200,
          contentType: 'text/html',
          retries: 0,
          durationMs: 0,
          html: '<main><h1>Form boundary</h1><script src="/form.js"></script></main>',
        },
        { resolver: publicDns, transport },
      ),
    ).rejects.toThrow('BROWSER_PROHIBITED_NAVIGATION');
    expect(targetRequests).toEqual([]);
  }, 30_000);

  it('fails_resource_bursts_before_the_pinned_transport_fans_out', async () => {
    const transportedUrls: string[] = [];
    const transport: PinnedTransport = async ({ url }) => {
      transportedUrls.push(url.href);
      if (url.pathname === '/burst.js') {
        return {
          status: 200,
          headers: { 'content-type': 'application/javascript' },
          body: Buffer.from(`
            for (let index = 0; index < ${SOURCE_LIMITS.maxBrowserResources}; index += 1) {
              const script = document.createElement('script');
              script.src = '/burst-' + index + '.js';
              document.head.append(script);
            }
          `),
        };
      }
      if (/^\/burst-\d+\.js$/.test(url.pathname)) {
        return { status: 200, headers: { 'content-type': 'application/javascript' }, body: Buffer.from('') };
      }
      throw new Error('UNEXPECTED_BROWSER_RESOURCE');
    };
    await expect(
      renderPublicPage(
        {
          url: 'https://public.example/burst',
          status: 200,
          contentType: 'text/html',
          retries: 0,
          durationMs: 0,
          html: '<main><h1>Browser resource burst</h1><script src="/burst.js"></script></main>',
        },
        { resolver: publicDns, transport },
      ),
    ).rejects.toThrow('BROWSER_RESOURCE_LIMIT');
    expect(transportedUrls).toHaveLength(SOURCE_LIMITS.maxBrowserResources - 1);
  }, 30_000);

  it('stops_queued_resources_after_the_aggregate_byte_limit', async () => {
    const transportedUrls: string[] = [];
    const transport: PinnedTransport = async ({ url }) => {
      transportedUrls.push(url.href);
      if (url.pathname === '/burst-bytes.js') {
        return {
          status: 200,
          headers: { 'content-type': 'application/javascript' },
          body: Buffer.from(`
            for (let index = 0; index < 10; index += 1) {
              const script = document.createElement('script');
              script.src = '/payload-' + index + '.js';
              document.head.append(script);
            }
          `),
        };
      }
      if (/^\/payload-\d+\.js$/.test(url.pathname)) {
        return {
          status: 200,
          headers: { 'content-type': 'application/javascript' },
          body: Buffer.alloc(SOURCE_LIMITS.maxHtmlBytes / 2, 120),
        };
      }
      throw new Error('UNEXPECTED_BROWSER_RESOURCE');
    };
    await expect(
      renderPublicPage(
        {
          url: 'https://public.example/burst-bytes',
          status: 200,
          contentType: 'text/html',
          retries: 0,
          durationMs: 0,
          html: '<main><h1>Browser byte burst</h1><script src="/burst-bytes.js"></script></main>',
        },
        { resolver: publicDns, transport },
      ),
    ).rejects.toThrow('BROWSER_RESOURCE_LIMIT');
    expect(transportedUrls).toEqual([
      'https://public.example/burst-bytes.js',
      'https://public.example/payload-0.js',
      'https://public.example/payload-1.js',
    ]);
  }, 30_000);

  it('rejects_oversized_rendered_dom_before_returning_html_over_cdp', async () => {
    const page = {
      url: 'https://public.example/dom-amplification',
      status: 200,
      contentType: 'text/html',
      retries: 0,
      durationMs: 0,
      html: `<main><h1>DOM amplification</h1><script>globalThis.TextEncoder = class { encode() { return { byteLength: 0 } } }; document.body.append('x'.repeat(${3 * 1024 * 1024}))</script></main>`,
    };
    const options = {
      resolver: publicDns,
      transport: async () => ({ status: 200, headers: {}, body: Buffer.alloc(0) }),
    };
    const observed = await observeCdpMessages(async () =>
      expect(renderPublicPage(page, options)).rejects.toThrow('BROWSER_RENDERED_HTML_LIMIT'),
    );
    expect(observed.directReceivedBytes).not.toHaveLength(0);
    expect(Math.max(...observed.directReceivedBytes)).toBeLessThan(64 * 1024);
    expect(observed.stagehandCaptureResponseBytes).toHaveLength(1);
    expect(observed.stagehandCaptureResponseBytes[0]).toBeLessThan(64 * 1024);

    const unisolated = await observeCdpMessages(
      async () => expect(renderPublicPage(page, options)).rejects.toThrow('BROWSER_RENDERED_HTML_LIMIT'),
      true,
    );
    expect(unisolated.stagehandCaptureResponseBytes).toHaveLength(1);
    expect(unisolated.stagehandCaptureResponseBytes[0]).toBeGreaterThan(SOURCE_LIMITS.maxHtmlBytes);
  }, 30_000);

  it('renders_inline_and_module_bootstrap_scripts', async () => {
    const transportedUrls: string[] = [];
    const transport: PinnedTransport = async ({ url }) => {
      transportedUrls.push(url.href);
      if (url.pathname !== '/bootstrap.mjs') throw new Error('UNEXPECTED_BROWSER_RESOURCE');
      return {
        status: 200,
        headers: { 'content-type': 'application/javascript' },
        body: Buffer.from(`document.body.insertAdjacentHTML('beforeend', '<p>module bootstrap rendered</p>');`),
      };
    };
    const inline = await renderPublicPage(
      {
        url: 'https://public.example/inline',
        status: 200,
        contentType: 'text/html',
        retries: 0,
        durationMs: 0,
        html: "<main><h1>Inline</h1><script>document.body.insertAdjacentHTML('beforeend', '<p>inline bootstrap rendered</p>')</script></main>",
      },
      { resolver: publicDns, transport },
    );
    const module = await renderPublicPage(
      {
        url: 'https://public.example/module',
        status: 200,
        contentType: 'text/html',
        retries: 0,
        durationMs: 0,
        html: '<main><h1>Module</h1><script type="module" src="/bootstrap.mjs"></script></main>',
      },
      { resolver: publicDns, transport },
    );
    expect(inline.html).toContain('inline bootstrap rendered');
    expect(module.html).toContain('module bootstrap rendered');
    expect(transportedUrls).toEqual(['https://public.example/bootstrap.mjs']);
  }, 30_000);

  it('blocks_same_origin_document_navigation_before_transport', async () => {
    const transportedUrls: string[] = [];
    const transport: PinnedTransport = async ({ url }) => {
      transportedUrls.push(url.href);
      if (url.pathname !== '/nav.js') throw new Error('UNAPPROVED_DOCUMENT_REACHED_TRANSPORT');
      return {
        status: 200,
        headers: { 'content-type': 'application/javascript' },
        body: Buffer.from(`location.href = '/unapproved-navigation';`),
      };
    };
    await expect(
      renderPublicPage(
        {
          url: 'https://public.example/navigation',
          status: 200,
          contentType: 'text/html',
          retries: 0,
          durationMs: 0,
          html: '<main><h1>Navigation</h1><script src="/nav.js"></script></main>',
        },
        { resolver: publicDns, transport },
      ),
    ).rejects.toThrow('BROWSER_PROHIBITED_NAVIGATION');
    expect(transportedUrls).toEqual(['https://public.example/nav.js']);
  }, 30_000);
});
