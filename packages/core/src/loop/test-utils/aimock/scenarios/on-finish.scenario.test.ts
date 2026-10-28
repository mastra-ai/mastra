import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../../../events/event-emitter';
import type { Processor } from '../../../../processors';
import { FLUSH_HELD_PARTS_KEY, REPROCESS_PART_KEY } from '../../../../processors/stream-reprocess';
import type { LLMStepResult, MastraOnFinishCallbackArgs, ToolResultChunk } from '../../../../stream/types';
import { createTool } from '../../../../tools';
import {
  createSharedAgent,
  isDurableEngineVariant,
  runLoopScenario,
  useLoopScenarioAimock,
  describeForAllEngines,
} from '../aimock-scenario';

function expectToolHistory(
  result: MastraOnFinishCallbackArgs,
  calls: Array<{ toolCallId: string; toolName: string; args: unknown }>,
  results: Array<{ toolCallId: string; toolName: string; result: unknown }>,
) {
  const expectedCalls = calls.map(payload =>
    expect.objectContaining({
      type: 'tool-call',
      runId: expect.any(String),
      from: 'AGENT',
      payload: expect.objectContaining(payload),
    }),
  );
  const expectedResults = results.map(payload =>
    expect.objectContaining({
      type: 'tool-result',
      runId: expect.any(String),
      from: 'AGENT',
      payload: expect.objectContaining(payload),
    }),
  );
  expect.soft(result.toolCalls, 'top-level tool-call envelopes').toEqual(expectedCalls);
  expect.soft(result.toolResults, 'top-level successful tool results').toEqual(expectedResults);
  expect
    .soft(
      result.steps.flatMap(step => step.toolCalls ?? []),
      'per-step tool-call envelopes',
    )
    .toEqual(expectedCalls);
  expect
    .soft(
      result.steps.flatMap(step => step.toolResults ?? []),
      'per-step successful tool results',
    )
    .toEqual(expectedResults);
}

/**
 * Regression class: onFinish callback.
 *
 * The onFinish callback fires when execution completes. This pins the callback
 * invocation path, ensuring final result observability works correctly.
 */
