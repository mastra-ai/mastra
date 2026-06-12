/**
 * Cross-process codec round-trips through a real UnixSocketPubSub.
 *
 * `unix-socket-pubsub-codec.test.ts` covers the same broker + client codec
 * round-trip but both endpoints live in the same Node process — so a
 * subtle bug that depends on a per-process JS module cache, a shared
 * `WeakSet`, or a side-effect in module initialization would silently pass.
 *
 * This suite forks two real processes and publishes the payload from the
 * broker to the client over the actual socket, then asserts the prototype
 * and value survive on the receiving side. It also covers payload types
 * that the in-process test omits (RegExp, URL, BigInt) — these are the
 * ones that go through codec envelope encode/decode at the wire boundary
 * and are most likely to regress.
 *
 * Note: registered-class payloads (DefaultGeneratedFile, DefaultStepResult)
 * are intentionally not covered cross-process here. The bundled dist drops
 * the side-effect `import './registrations'` because the package declares
 * `sideEffects: false`, so worker processes loading dist would silently
 * lose the class registry. The single-process codec test exercises those
 * classes against src directly where registrations are present.
 *
 * Notes:
 * - Uses `UnixSocketPubSub` directly (no Mastra / Agent / Workflow) so the
 *   test isolates the codec at the actual transport boundary.
 * - The broker side serializes the payload, writes it to socket; the client
 *   side reads from socket, deserializes; the assertions run client-side
 *   and ship back via IPC.
 */
import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

interface WorkerMessage {
  type: 'ready' | 'received' | 'error' | 'published';
  data?: any;
}

function waitForMessage(child: ChildProcess, type: string, timeoutMs: number): Promise<WorkerMessage> {
  return new Promise((resolve, reject) => {
    const stderrChunks: string[] = [];
    const stderrHandler = (buf: Buffer) => stderrChunks.push(buf.toString());
    child.stderr?.on('data', stderrHandler);

    const handler = (msg: WorkerMessage) => {
      if (msg.type === type) {
        cleanup();
        resolve(msg);
      } else if (msg.type === 'error') {
        cleanup();
        reject(new Error(`Worker error: ${msg.data?.message ?? 'unknown'}\n${msg.data?.stack ?? ''}`));
      }
    };
    const cleanup = () => {
      clearTimeout(timer);
      child.off('message', handler);
      child.stderr?.off('data', stderrHandler);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(`Timeout waiting for "${type}" from worker after ${timeoutMs}ms.\nstderr:\n${stderrChunks.join('')}`),
      );
    }, timeoutMs);
    child.on('message', handler);
  });
}

