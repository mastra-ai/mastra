import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

// These tests run each transport in a real child process, because whether Node exits on its own
// depends on which timers keep the event loop alive and can't be observed with fake timers.

const httpTransportPath = fileURLToPath(new URL('./http/index.ts', import.meta.url));
const upstashTransportPath = fileURLToPath(new URL('./upstash/index.ts', import.meta.url));

vi.setConfig({ testTimeout: 15_000 });

// Kill a child that hasn't exited by then; a hung child is the bug under test.
const EXIT_DEADLINE_MS = 4000;

interface ChildResult {
  code: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
}

function runScript(source: string): Promise<ChildResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', source], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.on('data', chunk => (stdout += chunk));
    child.stderr.on('data', chunk => (stderr += chunk));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, EXIT_DEADLINE_MS);
    child.on('error', reject);
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ code, timedOut, stdout, stderr });
    });
  });
}

let server: Server | undefined;

async function startServer(handler: (req: IncomingMessage, body: string, res: ServerResponse) => void) {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => handler(req, body, res));
  });
  await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise(resolve => server!.close(resolve));
    server = undefined;
  }
});

describe('HttpTransport process lifecycle', () => {
  it('lets an idle script exit without destroy()', async () => {
    const result = await runScript(`
      import { HttpTransport } from ${JSON.stringify(httpTransportPath)};
      new HttpTransport({ url: 'http://127.0.0.1:9/logs' });
      console.log('work finished');
    `);

    expect(result).toMatchObject({ timedOut: false, code: 0 });
    expect(result.stdout).toContain('work finished');
  });

  it('keeps the script alive until buffered logs are sent, then exits', async () => {
    const received: string[] = [];
    const url = await startServer((_req, body, res) => {
      received.push(...JSON.parse(body).logs.map((log: { msg: string }) => log.msg));
      res.end('{}');
    });

    const result = await runScript(`
      import { HttpTransport } from ${JSON.stringify(httpTransportPath)};
      const transport = new HttpTransport({ url: ${JSON.stringify(`${url}/logs`)}, flushInterval: 200 });
      transport.write({ level: 30, msg: 'buffered before exit' });
      console.log('work finished');
    `);

    expect(result).toMatchObject({ timedOut: false, code: 0 });
    expect(received).toEqual(['buffered before exit']);
  });

  it('keeps retrying on later intervals after a transient failure, then exits once delivered', async () => {
    const statuses: number[] = [];
    const received: string[] = [];
    const url = await startServer((_req, body, res) => {
      const status = statuses.length === 0 ? 503 : 200;
      statuses.push(status);
      if (status === 200) received.push(...JSON.parse(body).logs.map((log: { msg: string }) => log.msg));
      res.statusCode = status;
      res.end('{}');
    });

    const result = await runScript(`
      import { HttpTransport } from ${JSON.stringify(httpTransportPath)};
      const transport = new HttpTransport({
        url: ${JSON.stringify(`${url}/logs`)},
        flushInterval: 200,
        retryOptions: { maxRetries: 0 },
      });
      transport.write({ level: 30, msg: 'survives one outage' });
    `);

    expect(result).toMatchObject({ timedOut: false, code: 0 });
    expect(statuses).toEqual([503, 200]);
    expect(received).toEqual(['survives one outage']);
  });

  it('lets the script exit after clearBuffer() discards pending logs', async () => {
    const result = await runScript(`
      import { HttpTransport } from ${JSON.stringify(httpTransportPath)};
      const transport = new HttpTransport({ url: 'http://127.0.0.1:9/logs', flushInterval: 60_000 });
      transport.write({ level: 30, msg: 'discarded' });
      transport.clearBuffer();
    `);

    expect(result).toMatchObject({ timedOut: false, code: 0 });
  });
});

