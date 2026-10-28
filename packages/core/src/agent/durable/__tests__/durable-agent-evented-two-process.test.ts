/**
 * Shared brokers cannot safely coordinate durable agents over process-local stores.
 * Verify rejection in real producer/worker processes regardless of broker placement.
 * Supported split execution is covered by Redis/Postgres durable-worker-takeover.test.ts.
 */
import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

interface ChildMessage {
  type: 'ready' | 'configured' | 'error';
  data?: { message?: string };
}

function waitForMessage(child: ChildProcess, type: ChildMessage['type'], timeoutMs = 10_000): Promise<ChildMessage> {
  return new Promise((resolve, reject) => {
    const handler = (msg: ChildMessage) => {
      if (msg.type === type) {
        clearTimeout(timer);
        child.off('message', handler);
        resolve(msg);
      } else if (msg.type === 'error') {
        clearTimeout(timer);
        child.off('message', handler);
        reject(new Error(`child error: ${msg.data?.message}`));
      }
    };
    const timer = setTimeout(() => {
      child.off('message', handler);
      reject(new Error(`Timeout waiting for "${type}" from child`));
    }, timeoutMs);
    child.on('message', handler);
  });
}

const distPath = (rel: string) => join(__dirname, '../../../../dist', rel).replace(/\\/g, '/');

const CHILD_SCRIPT = `
import { UnixSocketPubSub } from '${distPath('events/index.js')}';
import { Mastra } from '${distPath('mastra/index.js')}';
import { Agent } from '${distPath('agent/index.js')}';
import { createEventedAgent } from '${distPath('agent/durable/index.js')}';
import { InMemoryStore } from '${distPath('storage/index.js')}';

const pubsub = new UnixSocketPubSub(process.argv[2]);
await pubsub.subscribe('__boot__', () => {});
process.on('message', async msg => {
  if (msg.type !== 'configure') return;
  try {
    const storage = new InMemoryStore();
    for (const domain of ['workflows', 'memory']) {
      (await storage.getStore(domain)).supportsRunFencing = () => false;
    }
    const evented = createEventedAgent({
      agent: new Agent({ id: 'two-process-agent', name: 'two-process-agent', model: 'openai/gpt-4o-mini' }),
    });
    new Mastra({ logger: false, storage, pubsub, agents: { [evented.id]: evented } });
    process.send({ type: 'configured' });
  } catch (error) {
    process.send({ type: 'error', data: { message: error.message } });
  }
});
process.send({ type: 'ready' });
`;

describe('EventedAgent - producer (MASTRA_WORKERS=false) + dedicated worker process', () => {
  let tempDir: string;
  let scriptPath: string;
  const children: ChildProcess[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mastra-evented-two-proc-'));
    scriptPath = join(tempDir, 'child.mjs');
    await writeFile(scriptPath, CHILD_SCRIPT);
  });

  afterEach(async () => {
    for (const child of children.splice(0)) child.kill('SIGKILL');
    await rm(tempDir, { recursive: true, force: true });
  });

  async function spawn(socketPath: string, role: 'producer' | 'worker'): Promise<ChildProcess> {
    const env = { ...process.env };
    if (role === 'producer') env.MASTRA_WORKERS = 'false';
    else delete env.MASTRA_WORKERS;
    const child = fork(scriptPath, [socketPath], { env, stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
    children.push(child);
    await waitForMessage(child, 'ready');
    return child;
  }

  it.each(['worker', 'producer'] as const)(
    'rejects unfenced storage when the %s process owns the broker',
    async brokerRole => {
      const socketPath = join(tempDir, 'pubsub.sock');
      const first = await spawn(socketPath, brokerRole);
      const second = await spawn(socketPath, brokerRole === 'worker' ? 'producer' : 'worker');
      for (const child of [first, second]) {
        const rejected = waitForMessage(child, 'error');
        child.send({ type: 'configure' });
        expect((await rejected).data?.message).toMatch(/shared evented execution requires storage-backed run fencing/);
      }
    },
    30_000,
  );
});
