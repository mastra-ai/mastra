/**
 * Keeps a browser off the machine it runs on and off private networks.
 *
 * Network traffic goes through a local proxy that resolves every host itself,
 * refuses private addresses, and connects to the address it checked. Checking
 * at connect time covers redirects, service workers, WebSockets and DNS names
 * that point at private addresses, none of which a request route sees.
 * Everything that never reaches the network (file: and other local schemes)
 * is refused by a context route.
 */

import { lookup } from 'node:dns/promises';
import http from 'node:http';
import type { IncomingMessage } from 'node:http';
import net from 'node:net';
import type { AddressInfo, Socket } from 'node:net';
import type { BrowserContext } from 'playwright-core';

const privateAddresses = new net.BlockList();
for (const [prefix, bits] of [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8],
  ['100.64.0.0', 10], // carrier-grade NAT, also Tailscale
  ['127.0.0.0', 8],
  ['169.254.0.0', 16], // link-local, includes cloud metadata at 169.254.169.254
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved and broadcast
] as const) {
  privateAddresses.addSubnet(prefix, bits, 'ipv4');
}
for (const [prefix, bits] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
] as const) {
  privateAddresses.addSubnet(prefix, bits, 'ipv6');
}

/** Whether an IP address is loopback, link-local, private or otherwise not on the public internet. */
export function isPrivateAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 0) return false;
  // IPv4-mapped IPv6 addresses (::ffff:127.0.0.1) are checked against the IPv4 rules.
  return privateAddresses.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

type Resolved = { address: string } | { blocked: string };

/** Schemes that reach the network, and so go through the proxy. */
const NETWORK_SCHEMES = new Set(['http:', 'https:', 'ws:', 'wss:']);
/** Schemes that carry their own content and touch neither the network nor the disk. */
const INLINE_SCHEMES = new Set(['about:', 'blob:', 'data:']);

function blockedPage(reason: string): string {
  return `<!doctype html><title>Blocked</title><p>This browser can't open that address: ${reason
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')}.</p>`;
}

/** A local proxy that refuses connections to private addresses. One per browser config, shared by its browsers. */
export class NetworkGuard {
  private server?: http.Server;
  private starting?: Promise<string>;
  private readonly sockets = new Set<Socket>();
  private readonly allow: ReadonlySet<string>;

  /** @param allow Private hosts to let through anyway, as `host` or `host:port`. */
  constructor(allow: readonly string[] = []) {
    this.allow = new Set(allow.map(entry => entry.toLowerCase()));
  }

  /**
   * Why a URL is blocked, or `undefined` when the browser may open it.
   * Used to refuse a navigation up front with a clear reason; the proxy and
   * route enforce the same rules for everything the page loads.
   */
  async check(url: string): Promise<string | undefined> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return undefined; // let the browser report the malformed URL
    }
    if (INLINE_SCHEMES.has(parsed.protocol)) return undefined;
    if (!NETWORK_SCHEMES.has(parsed.protocol)) return `${parsed.protocol} URLs can't be opened`;
    const port = parsed.port || (parsed.protocol === 'https:' || parsed.protocol === 'wss:' ? '443' : '80');
    const resolved = await this.resolve(parsed.hostname, port);
    return 'blocked' in resolved ? resolved.blocked : undefined;
  }

  /** Starts the proxy (once) and returns its address, for the browser's `proxy.server`. */
  start(): Promise<string> {
    this.starting ??= this.listen().catch(error => {
      this.starting = undefined;
      throw error;
    });
    return this.starting;
  }

  /** Refuses file: and other local schemes in a browser context. */
  async guardContext(context: BrowserContext | null): Promise<void> {
    // Fail closed: an unguarded context could open local files.
    if (!context) throw new Error('blockPrivateNetwork: the browser launched without a context to protect');
    await context.route(
      url => !NETWORK_SCHEMES.has(url.protocol) && !INLINE_SCHEMES.has(url.protocol),
      route => route.abort('blockedbyclient'),
    );
  }

  async close(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    this.starting = undefined;
    for (const socket of this.sockets) socket.destroy();
    this.sockets.clear();
    if (server) await new Promise<void>(done => server.close(() => done()));
  }

  private async listen(): Promise<string> {
    const server = http.createServer((req, res) => void this.forward(req, res));
    server.on('connect', (req: IncomingMessage, socket: Socket, head: Buffer) => void this.tunnel(req, socket, head));
    server.on('connection', socket => {
      this.sockets.add(socket);
      socket.on('close', () => this.sockets.delete(socket));
    });
    await new Promise<void>((done, fail) => {
      server.once('error', fail);
      server.listen(0, '127.0.0.1', () => done());
    });
    this.server = server;
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  private async resolve(hostname: string, port: string): Promise<Resolved> {
    const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
    let addresses: string[];
    if (net.isIP(host)) {
      addresses = [host];
    } else {
      try {
        addresses = (await lookup(host, { all: true })).map(entry => entry.address);
      } catch {
        return { blocked: `${host} couldn't be found` };
      }
    }
    const allowed = this.allow.has(host) || this.allow.has(`${host}:${port}`);
    if (!allowed && addresses.some(isPrivateAddress)) {
      return { blocked: `${host} is on a private network or this machine` };
    }
    return { address: addresses[0]! };
  }

  /** Plain http: requests arrive with an absolute URL. */
  private async forward(req: IncomingMessage, res: http.ServerResponse): Promise<void> {
    let target: URL;
    try {
      target = new URL(req.url ?? '');
    } catch {
      res.writeHead(400).end();
      return;
    }
    const resolved = await this.resolve(target.hostname, target.port || '80');
    if ('blocked' in resolved) {
      res.writeHead(403, { 'content-type': 'text/html; charset=utf-8' }).end(blockedPage(resolved.blocked));
      return;
    }
    const headers = { ...req.headers };
    delete headers['proxy-connection'];
    delete headers['proxy-authorization'];
    const upstream = http.request(
      {
        host: resolved.address,
        port: target.port || 80,
        method: req.method,
        path: `${target.pathname}${target.search}`,
        headers,
      },
      upstreamRes => {
        res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
        upstreamRes.pipe(res);
      },
    );
    upstream.on('error', () => (res.headersSent ? res.destroy() : res.writeHead(502).end()));
    req.pipe(upstream);
  }

  /** https:, wss: and ws: go through CONNECT tunnels. */
  private async tunnel(req: IncomingMessage, client: Socket, head: Buffer): Promise<void> {
    client.on('error', () => client.destroy());
    let target: URL;
    try {
      target = new URL(`http://${req.url}`);
    } catch {
      client.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }
    const resolved = await this.resolve(target.hostname, target.port || '443');
    if ('blocked' in resolved) {
      client.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      return;
    }
    let connected = false;
    const upstream = net.connect(Number(target.port || 443), resolved.address, () => {
      connected = true;
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      upstream.pipe(client);
      client.pipe(upstream);
    });
    upstream.on('error', () => (connected ? client.destroy() : client.end('HTTP/1.1 502 Bad Gateway\r\n\r\n')));
    client.on('close', () => upstream.destroy());
  }
}