describe('UpstashTransport process lifecycle', () => {
  it('lets an idle script exit without destroy()', async () => {
    const result = await runScript(`
      import { UpstashTransport } from ${JSON.stringify(upstashTransportPath)};
      new UpstashTransport({ upstashUrl: 'http://127.0.0.1:9', upstashToken: 'test' });
      console.log('work finished');
    `);

    expect(result).toMatchObject({ timedOut: false, code: 0 });
    expect(result.stdout).toContain('work finished');
  });

  it('keeps the script alive until buffered records are pushed, then exits', async () => {
    const pushed: string[] = [];
    const url = await startServer((_req, body, res) => {
      const [[command, _list, ...values]] = JSON.parse(body);
      if (command === 'LPUSH') pushed.push(...values.map((value: string) => JSON.parse(value).msg));
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify([{ result: pushed.length }, { result: 'OK' }]));
    });

    const result = await runScript(`
      import { UpstashTransport } from ${JSON.stringify(upstashTransportPath)};
      const transport = new UpstashTransport({ upstashUrl: ${JSON.stringify(url)}, upstashToken: 'test', flushInterval: 200 });
      transport.write({ level: 30, msg: 'buffered before exit' });
      console.log('work finished');
    `);

    expect(result).toMatchObject({ timedOut: false, code: 0 });
    expect(pushed).toEqual(['buffered before exit']);
  });

  it('keeps retrying after a failed request, then exits once delivered', async () => {
    const pushed: string[] = [];
    let attempts = 0;
    const url = await startServer((_req, body, res) => {
      attempts++;
      if (attempts === 1) {
        res.statusCode = 503;
        res.end('{}');
        return;
      }
      const [[command, _list, ...values]] = JSON.parse(body);
      if (command === 'LPUSH') pushed.push(...values.map((value: string) => JSON.parse(value).msg));
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify([{ result: pushed.length }, { result: 'OK' }]));
    });

    const result = await runScript(`
      import { UpstashTransport } from ${JSON.stringify(upstashTransportPath)};
      new UpstashTransport({ upstashUrl: ${JSON.stringify(url)}, upstashToken: 'test', flushInterval: 200 })
        .write({ level: 30, msg: 'survives one outage' });
    `);

    expect(result).toMatchObject({ timedOut: false, code: 0 });
    expect(attempts).toBe(2);
    expect(pushed).toEqual(['survives one outage']);
  });
});

// Web-standard runtimes (e.g. Cloudflare Workers without Node global timers) return a numeric id from
// setInterval, with no ref()/unref(). The transports must still construct, buffer, and flush there.
const numericTimersPrelude = `
  const realSetInterval = globalThis.setInterval;
  const realClearInterval = globalThis.clearInterval;
  const timers = new Map();
  let nextId = 1;
  globalThis.setInterval = (fn, ms, ...args) => {
    const id = nextId++;
    timers.set(id, realSetInterval(fn, ms, ...args));
    return id;
  };
  globalThis.clearInterval = id => {
    realClearInterval(timers.get(id));
    timers.delete(id);
  };
`;

describe('process lifecycle with web-standard numeric timer ids', () => {
  it('HttpTransport constructs, buffers a write, and flushes it on destroy', async () => {
    const received: string[] = [];
    const url = await startServer((_req, body, res) => {
      received.push(...JSON.parse(body).logs.map((log: { msg: string }) => log.msg));
      res.end('{}');
    });

    const result = await runScript(`
      ${numericTimersPrelude}
      const { HttpTransport } = await import(${JSON.stringify(httpTransportPath)});
      const transport = new HttpTransport({ url: ${JSON.stringify(`${url}/logs`)} });
      transport.write({ level: 30, msg: 'numeric timer id' });
      transport.clearBuffer();
      transport.write({ level: 30, msg: 'numeric timer id' });
      await new Promise((resolve, reject) => {
        transport.once('close', resolve);
        transport.once('error', reject);
        transport.destroy();
      });
    `);

    expect(result.stderr).not.toContain('TypeError');
    expect(result).toMatchObject({ timedOut: false, code: 0 });
    expect(received).toEqual(['numeric timer id']);
  });

  it('UpstashTransport constructs, buffers a write, and flushes it on destroy', async () => {
    const pushed: string[] = [];
    const url = await startServer((_req, body, res) => {
      const [[command, _list, ...values]] = JSON.parse(body);
      if (command === 'LPUSH') pushed.push(...values.map((value: string) => JSON.parse(value).msg));
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify([{ result: pushed.length }, { result: 'OK' }]));
    });

    const result = await runScript(`
      ${numericTimersPrelude}
      const { UpstashTransport } = await import(${JSON.stringify(upstashTransportPath)});
      const transport = new UpstashTransport({ upstashUrl: ${JSON.stringify(url)}, upstashToken: 'test' });
      transport.write({ level: 30, msg: 'numeric timer id' });
      await new Promise((resolve, reject) => {
        transport.once('close', resolve);
        transport.once('error', reject);
        transport.destroy();
      });
    `);

    expect(result.stderr).not.toContain('TypeError');
    expect(result).toMatchObject({ timedOut: false, code: 0 });
    expect(pushed).toEqual(['numeric timer id']);
  });
});
