import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { globalRunRegistry } from '@mastra/core/agent/durable';
import type { Event } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LibSQLStore } from '../../storage';
import { createMarkerWorkflow } from './fixtures/marker-workflow';
import type { SelfTestArgs } from './fixtures/self-test-peer';
import { createXprocEnv, DEFAULT_HANG_GUARD_MS, PEER_TIMEOUT_MS } from './peer-helper';
import type { XprocEnv } from './peer-helper';
import { bootWorkers } from './process-workers';
import { gate } from './step-agent';

const FIXTURE = new URL('./fixtures/self-test-peer.ts', import.meta.url);

/**
 * Vitest budget for a self-test that spawns a peer. `spawnPeer` waits up to
 * `PEER_TIMEOUT_MS` (45s) for the peer to report its config and reach the
 * transport, and the handle's own waits do too, so a test that would report its
 * own hang-guard error needs headroom above that: without it the runner's bare
 * "Test timed out" replaces the diagnostic.
 */
const PEER_TEST_TIMEOUT_MS = PEER_TIMEOUT_MS + 15_000;

function hangGuard<T>(promise: Promise<T>, what: string, describeEnv: () => string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${what} within ${DEFAULT_HANG_GUARD_MS}ms (hang guard)\n${describeEnv()}`)),
        DEFAULT_HANG_GUARD_MS,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

describe('cross-process peer helper', () => {
  let env: XprocEnv;

  beforeEach(async () => {
    env = await createXprocEnv();
  });

  afterEach(async () => {
    await env.cleanup();
  });

  // Every fixture here except the workflow producer only talks to the
  // transport, so none of them consumes workflow events and each declares
  // `workers: false` — the peer runtime fails a peer whose declaration and boot
  // state disagree.
  const spawn = (args: SelfTestArgs) => env.spawnPeer(FIXTURE, args, { workers: false });

  it(
    'shares one socket: a publish in the peer is received in main',
    async () => {
      const topic = `xproc.selftest.${randomUUID()}`;
      const received = gate<Event>();
      await env.pubsub().subscribe(topic, event => received.resolve(event));
      expect(env.pubsub().isBroker, env.describe()).toBe(true);

      const peer = await spawn({ mode: 'publish', topic, payload: 'from-peer' });
      const result = await peer.result<{ pid: number }>();

      // spawnPeer proves this before the fixture runs: the peer reached the
      // shared transport and connected to this process's broker.
      expect(peer.selfCheck?.remoteClientCount, env.describe()).toBeGreaterThanOrEqual(1);
      const event = await received.promise;
      expect(event.data, env.describe()).toEqual({ payload: 'from-peer' });
      expect(result.pid).toBe(peer.pid);
      expect(peer.pid).not.toBe(process.pid);
      expect(await peer.exit()).toEqual({ code: 0, signal: null });
    },
    PEER_TEST_TIMEOUT_MS,
  );

  it(
    'passes the startup self-check when the peer is gone again immediately',
    async () => {
      // One peer at a time on purpose: what is under test is this peer's own
      // receipt. A peer that returns as soon as its ping lands can be gone
      // before the spawn wait resumes, which a check that read the broker's
      // client count afterwards could get wrong. This pins the contract — an
      // immediately exiting peer must pass the self-check — rather than
      // reproducing that race, which was not reachable locally under the old
      // sampling (see round3-followup.txt in the plan's proof directory).
      for (let attempt = 0; attempt < 5; attempt++) {
        const peer = await spawn({ mode: 'instant' });
        const selfCheck = peer.selfCheck;
        expect(selfCheck, `no self-check recorded for ${peer.pid}\n${env.describe()}`).toBeDefined();
        expect(selfCheck!.remoteClientCount, `peer ${peer.pid}\n${env.describe()}`).toBeGreaterThanOrEqual(1);
        expect(selfCheck!.startupMs).toBeGreaterThanOrEqual(0);
        expect(await peer.result<{ pid: number }>()).toEqual({ pid: peer.pid });
        expect(await peer.exit()).toEqual({ code: 0, signal: null });
        expect(peer.pid).not.toBe(process.pid);
      }
    },
    PEER_TEST_TIMEOUT_MS,
  );

  it(
    'shares one LibSQL file: a row written by the peer is readable by main',
    async () => {
      const threadId = `xproc-thread-${randomUUID()}`;
      const peer = await spawn({ mode: 'db-write', threadId });
      await peer.result();

      const store = new LibSQLStore({ id: 'self-test-main', url: env.dbUrl });
      await store.init();
      try {
        const memory = (await store.getStore('memory'))!;
        const thread = await memory.getThreadById({ threadId });
        expect(thread?.resourceId, env.describe()).toBe(`written-by-${peer.pid}`);
      } finally {
        await store.close();
      }
    },
    PEER_TEST_TIMEOUT_MS,
  );

  it('fails waitFor within its hang guard when the peer never signals', async () => {
    const peer = await spawn({ mode: 'silent' });

    await expect(peer.waitFor('never-sent', { timeoutMs: 250 })).rejects.toThrow(
      /signal "never-sent" from peer-1 \(pid \d+\) not received within 250ms \(hang guard\)[\s\S]*xproc-config/,
    );

    // The peer is still healthy; let it finish normally.
    peer.send('finish');
    await peer.result();
    expect(await peer.exit()).toEqual({ code: 0, signal: null });
  });

  it(
    'a paused peer does not process a published event until resumed',
    async () => {
      const topic = `xproc.selftest.${randomUUID()}`;
      const mainCopy = gate<Event>();
      await env.pubsub().subscribe(topic, event => mainCopy.resolve(event));

      const peer = await spawn({ mode: 'heard', topic });
      await peer.waitFor('subscribed');

      await peer.pause();
      let heard = false;
      const heardSignal = peer.waitFor<{ seq: number }>('heard').then(data => {
        heard = true;
        return data;
      });

      await env.pubsub().publish(topic, { type: 'ping', runId: 'self-test', data: { seq: 1 } });
      // Main's own subscriber has the event, so the broker already fanned it out to the peer's socket.
      await mainCopy.promise;
      expect(heard, `peer handled the event while stopped\n${env.describe()}`).toBe(false);

      await peer.resume();
      expect(await heardSignal).toEqual({ seq: 1 });
      expect(await peer.exit()).toEqual({ code: 0, signal: null });
    },
    PEER_TEST_TIMEOUT_MS,
  );

  it(
    'runs each process in its own module graph: a peer run is not in main globalRunRegistry',
    async () => {
      const runId = `xproc-registry-${randomUUID()}`;
      const peer = await spawn({ mode: 'registry', runId });

      const parked = await peer.waitFor<{ pid: number; present: boolean }>('parked');
      expect(parked.pid).toBe(peer.pid);
      expect(parked.present, `run missing from the peer's registry\n${env.describe()}`).toBe(true);
      // `has` rather than `get`: the run must not be visible here at all.
      expect(globalRunRegistry.has(runId), `peer run leaked into main's registry\n${env.describe()}`).toBe(false);

      peer.send('release');
      expect(await peer.result<{ text: string }>()).toEqual({ text: 'finished 1 steps' });
      expect(await peer.exit()).toEqual({ code: 0, signal: null });
    },
    PEER_TEST_TIMEOUT_MS,
  );

  it(
    'runs a producer peer with workers off: only main executes the workflow event',
    async () => {
      const workflowId = `xproc-marker-${randomUUID()}`;
      const logPath = path.join(env.dir, 'executions.log');
      const executed = gate<void>();
      const workflow = createMarkerWorkflow({ id: workflowId, logPath, onExecute: () => executed.resolve() });

      const storage = new LibSQLStore({ id: 'self-test-marker-main', url: env.dbUrl });
      await storage.init();
      const mastra = new Mastra({
        workflows: { [workflowId]: workflow },
        storage,
        pubsub: env.pubsub(),
        logger: false,
        workers: env.workers ? undefined : false,
      });

      try {
        await bootWorkers(mastra, env.workers);

        const peer = await env.spawnPeer(
          FIXTURE,
          { mode: 'workflow-producer', workflowId, logPath } satisfies SelfTestArgs,
          { workers: false },
        );
        expect(peer.workers, env.describe()).toBe(false);

        // The producer owns no local run: it only published the start event.
        const started = await peer.waitFor<{ runId: string; pid: number }>('started');
        expect(started.pid).toBe(peer.pid);

        // Main's push subscription consumes the event and runs the step.
        await hangGuard(executed.promise, 'main never executed the workflow event', () => {
          let log = 'no executions.log yet';
          try {
            log = `executions.log: ${readFileSync(logPath, 'utf8').trim() || '(empty)'}`;
          } catch {}
          return `${log}\n${env.describe()}`;
        });

        peer.send('finish');
        await peer.result();
        expect(await peer.exit()).toEqual({ code: 0, signal: null });

        const lines = (await readFile(logPath, 'utf8')).trim().split('\n').filter(Boolean);
        expect(lines, `expected exactly one execution by main\n${env.describe()}`).toEqual([String(process.pid)]);
      } finally {
        await mastra.shutdown();
        await storage.close();
      }
    },
    PEER_TEST_TIMEOUT_MS,
  );

  it(
    'fails the peer when it cannot flush before exit',
    async () => {
      const peer = await spawn({ mode: 'flush-fails' });

      await expect(peer.result(), `flush failure must not look like a clean result\n${env.describe()}`).rejects.toThrow(
        /flush\(\) before exit failed/,
      );
      expect(await peer.exit()).toEqual({ code: 1, signal: null });
    },
    PEER_TEST_TIMEOUT_MS,
  );

  it(
    'fails a peer whose worker setting and boot state disagree',
    async () => {
      // Spawned with `workers: true` on purpose, which is the env default: the
      // fixture only talks to the transport and never calls bootWorkers, so it
      // declares workers it does not boot. Without this check the mistake
      // surfaces later as a test waiting for an event this process never
      // consumes.
      const peer = await env.spawnPeer(FIXTURE, { mode: 'silent' }, { workers: true });
      peer.send('finish');

      await expect(
        peer.result(),
        `a peer that never boots workers must not report success\n${env.describe()}`,
      ).rejects.toThrow(/declares workers: true but never called bootWorkers/);
      expect(await peer.exit()).toEqual({ code: 1, signal: null });
    },
    PEER_TEST_TIMEOUT_MS,
  );
});