describe('cross-process codec round-trips through UnixSocketPubSub', () => {
  let tempDir: string;
  let brokerScript: string;
  let clientScript: string;
  const children: ChildProcess[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mc-codec-'));
    brokerScript = join(tempDir, 'broker.mjs');
    clientScript = join(tempDir, 'client.mjs');
    const coreDist = join(__dirname, '../../../dist').replace(/\\/g, '/');

    // Broker: waits for a "publish" IPC message, encodes the payload according
    // to its `kind`, and publishes it on the shared topic. The payload kind
    // determines which type the broker reconstructs locally before publishing
    // (Date, RegExp, etc.) so the wire encoding is the real one, not a
    // pre-serialized stand-in.
    await writeFile(
      brokerScript,
      `
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { UnixSocketPubSub } from '${coreDist}/events/index.js';

const socketPath = process.argv[2];
await mkdir(dirname(socketPath), { recursive: true });

const pubsub = new UnixSocketPubSub(socketPath);
// Bind broker by subscribing once — also keeps the listener alive.
await pubsub.subscribe('codec-test', () => {});

process.send({ type: 'ready' });

process.on('message', async (msg) => {
  try {
    if (msg.type === 'publish') {
      // Rebuild the payload locally — JSON-IPC strips types coming from parent.
      const kind = msg.kind;
      let value;
      if (kind === 'Date') value = new Date('2024-06-15T12:34:56.789Z');
      else if (kind === 'RegExp') value = /foo.*bar/gi;
      else if (kind === 'URL') value = new URL('https://example.com/p?q=1#h');
      else if (kind === 'BigInt') value = 12345678901234567890n;
      else if (kind === 'Map') value = new Map([['a', 1], ['b', 2]]);
      else if (kind === 'Set') value = new Set(['x', 'y', 'z']);
      else if (kind === 'Error') {
        const e = new Error('boom');
        e.name = 'MyError';
        e.code = 'E_BOOM';
        value = e;
      } else if (kind === 'undefined-prop') {
        value = { headers: undefined, value: 7 };
      } else if (kind === 'nested') {
        value = {
          when: new Date(0),
          why: new Error('nested'),
          where: new URL('https://example.com'),
          pattern: /hello/i,
          tags: new Set(['a', 'b']),
        };
      } else {
        throw new Error('unknown kind: ' + kind);
      }
      await pubsub.publish('codec-test', { type: 'codec-test', runId: 'r', data: { value } });
      process.send({ type: 'published' });
    } else if (msg.type === 'shutdown') {
      try { await pubsub.close?.(); } catch {}
      process.exit(0);
    }
  } catch (err) {
    process.send({ type: 'error', data: { message: err?.message ?? String(err), stack: err?.stack } });
  }
});
`,
    );

    // Client: subscribes to the topic, on receive runs the kind-specific
    // assertions inline (we can't ship complex prototypes back via IPC), and
    // reports a boolean + diagnostic string per check.
    await writeFile(
      clientScript,
      `
import { UnixSocketPubSub } from '${coreDist}/events/index.js';

const socketPath = process.argv[2];
const expectedKind = process.argv[3];

const pubsub = new UnixSocketPubSub(socketPath);

await pubsub.subscribe('codec-test', e => {
  const v = e.data.value;
  const checks = {};
  if (expectedKind === 'Date') {
    checks.isDate = v instanceof Date;
    checks.time = v?.getTime?.() === new Date('2024-06-15T12:34:56.789Z').getTime();
  } else if (expectedKind === 'RegExp') {
    checks.isRegExp = v instanceof RegExp;
    checks.source = v?.source === 'foo.*bar';
    checks.flags = v?.flags === 'gi';
    checks.matches = v?.test?.('FOOXYZBAR') === true;
  } else if (expectedKind === 'URL') {
    checks.isURL = v instanceof URL;
    checks.href = v?.href === 'https://example.com/p?q=1#h';
    checks.host = v?.host === 'example.com';
  } else if (expectedKind === 'BigInt') {
    checks.isBigInt = typeof v === 'bigint';
    checks.value = v === 12345678901234567890n;
  } else if (expectedKind === 'Map') {
    checks.isMap = v instanceof Map;
    checks.aIs1 = v?.get?.('a') === 1;
    checks.bIs2 = v?.get?.('b') === 2;
    checks.size = v?.size === 2;
  } else if (expectedKind === 'Set') {
    checks.isSet = v instanceof Set;
    checks.hasX = v?.has?.('x') === true;
    checks.size = v?.size === 3;
  } else if (expectedKind === 'Error') {
    checks.isError = v instanceof Error;
    checks.message = v?.message === 'boom';
    checks.name = v?.name === 'MyError';
    checks.code = v?.code === 'E_BOOM';
  } else if (expectedKind === 'undefined-prop') {
    checks.hasHeadersKey = v && 'headers' in v;
    checks.headersUndefined = v?.headers === undefined;
    checks.valueIs7 = v?.value === 7;
  } else if (expectedKind === 'nested') {
    checks.whenIsDate = v?.when instanceof Date;
    checks.whyIsError = v?.why instanceof Error;
    checks.whereIsURL = v?.where instanceof URL;
    checks.patternIsRegExp = v?.pattern instanceof RegExp;
    checks.tagsIsSet = v?.tags instanceof Set;
    checks.tagsHasA = v?.tags?.has?.('a') === true;
  }
  process.send({
    type: 'received',
    data: {
      checks,
      ctorName: v?.constructor?.name ?? typeof v,
    },
  });
});

process.send({ type: 'ready' });

process.on('message', async (msg) => {
  if (msg.type === 'shutdown') {
    try { await pubsub.close?.(); } catch {}
    process.exit(0);
  }
});
`,
    );
  });

  afterEach(async () => {
    for (const child of children.splice(0)) {
      try {
        child.kill('SIGKILL');
      } catch {}
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  function spawnBroker(socketPath: string): ChildProcess {
    const child = fork(brokerScript, [socketPath], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: { ...process.env },
    });
    children.push(child);
    return child;
  }
  function spawnClient(socketPath: string, expectedKind: string): ChildProcess {
    const child = fork(clientScript, [socketPath, expectedKind], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: { ...process.env },
    });
    children.push(child);
    return child;
  }

  async function roundTrip(kind: string): Promise<{ checks: Record<string, boolean>; ctorName: string }> {
    const socketPath = join(tempDir, `${kind}.sock`);
    const broker = spawnBroker(socketPath);
    await waitForMessage(broker, 'ready', 30_000);

    const client = spawnClient(socketPath, kind);
    await waitForMessage(client, 'ready', 30_000);

    const received = waitForMessage(client, 'received', 30_000);
    broker.send({ type: 'publish', kind });
    await waitForMessage(broker, 'published', 30_000);

    const msg = await received;

    broker.send({ type: 'shutdown' });
    client.send({ type: 'shutdown' });

    return msg.data as { checks: Record<string, boolean>; ctorName: string };
  }

  it('preserves Date across the real socket', async () => {
    const { checks, ctorName } = await roundTrip('Date');
    expect(ctorName).toBe('Date');
    expect(checks).toEqual({ isDate: true, time: true });
  }, 60_000);

  it('preserves RegExp (source + flags + behaviour) across the real socket', async () => {
    const { checks } = await roundTrip('RegExp');
    expect(checks).toEqual({ isRegExp: true, source: true, flags: true, matches: true });
  }, 60_000);

  it('preserves URL across the real socket', async () => {
    const { checks } = await roundTrip('URL');
    expect(checks).toEqual({ isURL: true, href: true, host: true });
  }, 60_000);

  it('preserves BigInt across the real socket', async () => {
    const { checks } = await roundTrip('BigInt');
    expect(checks).toEqual({ isBigInt: true, value: true });
  }, 60_000);

  it('preserves Map entries and prototype across the real socket', async () => {
    const { checks } = await roundTrip('Map');
    expect(checks).toEqual({ isMap: true, aIs1: true, bIs2: true, size: true });
  }, 60_000);

  it('preserves Set entries and prototype across the real socket', async () => {
    const { checks } = await roundTrip('Set');
    expect(checks).toEqual({ isSet: true, hasX: true, size: true });
  }, 60_000);

  it('preserves Error including custom fields across the real socket', async () => {
    const { checks } = await roundTrip('Error');
    expect(checks).toEqual({ isError: true, message: true, name: true, code: true });
  }, 60_000);

  it('preserves explicitly-undefined object fields across the real socket', async () => {
    const { checks } = await roundTrip('undefined-prop');
    expect(checks).toEqual({ hasHeadersKey: true, headersUndefined: true, valueIs7: true });
  }, 60_000);

  it('preserves nested mixed payloads across the real socket', async () => {
    const { checks } = await roundTrip('nested');
    expect(checks).toEqual({
      whenIsDate: true,
      whyIsError: true,
      whereIsURL: true,
      patternIsRegExp: true,
      tagsIsSet: true,
      tagsHasA: true,
    });
  }, 60_000);
});