describeForAllEngines(
  'AIMock loop scenario: onFinish callback',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('onFinish fires when execution completes', async () => {
      const tickTool = createTool({
        id: 'tick',
        description: 'Advance a counter.',
        inputSchema: z.object({}),
        outputSchema: z.object({ count: z.number() }),
        execute: async () => ({ count: 1 }),
      });

      let finishCalled = false;
      let finishResult: any;

      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Call tool then finish.',
        tools: { tick: tickTool },
        stopWhen: stepCountIs(3),
        onFinish: (result: MastraOnFinishCallbackArgs) => {
          finishCalled = true;
          finishResult = result;
        },
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_tick', name: 'tick', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
        },
      });

      expect(finishCalled).toBe(true);
      expect(finishResult.text).toBe('Done.');
      expect(finishResult.finishReason).toBe('stop');
      expect(finishResult.steps).toHaveLength(2);
    });

    it('onFinish receives text and steps', async () => {
      let resultText: string | undefined;
      let resultSteps: LLMStepResult[] | undefined;
      let toolResults: ToolResultChunk[] | undefined;
      let finish: MastraOnFinishCallbackArgs | undefined;

      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Simple test.',
        stopWhen: stepCountIs(1),
        onFinish: (result: MastraOnFinishCallbackArgs) => {
          finish = result;
          resultText = result.text;
          resultSteps = result.steps;
          toolResults = result.toolResults;
        },
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Test response.' });
        },
      });

      expect(resultText).toBe('Test response.');
      expect(resultSteps).toHaveLength(1);
      expect(resultSteps![0].text).toBe('Test response.');
      expect(toolResults).toEqual([]);
      expect(resultSteps![0].toolResults).toEqual([]);
      expect(finish!.toolCalls).toEqual([]);
      expect(resultSteps![0].toolCalls).toEqual([]);
    });

    // The public callback must expose tool-result chunks on every engine (#27428).
    it('onFinish fires after tool execution', async () => {
      const tickTool = createTool({
        id: 'tick',
        description: 'Advance a counter.',
        inputSchema: z.object({ amount: z.number() }),
        outputSchema: z.object({ count: z.number() }),
        execute: async ({ amount }) => ({ count: amount }),
      });

      let toolResults: ToolResultChunk[] | undefined;
      let steps: LLMStepResult[] | undefined;
      let runId: string | undefined;
      let finish: MastraOnFinishCallbackArgs | undefined;

      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Call tool.',
        tools: { tick: tickTool },
        stopWhen: stepCountIs(3),
        onFinish: (result: MastraOnFinishCallbackArgs) => {
          toolResults = result.toolResults;
          steps = result.steps;
          runId = result.runId;
          finish = result;
        },
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_tick', name: 'tick', arguments: { amount: 2 } }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
        },
      });

      expect(toolResults).toHaveLength(1);
      const expectedResult = {
        type: 'tool-result',
        runId,
        from: 'AGENT',
        payload: {
          toolCallId: 'call_tick',
          toolName: 'tick',
          args: { amount: 2 },
          result: { count: 2 },
        },
      };
      expect(toolResults![0]).toMatchObject(expectedResult);
      expect(steps![0].toolResults).toHaveLength(1);
      expect(steps![0].toolResults[0]).toMatchObject(expectedResult);
      expect(steps![1].toolResults).toEqual([]);
      expectToolHistory(
        finish!,
        [{ toolCallId: 'call_tick', toolName: 'tick', args: { amount: 2 } }],
        [{ toolCallId: 'call_tick', toolName: 'tick', result: { count: 2 } }],
      );
    });

    it('gives generate callbacks the same tool history', async () => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        {
          toolCalls: [{ id: 'generate-tick', name: 'tick', arguments: { count: 2 } }],
        },
      );
      llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Counted.' });
      const shared = await createSharedAgent(llm, {
        engine,
        tools: {
          tick: createTool({
            id: 'tick',
            description: 'Count.',
            inputSchema: z.object({ count: z.number() }),
            execute: async ({ count }) => ({ count }),
          }),
        },
      });
      let finish: MastraOnFinishCallbackArgs | undefined;
      try {
        const output = await shared.agent.generate('Count twice.', {
          maxSteps: 3,
          onFinish: result => {
            finish = result;
          },
        });
        expect(output.text).toBe('Counted.');
        await expect.poll(() => finish).toBeDefined();
        expectToolHistory(
          finish!,
          [{ toolCallId: 'generate-tick', toolName: 'tick', args: { count: 2 } }],
          [{ toolCallId: 'generate-tick', toolName: 'tick', result: { count: 2 } }],
        );
      } finally {
        if (engine !== 'inngest') await shared.mastra.shutdown({ drainTimeout: 1000 });
      }
    });

    it('retains ordered calls and results from multiple completed steps', async () => {
      let finish: MastraOnFinishCallbackArgs | undefined;
      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Count twice.',
        maxSteps: 4,
        tools: {
          tick: createTool({
            id: 'tick',
            description: 'Count.',
            inputSchema: z.object({ count: z.number() }),
            execute: async ({ count }) => ({ count }),
          }),
        },
        onFinish: result => {
          finish = result;
        },
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', sequenceIndex: 0 },
            { toolCalls: [{ id: 'tick-1', name: 'tick', arguments: { count: 1 } }] },
          );
          llm.on(
            { endpoint: 'chat', sequenceIndex: 1 },
            { toolCalls: [{ id: 'tick-2', name: 'tick', arguments: { count: 2 } }] },
          );
          llm.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'Counted.' });
        },
      });
      expect(finish!.text).toBe('Counted.');
      expectToolHistory(
        finish!,
        [1, 2].map(count => ({ toolCallId: `tick-${count}`, toolName: 'tick', args: { count } })),
        [1, 2].map(count => ({ toolCallId: `tick-${count}`, toolName: 'tick', result: { count } })),
      );
      expect(finish!.steps.map(step => step.toolResults.length)).toEqual([1, 1, 0]);
    });

    it('does not report a failed tool as a successful result', async () => {
      let finish: MastraOnFinishCallbackArgs | undefined;
      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Try the lookup.',
        maxSteps: 3,
        tools: {
          lookup: createTool({
            id: 'lookup',
            description: 'Lookup.',
            inputSchema: z.object({}),
            execute: async () => {
              throw new Error('Lookup unavailable');
            },
          }),
        },
        onFinish: result => {
          finish = result;
        },
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'failed-lookup', name: 'lookup', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Lookup failed.' });
        },
      });
      expect(finish!.text).toBe('Lookup failed.');
      expectToolHistory(finish!, [{ toolCallId: 'failed-lookup', toolName: 'lookup', args: {} }], []);
    });

    it.each(['stream', 'tool-result'] as const)('does not recreate a result blocked by a %s processor', async phase => {
      let finish: MastraOnFinishCallbackArgs | undefined;
      const blocker: Processor =
        phase === 'stream'
          ? { id: 'hide-result', processOutputStream: async ({ part }) => (part.type === 'tool-result' ? null : part) }
          : { id: 'block-result', processToolResult: ({ abort }) => abort('Result blocked.') };
      const { output, chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Lookup.',
        maxSteps: 3,
        collectChunks: true,
        tools: {
          lookup: createTool({
            id: 'lookup',
            description: 'Lookup.',
            inputSchema: z.object({}),
            execute: async () => ({ secret: 'private' }),
          }),
        },
        outputProcessors: [blocker],
        onFinish: result => {
          finish = result;
        },
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'blocked-lookup', name: 'lookup', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
        },
      });
      if (phase === 'tool-result') {
        // A tool-result tripwire terminates without invoking onFinish.
        expect(await output.toolResults).toEqual([]);
        expect(chunks!.filter(chunk => chunk.type === 'tool-result')).toEqual([]);
        expect(finish).toBeUndefined();
        return;
      }
      await expect.poll(() => finish).toBeDefined();
      expectToolHistory(finish!, [{ toolCallId: 'blocked-lookup', toolName: 'lookup', args: {} }], []);
    });

    it('keeps processed tool payloads and transform metadata in the callback', async () => {
      let finish: MastraOnFinishCallbackArgs | undefined;
      const redact: Processor = {
        id: 'redact-result',
        processOutputStream: async ({ part }) =>
          part.type === 'tool-result' ? { ...part, payload: { ...part.payload, result: { redacted: true } } } : part,
      };
      const { chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Lookup.',
        maxSteps: 3,
        tools: {
          lookup: createTool({
            id: 'lookup',
            description: 'Lookup.',
            inputSchema: z.object({}),
            execute: async () => ({ secret: 'private' }),
          }),
        },
        outputProcessors: [redact],
        collectChunks: true,
        transform: { targets: ['display'], transformToolPayload: () => 'Display redacted.' },
        onFinish: result => {
          finish = result;
        },
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'redacted-lookup', name: 'lookup', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
        },
      });
      expectToolHistory(
        finish!,
        [{ toolCallId: 'redacted-lookup', toolName: 'lookup', args: {} }],
        [{ toolCallId: 'redacted-lookup', toolName: 'lookup', result: { redacted: true } }],
      );
      expect.soft(finish!.toolCalls).toEqual(chunks!.filter(chunk => chunk.type === 'tool-call'));
      expect.soft(finish!.toolResults).toEqual(chunks!.filter(chunk => chunk.type === 'tool-result'));
      expect(finish!.toolResults[0]!.metadata).toMatchObject({
        mastra: {
          toolPayloadTransform: {
            display: { 'output-available': { transformed: 'Display redacted.' } },
          },
        },
      });
    });

    if (isDurableEngineVariant(engine)) {
      it('finishes with tool chunks when nobody consumes the stream', async () => {
        const finished = Promise.withResolvers<MastraOnFinishCallbackArgs>();
        const { mastra } = await runLoopScenario({
          engine,
          llm: getMock(),
          prompt: 'Lookup.',
          maxSteps: 3,
          manualStreamConsumption: true,
          tools: {
            lookup: createTool({
              id: 'lookup',
              description: 'Lookup.',
              inputSchema: z.object({}),
              execute: async () => ({ found: true }),
            }),
          },
          onFinish: result => {
            finished.resolve(result);
          },
          fixtures: llm => {
            llm.on(
              { endpoint: 'chat', hasToolResult: false },
              { toolCalls: [{ id: 'unread-lookup', name: 'lookup', arguments: {} }] },
            );
            llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
          },
        });
        try {
          // Do not touch any output getter: those start stream consumption themselves.
          const finish = await finished.promise;
          expect(finish.text).toBe('Done.');
          expectToolHistory(
            finish,
            [{ toolCallId: 'unread-lookup', toolName: 'lookup', args: {} }],
            [{ toolCallId: 'unread-lookup', toolName: 'lookup', result: { found: true } }],
          );
        } finally {
          if (engine !== 'inngest') await mastra.shutdown({ drainTimeout: 1000 });
        }
      });
    }
  },
  {},
);

