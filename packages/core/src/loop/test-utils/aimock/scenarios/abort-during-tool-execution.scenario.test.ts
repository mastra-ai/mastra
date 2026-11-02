/**
 * AIMock Scenario: Abort During Tool Execution
 *
 * Tests that when an abort signal is triggered *while a tool is executing*,
 * the agentic loop handles it gracefully. This is distinct from aborting
 * mid-stream (between turns) - here we test aborting during the actual tool
 * execution phase.
 *
 * Asserts:
 * - abort signal propagates to tool execution context
 * - tool can detect abort and bail early
 * - loop does not make additional model requests after abort during tool
 * - finishReason reflects the abort
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

describeForAllEngines(
  'AIMock loop scenario: abort during tool execution',
  engine => {
    const getMock = useLoopScenarioAimock();

    it.each(
      (['resolve', 'reject'] as const).flatMap(lateOutcome =>
        (engine === 'normal' || engine === 'fs' ? [true, false] : [false]).map(eager => ({ lateOutcome, eager })),
      ),
    )(
      'ends an aborted run before an uncooperative tool can $lateOutcome (eager: $eager)',
      async ({ lateOutcome, eager }) => {
        const controller = new AbortController();
        const memory = new MockMemory();
        const threadId = `cancelled-tool-${engine}-${lateOutcome}`;
        const resourceId = 'cancelled-tool-customer';
        const notice =
          'Tool execution was aborted while running. The tool may still be running and its effects are unknown. Check its status before retrying.';
        const started = Promise.withResolvers<void>();
        const execution = Promise.withResolvers<{ done: boolean }>();
        let toolFinished = false;
        let outputs = 0;
        let mappedOutputs = 0;
        const processedNotices: unknown[] = [];
        let streamedNotices = 0;
        const tool = createTool({
          id: 'uncooperative',
          description: 'Waits for external work that ignores cancellation',
          inputSchema: z.object({}),
          outputSchema: z.object({ done: z.boolean() }),
          toModelOutput: output => {
            mappedOutputs++;
            return { type: 'text', value: JSON.stringify(output) };
          },
          execute: async () => {
            started.resolve();
            try {
              return await execution.promise;
            } finally {
              toolFinished = true;
            }
          },
          onOutput: () => {
            outputs++;
          },
        });
        const scenario = runLoopScenario({
          engine,
          llm: getMock(),
          prompt: 'Wait for external work',
          defaultOptions: { eagerToolExecution: eager },
          memory,
          threadId,
          resourceId,
          tools: { uncooperative: tool },
          outputProcessors: [
            {
              id: 'inspect-cancellation-notice',
              processToolResult: ({ result, messageList }) => {
                processedNotices.push(result);
                return messageList;
              },
              processOutputStream: ({ part }) => {
                if (part.type === 'tool-result') streamedNotices++;
                return part;
              },
            },
          ],
          abortSignal: controller.signal,
          collectChunks: true,
          fixtures: llm => {
            llm.on(
              { endpoint: 'chat', hasToolResult: false },
              {
                toolCalls: [{ id: 'call_uncooperative', name: 'uncooperative', arguments: {} }],
              },
            );
            llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Should not reach here' });
          },
        });
        let settled = false;
        void scenario.then(
          () => {
            settled = true;
          },
          () => {
            settled = true;
          },
        );
        try {
          // Handshake with the real tool; no scheduling delay determines when to abort.
          await started.promise;
          controller.abort();
          await expect.poll(() => settled, { timeout: 5_000 }).toBe(true);
          const { output, requests, chunks, mastra, agent } = await scenario;
          expect(toolFinished).toBe(false);
          expect(requests).toHaveLength(1);
          expect(await output.finishReason).toBe('aborted');
          expect(chunks?.filter(chunk => chunk.type === 'abort')).toHaveLength(1);
          const results = chunks?.filter(chunk => chunk.type === 'tool-result');
          expect(results).toHaveLength(1);
          expect(results?.[0]?.payload).toMatchObject({ toolCallId: 'call_uncooperative', result: notice });
          expect(chunks?.filter(chunk => chunk.type === 'tool-error')).toHaveLength(0);
          const savedBefore = (await memory.recall({ threadId, resourceId })).messages;
          expect(JSON.stringify(savedBefore)).toContain(notice);
          const store = await mastra.getStorage()!.getStore('workflows');
          const durable = engine === 'durable' || engine === 'evented' || engine === 'inngest';
          const prefix = engine === 'inngest' ? 'inngest:' : '';
          for (const name of durable
            ? ['durable-agentic-loop', 'durable-agentic-execution']
            : ['agentic-loop', 'executionWorkflow']) {
            await expect
              .poll(
                async () => {
                  const snapshot = await store!.loadWorkflowSnapshot({
                    workflowName: `${prefix}${name}`,
                    runId: output.runId,
                  });
                  return snapshot?.status;
                },
                { timeout: 5_000 },
              )
              .not.toBe('running');
          }
          const chunkCount = chunks?.length;
          if (lateOutcome === 'resolve') execution.resolve({ done: true });
          else execution.reject(new Error('external work failed after abort'));
          await expect.poll(() => toolFinished).toBe(true);
          expect(outputs).toBe(0);
          expect(mappedOutputs).toBe(0);
          expect(processedNotices).toEqual([notice]);
          expect(streamedNotices).toBe(1);
          expect(chunks).toHaveLength(chunkCount!);
          expect(getMock().getRequests()).toHaveLength(1);
          expect((await memory.recall({ threadId, resourceId })).messages).toEqual(savedBefore);
          await agent.generate('What happened to the external work?', {
            memory: { thread: threadId, resource: resourceId },
            maxSteps: 1,
          });
          const nextMessages = getMock().getRequests()[1]!.body!.messages;
          expect(nextMessages).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ role: 'tool', tool_call_id: 'call_uncooperative', content: notice }),
            ]),
          );
        } finally {
          controller.abort();
          execution.resolve({ done: true });
          await scenario.catch(() => {});
        }
      },
    );

    it('keeps cancellation terminal when another tool has already failed', async () => {
      const controller = new AbortController();
      const { output, requests, chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Run both operations',
        defaultOptions: { eagerToolExecution: false, toolCallConcurrency: 1 },
        abortSignal: controller.signal,
        collectChunks: true,
        tools: {
          failure: createTool({
            id: 'failure',
            description: 'Fails before the other tool starts',
            inputSchema: z.object({}),
            execute: async () => {
              throw new Error('operation failed before cancellation');
            },
          }),
          cancelled: createTool({
            id: 'cancelled',
            description: 'Cancels the run and ignores the signal',
            inputSchema: z.object({}),
            execute: async () => {
              controller.abort();
              return new Promise<never>(() => {});
            },
          }),
        },
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: [
                { id: 'call_failure', name: 'failure', arguments: {} },
                { id: 'call_cancelled', name: 'cancelled', arguments: {} },
              ],
            },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Should not retry after cancellation' });
        },
      });
      expect(requests).toHaveLength(1);
      expect(await output.finishReason).toBe('aborted');
      expect(chunks?.filter(chunk => chunk.type === 'abort')).toHaveLength(1);
      expect(chunks?.filter(chunk => chunk.type === 'tool-result')).toEqual([
        expect.objectContaining({
          payload: expect.objectContaining({
            toolCallId: 'call_cancelled',
            result: expect.stringContaining('The tool may still be running'),
          }),
        }),
      ]);
    });

    it.each(engine === 'normal' || engine === 'fs' ? [true, false] : [false])(
      'keeps a result returned just after caller abort (eager: %s)',
      async eager => {
        const controller = new AbortController();
        const memory = new MockMemory();
        const threadId = `payment-${engine}-${eager}`;
        const resourceId = 'payment-customer';
        const { output, requests, chunks } = await runLoopScenario({
          memory,
          threadId,
          resourceId,
          engine,
          llm: getMock(),
          prompt: 'Complete the payment',
          defaultOptions: { eagerToolExecution: eager },
          abortSignal: controller.signal,
          collectChunks: true,
          tools: {
            payment: createTool({
              id: 'payment',
              description: 'Complete the payment',
              inputSchema: z.object({}),
              execute: async () => {
                controller.abort();
                await new Promise(resolve => setTimeout(resolve, 20));
                return { receipt: 'PAID_1488' };
              },
            }),
          },
          fixtures: llm => {
            llm.on(
              { endpoint: 'chat', hasToolResult: false },
              {
                toolCalls: [{ id: 'call_payment', name: 'payment', arguments: {} }],
              },
            );
            llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Should not reach here' });
          },
        });
        expect(await output.finishReason).toBe('aborted');
        expect(requests).toHaveLength(1);
        expect(chunks?.filter(chunk => chunk.type === 'abort')).toHaveLength(1);
        expect(chunks?.filter(chunk => chunk.type === 'tool-result')).toHaveLength(1);
        expect(chunks!.findIndex(chunk => chunk.type === 'tool-result')).toBeLessThan(
          chunks!.findIndex(chunk => chunk.type === 'abort'),
        );
        expect(JSON.stringify((await memory.recall({ threadId, resourceId })).messages)).toContain('PAID_1488');
      },
    );

    (engine === 'normal' || engine === 'fs' ? it : it.skip)(
      'saves completed eager work queued behind a tool that ignores cancellation',
      async () => {
        const controller = new AbortController();
        const memory = new MockMemory();
        const paymentFinished = Promise.withResolvers<void>();
        const threadId = `queued-payment-${engine}`;
        const resourceId = 'payment-customer';
        let payments = 0;
        const { output, chunks, requests } = await runLoopScenario({
          engine,
          llm: getMock(),
          memory,
          threadId,
          resourceId,
          prompt: 'Check the account and complete the payment',
          defaultOptions: { eagerToolExecution: true, toolCallConcurrency: 1 },
          abortSignal: controller.signal,
          collectChunks: true,
          tools: {
            check: createTool({
              id: 'check',
              description: 'Check the account before continuing',
              inputSchema: z.object({}),
              // A suspend-capable tool runs in the foreach, not eagerly.
              suspendSchema: z.object({ question: z.string() }),
              execute: async () => {
                await paymentFinished.promise;
                controller.abort();
                return new Promise<never>(() => {});
              },
            }),
            payment: createTool({
              id: 'payment',
              description: 'Complete the payment',
              inputSchema: z.object({}),
              execute: async () => {
                payments++;
                return { receipt: 'QUEUED_PAID_1488' };
              },
              onOutput: () => paymentFinished.resolve(),
            }),
          },
          fixtures: llm => {
            llm.on(
              { endpoint: 'chat', hasToolResult: false },
              {
                toolCalls: [
                  { id: 'call_check', name: 'check', arguments: {} },
                  { id: 'call_payment', name: 'payment', arguments: {} },
                ],
              },
            );
            llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Should not reach here' });
          },
        });
        expect(payments).toBe(1);
        expect(await output.finishReason).toBe('aborted');
        expect(requests).toHaveLength(1);
        expect(chunks?.filter(chunk => chunk.type === 'abort')).toHaveLength(1);
        expect(JSON.stringify((await memory.recall({ threadId, resourceId })).messages)).toContain('QUEUED_PAID_1488');
        expect(
          chunks?.filter(chunk => chunk.type === 'tool-result' && chunk.payload.toolCallId === 'call_payment'),
        ).toHaveLength(1);
      },
    );

    it('propagates abort signal to tool execution context', async () => {
      const abortController = new AbortController();
      let toolReceivedSignal = false;
      let toolCheckedAbort = false;

      const slowTool = createTool({
        id: 'slow_tool',
        description: 'A slow tool that checks for abort signal',
        inputSchema: z.object({}),
        outputSchema: z.object({ aborted: z.boolean() }),
        execute: async (_, context) => {
          // Tool checks if abort signal is available in context
          if ((context as any)?.abortSignal) {
            toolReceivedSignal = true;
            toolCheckedAbort = (context as any).abortSignal.aborted;
          }
          return { aborted: toolCheckedAbort };
        },
      });

      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Use the slow tool',
        tools: { slow_tool: slowTool },
        stopWhen: stepCountIs(5),
        abortSignal: abortController.signal,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: [{ id: 'call_slow', name: 'slow_tool', arguments: {} }],
            },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Tool completed' });
        },
      });

      // Tool should have received the abort signal in context
      expect(toolReceivedSignal).toBe(true);

      // At the time of execution, abort was not yet triggered
      expect(toolCheckedAbort).toBe(false);
    });

    it('tool bails early when it observes the abort signal during execution', async () => {
      const abortController = new AbortController();
      let toolStarted = false;
      let toolCompleted: boolean | null = null;

      const longRunningTool = createTool({
        id: 'long_running',
        description: 'A long-running tool that can be interrupted',
        inputSchema: z.object({}),
        outputSchema: z.object({ completed: z.boolean() }),
        execute: async (_, context) => {
          toolStarted = true;

          // Deterministically abort from inside the tool, then observe the signal
          // on the very next loop iteration. No timers, no races.
          abortController.abort();

          for (let i = 0; i < 10; i++) {
            if ((context as any)?.abortSignal?.aborted) {
              toolCompleted = false;
              return { completed: false };
            }
            await new Promise(resolve => setTimeout(resolve, 5));
          }

          toolCompleted = true;
          return { completed: true };
        },
      });

      const { output, requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Run the long tool',
        tools: { long_running: longRunningTool },
        stopWhen: stepCountIs(5),
        abortSignal: abortController.signal,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: [{ id: 'call_long', name: 'long_running', arguments: {} }],
            },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Should not reach here' });
        },
      });

      // The tool started and observed the abort via its execution context, so it
      // bailed early instead of completing its work. If the abort signal were not
      // propagated to the tool context, `toolCompleted` would be true.
      expect(toolStarted).toBe(true);
      expect(toolCompleted).toBe(false);

      // The loop halted before issuing the post-tool model request.
      expect(requests).toHaveLength(1);

      // And the run terminated with an abort/tripwire reason.
      const finishReason = await output.finishReason;
      expect(finishReason).toMatch(/abort|cancelled|error|tripwire/i);
    });

    it('reports the run as aborted when a tool rejects because the run was aborted', async () => {
      const abortController = new AbortController();

      const waitTool = createTool({
        id: 'wait_for_abort',
        description: 'Waits until the run is aborted',
        inputSchema: z.object({}),
        execute: async (_, context) => {
          const signal = (context as any)?.abortSignal as AbortSignal;
          setTimeout(() => abortController.abort(), 20);
          await new Promise((_resolve, reject) =>
            signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }),
          );
          return { done: true };
        },
      });

      const { output, requests, chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Wait for the abort',
        tools: { wait_for_abort: waitTool },
        stopWhen: stepCountIs(5),
        abortSignal: abortController.signal,
        collectChunks: true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_wait', name: 'wait_for_abort', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Should not reach here' });
        },
      });

      expect(requests).toHaveLength(1);
      expect(await output.finishReason).toBe('aborted');
      expect(chunks?.filter(chunk => chunk.type === 'abort')).toHaveLength(1);
    });

    it('loop does not make additional requests after abort during tool execution', async () => {
      const abortController = new AbortController();
      let toolCallCount = 0;

      const countingTool = createTool({
        id: 'counting_tool',
        description: 'A tool that counts calls',
        inputSchema: z.object({}),
        outputSchema: z.object({ count: z.number() }),
        execute: async () => {
          toolCallCount++;
          // Abort after first tool execution
          if (toolCallCount === 1) {
            abortController.abort();
          }
          return { count: toolCallCount };
        },
      });

      const { requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Keep calling the tool',
        tools: { counting_tool: countingTool },
        stopWhen: stepCountIs(10),
        abortSignal: abortController.signal,
        fixtures: llm => {
          // Model always wants to call the tool
          llm.on(
            { endpoint: 'chat' },
            {
              toolCalls: [{ id: 'call_count', name: 'counting_tool', arguments: {} }],
            },
          );
        },
      });

      // Tool should have been called exactly once
      expect(toolCallCount).toBe(1);

      // Loop should have made at most 2 requests (initial + post-tool)
      // but should not continue after abort
      expect(requests.length).toBeLessThanOrEqual(2);
    });
  },
  {},
);
