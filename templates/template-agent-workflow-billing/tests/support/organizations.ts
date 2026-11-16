import { fixtureServer } from './fixture-server.js';
import { ipcWorker } from './ipc-worker.js';
import { createServer } from 'node:http';
import { once } from 'node:events';
import type { Hono } from 'hono';

export async function httpServer(app: Hono<any>) {
  const server = createServer(async (incoming, outgoing) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
      const response = await app.fetch(
        new Request(`http://127.0.0.1${incoming.url}`, {
          method: incoming.method,
          headers,
          body: ['GET', 'HEAD'].includes(incoming.method ?? 'GET') ? undefined : Buffer.concat(chunks),
        }),
      );
      response.headers.forEach((value, name) => outgoing.setHeader(name, value));
      outgoing.writeHead(response.status);
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      outgoing.writeHead(500);
      outgoing.end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('No HTTP address');
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      const closed = new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
      server.closeAllConnections();
      await closed;
    },
  };
}

export function mastraServer(databaseUrl: string, credential: string) {
  return fixtureServer(
    'organization-server',
    {
      BILLING_MODE: 'local',
      BILLING_DATABASE_URL: databaseUrl,
      BILLING_PROVIDER: 'local',
    },
    credential,
  );
}

export async function request(
  url: string,
  credential: string | null,
  path: string,
  options: { method?: string; body?: unknown; key?: string } = {},
) {
  const headers = new Headers();
  if (credential !== null) headers.set('authorization', `Bearer ${credential}`);
  if (options.body !== undefined) headers.set('content-type', 'application/json');
  if (options.key) headers.set('idempotency-key', options.key);
  const response = await fetch(`${url}${path}`, {
    method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { status: response.status, body: (await response.json()) as any };
}

interface WorkerMessage {
  type: string;
  round?: number;
  contended?: boolean;
  status?: string;
}
export function organizationWriter(url: string) {
  return ipcWorker<WorkerMessage>(new URL('./organization-worker.mjs', import.meta.url), [url]);
}
