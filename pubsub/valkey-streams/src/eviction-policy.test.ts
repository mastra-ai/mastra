import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ValkeyStreamsPubSub } from './index';

// Throwaway servers with maxmemory set (like a managed instance), one evicting
// and one not. Never reconfigure the shared test container.
const containers: string[] = [];
let evictingUrl: string;
let noevictionUrl: string;

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

async function startValkey(policy: string): Promise<string> {
  const port = await freePort();
  containers.push(
    execFileSync(
      'docker',
      [
        'run',
        '-d',
        '--rm',
        '-p',
        `127.0.0.1:${port}:6379`,
        'valkey/valkey:8-alpine',
        'valkey-server',
        '--maxmemory',
        '64mb',
        '--maxmemory-policy',
        policy,
      ],
      { encoding: 'utf8' },
    ).trim(),
  );
  const deadline = Date.now() + 15_000;
  // Wait until the server answers PING over raw RESP.
  for (;;) {
    const ready = await new Promise<boolean>(resolve => {
      const socket = net.connect(port, 'localhost');
      // Docker's port proxy can accept and then close before the server is up.
      socket.setTimeout(1_000, () => socket.destroy());
      socket.once('error', () => resolve(false));
      socket.once('close', () => resolve(false));
      socket.once('data', data => {
        socket.destroy();
        resolve(data.toString().startsWith('+PONG'));
      });
      socket.write('PING\r\n');
    });
    if (ready) return `valkey://localhost:${port}`;
    if (Date.now() > deadline) throw new Error(`throwaway valkey (${policy}) did not start`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

beforeAll(async () => {
  [evictingUrl, noevictionUrl] = await Promise.all([startValkey('volatile-lru'), startValkey('noeviction')]);
}, 60_000);

afterAll(() => {
  if (containers.length) execFileSync('docker', ['rm', '-f', ...containers]);
});

async function exercise(ps: ValkeyStreamsPubSub) {
  const topic = `eviction-${randomUUID()}`;
  await ps.publish(topic, { type: 'test', data: {}, runId: 'run-1' });
  await ps.subscribe(topic, (_event, ack) => void ack?.());
  await ps.publish(topic, { type: 'test', data: {}, runId: 'run-1' });
  // The check runs right after the first connect; give its INFO round trip time.
  await new Promise(resolve => setTimeout(resolve, 300));
  await ps.clearTopic(topic);
  await ps.close();
}

const policyWarnings = (calls: unknown[][]) => calls.filter(([msg]) => String(msg).includes('maxmemory-policy'));

describe('maxmemory-policy warning', () => {
  it('warns exactly once when the server can evict pubsub keys', async () => {
    const warn = vi.fn();
    await exercise(new ValkeyStreamsPubSub({ url: evictingUrl, blockMs: 50, logger: { warn } }));

    const warnings = policyWarnings(warn.mock.calls);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]![0]).toContain('"volatile-lru"');
    expect(warnings[0]![0]).toContain('noeviction');
  }, 20_000);

  it('falls back to console.warn when no logger is configured', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await exercise(new ValkeyStreamsPubSub({ url: evictingUrl, blockMs: 50 }));
      expect(policyWarnings(consoleWarn.mock.calls)).toHaveLength(1);
    } finally {
      consoleWarn.mockRestore();
    }
  }, 20_000);

  it('does not warn under noeviction', async () => {
    const warn = vi.fn();
    await exercise(new ValkeyStreamsPubSub({ url: noevictionUrl, blockMs: 50, logger: { warn } }));
    expect(policyWarnings(warn.mock.calls)).toHaveLength(0);
  }, 20_000);
});
