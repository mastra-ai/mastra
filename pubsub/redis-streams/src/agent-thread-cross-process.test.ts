/**
 * Cross-process AgentThreadStreamRuntime + Redis lease tests.
 *
 * Spawns N tsx child processes, each holding its own ThreadStreamRuntime +
 * stub Agent bound to a shared RedisStreamsPubSub. Drives rapid-fire signals
 * from independent processes and asserts:
 *   - exactly one worker wins the lease (gets ownerStream defined)
 *   - the remaining signals are delivered to the winner via signal-enqueued
 *   - all runs eventually complete (no signal dropped)
 *
 * Mirrors the Vercel-Lambda topology where each request lands on a fresh
 * process with no shared in-memory state.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { flushRedis, REDIS_URL, waitFor, waitForLine } from '../test-fixtures/harness';
import type { ManagedProcess } from '../test-fixtures/harness';

const PACKAGE_DIR = resolve(__dirname, '..');
const TSX_BIN = resolve(PACKAGE_DIR, 'node_modules/.bin/tsx');
const ENTRY = resolve(PACKAGE_DIR, 'test-fixtures/agent-thread-worker.entry.ts');

interface Worker extends ManagedProcess {
  proc: ChildProcess;
  send: (msg: Record<string, unknown>) => void;
  events: () => Array<Record<string, unknown>>;
}

function spawnWorker(id: string, env: Record<string, string> = {}): Worker {
  const proc = spawn(TSX_BIN, [ENTRY], {
    cwd: PACKAGE_DIR,
    env: {
      ...process.env,
      REDIS_URL,
      WORKER_ID: id,
      ...env,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const managed: Worker = {
    proc,
    stdout: '',
    stderr: '',
    label: id,
    send: (msg: Record<string, unknown>) => {
      proc.stdin?.write(`${JSON.stringify(msg)}\n`);
    },
    events: () => {
      const lines = managed.stdout.split('\n').filter(Boolean);
      const out: Array<Record<string, unknown>> = [];
      for (const line of lines) {
        try {
          out.push(JSON.parse(line));
        } catch {
          /* ignore non-json lines */
        }
      }
      return out;
    },
  };

  proc.stdout?.on('data', (chunk: Buffer) => {
    managed.stdout += chunk.toString();
  });
  proc.stderr?.on('data', (chunk: Buffer) => {
    managed.stderr += chunk.toString();
  });
  return managed;
}

