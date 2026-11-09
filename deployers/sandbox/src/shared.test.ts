import { once } from 'node:events';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import { waitForHealthy } from './shared';

let server: Server | undefined;

afterEach(async () => {
  if (server) await new Promise(resolve => server!.close(resolve));
  server = undefined;
});

/** A server that answers every request with `status` and `headers`. */
async function serve(status: number, headers: Record<string, string> = {}): Promise<string> {
  server = createServer((_req, res) => res.writeHead(status, headers).end());
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const quickly = { timeoutMs: 300, intervalMs: 50 };

describe('waitForHealthy', () => {
  it.each([
    ['answers', 200],
    ['asks for its own login', 401],
  ])('counts a server that %s as up', async (_case, status) => {
    await expect(waitForHealthy(await serve(status), quickly)).resolves.toBe(true);
  });

  it.each([
    ['a stopped sandbox', 410, {}],
    ["Vercel's edge", 404, { 'x-vercel-error': 'NOT_FOUND' }],
    // A private Platform sandbox port turns a caller without a browser away.
    ["a sandbox preview's sign-in", 401, { 'x-mastra-preview-error': 'sign-in-required' }],
  ])("doesn't count a response from %s as the server", async (_case, status, headers) => {
    await expect(waitForHealthy(await serve(status, headers), quickly)).resolves.toBe(false);
  });
});
