/**
 * Cross-process AgentThreadStreamRuntime + Redis lease tests.
 *
 * Spawns N tsx child processes, each holding its own ThreadStreamRuntime +
 * stub Agent bound to a shared RedisStreamsPubSub. Drives rapid-fire signals
 * from independent processes and asserts:
 *   - exactly one worker wins the lease (its result resolves to a wake outcome with output)
 *   - the remaining signals are delivered to the winner via signal-enqueued
 *   - all runs eventually complete (no signal dropped)
 *
 * Mirrors the Vercel-Lambda topology where each request lands on a fresh
 * process with no shared in-memory state.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { createClient } from 'redis';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { flushRedis, REDIS_URL, waitFor, waitForLine } from '../test-fixtures/harness';
import type { ManagedProcess } from '../test-fixtures/harness';

const PACKAGE_DIR = resolve(__dirname, '..');
const TSX_BIN = resolve(PACKAGE_DIR, 'node_modules/.bin/tsx');
const ENTRY = resolve(PACKAGE_DIR, 'test-fixtures/agent-thread-worker.entry.ts');

// Mirror RedisStreamsPubSub#leaseKey: `<keyPrefix>:lease:<threadKey>` where the
// default keyPrefix is `mastra:topic` and the thread key joins resourceId and
// threadId with a NUL separator (AGENT_THREAD_KEY_SEPARATOR).
const AGENT_THREAD_KEY_SEPARATOR = '\u0000';
function leaseKeyFor(resourceId: string, threadId: string): string {
  return `mastra:topic:lease:${resourceId}${AGENT_THREAD_KEY_SEPARATOR}${threadId}`;
}

function streamKeyFor(resourceId: string, threadId: string): string {
  const topic = `agent.thread-stream.${encodeURIComponent(`${resourceId}${AGENT_THREAD_KEY_SEPARATOR}${threadId}`)}`;
  return `mastra:topic:${topic}`;
}

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

    it('acknowledges thread events so the private fanout pending list stays empty', async () => {
      const resourceId = `ack-${Date.now()}`;
      const threadId = `thread-${Date.now()}`;
      const streamKey = streamKeyFor(resourceId, threadId);
      const worker = spawnWorker('ack-worker', {
        RESOURCE_ID: resourceId,
        THREAD_ID: threadId,
        RUN_MS: '200',
      });
      workers = [worker];

      await waitForLine(worker, '"type":"ready"');
      worker.send({ cmd: 'send', sigId: 'ack-signal' });
      await waitForLine(worker, '"type":"run-finished"');

      const inspector = createClient({ url: REDIS_URL });
      await inspector.connect();
      try {
        await waitFor(async () => {
          const groups = await inspector.xInfoGroups(streamKey);
          return (
            (await inspector.xLen(streamKey)) >= 2 &&
            groups.length > 0 &&
            groups.every(group => Number(group.lag) === 0)
          );
        });

        const groups = await inspector.xInfoGroups(streamKey);
        expect(groups.every(group => group.name.startsWith('__fanout-'))).toBe(true);
        expect(groups.reduce((total, group) => total + Number(group.pending), 0)).toBe(0);
      } finally {
        await inspector.quit();
      }
    }, 30_000);

    it('serializes rapid-fire signals through one lease winner with no dropped signals', async () => {
      const resourceId = `rapid-${Date.now()}`;
      const threadId = `thread-${Date.now()}`;
      const env = {
        RESOURCE_ID: resourceId,
        THREAD_ID: threadId,
        RUN_MS: '500',
        MASTRA_AGENT_THREAD_LEASE_TTL_MS: '6000',
      };

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
      // publish, and exit before run-completed releases the lease. The lease TTL
      // is shortened (with renewal scaled to TTL/3) so the winner's heartbeat,
      // not a 15s default, is what keeps the lease alive across the three runs —
      // and so a genuinely dead owner's lease would lapse quickly.
      const env = {
        RESOURCE_ID: resourceId,
        THREAD_ID: threadId,
        RUN_MS: '1500',
        MASTRA_AGENT_THREAD_LEASE_TTL_MS: '6000',
      };

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
      // first run finishes, so their `signal-enqueued` must reach the winner
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

    it('holds the thread lease across drained follow-up runs so a racing process cannot start a competing run', async () => {
      const resourceId = `drain-race-${Date.now()}`;
      const threadId = `thread-${Date.now()}`;
      // Each run is long enough that the lease-key poller captures many samples
      // during the drained follow-up run, but short enough that completion (and
      // the release/re-acquire transition) happens within the test.
      const env = { RESOURCE_ID: resourceId, THREAD_ID: threadId, RUN_MS: '900' };
      const leaseKey = leaseKeyFor(resourceId, threadId);

      // Poll the raw Redis lease key directly. A subscribed peer's local
      // `activeThreadRunIds` is kept "active" by run-registered pub/sub events,
      // which masks a freed lease — so peer-event assertions give false
      // negatives. The Redis key is the single source of truth a *fresh* cold
      // process consults via acquireLease, so we observe it directly.
      const probe = createClient({ url: REDIS_URL });
      await probe.connect();
      let polling = true;
      const samples: Array<{ t: number; owner: string | null }> = [];
      const t0 = Date.now();
      const poller = (async () => {
        while (polling) {
          const owner = await probe.get(leaseKey);
          samples.push({ t: Date.now() - t0, owner });
          await new Promise(r => setTimeout(r, 5));
        }
      })();

      // Owner boots and acquires the lease for run 1. Declared outside the try
      // so the post-finally lease-window assertions can read its events.
      const owner = spawnWorker('owner', env);
      try {
        workers = [owner];
        await waitForLine(owner, '"type":"ready"');
        await new Promise(r => setTimeout(r, 300)); // let subscription settle

        owner.send({ cmd: 'send', sigId: 'sig-1' });
        await waitForLine(owner, '"type":"run-started"');

        // While run 1 is in flight, enqueue a follow-up locally. This guarantees
        // a drained run 2 fires the instant run 1 completes — the exact moment
        // the lease is released and (without the fix) handed to agent.stream()
        // again without re-acquiring.
        owner.send({ cmd: 'send', sigId: 'sig-2' });

        // Let the owner finish run 1, drain + finish run 2.
        await waitFor(async () => eventsByType(owner, 'run-finished').length >= 2, 20_000);

        // The owner ran both its own signal and the drained follow-up.
        const ownerFinishedSigIds = new Set(eventsByType(owner, 'run-finished').map(e => e.sigId));
        expect(ownerFinishedSigIds).toEqual(new Set(['sig-1', 'sig-2']));
      } finally {
        polling = false;
        await poller;
        await probe.quit();
      }

      // Bracket the drained follow-up run (run 2) by the run-started/run-finished
      // timestamps the owner emitted for sig-2, then assert the lease was owned
      // for the whole window. Without the fix, run 2 executes with the lease key
      // empty — a fresh process firing `ifIdle: wake` would win it and start a
      // competing concurrent run for the same thread.
      const sig2Started = eventsByType(owner, 'run-started').find(e => e.sigId === 'sig-2');
      const sig2Finished = eventsByType(owner, 'run-finished').find(e => e.sigId === 'sig-2');
      expect(sig2Started).toBeDefined();
      expect(sig2Finished).toBeDefined();

      // Owners observed while the lease key held a value (any non-null run id).
      const heldOwners = new Set(samples.filter(s => s.owner !== null).map(s => s.owner));
      // The drained run 2 must run under a held lease — so we must have observed
      // at least one owner id beyond run 1's. A single distinct owner across the
      // whole test means run 2 ran leaseless after run 1 released.
      expect(heldOwners.size).toBeGreaterThanOrEqual(2);

      // No sustained freed window *after the lease is first acquired*: once the
      // owner holds the lease, it must never be empty for an extended stretch
      // while drained work is pending. We ignore the leading pre-acquire empties
      // and tolerate brief atomic release→re-acquire blips, but not a run-length
      // gap (~RUN_MS). Without the fix, run 2 leaves a ~900ms empty window.
      let maxFreeRunMs = 0;
      let freeStart: number | null = null;
      let acquiredOnce = false;
      for (const s of samples) {
        if (s.owner !== null) {
          acquiredOnce = true;
          freeStart = null;
          continue;
        }
        if (!acquiredOnce) continue; // skip pre-acquire empties
        if (freeStart === null) freeStart = s.t;
        maxFreeRunMs = Math.max(maxFreeRunMs, s.t - freeStart);
      }
      expect(maxFreeRunMs).toBeLessThan(300);
    }, 60_000);
  },
);
