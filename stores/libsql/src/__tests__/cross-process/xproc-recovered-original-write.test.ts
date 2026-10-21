/**
 * T81 / COR-1334: a paused original must not replace or append to the answer
 * persisted by a recovering process. This proves surviving history, not that
 * the original necessarily attempts a stale write (it shares the run stream).
 */
import { randomUUID } from 'node:crypto';

import { createDurableAgent, createEventedAgent, DurableStepIds } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LibSQLStore } from '../../storage';
import type { T81PeerArgs, T81PeerResult } from './fixtures/t81-peer';
import { createXprocEnv, DEFAULT_HANG_GUARD_MS, PEER_TIMEOUT_MS } from './peer-helper';
import type { PeerHandle, XprocEnv } from './peer-helper';
import { bootWorkers } from './process-workers';
import { createStepAgent } from './step-agent';

const FIXTURE = new URL('./fixtures/t81-peer.ts', import.meta.url);
const CELL_TIMEOUT_MS = PEER_TIMEOUT_MS + DEFAULT_HANG_GUARD_MS + 10_000;
const PEER_LEASE_TTL_MS = 1_500;
const answer = (pid: number) => `finished 3 steps from pid ${pid}`;

for (const engine of ['durable', 'evented'] as const) {
  describe(`T81 xproc-${engine}: recovered history survives the original`, () => {
    let env: XprocEnv;
    let reader: LibSQLStore;
    let storage: LibSQLStore | undefined;
    let mastra: Mastra | undefined;
    let peer: PeerHandle | undefined;
    let args: T81PeerArgs;

    beforeEach(async () => {
      env = await createXprocEnv({ workers: true });
      reader = new LibSQLStore({ id: 't81-independent-reader', url: env.dbUrl });
      const id = randomUUID();
      args = {
        engine,
        agentId: `t81-${id}`,
        runId: `run-${id}`,
        threadId: `thread-${id}`,
        resourceId: `resource-${id}`,
      };
    });

    afterEach(async () => {
      try {
        // kill() resumes a stopped peer first; failure cleanup must not leave SIGSTOP orphans.
        if (peer) {
          peer.send('release');
          await peer.kill();
        }
      } finally {
        peer = undefined;
        try {
          await mastra?.shutdown();
        } finally {
          mastra = undefined;
          try {
            await storage?.close();
          } finally {
            storage = undefined;
            try {
              await reader?.close();
            } finally {
              await env?.cleanup();
            }
          }
        }
      }
    });

    function guarded<T>(promise: Promise<T>, phase: string): Promise<T> {
      let timer: ReturnType<typeof setTimeout> | undefined;
      return Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`${engine} ${args.runId}: ${phase}\n${env.describe()}`)),
            DEFAULT_HANG_GUARD_MS,
          );
        }),
      ]).finally(() => clearTimeout(timer));
    }

    async function startOriginal() {
      const previous = process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS;
      process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = String(PEER_LEASE_TTL_MS);
      try {
        peer = await env.spawnPeer<T81PeerArgs>(FIXTURE, args, { role: `original-${engine}`, workers: true });
      } finally {
        if (previous === undefined) delete process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS;
        else process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = previous;
      }
      const blocked = await peer.waitFor<{ pid: number; runId: string; step: number }>('blocked');
      expect(blocked).toEqual({ pid: peer.pid, runId: args.runId, step: 1 });
      return peer;
    }

    async function messages() {
      const memory = (await reader.getStore('memory'))!;
      return (await memory.listMessages({ threadId: args.threadId, perPage: false })).messages;
    }

    async function history() {
      return (await messages()).map(({ id, role, content }) => ({ id, role, content }));
    }

    async function expectAnswer(pid: number) {
      const saved = await messages();
      const finals = saved.filter(
        message => message.role === 'assistant' && /finished 3 steps from pid \d+/.test(message.content.content ?? ''),
      );
      expect(finals, `the thread holds one answer, not two\n${env.describe()}`).toHaveLength(1);
      expect(finals[0]!.content.content, "the recovered answer is still the thread's last word").toBe(answer(pid));
      expect(saved.at(-1)?.content.content).toBe(answer(pid));
    }

    async function finishOriginal(original: PeerHandle) {
      original.send('release');
      const result = await guarded(original.result<T81PeerResult>(), 'original tool/run/stream did not settle');
      expect(result.pid).toBe(original.pid);
      expect(result.toolEvents).toContainEqual({ event: 'commit', n: 1 });
      expect(result.errors, env.describe()).toEqual([]);
      expect(await original.exit()).toEqual({ code: 0, signal: null });
      return result;
    }

    it(
      'control: releasing the blocked original persists its own answer',
      async () => {
        const original = await startOriginal();
        const result = await finishOriginal(original);
        expect(result.toolEvents.filter(event => event.event === 'commit').map(event => event.n)).toEqual([1, 2, 3]);
        await expectAnswer(original.pid);
      },
      CELL_TIMEOUT_MS,
    );

    // COR-1444: evented recover() stalled before returning its stream in repetition 8
    // (20s guard; 3/4 tests passed). Fifty instrumented recovery repeats passed,
    // but did not explain the timeout. Retain the assertions without treating a
    // setup timeout as COR-1334 reproduction or claiming evented stability.
    it.skipIf(engine === 'evented')(
      'keeps the recovered answer after the stopped original resumes and exits',
      async () => {
        const original = await startOriginal();
        const workflows = (await reader.getStore('workflows'))!;
        const ownership = () => workflows.getRunOwnership({ runId: args.runId });
        const snapshot = () =>
          workflows.loadWorkflowSnapshot({ workflowName: DurableStepIds.AGENTIC_LOOP, runId: args.runId });
        await expect.poll(async () => (await snapshot())?.status, { timeout: DEFAULT_HANG_GUARD_MS }).toBe('running');
        const first = await ownership();
        expect(first?.live, env.describe()).toBe(true);

        storage = new LibSQLStore({ id: 't81-replacement', url: env.dbUrl });
        const memory = new MockMemory();
        memory.setStorage(storage);
        const { agent, modelCalls } = createStepAgent({
          id: args.agentId,
          steps: 3,
          finalText: answer(process.pid),
          memory,
        });
        const runner = engine === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent });
        mastra = new Mastra({
          agents: { t81: runner },
          storage,
          pubsub: env.pubsub(),
          logger: false,
          recovery: { durableAgents: 'auto' },
        });
        // Do not boot replacement workers while the original is executing its tool.
        await expect(runner.recover(args.runId)).rejects.toMatchObject({ id: 'DURABLE_AGENT_RUN_ACTIVE' });
        expect(modelCalls()).toBe(0);
        expect(await ownership()).toMatchObject({ generation: first!.generation, ownerId: first!.ownerId, live: true });

        await original.pause();
        await expect.poll(async () => (await ownership())?.live, { timeout: DEFAULT_HANG_GUARD_MS }).toBe(false);
        await bootWorkers(mastra, env.workers);
        const recovered = await guarded(runner.recover(args.runId), 'recovery did not start');
        try {
          const errors: unknown[] = [];
          const drained = (async () => {
            for await (const chunk of recovered.fullStream) {
              if (chunk.type === 'error') errors.push(chunk);
            }
          })();
          const [output] = await guarded(
            Promise.all([recovered.output.getFullOutput(), drained]),
            'replacement output/stream did not settle',
          );
          expect(errors, env.describe()).toEqual([]);
          expect(output.text, env.describe()).toBe(answer(process.pid));
          expect(output.finishReason).toBe('stop');
          expect(modelCalls()).toBeGreaterThan(0);
          await expect.poll(snapshot, { timeout: DEFAULT_HANG_GUARD_MS }).toBeNull();
          const replacement = await ownership();
          expect(replacement!.generation).toBeGreaterThan(first!.generation);
          await expectAnswer(process.pid);
          const baseline = await history();

          await original.resume();
          await finishOriginal(original);
          await expectAnswer(process.pid);
          expect(await history(), 'original changed recovered message IDs, ordering or content').toEqual(baseline);
          expect(await snapshot(), 'original recreated a completed run snapshot').toBeNull();
          expect((await ownership())?.generation).toBe(replacement!.generation);
        } finally {
          recovered.cleanup();
        }
      },
      CELL_TIMEOUT_MS,
    );
  });
}
