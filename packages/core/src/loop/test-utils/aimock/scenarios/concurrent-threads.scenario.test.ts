/** Ported from validation harness case T43 (concurrent-threads). */
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';

function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => {
    release = resolve;
  });
  return { promise, release };
}

type ChatRequest = { messages?: { role: string; content?: unknown }[] };

function turn(body: ChatRequest) {
  const messages = body.messages ?? [];
  const user = messages.filter(message => message.role === 'user').at(-1);
  return {
    run: String(user?.content).includes('run 1') ? 1 : 0,
    done: messages.filter(message => message.role === 'tool').length,
  };
}

describeForAllEngines('Concurrent conversations preserve replies and isolate cancellation (COR-1409)', engine => {
  const getMock = useLoopScenarioAimock();

  for (const variant of ['same-resource', 'same-thread', 'abort'] as const) {
    it(`${variant}: neither conversation loses or steals the other reply`, async () => {
      const llm = getMock();
      for (const run of [0, 1]) {
        for (const done of [0, 1]) {
          llm.on(
            {
              endpoint: 'chat',
              predicate: body => {
                const current = turn(body as ChatRequest);
                return current.run === run && current.done === done;
              },
            },
            { toolCalls: [{ id: `call_${run}_${done + 1}`, name: 'step', arguments: { run, n: done + 1 } }] },
          );
        }
      }
      llm.on(
        { endpoint: 'chat', predicate: body => turn(body as ChatRequest).done >= 2 },
        { content: 'finished 2 steps' },
      );
      const entered = [
        [gate(), gate()],
        [gate(), gate()],
      ];
      const released = [
        [gate(), gate()],
        [gate(), gate()],
      ];
      const commits: string[] = [];
      const step = createTool({
        id: 'step',
        description: 'Commit a step for this conversation.',
        inputSchema: z.object({ run: z.number().int().min(0).max(1), n: z.number().int().min(1).max(2) }),
        execute: async ({ run, n }, context) => {
          entered[run]![n - 1]!.release();
          await released[run]![n - 1]!.promise;
          context?.abortSignal?.throwIfAborted();
          commits.push(`${run}:${n}`);
          return { run, n };
        },
      });
      const memory = new MockMemory({ options: { lastMessages: 100 } });
      const { agent } = await createSharedAgent(llm, { engine, memory, tools: { step } });
      const resource = randomUUID();
      const threads = [randomUUID(), randomUUID()];
      if (variant === 'same-thread') threads[1] = threads[0]!;
      const runs: Awaited<ReturnType<typeof agent.stream>>[] = [];
      const drains: Promise<{ types: string[]; text: string }>[] = [];
      const start = async (run: number) => {
        const result = await agent.stream(`run ${run}`, {
          memory: { thread: threads[run]!, resource },
          maxSteps: 5,
        });
        runs[run] = result;
        const output = isDurableEngineVariant(engine) ? result.output : result;
        const drain = (async () => {
          const types: string[] = [];
          let text = '';
          for await (const chunk of output.fullStream) {
            types.push(chunk.type);
            if (chunk.type === 'text-delta') text += chunk.payload.text;
          }
          return { types, text };
        })();
        drains[run] = drain;
        return drain;
      };
      const first = start(0);
      let second: ReturnType<typeof start> | undefined;
      try {
        await entered[0]![0]!.promise;
        second = start(1);
        // Plain/fs queue a shared thread. Durable engines interleave its runs.
        const serialized = variant === 'same-thread' && !isDurableEngineVariant(engine);
        const interleaved = variant === 'same-thread' && isDurableEngineVariant(engine);
        if (!serialized) await entered[1]![0]!.promise;
        released[0]![0]!.release();
        await entered[0]![1]!.promise;
        if (variant === 'abort') {
          expect(agent.abortRunStream(runs[0]!.runId)).toBe(true);
          released[0]![1]!.release();
        } else if (interleaved) {
          released[1]![0]!.release();
          await entered[1]![1]!.promise;
          released[0]![1]!.release();
          await first;
          released[1]![1]!.release();
        } else {
          released[0]![1]!.release();
        }
        if (!serialized && !interleaved) {
          released[1]![0]!.release();
          await entered[1]![1]!.promise;
          released[1]![1]!.release();
        }
        const [a, b] = await Promise.all([first, second]);
        expect(b.text).toBe('finished 2 steps');
        expect(a.text).toBe(variant === 'abort' ? '' : 'finished 2 steps');
        expect(a.types.filter(type => type === 'finish')).toHaveLength(1);
        expect(b.types.filter(type => type === 'finish')).toHaveLength(1);
        expect(b.types).not.toContain('error');
        expect(commits).toHaveLength(variant === 'abort' ? 3 : serialized ? 2 : 4);
        expect(new Set(commits).size).toBe(commits.length);
        if (interleaved) expect(commits).toEqual(['0:1', '1:1', '0:2', '1:2']);
        // COR-1409: cancellation is clean on every engine (COR-1415 / #26345).
        expect(a.types).not.toContain('error');
        if (variant === 'abort') expect(a.types).toContain('abort');
        if (variant !== 'abort') {
          for (const run of [0, 1]) {
            const store = (await memory.storage.getStore('memory'))!;
            const { messages } = await store.listMessages({ threadId: threads[run]!, perPage: false });
            const users = messages.filter(message => message.role === 'user');
            const answers = messages.filter(
              message =>
                message.role === 'assistant' &&
                message.content.parts?.some(part => part.type === 'text' && part.text === 'finished 2 steps'),
            );
            expect(users).toHaveLength(variant === 'same-thread' ? 2 : 1);
            // COR-1409: every engine persists one assistant message per run, not per tool step.
            expect(messages.filter(message => message.role === 'assistant')).toHaveLength(
              variant === 'same-thread' ? 2 : 1,
            );
            expect(answers).toHaveLength(variant === 'same-thread' ? 2 : 1);
            expect(JSON.stringify(users)).toContain(`run ${run}`);
            if (variant === 'same-resource') expect(JSON.stringify(messages)).not.toContain(`run ${1 - run}`);
            if (serialized)
              expect(messages.map(message => message.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
          }
        }
      } finally {
        for (const gates of released) for (const pending of gates) pending.release();
        for (const run of runs) if (run) agent.abortRunStream(run.runId);
        await Promise.allSettled([first, ...(second ? [second] : []), ...drains]);
        for (const run of runs) run?.cleanup?.();
      }
    }, 30_000);
  }
});
