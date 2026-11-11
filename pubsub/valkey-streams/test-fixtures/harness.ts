import { connect, createServer } from 'node:net';
import type { AddressInfo, Socket } from 'node:net';

export const VALKEY_URL = process.env.VALKEY_URL ?? 'valkey://localhost:6381';

export function valkeyTarget(url = VALKEY_URL): { host: string; port: number } {
  const parsed = new URL(url);
  return { host: parsed.hostname || '127.0.0.1', port: Number(parsed.port || 6379) };
}

export async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

/**
 * Split complete RESP request arrays (`*N\r\n$len\r\narg\r\n...`) off the front
 * of `buf`. Returns each command's name and the unparsed remainder.
 *
 * GLIDE's client owns the socket from its Rust core, but that socket still
 * carries plain RESP (RESP3 after `HELLO 3`), so the same parser works here as
 * it does in front of node-redis.
 */
function takeRespCommands(buf: Buffer): { names: string[]; rest: Buffer } {
  const names: string[] = [];
  let offset = 0;
  outer: while (offset < buf.length) {
    if (buf[offset] !== 0x2a /* '*' */) throw new Error(`unexpected RESP request byte ${buf[offset]}`);
    let lineEnd = buf.indexOf('\r\n', offset);
    if (lineEnd === -1) break;
    const argc = Number(buf.toString('latin1', offset + 1, lineEnd));
    let cursor = lineEnd + 2;
    let name = '';
    for (let i = 0; i < argc; i++) {
      lineEnd = buf.indexOf('\r\n', cursor);
      if (lineEnd === -1) break outer;
      const len = Number(buf.toString('latin1', cursor + 1, lineEnd));
      const start = lineEnd + 2;
      if (buf.length < start + len + 2) break outer;
      if (i === 0) name = buf.toString('latin1', start, start + len).toUpperCase();
      cursor = start + len + 2;
    }
    names.push(name);
    offset = cursor;
  }
  return { names, rest: buf.subarray(offset) };
}

/**
 * TCP proxy that drops the connection carrying the first XADD. With `before`,
 * the XADD never reaches Valkey; with `after`, Valkey applies it and the reply
 * is lost. Every later connection forwards normally, unless
 * `closeListenerAfterDrop` is set: then the proxy stops accepting connections
 * once it drops, like a Valkey that went away and stayed down.
 */
export function makeXaddDropProxy(
  target: { host: string; port: number },
  mode: 'before' | 'after',
  options: { closeListenerAfterDrop?: boolean } = {},
) {
  const sockets = new Set<Socket>();
  let dropped = false;
  const drop = () => {
    dropped = true;
    if (options.closeListenerAfterDrop) server.close();
  };
  const server = createServer(client => {
    sockets.add(client);
    client.on('close', () => sockets.delete(client));
    client.on('error', () => {});
    const upstream = connect(target.port, target.host);
    sockets.add(upstream);
    upstream.on('close', () => {
      sockets.delete(upstream);
      client.destroy();
    });
    upstream.on('error', () => {});
    client.on('close', () => upstream.destroy());
    let pending: Buffer = Buffer.alloc(0);
    let sawXadd = false;
    let inMulti = false;
    let replyLost = false;
    client.on('data', (chunk: Buffer) => {
      if (dropped) return void upstream.write(chunk);
      pending = Buffer.concat([pending, chunk]);
      const { names, rest } = takeRespCommands(pending);
      pending = rest;
      for (const name of names) {
        if (name === 'MULTI') inMulti = true;
        if (name === 'XADD') sawXadd = true;
      }
      if (sawXadd && mode === 'before') {
        drop();
        return void client.destroy();
      }
      upstream.write(chunk);
      // Publish wraps XADD in MULTI/EXEC when a TTL is set; wait for EXEC so
      // Valkey applies the write, then hide its reply by dropping the client.
      if (sawXadd && (!inMulti || names.includes('EXEC'))) {
        drop();
        replyLost = true;
        setTimeout(() => client.destroy(), 200);
      }
    });
    upstream.on('data', (chunk: Buffer) => {
      if (!replyLost) client.write(chunk);
    });
  });
  const listening = new Promise<number>(resolve => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
  return {
    listening,
    get dropped() {
      return dropped;
    },
    close() {
      for (const s of sockets) s.destroy();
      return new Promise<void>(r => server.close(() => r()));
    },
  };
}

/**
 * TCP proxy that refuses every connection until `accept()` is called, then
 * forwards. Simulates a Valkey that is unreachable while the process starts up,
 * so a client's initial connect fails, and comes back later.
 */
export function makeRefusingProxy(target: { host: string; port: number }) {
  const sockets = new Set<Socket>();
  let accepting = false;
  const forward = (client: Socket) => {
    const upstream = connect(target.port, target.host);
    sockets.add(upstream);
    upstream.on('close', () => {
      sockets.delete(upstream);
      client.destroy();
    });
    upstream.on('error', () => {});
    client.on('close', () => upstream.destroy());
    client.pipe(upstream);
    upstream.pipe(client);
  };
  const server = createServer(client => {
    client.on('error', () => {});
    if (accepting) {
      sockets.add(client);
      client.on('close', () => sockets.delete(client));
      return forward(client);
    }
    // Accept then reset, so the client sees a connection that immediately
    // dies rather than a hanging socket it would wait on.
    client.destroy();
  });
  const listening = new Promise<number>(resolve => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
  return {
    listening,
    accept() {
      accepting = true;
    },
    close() {
      for (const s of sockets) s.destroy();
      return new Promise<void>(r => server.close(() => r()));
    },
  };
}