describeForAllEngines(
  'onFinish history after approval',
  engine => {
    const getMock = useLoopScenarioAimock();
    it.each([
      { sameStep: false, decline: false },
      { sameStep: true, decline: false },
      { sameStep: false, decline: true },
      { sameStep: true, decline: true },
    ])(
      'reports earlier and resumed tools once (same step: $sameStep, declined: $decline)',
      async ({ sameStep, decline }) => {
        const shared = await createSharedAgent(getMock(), {
          engine,
          tools: {
            lookup: createTool({
              id: 'lookup',
              description: 'Find an item.',
              inputSchema: z.object({}),
              execute: async () => ({ item: 'A' }),
            }),
            purchase: createTool({
              id: 'purchase',
              description: 'Purchase the item.',
              inputSchema: z.object({}),
              requireApproval: true,
              execute: async () => ({ purchased: 'A' }),
            }),
          },
        });
        let finish: MastraOnFinishCallbackArgs | undefined;
        let resumed: any;
        try {
          const { output } = await runLoopScenario({
            engine,
            llm: getMock(),
            sharedAgent: shared,
            prompt: 'Find and buy an item.',
            maxSteps: 4,
            fixtures: llm => {
              if (sameStep) {
                llm.on(
                  { endpoint: 'chat', sequenceIndex: 0 },
                  {
                    toolCalls: [
                      { id: 'lookup-1', name: 'lookup', arguments: {} },
                      { id: 'purchase-1', name: 'purchase', arguments: {} },
                    ],
                  },
                );
                llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: decline ? 'Declined.' : 'Purchased.' });
                return;
              }
              llm.on(
                { endpoint: 'chat', sequenceIndex: 0 },
                { toolCalls: [{ id: 'lookup-1', name: 'lookup', arguments: {} }] },
              );
              llm.on(
                { endpoint: 'chat', sequenceIndex: 1 },
                { toolCalls: [{ id: 'purchase-1', name: 'purchase', arguments: {} }] },
              );
              llm.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: decline ? 'Declined.' : 'Purchased.' });
            },
          });
          const resumeOptions = {
            runId: output.runId,
            toolCallId: 'purchase-1',
            onFinish: (result: MastraOnFinishCallbackArgs) => {
              finish = result;
            },
          };
          resumed = decline
            ? await shared.agent.declineToolCall(resumeOptions)
            : await shared.agent.approveToolCall(resumeOptions);
          for await (const _chunk of resumed.fullStream) {
            /* drain the resumed segment */
          }
          await expect.poll(() => finish).toBeDefined();
          expect(finish!.text).toBe(decline ? 'Declined.' : 'Purchased.');
          expectToolHistory(
            finish!,
            [
              { toolCallId: 'lookup-1', toolName: 'lookup', args: {} },
              { toolCallId: 'purchase-1', toolName: 'purchase', args: {} },
            ],
            [
              { toolCallId: 'lookup-1', toolName: 'lookup', result: { item: 'A' } },
              ...(decline ? [] : [{ toolCallId: 'purchase-1', toolName: 'purchase', result: { purchased: 'A' } }]),
            ],
          );
          expect(finish!.steps.map(step => step.toolResults.length)).toEqual(
            sameStep ? [decline ? 1 : 2, 0] : [1, decline ? 0 : 1, 0],
          );
        } finally {
          resumed?.cleanup?.();
          if (engine !== 'inngest') await shared.mastra.shutdown({ drainTimeout: 1000 });
        }
      },
    );

    // A resumed stream restores the run's earlier tool results from storage.
    // Results the stream never emitted must stay out of the callback. The plain
    // Agent still restores a processor-hidden result on resume, so the hidden
    // case covers the durable engines only. A result a processor stashes and
    // emits right after (the reprocess path) was emitted, so it stays. A
    // result whose publish failed never reached the stream, so it is left out
    // (Inngest publishes through its own pubsub, so that case can't run there).
    // A result a processor holds until the stream ends was emitted too, whether
    // the approval call is in the same step or the next one.
    it.each(
      isDurableEngineVariant(engine)
        ? engine === 'inngest'
          ? (['hidden', 'client', 'reprocessed', 'held', 'held-next-step'] as const)
          : (['hidden', 'client', 'reprocessed', 'held', 'held-next-step', 'unpublished'] as const)
        : (['hidden', 'client', 'held', 'held-next-step'] as const),
    )('restores only emitted results after approval (%s lookup)', async kind => {
      // Publishing the lookup result fails once; the rest goes through.
      let failedPublish = false;
      const pubsub =
        kind === 'unpublished'
          ? new (class extends EventEmitterPubSub {
              override async publish(topic: string, event: any) {
                const data = event?.data;
                if (!failedPublish && data?.type === 'tool-result' && data.payload?.toolName === 'lookup') {
                  failedPublish = true;
                  throw new Error('publish failed');
                }
                return super.publish(topic, event);
              }
            })()
          : undefined;
      const shared = await createSharedAgent(getMock(), {
        engine,
        ...(pubsub ? { pubsub } : {}),
        tools: {
          lookup: createTool({
            id: 'lookup',
            description: 'Find an item.',
            inputSchema: z.object({}),
            ...(kind !== 'client' ? { execute: async () => ({ secret: 'private' }) } : {}),
          }),
          purchase: createTool({
            id: 'purchase',
            description: 'Purchase the item.',
            inputSchema: z.object({}),
            requireApproval: true,
            execute: async () => ({ purchased: 'A' }),
          }),
        },
      });
      const hideLookup: Processor = {
        id: 'hide-lookup',
        processOutputStream: async ({ part }) =>
          part.type === 'tool-result' && part.payload.toolName === 'lookup' ? null : part,
      };
      const deferLookup: Processor = {
        id: 'defer-lookup',
        processOutputStream: async ({ part, state }) => {
          if (part.type !== 'tool-result' || part.payload.toolName !== 'lookup' || state.deferred) return part;
          state.deferred = true;
          state[REPROCESS_PART_KEY] = part;
          return null;
        },
      };
      // Holds the lookup result until the stream ends, like a batching processor.
      const holdLookup: Processor = {
        id: 'hold-lookup',
        processOutputStream: async ({ part, state }) => {
          if (part.type !== 'tool-result' || part.payload.toolName !== 'lookup') return part;
          state[FLUSH_HELD_PARTS_KEY] = () => {
            delete state[FLUSH_HELD_PARTS_KEY];
            return [part];
          };
          return null;
        },
      };
      const outputProcessors = {
        hidden: [hideLookup],
        reprocessed: [deferLookup],
        held: [holdLookup],
        'held-next-step': [holdLookup],
        client: undefined,
      }[kind];
      const expected = ['reprocessed', 'held', 'held-next-step'].includes(kind)
        ? ['lookup-1', 'purchase-1']
        : ['purchase-1'];
      let finish: MastraOnFinishCallbackArgs | undefined;
      let resumed: any;
      try {
        const { output } = await runLoopScenario({
          engine,
          llm: getMock(),
          sharedAgent: shared,
          prompt: 'Find and buy an item.',
          maxSteps: 4,
          ...(outputProcessors ? { outputProcessors } : {}),
          fixtures: llm => {
            if (kind === 'held-next-step') {
              llm.on(
                { endpoint: 'chat', sequenceIndex: 0 },
                { toolCalls: [{ id: 'lookup-1', name: 'lookup', arguments: {} }] },
              );
              llm.on(
                { endpoint: 'chat', sequenceIndex: 1 },
                { toolCalls: [{ id: 'purchase-1', name: 'purchase', arguments: {} }] },
              );
              llm.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'Purchased.' });
              return;
            }
            llm.on(
              { endpoint: 'chat', sequenceIndex: 0 },
              {
                toolCalls: [
                  { id: 'lookup-1', name: 'lookup', arguments: {} },
                  { id: 'purchase-1', name: 'purchase', arguments: {} },
                ],
              },
            );
            llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Purchased.' });
          },
        });
        resumed = await shared.agent.approveToolCall({
          runId: output.runId,
          toolCallId: 'purchase-1',
          onFinish: (result: MastraOnFinishCallbackArgs) => {
            finish = result;
          },
        });
        for await (const _chunk of resumed.fullStream) {
          /* drain the resumed segment */
        }
        await expect.poll(() => finish).toBeDefined();
        if (kind === 'unpublished') expect(failedPublish).toBe(true);
        // The plain Agent reports results in emission order, and a held result is emitted at the end of the
        // resumed stream; durable engines move it back to its call's place.
        const inOrder = (ids: string[]) => (kind === 'held' && !isDurableEngineVariant(engine) ? [...ids].sort() : ids);
        expect(inOrder(finish!.toolResults.map(chunk => chunk.payload.toolCallId))).toEqual(expected);
        expect(inOrder(finish!.steps.flatMap(step => step.toolResults.map(chunk => chunk.payload.toolCallId)))).toEqual(
          expected,
        );
      } finally {
        resumed?.cleanup?.();
        if (engine !== 'inngest') await shared.mastra.shutdown({ drainTimeout: 1000 });
      }
    });
  },
  { skip: ['fs'] },
);
