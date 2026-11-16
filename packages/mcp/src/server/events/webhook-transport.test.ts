import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import { nodeWebhookTransport, statusFailure } from './webhook-transport';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

const servers: Server[] = [];

async function listen(handler: Handler): Promise<number> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return (server.address() as AddressInfo).port;
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      server =>
        new Promise<void>(resolve => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});

function post(url: string, timeoutMs = 2000) {
  return nodeWebhookTransport({
    url: new URL(url),
    address: '127.0.0.1',
    family: 4,
    headers: { 'content-type': 'application/json', 'webhook-id': 'evt_1' },
    body: '{"hello":"world"}',
    timeoutMs,
  });
}

describe('nodeWebhookTransport', () => {
  it('connects to the pinned address and sends the hostname as Host', async () => {
    const seen: { host?: string; body?: string; id?: string } = {};
    const port = await listen((req, res) => {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', () => {
        Object.assign(seen, { host: req.headers.host, body, id: req.headers['webhook-id'] });
        res.writeHead(200).end('{"ok":true}');
      });
    });

    // `.invalid` never resolves, so reaching the server proves the pinned address was used.
    const result = await post(`http://receiver.invalid:${port}/hooks`);

    expect(result).toEqual({ status: 200, body: '{"ok":true}' });
    expect(seen).toEqual({ host: `receiver.invalid:${port}`, body: '{"hello":"world"}', id: 'evt_1' });
  });

  it('returns a redirect as a status without following it', async () => {
    let followed = false;
    const port = await listen((req, res) => {
      if (req.url === '/target') {
        followed = true;
        res.writeHead(200).end();
        return;
      }
      res.writeHead(302, { location: '/target' }).end();
    });

    const result = await post(`http://127.0.0.1:${port}/hooks`);

    expect(result).toEqual({ status: 302, body: '' });
    expect(followed).toBe(false);
  });

  it('reports a slow endpoint as timeout', async () => {
    const port = await listen(() => {});
    expect(await post(`http://127.0.0.1:${port}/hooks`, 100)).toEqual({ error: 'timeout' });
  });

  it('reports a refused connection as connection_refused', async () => {
    const port = await listen(() => {});
    await new Promise<void>(resolve => servers.pop()!.close(() => resolve()));
    expect(await post(`http://127.0.0.1:${port}/hooks`)).toEqual({ error: 'connection_refused' });
  });

  it('reports a TLS handshake failure as tls_error', async () => {
    const port = await listen((_req, res) => res.writeHead(200).end());
    expect(await post(`https://127.0.0.1:${port}/hooks`)).toEqual({ error: 'tls_error' });
  });

  it('returns error statuses for categorisation', async () => {
    const port = await listen((req, res) => res.writeHead(req.url === '/gone' ? 410 : 503).end('nope'));
    const gone = await post(`http://127.0.0.1:${port}/gone`);
    const unavailable = await post(`http://127.0.0.1:${port}/down`);
    expect(gone).toEqual({ status: 410, body: 'nope' });
    expect(unavailable).toEqual({ status: 503, body: 'nope' });
    expect(statusFailure(410)).toBe('http_4xx');
    expect(statusFailure(503)).toBe('http_5xx');
  });

  it('caps the response body', async () => {
    const port = await listen((_req, res) => res.writeHead(200).end('x'.repeat(20_000)));
    const result = await post(`http://127.0.0.1:${port}/hooks`);
    expect(result).toMatchObject({ status: 200 });
    expect('body' in result && result.body.length).toBe(4096);
  });
});
