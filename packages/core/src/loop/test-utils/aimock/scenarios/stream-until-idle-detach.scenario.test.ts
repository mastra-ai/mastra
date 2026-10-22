import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';

const BG_CONFIG = { enabled: true, globalConcurrency: 5, perAgentConcurrency: 3 };

describeForAllEngines('AIMock loop scenario: durable untilIdle observer detach (COR-1489)', engine => {
  const getMock = useLoopScenarioAimock();

  for (const resumed of [false, true, 'legacy'] as const) {
    for (const action of ['cancel', 'signal', 'cancel-signal', 'signal-cancel', 'race', 'cancel-abort'] as const) {
      it(`${resumed === 'legacy' ? 'legacy resumed' : resumed ? 'resumed' : 'initial'} reader ${action} preserves execution cancellation authority`, async () => {
        const llm = getMock();
        const memory = new MockMemory();
        const entered = Promise.withResolvers<void>();
        const gate = Promise.withResolvers<void>();
        const calls: number[] = [];
        let toolSignal: AbortSignal | undefined;
        const slow = createTool({
          id: 'slow',
          description: 'Execute a numbered step',
          inputSchema: z.object({ n: z.number() }),
          execute: async ({ n }, context) => {
            calls.push(n);
            if (n === 1) {
              toolSignal = context?.abortSignal;
              entered.resolve();
              await Promise.race([
                gate.promise,
                new Promise<void>(resolve => {
                  if (toolSignal?.aborted) return resolve();
                  toolSignal?.addEventListener('abort', () => resolve(), { once: true });
                }),
              ]);
            }
            return { n };
          },
        });
        const authorize = createTool({
          id: 'authorize',
          description: 'Get permission before starting',
          inputSchema: z.object({}),
          requireApproval: true,
          execute: async () => ({ approved: true }),
        });
        const research = createTool({
          id: 'research',
          description: 'Research in the background',
          inputSchema: z.object({}),
          background: { enabled: true },
          execute: async () => ({ done: true }),
        });
        const { agent } = await createSharedAgent(llm, {
          engine,
          memory,
          tools: { slow, authorize, research },
          agentBackgroundTasks: { tools: { research: true } },
          backgroundTasks: BG_CONFIG,
        });
        const thread = { thread: `detach-${engine}-${resumed}-${action}`, resource: 'detach-user' };
        const offset = resumed ? 1 : 0;
        if (resumed) {
          llm.on(
            { endpoint: 'chat', sequenceIndex: 0 },
            {
              toolCalls: [{ id: 'authorize-1', name: 'authorize', arguments: {} }],
            },
          );
        }
        for (let n = 1; n <= 3; n++) {
          llm.on(
            { endpoint: 'chat', sequenceIndex: offset + n - 1 },
            {
              toolCalls: [{ id: `slow-${n}`, name: 'slow', arguments: { n } }],
            },
          );
        }
        llm.on({ endpoint: 'chat', sequenceIndex: offset + 3 }, { content: 'done: 3 results' });
        const signal = new AbortController();
        let result;
        if (resumed) {
          const parked = await agent.streamUntilIdle('Start', { memory: thread, maxSteps: 8 });
          for await (const chunk of parked.fullStream) {
            if (chunk.type === 'tool-call-approval') break;
          }
          const options = {
            untilIdle: true,
            runId: parked.runId,
            toolCallId: 'authorize-1',
            memory: thread,
            maxSteps: 8,
            abortSignal: signal.signal,
          };
          result =
            resumed === 'legacy'
              ? await agent.resumeStreamUntilIdle({ approved: true }, options)
              : await agent.resumeStream({ approved: true }, options);
        } else {
          result = await agent.streamUntilIdle('Start', { memory: thread, maxSteps: 8, abortSignal: signal.signal });
        }
        const reader = result.fullStream.getReader();
        try {
          await entered.promise;
          if (action === 'signal' || action === 'signal-cancel') signal.abort();
          if (action === 'race') await Promise.all([reader.cancel(), Promise.resolve().then(() => signal.abort())]);
          else await reader.cancel();
          if (action === 'cancel-signal') signal.abort();
          if (action === 'cancel-abort') await agent.abortRunStream(result.runId);

          const completes = action === 'cancel' && isDurableEngineVariant(engine);
          if (!completes) await vi.waitFor(() => expect(toolSignal?.aborted).toBe(true));
          else {
            expect(toolSignal?.aborted).toBe(false);
            if (engine === 'durable' || engine === 'evented') {
              await expect(
                agent.stream('Competing start', { runId: result.runId, memory: thread }),
              ).rejects.toMatchObject({
                id: 'DURABLE_AGENT_EXECUTION_CONFLICT',
              });
            }
          }
          const observation = isDurableEngineVariant(engine) ? await agent.observe(result.runId) : undefined;
          gate.resolve();
          if (observation) {
            const chunks = [];
            for await (const chunk of observation.fullStream) chunks.push(chunk);
            const text = chunks
              .filter(c => c.type === 'text-delta')
              .map(c => c.payload.text)
              .join('');
            expect(text).toBe(completes ? 'done: 3 results' : '');
            expect(chunks.some(c => c.type === 'finish')).toBe(true);
            expect(chunks.some(c => c.type === 'abort')).toBe(!completes);
          }
          expect(calls).toEqual(completes ? [1, 2, 3] : [1]);
          expect(llm.getRequests()).toHaveLength(offset + (completes ? 4 : 1));
          if (completes) {
            await vi.waitFor(async () => {
              const { messages } = await memory.recall({ threadId: thread.thread, resourceId: thread.resource });
              expect(
                messages
                  .flatMap(m => m.content.parts ?? [])
                  .some(p => p.type === 'text' && p.text === 'done: 3 results'),
              ).toBe(true);
            });
          }
        } finally {
          gate.resolve();
          reader.releaseLock();
        }
      }, 30_000);
    }
  }
});
