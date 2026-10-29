import { createOpenAI } from '@ai-sdk/openai-v5';
import { expect, it, onTestFinished } from 'vitest';
import { ModelSpanTracker } from '../../../../../../../observability/mastra/src/model-tracing';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { createScorer } from '../../../../evals';
import { EventEmitterPubSub } from '../../../../events/event-emitter';
import { SCENARIO_MODEL_ID } from '../types';
import { SamplingStrategyType, SpanType, TracingEventType } from '../../../../observability';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runApprovalScenario, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { captureOutcomeEvents as capture } from '../outcome-test-utils';

describeForAllEngines('native execution outcomes (OBS-724)', engine => {
  const getMock = useLoopScenarioAimock();

  it.each([true, false])('keeps processed chunks inside their logical step (buffered=%s)', async buffered => {
    const { observability, ended } = capture();
    let bufferedText = '';
    let releasedAfterInference = false;
    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      collectChunks: true,
      prompt: 'Write a short reply',
      outputProcessors: buffered
        ? [
            {
              id: 'buffer-reply',
              processOutputStream: async ({ part }) => {
                if (part.type === 'text-start') return null;
                if (part.type === 'text-delta') {
                  bufferedText += part.payload.text;
                  return null;
                }
                if (part.type === 'text-end') {
                  // Hold content until provider completion has been exported. This makes
                  // the delayed-processor boundary deterministic rather than racing clocks.
                  await expect.poll(() => ended(SpanType.MODEL_INFERENCE).length).toBe(1);
                  releasedAfterInference = true;
                  return { ...part, type: 'text-delta', payload: { ...part.payload, text: bufferedText } };
                }
                return part;
              },
            },
          ]
        : [],
      afterStream: async () => {
        await expect.poll(() => ended().length).toBe(1);
      },
      fixtures: llm => llm.on({ endpoint: 'chat' }, { content: 'Buffered reply' }),
    });
    expect(releasedAfterInference).toBe(buffered);
    expect(
      chunks
        ?.filter(chunk => chunk.type === 'text-delta')
        .map(chunk => chunk.payload.text)
        .join(''),
    ).toBe('Buffered reply');
    const parents = new Map(
      [...ended(SpanType.MODEL_INFERENCE), ...ended(SpanType.MODEL_STEP)].map(span => [span.id, span]),
    );
    const chunkSpans = ended(SpanType.MODEL_CHUNK);
    expect(chunkSpans.length).toBeGreaterThan(0);
    for (const chunk of chunkSpans) {
      const parent = parents.get(chunk.parentSpanId!);
      expect(parent).toBeDefined();
      expect(parent!.type).toBe(SpanType.MODEL_STEP);
      expect(parent!.endTime).toBeDefined();
      expect(chunk.endTime!.getTime()).toBeLessThanOrEqual(parent!.endTime!.getTime());
      expect(chunk.startTime.getTime()).toBeLessThanOrEqual(parent!.endTime!.getTime());
    }
  });

  it.each(['redact', 'block'] as const)(
    'captures only processed model chunks when a processor chooses to %s',
    async mode => {
      const { observability, ended } = capture();
      const { chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        observability,
        collectChunks: true,
        prompt: 'Return the private value',
        outputProcessors: [
          {
            id: 'privacy-policy',
            processOutputStream: ({ part, abort }) => {
              if (part.type !== 'text-delta') return part;
              if (mode === 'block') return abort('Blocked private reply');
              return { ...part, payload: { ...part.payload, text: '[redacted]' } };
            },
          },
        ],
        afterStream: async () => {
          await expect.poll(() => ended().length).toBeGreaterThan(0);
        },
        fixtures: llm => llm.on({ endpoint: 'chat' }, { content: 'private-secret-123' }),
      });
      expect(JSON.stringify(ended(SpanType.MODEL_CHUNK))).not.toContain('private-secret-123');
      expect(JSON.stringify(chunks)).not.toContain('private-secret-123');
      if (mode === 'redact') expect(JSON.stringify(ended(SpanType.MODEL_CHUNK))).toContain('[redacted]');
      else expect(ended().at(-1)).toMatchObject({ outcome: 'blocked', stopReason: 'guardrail' });
    },
  );

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
    expect(ended().filter(span => span.entityId === 'worker')).toMatchObject([
      { outcome: failed ? 'error' : 'success' },
    ]);
    const supervisor = ended().find(span => span.entityId !== 'worker');
    expect(supervisor).toMatchObject({ outcome: failed ? 'interrupted' : 'success', stopReason: 'delegation_bail' });
    if (failed)
      expect(supervisor?.stopReasonContext).toMatchObject({ causeOutcome: 'error', causeStopReason: 'model_error' });
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
        stopReasonContext: { processorId: 'final-policy' },
      });
    }
    expect(ended(SpanType.MODEL_GENERATION)[0]?.attributes?.usage).toMatchObject({ inputTokens: 13, outputTokens: 7 });
    expect(ended(SpanType.AGENT_RUN)[0]?.output).toBeDefined();
    const inference = ended(SpanType.MODEL_INFERENCE)[0]!;
    expect(inference).toMatchObject({ outcome: 'success' });
    const firstChunkTime = new Date(inference.attributes?.completionStartTime as string).getTime();
    expect(firstChunkTime).toBeGreaterThanOrEqual(new Date(inference.startTime).getTime());
    expect(firstChunkTime).toBeLessThanOrEqual(new Date(inference.endTime!).getTime());
    for (const span of ended(SpanType.MODEL_CHUNK)) expect(span.parentSpanId).toBe(ended(SpanType.MODEL_STEP)[0]!.id);
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
              stopReasonContext: null,
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

  it.each(engine === 'durable' || engine === 'evented' ? [false, true] : [false])(
    'ends an input-step guardrail without onFinish (legacy tracker=%s)',
    async legacy => {
      if (legacy) {
        // Simulate an installed tracker version without the new lifecycle method;
        // the real exporter, spans and snapshot/rebuild cleanup still run.
        const descriptor = Object.getOwnPropertyDescriptor(ModelSpanTracker.prototype, 'endAttempt')!;
        Object.defineProperty(ModelSpanTracker.prototype, 'endAttempt', { ...descriptor, value: undefined });
        onTestFinished(() => Object.defineProperty(ModelSpanTracker.prototype, 'endAttempt', descriptor));
      }
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
          processorId: 'step-policy',
        },
      });
      expect(ended(SpanType.MODEL_INFERENCE)).toHaveLength(0);
    },
  );

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
        stopReasonContext: { processorId: 'exchange-policy' },
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
            throw new DOMException('Tool canceled', 'AbortError');
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

  // Durable resume creates fresh spans from an earlier execution's tracing state.
  if (engine === 'durable' || engine === 'evented' || engine === 'inngest') {
    it.each([true, false])('preserves durable resume sampling=%s and privacy after approval', async sampled => {
      let resumed = false;
      let resumeSamples = 0;
      const { observability, ended } = capture({
        type: SamplingStrategyType.CUSTOM,
        sampler: options => {
          // Workflow-level traces make their own sampling decisions. This assertion
          // targets the agent's fresh resume segment, identified by its run metadata.
          if (resumed && options?.metadata?.resumed && !Object.hasOwn(options.metadata, 'resourceId')) {
            resumeSamples++;
            throw new Error('The existing agent trace must not be sampled again');
          }
          return sampled;
        },
      });
      const { output } = await runApprovalScenario({
        engine,
        llm: getMock(),
        observability,
        tracingOptions: { hideInput: true, hideOutput: true },
        prompt: 'private order question',
        decision: () => {
          resumed = true;
          return true;
        },
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
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'private shipment details' });
        },
      });
      expect(await output.text).toBe('private shipment details');
      expect(resumeSamples).toBe(0);
      if (sampled) {
        await expect.poll(() => ended().length).toBe(2);
        for (const type of [
          SpanType.AGENT_RUN,
          SpanType.MODEL_GENERATION,
          SpanType.MODEL_INFERENCE,
          SpanType.TOOL_CALL,
        ]) {
          for (const span of ended(type)) {
            expect(span.input).toBeUndefined();
            expect(span.output).toBeUndefined();
          }
        }
        const generations = ended(SpanType.MODEL_GENERATION);
        expect(generations).toHaveLength(2);
        expect(generations[1]?.attributes).toMatchObject({
          model: generations[0]!.attributes!.model,
          provider: generations[0]!.attributes!.provider,
          streaming: true,
        });
      } else {
        expect(ended()).toEqual([]);
      }
    });
  }

  // OBS-754: Inngest still reuses the pre-suspension identity. Separate resume
  // spans are deferred until their identity can travel to the executing worker.
  const itSeparateResume = engine === 'inngest' ? it.fails : it;
  itSeparateResume('preserves suspension when approval creates a new successful execution', async () => {
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

  if (engine === 'durable' || engine === 'evented') {
    it('closes root spans when publishing a fatal bail fails before final mapping', async () => {
      const { observability, ended } = capture();
      let rejected = false;
      class FailingBailTransport extends EventEmitterPubSub {
        override async publish(...args: Parameters<EventEmitterPubSub['publish']>): Promise<void> {
          const event = args[1];
          if (!rejected && event.data?.type === 'error') {
            rejected = true;
            throw new Error('Fatal bail transport failed');
          }
          return super.publish(...args);
        }
      }
      await runLoopScenario({
        engine,
        llm: getMock(),
        observability,
        pubsub: new FailingBailTransport(),
        prompt: 'Answer briefly',
        maxRetries: 0,
        expectStreamError: true,
        fixtures: llm =>
          llm.on(
            { endpoint: 'chat' },
            { error: { message: 'Provider unavailable', type: 'server_error' }, status: 500 },
          ),
      });
      expect(rejected).toBe(true);
      for (const type of [SpanType.MODEL_GENERATION, SpanType.AGENT_RUN]) {
        await expect.poll(() => ended(type)).toMatchObject([{ outcome: 'error', endTime: expect.any(Date) }]);
      }
    });
  }

  it.each([false, true])('closes tracing after a hard workflow failure (onError throws=%s)', async throwsOnError => {
    const { observability, ended } = capture();
    const errors: Array<{ error: Error | string }> = [];
    let finishes = 0;
    const callbackError = new Error('Error callback failed');
    const scorer = createScorer({
      id: 'broken-completion-check',
      description: 'Task completion service is unavailable',
    }).generateScore(() => 1);
    const { chunks, requests, streamError } = await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      prompt: 'Answer briefly',
      collectChunks: true,
      expectStreamError: throwsOnError,
      isTaskComplete: {
        scorers: [scorer],
        onComplete: () => {
          throw new Error('Completion callback failed');
        },
      },
      onError: event => {
        errors.push(event);
        if (throwsOnError) throw callbackError;
      },
      onFinish: () => {
        finishes++;
      },
      fixtures: llm => llm.on({ endpoint: 'chat' }, { content: 'Accepted reply' }),
    });
    expect(requests).toHaveLength(1);
    if (engine === 'normal' || engine === 'fs') {
      // Completion callback errors escape the workflow step on the in-process engine. This
      // branch closes its stream after onError, without ever calling onFinish.
      expect(finishes).toBe(0);
      if (throwsOnError) expect(streamError).toBe(callbackError);
      expect(chunks?.filter(chunk => chunk.type === 'finish')).toEqual([]);
      const errorChunks = chunks?.filter(chunk => chunk.type === 'error');
      expect(errorChunks).toHaveLength(1);
      expect(errors).toHaveLength(1);
      expect(Object.keys(errors[0]!)).toEqual(['error']);
      expect(errors[0]!.error).toBe(errorChunks![0]!.payload.error);
      for (const type of [SpanType.MODEL_GENERATION, SpanType.AGENT_RUN]) {
        expect(ended(type)).toHaveLength(1);
        expect(ended(type)[0]).toMatchObject({
          outcome: 'error',
          stopReason: 'runtime_error',
          endTime: expect.any(Date),
        });
      }
      // Provider completion preceded the failing workflow callback.
      expect(ended(SpanType.MODEL_INFERENCE)).toMatchObject([{ outcome: 'success' }]);
    } else {
      // Durable engines retain their existing best-effort grading policy;
      // Inngest does not run these completion checks.
      expect(errors).toEqual([]);
      expect(finishes).toBe(1);
      for (const type of [SpanType.MODEL_GENERATION, SpanType.AGENT_RUN]) {
        expect(ended(type)).toMatchObject([{ outcome: 'success' }]);
      }
    }
  });

  it('retains successful-step usage when the next provider request fails', async () => {
    const { observability, ended } = capture();
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      prompt: 'Look up stock then answer',
      maxRetries: 0,
      tools: {
        lookup: createTool({
          id: 'lookup',
          description: 'Look up stock',
          inputSchema: z.object({}),
          execute: async () => ({ stock: 5 }),
        }),
      },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'stock-1', name: 'lookup', arguments: {} }],
            usage: { input_tokens: 13, output_tokens: 7 },
          },
        );
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          { error: { message: 'Unavailable', type: 'server_error' }, status: 500 },
        );
      },
      afterStream: async () => {
        await expect.poll(() => ended(SpanType.MODEL_GENERATION).length).toBeGreaterThan(0);
      },
    });
    expect(await output.finishReason).toBe('error');
    const generations = ended(SpanType.MODEL_GENERATION);
    expect(generations).toHaveLength(1);
    expect(generations[0]).toMatchObject({
      outcome: 'error',
      attributes: { usage: { inputTokens: 13, outputTokens: 7 } },
    });
    expect(generations[0]?.output).toBeDefined();
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

  it('records a real tool error after requesting suspension', async () => {
    const { observability, ended } = capture();
    await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      prompt: 'Ask for details',
      tools: {
        ask: createTool({
          id: 'ask',
          description: 'Ask for missing details',
          inputSchema: z.object({}),
          // Declaring the schema excludes eager dispatch, whose suspension intentionally
          // unwinds before the rest of the tool body executes.
          suspendSchema: z.object({ question: z.string() }),
          execute: async (_input, context) => {
            await context?.agent?.suspend({ question: 'Which order?' });
            throw new Error('Failed to save approval audit');
          },
        }),
      },
      fixtures: llm => llm.on({ endpoint: 'chat' }, { toolCalls: [{ id: 'ask-1', name: 'ask', arguments: {} }] }),
    });
    await expect
      .poll(() => ended(SpanType.TOOL_CALL))
      .toMatchObject([{ outcome: 'error', errorInfo: { message: 'Failed to save approval audit' } }]);
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
