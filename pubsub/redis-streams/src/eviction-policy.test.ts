import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from 'redis';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getFreePort } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

// Throwaway servers with maxmemory set (like the incident's managed Redis),
// one evicting and one not. Never reconfigure the shared test container.
const containers: string[] = [];
let evictingUrl: string;
let noevictionUrl: string;

async function startRedis(policy: string): Promise<string> {
  const port = await getFreePort();
  containers.push(
    execFileSync(
      'docker',
      [
        'run',
        '-d',
        '--rm',
        '-p',
        `${port}:6379`,
        'redis:8-alpine',
        'redis-server',
        '--maxmemory',
        '64mb',
        '--maxmemory-policy',
        policy,
      ],
      { encoding: 'utf8' },
    ).trim(),
  );
  const url = `redis://localhost:${port}`;
  const deadline = Date.now() + 15_000;
  for (;;) {
    const probe = createClient({ url, socket: { reconnectStrategy: false } });
    probe.on('error', () => {});
    try {
      await probe.connect();
      await probe.ping();
      await probe.quit();
      return url;
    } catch {
      if (Date.now() > deadline) throw new Error(`throwaway redis (${policy}) did not start`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

beforeAll(async () => {
  [evictingUrl, noevictionUrl] = await Promise.all([startRedis('volatile-lru'), startRedis('noeviction')]);
}, 30_000);

afterAll(() => {
  if (containers.length) execFileSync('docker', ['rm', '-f', ...containers]);
});

async function exercise(ps: RedisStreamsPubSub) {
  const topic = `eviction-${randomUUID()}`;
  await ps.publish(topic, { type: 'test', data: {}, runId: 'run-1' });
  await ps.subscribe(topic, (_event, ack) => void ack?.());
  await ps.publish(topic, { type: 'test', data: {}, runId: 'run-1' });
  // The check runs right after the first connect; give its INFO round trip time.
  await new Promise(resolve => setTimeout(resolve, 300));
  await ps.clearTopic(topic);
  await ps.close();
}

describe('maxmemory-policy warning', () => {
  it('warns exactly once when Redis can evict pubsub keys', async () => {
    const warn = vi.fn();
    await exercise(new RedisStreamsPubSub({ url: evictingUrl, blockMs: 50, logger: { warn } }));

    const policyWarnings = warn.mock.calls.filter(([msg]) => String(msg).includes('maxmemory-policy'));
    expect(policyWarnings).toHaveLength(1);
    expect(policyWarnings[0]![0]).toContain('"volatile-lru"');
    expect(policyWarnings[0]![0]).toContain('noeviction');
  }, 20_000);

  it('falls back to console.warn when no logger is configured', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await exercise(new RedisStreamsPubSub({ url: evictingUrl, blockMs: 50 }));
      const policyWarnings = consoleWarn.mock.calls.filter(([msg]) => String(msg).includes('maxmemory-policy'));
      expect(policyWarnings).toHaveLength(1);
    } finally {
      consoleWarn.mockRestore();
    }
  }, 20_000);

  it('does not warn under noeviction', async () => {
    const warn = vi.fn();
    await exercise(new RedisStreamsPubSub({ url: noevictionUrl, blockMs: 50, logger: { warn } }));
    expect(warn.mock.calls.filter(([msg]) => String(msg).includes('maxmemory-policy'))).toHaveLength(0);
  }, 20_000);
});
