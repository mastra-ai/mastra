import { createOpenAI } from '@ai-sdk/openai-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { SCENARIO_MODEL_ID } from '../types';
import { SpanType, TracingEventType } from '../../../../observability';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runApprovalScenario, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { captureOutcomeEvents as capture } from '../outcome-test-utils';

describeForAllEngines('native execution outcomes (OBS-724)', engine => {
  const getMock = useLoopScenarioAimock();

  it.each([false, true])('records a supervisor bail after a worker failure=%s', async failed => {
    const { observability, ended } = capture();
    const worker = new Agent({
      id: 'worker',
      name: 'Worker',
      description: 'Handles delegated work',
      instructions: 'Do the delegated task.',
      model: createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${getMock().url}/v1` }).chat(SCENARIO_MODEL_ID),
      errorProcessorDefaults: false,
      defaultOptions: { maxRetries: 0 },
    });
    await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      agents: { worker },
      prompt: 'Delegate the task.',
      maxSteps: 5,
      errorProcessors: [],
      maxRetries: 0,
      delegation: {
        onDelegationComplete: context => {
          context.bail();
        },
      },
      afterStream: async () => {
        await expect.poll(() => ended().length).toBeGreaterThan(0);
      },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false, sequenceIndex: 0 },
          {
            toolCalls: [{ id: 'delegate', name: 'agent-worker', arguments: { prompt: 'Worker request.' } }],
          },
        );
        llm.on(
          { endpoint: 'chat', hasToolResult: false, sequenceIndex: 1 },
          failed
            ? { error: { message: 'Worker provider failed', type: 'server_error' }, status: 500 }
            : { content: 'Work complete.' },
        );
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          {
            content: 'Another step',
            toolCalls: [{ id: 'unwanted', name: 'agent-worker', arguments: { prompt: 'Must not run.' } }],
          },
        );
      },
    });
    expect(ended().filter(span => span.entityId === 'worker')).toMatchObject([{ outcome: failed ? 'error' : 'success' }]);
    const supervisor = ended().find(span => span.entityId !== 'worker');
    expect(supervisor).toMatchObject({ outcome: failed ? 'interrupted' : 'success', stopReason: 'delegation_bail' });
    if (failed)
      expect(supervisor?.stopReasonContext).toMatchObject({ cause: { outcome: 'error', stopReason: 'model_error' } });
  });

  it('records an output-result guardrail without losing usage or exporting terminal spans twice', async () => {
    const { observability, ended } = capture();
    const { chunks, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      afterStream: async () => {
        await expect.poll(() => ended().length).toBeGreaterThan(0);
      },
      collectChunks: true,
      prompt: 'Check the final answer',
      outputProcessors: [{ id: 'final-policy', processOutputResult: ({ abort }) => abort('Final answer rejected') }],
      fixtures: llm =>
        llm.on({ endpoint: 'chat' }, { content: 'Provider answer', usage: { input_tokens: 13, output_tokens: 7 } }),
    });
    expect(requests).toHaveLength(1);
    await expect.poll(() => ended().length).toBe(1);
    for (const type of [SpanType.AGENT_RUN, SpanType.MODEL_GENERATION]) {
      expect(ended(type)).toHaveLength(1);
      expect(ended(type)[0]).toMatchObject({
        outcome: 'blocked',
        stopReason: 'guardrail',
        stopReasonContext: { tripwire: { processorId: 'final-policy', reason: 'Final answer rejected' } },
      });
    }
    expect(ended(SpanType.MODEL_GENERATION)[0]?.attributes?.usage).toMatchObject({ inputTokens: 13, outputTokens: 7 });
    expect(ended(SpanType.AGENT_RUN)[0]?.output).toBeDefined();
    const inference = ended(SpanType.MODEL_INFERENCE)[0]!;
    expect(inference).toMatchObject({ outcome: 'success' });
    const firstChunkTime = new Date(inference.attributes?.completionStartTime as string).getTime();
    expect(firstChunkTime).toBeGreaterThanOrEqual(new Date(inference.startTime).getTime());
    expect(firstChunkTime).toBeLessThanOrEqual(new Date(inference.endTime!).getTime());
    for (const span of ended(SpanType.MODEL_CHUNK)) expect(span.parentSpanId).toBe(inference.id);
    expect(JSON.stringify(chunks)).not.toContain('continuationStopCause');
  });

  it.each([
    ['length', 'limit', 'max_tokens'],
    ['content_filter', 'blocked', 'content_filter'],
  ])('preserves provider termination %s as %s', async (finishReason, outcome, stopReason) => {
    const { observability, ended } = capture();
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      afterStream: async () => {
        await expect.poll(() => ended().length).toBeGreaterThan(0);
      },
      prompt: 'Answer',
      model: createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${getMock().url}/v1` }).chat('gpt-4o-mini'),
      fixtures: llm => llm.on({ endpoint: 'chat' }, { content: 'partial', finishReason }),
    });
    expect(await output.finishReason).toBe(finishReason === 'content_filter' ? 'content-filter' : finishReason);
    expect(ended().at(-1)).toMatchObject({ outcome, stopReason });
    expect(ended(SpanType.MODEL_GENERATION).at(-1)).toMatchObject({ outcome, stopReason });
    expect(ended(SpanType.MODEL_INFERENCE).at(-1)).toMatchObject({ outcome, stopReason });
    expect(ended(SpanType.MODEL_STEP).at(-1)).toMatchObject({ outcome, stopReason });
  });

  it('reports a deadline as a limit rather than caller cancellation', async () => {
    const { observability, ended } = capture();
    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      afterStream: async () => {
        await expect.poll(() => ended().length).toBeGreaterThan(0);
      },
      prompt: 'Slow answer',
      errorProcessors: [],
      maxRetries: 0,
      modelSettings: { timeout: { totalMs: 2000 } },
      fixtures: llm => llm.on({ endpoint: 'chat' }, { content: 'late answer' }, { streamingProfile: { ttft: 5000 } }),
    });
    expect(requests).toHaveLength(1);
    expect(ended().at(-1)).toMatchObject({
      outcome: 'limit',
      stopReason: 'timeout',
      stopReasonContext: { timeoutMs: 2000, timeoutType: 'total' },
    });
    expect(ended(SpanType.MODEL_GENERATION).at(-1)).toMatchObject({ outcome: 'limit', stopReason: 'timeout' });
    for (const type of [SpanType.MODEL_STEP, SpanType.MODEL_INFERENCE]) {
      expect(ended(type).at(-1)).toMatchObject({ outcome: 'interrupted', stopReason: 'timeout' });
    }
  });

  it.each([401, 403])('reports a provider access denial (%s) as blocked', async status => {
    const { observability, ended } = capture();
    await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      afterStream: async () => {
        await expect.poll(() => ended().length).toBeGreaterThan(0);
      },
      prompt: 'No access',
      errorProcessors: [],
      maxRetries: 0,
      fixtures: llm => llm.onMessage(/.*/, { error: { message: 'Access denied', type: 'access_error' }, status }),
    });
    expect(ended().at(-1)).toMatchObject({
      outcome: 'blocked',
      stopReason: status === 401 ? 'authentication' : 'authorization',
    });
  });

  it.each(['content_filter', 'invalid_request'] as const)(
    'classifies structured provider rejection %s without matching message text',
    async code => {
      const { observability, ended } = capture();
      const { requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        observability,
        afterStream: async () => {
          await expect.poll(() => ended().length).toBeGreaterThan(0);
        },
        prompt: 'Rejected input',
        errorProcessors: [],
        maxRetries: 0,
        model: createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${getMock().url}/v1` }).chat('gpt-4o-mini'),
        fixtures: llm =>
          llm.on(
            { endpoint: 'chat' },
            {
              error: { message: 'content_filter diagnostic text', type: 'invalid_request_error', code },
              status: 400,
            },
          ),
      });
      expect(requests).toHaveLength(1);
      const expected =
        code === 'content_filter'
          ? {
              outcome: 'blocked',
              stopReason: 'content_filter',
              stopReasonContext: { message: 'content_filter diagnostic text' },
            }
          : { outcome: 'error', stopReason: 'model_error' };
      for (const type of [
        SpanType.AGENT_RUN,
        SpanType.MODEL_GENERATION,
        SpanType.MODEL_INFERENCE,
        SpanType.MODEL_STEP,
      ]) {
        expect(ended(type).at(-1)).toMatchObject(expected);
      }
    },
  );

  it('reports a processor block without inferring success from an empty error', async () => {
    const { observability, ended } = capture();
    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      afterStream: async () => {
        await expect.poll(() => ended().length).toBeGreaterThan(0);
      },
      prompt: 'Blocked request',
      inputProcessors: [{ id: 'policy', processInput: ({ abort }) => abort('Policy rejected the request') }],
      fixtures: llm => llm.on({ endpoint: 'chat' }, { content: 'must not run' }),
    });
    expect(requests).toHaveLength(0);
    expect(ended().at(-1)).toMatchObject({ outcome: 'blocked', stopReason: 'guardrail' });
  });

  it('ends both executions when an input-step guardrail terminates before onFinish', async () => {
    const { observability, ended } = capture();
    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      afterStream: async () => {
        await expect.poll(() => ended().length).toBeGreaterThan(0);
      },
      prompt: 'Blocked step',
      inputProcessors: [
        {
          id: 'step-policy',
          processInputStep: ({ abort }) =>
            abort('Step denied', {
              retry: false,
              metadata: { rule: 'policy', observerFailure: { cause: { outcome: 'invalid' } } },
            }),
        },
      ],
      fixtures: llm => llm.on({ endpoint: 'chat' }, { content: 'must not run' }),
    });
    expect(requests).toHaveLength(0);
    expect(ended().at(-1)).toMatchObject({ outcome: 'blocked', stopReason: 'guardrail' });
    expect(ended(SpanType.MODEL_GENERATION).at(-1)).toMatchObject({ outcome: 'blocked', stopReason: 'guardrail' });
    expect(ended(SpanType.MODEL_STEP).at(-1)).toMatchObject({
      outcome: 'blocked',
      stopReason: 'guardrail',
      stopReasonContext: {
        tripwire: { processorId: 'step-policy', reason: 'Step denied', retry: false, metadata: { rule: 'policy' } },
      },
    });
    expect(ended(SpanType.MODEL_INFERENCE)).toHaveLength(0);
  });

  it.each(['request', 'response'] as const)('preserves a %s processor block on its logical step', async stage => {
    const { observability, ended } = capture();
    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      afterStream: async () => {
        await expect.poll(() => ended().length).toBeGreaterThan(0);
      },
      prompt: 'Check the request and response policy',
      inputProcessors: [
        {
          id: 'exchange-policy',
          processLLMRequest: ({ prompt, abort }) => {
            if (stage === 'request') abort('Exchange denied');
            return { prompt };
          },
          processLLMResponse: ({ abort }) => {
            if (stage === 'response') abort('Exchange denied');
          },
        },
      ],
      fixtures: llm => llm.on({ endpoint: 'chat' }, { content: 'Provider draft' }),
    });
    expect(requests).toHaveLength(stage === 'request' ? 0 : 1);
    for (const type of [SpanType.AGENT_RUN, SpanType.MODEL_GENERATION, SpanType.MODEL_STEP]) {
      expect(ended(type).at(-1)).toMatchObject({
        outcome: 'blocked',
        stopReason: 'guardrail',
        stopReasonContext: { tripwire: { processorId: 'exchange-policy', reason: 'Exchange denied' } },
      });
    }
    if (stage === 'request') expect(ended(SpanType.MODEL_INFERENCE)).toHaveLength(0);
    else expect(ended(SpanType.MODEL_INFERENCE)).toMatchObject([{ outcome: 'success', stopReason: null }]);
  });

  it('keeps successful recovery after a guardrail requests a retry', async () => {
    const { observability, ended } = capture();
    const { requests, output } = await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      afterStream: async () => {
        await expect.poll(() => ended().length).toBeGreaterThan(0);
      },
      prompt: 'Write a reply',
      maxSteps: 3,
      maxProcessorRetries: 3,
      outputProcessors: [
        {
          id: 'rewrite',
          processOutputStep: ({ retryCount, abort, messageList }) => {
            if (retryCount === 0) abort('Rewrite this draft', { retry: true });
            return messageList;
          },
        },
      ],
      fixtures: llm => {
        llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'draft' });
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'accepted' });
      },
    });
    expect(requests).toHaveLength(2);
    expect(await output.text).toBe('accepted');
    expect(ended(SpanType.MODEL_INFERENCE)).toMatchObject([{ outcome: 'success' }, { outcome: 'success' }]);
    expect(ended(SpanType.MODEL_STEP)).toMatchObject([
      { outcome: 'blocked', stopReason: 'guardrail' },
      { outcome: 'success', stopReason: null },
    ]);
    expect(ended().at(-1)).toMatchObject({ outcome: 'success', stopReason: null });
    expect(ended(SpanType.MODEL_GENERATION).at(-1)).toMatchObject({ outcome: 'success', stopReason: null });
  });

  it('records caller cancellation while a tool is executing', async () => {
    const { observability, ended } = capture();
    const controller = new AbortController();
    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      afterStream: async () => {
        await expect.poll(() => ended().length).toBeGreaterThan(0);
      },
      prompt: 'Look up the order',
      abortSignal: controller.signal,
      maxSteps: 3,
      tools: {
        lookup: createTool({
          id: 'lookup',
          description: 'Look up an order',
          inputSchema: z.object({}),
          execute: async () => {
            // Cancel tool work only after the provider has completed, so the
            // test also proves cancellation preserves an already settled child.
            await expect.poll(() => ended(SpanType.MODEL_INFERENCE).at(-1)?.outcome).toBe('success');
            controller.abort();
            return { cancelled: true };
          },
        }),
      },
      fixtures: llm => llm.on({ endpoint: 'chat' }, { toolCalls: [{ id: 'lookup-1', name: 'lookup', arguments: {} }] }),
    });
    expect(requests).toHaveLength(1);
    expect(ended().at(-1)).toMatchObject({ outcome: 'abort', stopReason: 'caller_cancelled' });
    expect(ended(SpanType.MODEL_GENERATION).at(-1)).toMatchObject({ outcome: 'abort', stopReason: 'caller_cancelled' });
    expect(ended(SpanType.MODEL_STEP).at(-1)).toMatchObject({ outcome: 'interrupted', stopReason: 'caller_cancelled' });
    expect(ended(SpanType.MODEL_INFERENCE)[0]).toMatchObject({ outcome: 'success', stopReason: null });
    // Normal execution can enter the next attempt before observing cancellation;
    // it must abort that attempt without rewriting the completed provider call.
    for (const inference of ended(SpanType.MODEL_INFERENCE).slice(1)) {
      expect(inference).toMatchObject({ outcome: 'interrupted', stopReason: 'caller_cancelled' });
    }
  });

  it('preserves suspension when approval creates a new successful execution', async () => {
    const { observability, ended } = capture();
    const { output, approvals } = await runApprovalScenario({
      engine,
      llm: getMock(),
      observability,
      afterStream: async () => {
        await expect.poll(() => ended().length).toBeGreaterThan(0);
      },
      prompt: 'Look up the order',
      decision: () => true,
      tools: {
        lookup: createTool({
          id: 'lookup',
          description: 'Look up an order',
          inputSchema: z.object({}),
          execute: async () => ({ shipped: true }),
        }),
      },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'lookup-1', name: 'lookup', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'shipped' });
      },
    });
    expect(approvals).toEqual(['approve:lookup-1']);
    expect(await output.text).toBe('shipped');
    expect(ended()).toMatchObject([{ outcome: 'suspend', stopReason: 'approval_required' }, { outcome: 'success' }]);
    expect(ended()[0]!.id).not.toBe(ended()[1]!.id);
    expect(ended(SpanType.MODEL_STEP)[0]).toMatchObject({ outcome: 'suspend', stopReason: 'approval_required' });
    expect(ended(SpanType.MODEL_GENERATION)).toMatchObject([
      { outcome: 'suspend', stopReason: 'approval_required' },
      { outcome: 'success' },
    ]);
  });

  it('keeps a generation ongoing while a provider attempt is retried', async () => {
    const { observability, ended } = capture();
    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      afterStream: async () => {
        await expect.poll(() => ended().length).toBeGreaterThan(0);
      },
      prompt: 'Retry the provider',
      maxRetries: 1,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          { error: { message: 'Unavailable', type: 'server_error' }, status: 500 },
        );
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Recovered.' });
      },
    });
    expect(requests.length).toBeGreaterThan(1);
    expect(await output.text).toBe('Recovered.');
    expect(ended().at(-1)).toMatchObject({ outcome: 'success' });
    expect(ended(SpanType.MODEL_GENERATION)).toMatchObject([{ outcome: 'success', stopReason: null }]);
  });

  it('attributes a failed provider request to the model layer', async () => {
    const { observability, ended } = capture();
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      afterStream: async () => {
        await expect.poll(() => ended().length).toBeGreaterThan(0);
      },
      prompt: 'Provider failure',
      maxRetries: 0,
      fixtures: llm =>
        llm.onMessage(/.*/, {
          error: { message: 'Unavailable', type: 'server_error', code: 'internal_error' },
          status: 500,
        }),
    });
    expect(await output.finishReason).toBe('error');
    expect(ended().at(-1)).toMatchObject({ outcome: 'error', stopReason: 'model_error' });
    expect(ended(SpanType.MODEL_GENERATION).at(-1)).toMatchObject({ outcome: 'error', stopReason: 'model_error' });
    expect(ended(SpanType.MODEL_INFERENCE).at(-1)).toMatchObject({ outcome: 'error', stopReason: 'model_error' });
  });

  it('records a tool suspension separately from completion', async () => {
    const { observability, events, ended } = capture();
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      afterStream: async () => {
        await expect.poll(() => ended().length).toBeGreaterThan(0);
      },
      prompt: 'Ask for details',
      tools: {
        ask: createTool({
          id: 'ask',
          description: 'Ask for missing details',
          inputSchema: z.object({}),
          execute: async (_input, context) => context?.agent?.suspend({ question: 'Which order?' }),
        }),
      },
      fixtures: llm => llm.on({ endpoint: 'chat' }, { toolCalls: [{ id: 'ask-1', name: 'ask', arguments: {} }] }),
    });
    expect(await output.finishReason).toBe('suspended');
    await expect.poll(() => ended().at(-1)).toMatchObject({ outcome: 'suspend' });
    expect(ended(SpanType.MODEL_STEP).at(-1)).toMatchObject({ outcome: 'suspend', stopReason: null });
    expect(
      events.findLast(e => e.type === TracingEventType.SPAN_ENDED && e.exportedSpan.type === SpanType.TOOL_CALL)
        ?.exportedSpan,
    ).toMatchObject({ outcome: 'suspend' });
  });

  it.each([false, true])('retains the tool result when the agent recovers (toolFails=%s)', async toolFails => {
    const { observability, events, ended } = capture();
    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      afterStream: async () => {
        await expect.poll(() => ended().length).toBeGreaterThan(0);
      },
      prompt: 'Check stock',
      tools: {
        lookup: createTool({
          id: 'lookup',
          description: 'Look up stock',
          inputSchema: z.object({}),
          execute: async () => {
            if (toolFails) throw new Error('Inventory unavailable');
            return { stock: 5 };
          },
        }),
      },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'stock-1', name: 'lookup', arguments: {} }] },
        );
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          { content: toolFails ? 'Inventory unavailable; try later.' : 'Five available.' },
        );
      },
    });
    expect(requests).toHaveLength(2);
    expect(await output.text).toContain(toolFails ? 'try later' : 'Five');
    expect(ended().at(-1)).toMatchObject({ outcome: 'success' });
    const toolEvents = events.filter(e => e.exportedSpan.type === SpanType.TOOL_CALL);
    expect(toolEvents.find(e => e.type === TracingEventType.SPAN_STARTED)?.exportedSpan).toMatchObject({
      outcome: null,
    });
    expect(toolEvents.findLast(e => e.type === TracingEventType.SPAN_ENDED)?.exportedSpan).toMatchObject(
      toolFails ? { outcome: 'error', stopReason: 'runtime_error' } : { outcome: 'success', stopReason: null },
    );
  });

  it.each([false, true])(
    'distinguishes completion from a denied next step (needsAnotherStep=%s)',
    async needsAnotherStep => {
      const { events, observability, ended } = capture();
      const { output, requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Check the order.',
        maxSteps: 1,
        observability,
        afterStream: async () => {
          await expect.poll(() => ended().length).toBeGreaterThan(0);
        },
        tools: {
          lookup: createTool({
            id: 'lookup',
            description: 'Look up an order',
            inputSchema: z.object({}),
            execute: async () => ({ shipped: true }),
          }),
        },
        fixtures: llm =>
          llm.on(
            { endpoint: 'chat' },
            needsAnotherStep
              ? { toolCalls: [{ id: 'lookup-1', name: 'lookup', arguments: {} }] }
              : { content: 'The order is shipped.' },
          ),
      });
      expect(requests).toHaveLength(1);
      expect(
        events.find(e => e.type === TracingEventType.SPAN_STARTED && e.exportedSpan.type === SpanType.MODEL_STEP)
          ?.exportedSpan,
      ).toMatchObject({ outcome: null });
      expect(
        events.findLast(e => e.type === TracingEventType.SPAN_ENDED && e.exportedSpan.type === SpanType.MODEL_STEP)
          ?.exportedSpan,
      ).toMatchObject({ outcome: 'success', stopReason: null });
      expect(
        events.find(e => e.type === TracingEventType.SPAN_STARTED && e.exportedSpan.type === SpanType.MODEL_INFERENCE)
          ?.exportedSpan,
      ).toMatchObject({ outcome: null });
      expect(
        events.findLast(e => e.type === TracingEventType.SPAN_ENDED && e.exportedSpan.type === SpanType.MODEL_INFERENCE)
          ?.exportedSpan,
      ).toMatchObject({
        outcome: 'success',
        stopReason: null,
      });
      if (!needsAnotherStep) expect(await output.text).toBe('The order is shipped.');
      const modelEvents = events.filter(e => e.exportedSpan.type === SpanType.MODEL_GENERATION);
      expect(modelEvents.find(e => e.type === TracingEventType.SPAN_STARTED)?.exportedSpan).toMatchObject({
        outcome: null,
      });
      expect(modelEvents.findLast(e => e.type === TracingEventType.SPAN_ENDED)?.exportedSpan).toMatchObject(
        needsAnotherStep ? { outcome: 'limit', stopReason: 'max_steps' } : { outcome: 'success', stopReason: null },
      );
      const agentEvents = events.filter(e => e.exportedSpan.type === SpanType.AGENT_RUN);
      expect(agentEvents.find(e => e.type === TracingEventType.SPAN_STARTED)?.exportedSpan).toMatchObject({
        outcome: null,
      });
      expect(agentEvents.findLast(e => e.type === TracingEventType.SPAN_ENDED)?.exportedSpan).toMatchObject(
        needsAnotherStep ? { outcome: 'limit', stopReason: 'max_steps' } : { outcome: 'success', stopReason: null },
      );
    },
  );
});
