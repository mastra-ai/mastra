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

  if (isDurableEngineVariant(engine)) {
    for (const detached of [false, true]) {
      it(`replaces a ${detached ? 'detached' : 'connected'} idle loop with the same thread policy`, async () => {
        const llm = getMock();
        const memory = new MockMemory();
        const gate = Promise.withResolvers<void>();
        const research = createTool({
          id: 'research',
          description: 'Research in the background',
          inputSchema: z.object({}),
          background: { enabled: true },
          execute: async () => {
            await gate.promise;
            return { summary: 'Research complete.' };
          },
        });
        const { agent } = await createSharedAgent(llm, {
          engine,
          memory,
          tools: { research },
          agentBackgroundTasks: { tools: { research: true } },
          backgroundTasks: BG_CONFIG,
        });
        const thread = { thread: `replacement-${engine}-${detached}`, resource: 'detach-user' };
        llm.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          { toolCalls: [{ id: 'research-1', name: 'research', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Research dispatched.' });
        llm.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'Replacement accepted.' });
        llm.on({ endpoint: 'chat', sequenceIndex: 3 }, { content: 'Final research answer.' });
        const first = await agent.stream('Start', {
          _detachObserverOnCancel: true,
          memory: thread,
          untilIdle: { maxIdleMs: 5_000 },
        });
        const reader = first.fullStream.getReader();
        try {
          while (true) {
            const next = await reader.read();
            expect(next.done).toBe(false);
            if (next.value?.type === 'finish') break;
          }
          if (detached) await reader.cancel();
          const replacement = await agent.stream('Continue on the same thread', {
            _detachObserverOnCancel: true,
            memory: thread,
            untilIdle: { maxIdleMs: 5_000 },
          });
          const reading = (async () => {
            for await (const chunk of replacement.fullStream) {
              /* Drain the replacement and its background continuation. */
            }
          })();
          await vi.waitFor(() => expect(llm.getRequests()).toHaveLength(3));
          gate.resolve();
          await reading;
          await vi.waitFor(async () => {
            const { messages } = await memory.recall({ threadId: thread.thread, resourceId: thread.resource });
            expect(JSON.stringify(messages)).toContain('Final research answer.');
          });
          expect(llm.getRequests()).toHaveLength(4);
        } finally {
          gate.resolve();
          await reader.cancel();
        }
      }, 30_000);
    }
    for (const abortBy of ['run', 'thread'] as const) {
      it(`aborting a detached continuation by ${abortBy} prevents another background reply`, async () => {
        const llm = getMock();
        const memory = new MockMemory();
        const gates = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
        const research = createTool({
          id: 'research',
          description: 'Research in the background',
          inputSchema: z.object({ stage: z.number().int().min(0).max(1) }),
          background: { enabled: true },
          execute: async ({ stage }) => {
            await gates[stage]!.promise;
            return { summary: `Research ${stage} complete.` };
          },
        });
        const { agent, mastra } = await createSharedAgent(llm, {
          engine,
          memory,
          tools: { research },
          agentBackgroundTasks: { tools: { research: true } },
          backgroundTasks: BG_CONFIG,
        });
        for (const stage of [0, 1]) {
          llm.on(
            { endpoint: 'chat', sequenceIndex: stage * 2 },
            {
              toolCalls: [{ id: `research-${stage}`, name: 'research', arguments: { stage } }],
            },
          );
          llm.on({ endpoint: 'chat', sequenceIndex: stage * 2 + 1 }, { content: `Research ${stage} dispatched.` });
        }
        llm.on({ endpoint: 'chat', sequenceIndex: 4 }, { content: 'Unexpected final reply.' });
        const thread = { thread: `continuation-abort-${engine}-${abortBy}`, resource: 'detach-user' };
        const signal = new AbortController();
        const output = await agent.streamUntilIdle('Start', {
          _detachObserverOnCancel: true,
          memory: thread,
          maxSteps: 8,
          maxIdleMs: 5_000,
          abortSignal: signal.signal,
        });
        const reader = output.fullStream.getReader();
        let continuationId: string | undefined;
        let taskId: string | undefined;
        try {
          for (const stage of [0, 1]) {
            while (true) {
              const { value, done } = await reader.read();
              expect(done).toBe(false);
              if (value.type === 'background-task-started') taskId = value.payload.taskId;
              if (value.type === 'finish') {
                if (stage === 1) continuationId = value.runId;
                break;
              }
            }
            if (stage === 0) gates[0]!.resolve();
          }
          expect(continuationId).toBeTypeOf('string');
          expect(continuationId).not.toBe(output.runId);
          expect(await mastra.backgroundTaskManager!.getTask(taskId!)).toMatchObject({ status: 'running' });
          await reader.cancel();
          const aborted =
            abortBy === 'run'
              ? agent.abortRunStream(continuationId!)
              : agent.abortThreadStream({
                  threadId: thread.thread,
                  resourceId: thread.resource,
                  expectedRunId: continuationId,
                });
          expect(await aborted).toBe(true);
          gates[1]!.resolve();
          await vi.waitFor(async () => {
            expect(await mastra.backgroundTaskManager!.getTask(taskId!)).toMatchObject({ status: 'completed' });
          });
          // Bounded grace period for a negative assertion, not consumer-delivery synchronization.
          await new Promise(resolve => setTimeout(resolve, 100));
          expect(llm.getRequests()).toHaveLength(4);
          const { messages } = await memory.recall({ threadId: thread.thread, resourceId: thread.resource });
          expect(JSON.stringify(messages)).not.toContain('Unexpected final reply.');
        } finally {
          signal.abort();
          for (const gate of gates) gate.resolve();
          reader.releaseLock();
        }
      }, 30_000);
    }
  }

  for (const resumed of [false, true, 'legacy'] as const) {
    for (const action of [
      'read',
      'cancel',
      'cancel-signal',
      'cancel-abort',
      'cancel-thread-abort',
      'cancel-local-only',
    ] as const) {
      if ((action === 'cancel-abort' || action === 'cancel-thread-abort') && !isDurableEngineVariant(engine)) continue;
      if (action === 'cancel-local-only' && engine !== 'inngest') continue;
      it(`${resumed === 'legacy' ? 'legacy resumed' : resumed ? 'resumed' : 'initial'} background research ${action} persists the continuation only while execution is live`, async () => {
        const llm = getMock();
        const memory = new MockMemory();
        const gate = Promise.withResolvers<void>();
        const research = createTool({
          id: 'research',
          description: 'Research in the background',
          inputSchema: z.object({}),
          background: { enabled: true },
          execute: async () => {
            await gate.promise;
            return { summary: 'Research complete.' };
          },
        });
        const authorize = createTool({
          id: 'authorize',
          description: 'Get permission before starting',
          inputSchema: z.object({}),
          requireApproval: true,
          execute: async () => ({ approved: true }),
        });
        const { agent, mastra } = await createSharedAgent(llm, {
          engine,
          memory,
          tools: { research, authorize },
          agentBackgroundTasks: { tools: { research: true } },
          backgroundTasks: BG_CONFIG,
        });
        const thread = { thread: `background-detach-${engine}-${resumed}-${action}`, resource: 'detach-user' };
        const offset = resumed ? 1 : 0;
        if (resumed) {
          llm.on(
            { endpoint: 'chat', sequenceIndex: 0 },
            {
              toolCalls: [{ id: 'authorize-1', name: 'authorize', arguments: {} }],
            },
          );
        }
        llm.on(
          { endpoint: 'chat', sequenceIndex: offset },
          {
            toolCalls: [{ id: 'research-1', name: 'research', arguments: {} }],
          },
        );
        llm.on({ endpoint: 'chat', sequenceIndex: offset + 1 }, { content: 'Research dispatched.' });
        llm.on({ endpoint: 'chat', sequenceIndex: offset + 2 }, { content: 'Final research answer.' });
        const signal = new AbortController();
        const options = {
          _detachObserverOnCancel: true,
          memory: thread,
          maxSteps: 8,
          abortSignal: signal.signal,
          maxIdleMs: 5_000,
        };
        let output;
        if (resumed) {
          const parked = await agent.streamUntilIdle('Start', {
            _detachObserverOnCancel: true,
            memory: thread,
            maxSteps: 8,
          });
          for await (const chunk of parked.fullStream) {
            if (chunk.type === 'tool-call-approval') break;
          }
          const resumeOptions = { ...options, runId: parked.runId, toolCallId: 'authorize-1', untilIdle: true };
          output =
            resumed === 'legacy'
              ? await agent.resumeStreamUntilIdle({ approved: true }, resumeOptions)
              : await agent.resumeStream({ approved: true }, resumeOptions);
        } else {
          output = await agent.streamUntilIdle('Start', options);
        }
        const reader = output.fullStream.getReader();
        let taskId: string | undefined;
        try {
          while (true) {
            const { value, done } = await reader.read();
            expect(done).toBe(false);
            if (value.type === 'background-task-started') taskId = value.payload.taskId;
            if (value.type === 'finish') break;
          }
          expect(taskId).toBeTypeOf('string');
          expect(await mastra.backgroundTaskManager!.getTask(taskId!)).toMatchObject({ status: 'running' });
          expect(llm.getRequests()).toHaveLength(offset + 2);
          if (action !== 'read') await reader.cancel();
          if (action === 'cancel-signal') signal.abort();
          if (action === 'cancel-abort') expect(await agent.abortRunStream(output.runId)).toBe(true);
          if (action === 'cancel-thread-abort') {
            expect(
              await agent.abortThreadStream({
                threadId: thread.thread,
                resourceId: thread.resource,
                expectedRunId: output.runId,
              }),
            ).toBe(true);
          }
          if (action === 'cancel-local-only') {
            agent.abortThreadStream({ threadId: thread.thread, resourceId: thread.resource, localOnly: true });
          }
          gate.resolve();
          if (action === 'read') {
            while (!(await reader.read()).done) {
              /* drain continuations */
            }
          }
          await vi.waitFor(async () => {
            expect(await mastra.backgroundTaskManager!.getTask(taskId!)).toMatchObject({ status: 'completed' });
          });
          const completes =
            action === 'read' ||
            action === 'cancel-local-only' ||
            (action === 'cancel' && isDurableEngineVariant(engine));
          if (completes) {
            await vi.waitFor(
              async () => {
                const { messages } = await memory.recall({ threadId: thread.thread, resourceId: thread.resource });
                expect(JSON.stringify(messages)).toContain('Final research answer.');
              },
              { timeout: 3_000 },
            );
            expect(llm.getRequests()).toHaveLength(offset + 3);
            expect(JSON.stringify(llm.getRequests()[offset + 2]!.body)).toContain('Research complete.');
          } else {
            // Bounded grace period for negative assertions; persisted status does not synchronize consumer delivery.
            await new Promise(resolve => setTimeout(resolve, 100));
            expect(llm.getRequests()).toHaveLength(offset + 2);
            const { messages } = await memory.recall({ threadId: thread.thread, resourceId: thread.resource });
            expect(JSON.stringify(messages)).not.toContain('Final research answer.');
          }
        } finally {
          signal.abort();
          gate.resolve();
          reader.releaseLock();
        }
      }, 30_000);
    }
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
          const parked = await agent.streamUntilIdle('Start', {
            _detachObserverOnCancel: true,
            memory: thread,
            maxSteps: 8,
          });
          for await (const chunk of parked.fullStream) {
            if (chunk.type === 'tool-call-approval') break;
          }
          const options = {
            untilIdle: true,
            _detachObserverOnCancel: true,
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
          result = await agent.streamUntilIdle('Start', {
            _detachObserverOnCancel: true,
            memory: thread,
            maxSteps: 8,
            abortSignal: signal.signal,
          });
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
              expect(toolSignal?.aborted).toBe(false);
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
          signal.abort();
          gate.resolve();
          reader.releaseLock();
        }
      }, 30_000);
    }
  }
});