async function killWorker(w: Worker) {
  if (w.proc.exitCode !== null) return;
  try {
    w.send({ cmd: 'exit' });
  } catch {
    /* ignore broken pipe */
  }
  await new Promise<void>(res => {
    const timer = setTimeout(() => {
      try {
        w.proc.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      res();
    }, 3000);
    w.proc.once('exit', () => {
      clearTimeout(timer);
      res();
    });
  });
}

function eventsByType(w: Worker, type: string) {
  return w.events().filter(e => e.type === type);
}

function totalEventsByType(workers: Worker[], type: string) {
  return workers.flatMap(w => eventsByType(w, type)).length;
}

describe.skipIf(!process.env.REDIS_URL && !process.env.CI && process.env.SKIP_REDIS_TESTS === '1')(
  'AgentThreadStreamRuntime cross-process lease',
  () => {
    beforeAll(async () => {
      // Smoke-test the Redis URL early so the failure is obvious if Docker
      // isn't up rather than the test timing out waiting for ready.
      await flushRedis(REDIS_URL);
    });

    afterAll(async () => {
      await flushRedis(REDIS_URL).catch(() => {});
    });

    let workers: Worker[] = [];
    afterEach(async () => {
      await Promise.all(workers.map(killWorker));
      workers = [];
      await flushRedis(REDIS_URL).catch(() => {});
    });

    it('serializes rapid-fire signals through one lease winner with no dropped signals', async () => {
      const resourceId = `rapid-${Date.now()}`;
      const threadId = `thread-${Date.now()}`;
      const env = { RESOURCE_ID: resourceId, THREAD_ID: threadId, RUN_MS: '500' };

      const a = spawnWorker('worker-a', env);
      const b = spawnWorker('worker-b', env);
      const c = spawnWorker('worker-c', env);
      workers = [a, b, c];

      await Promise.all([
        waitForLine(a, '"type":"ready"'),
        waitForLine(b, '"type":"ready"'),
        waitForLine(c, '"type":"ready"'),
      ]);

      // Let subscriptions settle in Redis before publishing — XREADGROUP `>`
      // only delivers messages that arrive after the subscriber joins. This is
      // also realistic for serverless: each Lambda subscribes when it boots
      // and the test wants to assert post-subscribe delivery works.
      await new Promise(r => setTimeout(r, 500));

      // Rapid-fire: each worker sends one signal, simulating three independent
      // Lambdas receiving three near-simultaneous Slack messages.
      a.send({ cmd: 'send', sigId: 'sig-1' });
      b.send({ cmd: 'send', sigId: 'sig-2' });
      c.send({ cmd: 'send', sigId: 'sig-3' });

      // Wait for all 3 owner-stream-resolved events: each worker returns either
      // a defined stream (lease winner) or undefined (lease loser).
      await waitFor(async () => totalEventsByType(workers, 'owner-stream-resolved') === 3, 15_000);

      const resolved = workers.flatMap(w =>
        eventsByType(w, 'owner-stream-resolved').map(e => ({ workerId: w.label, defined: e.defined })),
      );
      const winners = resolved.filter(r => r.defined === true);
      expect(winners).toHaveLength(1);
      const winnerWorker = workers.find(w => w.label === winners[0]!.workerId);
      expect(winnerWorker).toBeDefined();

      // Winner should run all three signals: its own + two enqueued from peers.
      await waitFor(async () => eventsByType(winnerWorker!, 'run-finished').length >= 3, 15_000);

      const finished = eventsByType(winnerWorker!, 'run-finished');
      const finishedSigIds = new Set(finished.map(e => e.sigId));
      expect(finishedSigIds).toEqual(new Set(['sig-1', 'sig-2', 'sig-3']));

      // Losers must NOT have run anything locally.
      const losers = workers.filter(w => w !== winnerWorker);
      for (const loser of losers) {
        expect(eventsByType(loser, 'run-started')).toHaveLength(0);
      }
    }, 30_000);

    it('drains signal-enqueued from losers that die immediately (Vercel Lambda-death)', async () => {
      const resourceId = `lambda-death-${Date.now()}`;
      const threadId = `thread-${Date.now()}`;
      // Hold the winner's run long enough for the losers to boot, subscribe,
      // publish, and exit before run-completed releases the lease.
      const env = { RESOURCE_ID: resourceId, THREAD_ID: threadId, RUN_MS: '3000' };

      // Winner stays alive for the duration of the test. It must boot first so
      // it acquires the lease before any losers fire.
      const winner = spawnWorker('winner', env);
      workers = [winner];
      await waitForLine(winner, '"type":"ready"');
      await new Promise(r => setTimeout(r, 300)); // let subscription settle

      winner.send({ cmd: 'send', sigId: 'sig-1' });
      // Wait until the winner has acquired the lease and run-started fires —
      // otherwise the losers might win the race.
      await waitForLine(winner, '"type":"run-started"');

      // Lambda 2 + 3 each fire a signal then exit. They model Vercel Lambdas
      // that return their HTTP response immediately after publishing to Redis.
      const lambda2 = spawnWorker('lambda-2', env);
      const lambda3 = spawnWorker('lambda-3', env);
      workers = [winner, lambda2, lambda3];

      await Promise.all([waitForLine(lambda2, '"type":"ready"'), waitForLine(lambda3, '"type":"ready"')]);

      lambda2.send({ cmd: 'send-and-exit', sigId: 'sig-2' });
      lambda3.send({ cmd: 'send-and-exit', sigId: 'sig-3' });

      // Both losers should exit after publishing — well before the winner's
      // 10s run finishes, so their `signal-enqueued` must reach the winner
      // through Redis while its run is still in flight.
      await waitFor(async () => lambda2.proc.exitCode !== null && lambda3.proc.exitCode !== null, 10_000);

      // Winner must drain both enqueued signals even though both publishers
      // exited immediately. This is the Vercel Lambda-death scenario where
      // the winner's heartbeat keeps the lease alive across follow-ups.
      await waitFor(async () => eventsByType(winner, 'run-finished').length >= 3, 20_000);

      const finished = eventsByType(winner, 'run-finished');
      const finishedSigIds = new Set(finished.map(e => e.sigId));
      expect(finishedSigIds).toEqual(new Set(['sig-1', 'sig-2', 'sig-3']));
    }, 60_000);
  },
);
