import { spawn, fork } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
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

export async function mastraServer(databaseUrl: string, credential: string) {
  const portFinder = createServer();
  portFinder.listen(0, '127.0.0.1');
  await once(portFinder, 'listening');
  const address = portFinder.address();
  if (address === null || typeof address === 'string') throw new Error('No server address');
  const port = address.port;
  await new Promise<void>(resolve => portFinder.close(() => resolve()));
  const child = spawn(
    process.execPath,
    ['node_modules/mastra/dist/index.js', 'dev', '--dir', 'tests/fixtures/organization-server'],
    {
      cwd: fileURLToPath(new URL('../../', import.meta.url)),
      detached: true,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        BILLING_DATABASE_URL: databaseUrl,
        BILLING_PORT: String(port),
        BILLING_PROVIDER: 'local',
        BILLING_JWT_CONFIGURATION: '',
        MASTRA_TELEMETRY_DISABLED: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let output = '';
  const capture = (chunk: Buffer) => {
    output = (output + String(chunk)).slice(-64000);
  };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  const closed = once(child, 'exit');
  const close = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    try {
      process.kill(-child.pid!, 'SIGTERM');
    } catch {
      return;
    }
    await Promise.race([closed, setTimeout(3000)]);
    try {
      process.kill(-child.pid!, 'SIGKILL');
    } catch {
      /* Already stopped. */
    }
  };
  const url = `http://127.0.0.1:${port}`;
  try {
    for (let attempt = 0; attempt < 300; attempt++) {
      if (child.exitCode !== null) throw new Error(`Mastra exited: ${output}`);
      try {
        const response = await fetch(`${url}/billing/context`, {
          headers: { authorization: `Bearer ${credential}` },
          signal: AbortSignal.timeout(1000),
        });
        if (response.status === 200) return { url, close };
      } catch {
        /* Server is still building. */
      }
      await setTimeout(200);
    }
    throw new Error(`Mastra did not serve configured billing routes: ${output}`);
  } catch (error) {
    await close();
    throw error;
  }
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
  const child = fork(fileURLToPath(new URL('./organization-worker.mjs', import.meta.url)), [url], {
    execArgv: [],
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  const inbox: WorkerMessage[] = [];
  const waiters: {
    type: string;
    round?: number;
    resolve: (message: WorkerMessage) => void;
    reject: (error: Error) => void;
  }[] = [];
  let stderr = '';
  let exited = false;
  child.stderr?.on('data', chunk => {
    stderr += String(chunk);
  });
  child.on('message', (message: WorkerMessage) => {
    const index = waiters.findIndex(waiter => waiter.type === message.type && waiter.round === message.round);
    if (index === -1) inbox.push(message);
    else waiters.splice(index, 1)[0].resolve(message);
  });
  child.on('exit', code => {
    exited = true;
    for (const waiter of waiters.splice(0)) waiter.reject(new Error(`Organization writer exited (${code}): ${stderr}`));
  });
  return {
    send: (message: object) => child.send(message),
    wait: (type: string, round?: number): Promise<WorkerMessage> => {
      const index = inbox.findIndex(message => message.type === type && message.round === round);
      if (index !== -1) return Promise.resolve(inbox.splice(index, 1)[0]);
      if (exited) return Promise.reject(new Error(`Organization writer exited: ${stderr}`));
      return new Promise((resolve, reject) => waiters.push({ type, round, resolve, reject }));
    },
    close: async () => {
      if (!exited) {
        child.kill();
        await once(child, 'exit');
      }
    },
  };
}
