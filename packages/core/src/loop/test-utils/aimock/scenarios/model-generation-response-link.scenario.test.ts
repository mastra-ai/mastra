import { stepCountIs } from '@internal/ai-sdk-v5';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { SpanType } from '../../../../observability';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { captureOutcomeEvents as capture } from '../outcome-test-utils';

const usage = { inputTokens: 3, outputTokens: 4, totalTokens: 7 };

const metadata = (step: number) => ({
  type: 'response-metadata',
  id: `resp-${step}`,
  modelId: `served-model-${step}`,
  timestamp: new Date(0),
});

const toolCallStep = (step: number, providerMetadata?: Record<string, unknown>) => [
  { type: 'stream-start', warnings: [] },
  metadata(step),
  { type: 'tool-call', toolCallId: `call-${step}`, toolName: 'tick', input: '{}', providerExecuted: false },
  { type: 'finish', finishReason: 'tool-calls', usage, ...(providerMetadata ? { providerMetadata } : {}) },
];

const textStep = (step: number, providerMetadata?: Record<string, unknown>) => [
  { type: 'stream-start', warnings: [] },
  metadata(step),
  { type: 'text-start', id: 'text' },
  { type: 'text-delta', id: 'text', delta: `answer ${step}` },
  { type: 'text-end', id: 'text' },
  { type: 'finish', finishReason: 'stop', usage, ...(providerMetadata ? { providerMetadata } : {}) },
];

const fromParts = (parts: unknown[]) =>
  new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });

/** A model that answers each request from its own script, so every step has its own response id. */
function scriptedModel(script: (step: number, options: { abortSignal?: AbortSignal }) => ReadableStream) {
  let step = 0;
  return () => new MockLanguageModelV2({ doStream: async options => ({ stream: script(++step, options) }) });
}

describeForAllEngines('model generation span links to the provider response', engine => {
  const getMock = useLoopScenarioAimock();

  const tick = createTool({
    id: 'tick',
    description: 'Tick',
    inputSchema: z.object({}),
    execute: async () => ({ ok: true }),
  });

  // Durable engines end the MODEL_GENERATION span from saved state in a later step.
  async function runTwoSteps(options: Record<string, unknown>) {
    const { observability, ended } = capture();
    const result = await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      prompt: 'Call tick, then answer.',
      tools: { tick },
      stopWhen: stepCountIs(3),
      fixtures: () => {},
      afterStream: async () => {
        await expect.poll(() => ended(SpanType.MODEL_GENERATION).length).toBe(1);
      },
      ...options,
    });
    return { ...result, generation: ended(SpanType.MODEL_GENERATION)[0] };
  }

  it('records the responseId and responseModel of the last step, as the caller sees on response', async () => {
    const { output, generation } = await runTwoSteps({
      model: scriptedModel(step => fromParts(step === 1 ? toolCallStep(1) : textStep(2))),
    });

    const response = await output.response;
    expect(response).toMatchObject({ id: 'resp-2', modelId: 'served-model-2' });
    expect(generation?.attributes).toMatchObject({ responseId: 'resp-2', responseModel: 'served-model-2' });
  });

  it('records the Anthropic server-side fallback model as responseModel', async () => {
    const fallback = { anthropic: { iterations: [{ type: 'fallback_message', model: 'fallback-model' }] } };
    const { generation } = await runTwoSteps({
      model: scriptedModel(step => fromParts(step === 1 ? toolCallStep(1) : textStep(2, fallback))),
    });

    expect(generation?.attributes).toMatchObject({ responseId: 'resp-2', responseModel: 'fallback-model' });
  });

  // Durable engines open the span for the first model in the list and end it in a later step.
  it('names the model that answered when the first model in the list fails', async () => {
    const { observability, ended } = capture();
    await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      errorProcessors: [],
      prompt: 'Answer.',
      fixtures: () => {},
      model: () => [
        {
          id: 'primary',
          maxRetries: 0,
          model: new MockLanguageModelV2({
            provider: 'down-provider',
            modelId: 'down-model',
            doStream: async () => {
              throw new Error('primary is down');
            },
          }),
        },
        {
          id: 'fallback',
          maxRetries: 0,
          model: new MockLanguageModelV2({
            provider: 'up-provider',
            modelId: 'up-model',
            doStream: async () => ({ stream: fromParts(textStep(1)) }),
          }),
        },
      ],
      afterStream: async () => {
        await expect.poll(() => ended(SpanType.MODEL_GENERATION).length).toBe(1);
      },
    });

    expect(ended(SpanType.MODEL_GENERATION)[0]).toMatchObject({
      name: "llm: 'up-model'",
      attributes: { model: 'up-model', provider: 'up-provider' },
    });
  });

  // A run that waits for approval has one generation span per part, and the part that waits ends
  // its span before the run is done.
  it('names the model that answered and the cost it reported on each part of an approved run', async () => {
    const { observability, ended } = capture();
    const model = (modelId: string, doStream: (prompt: any[]) => ReadableStream) => ({
      id: modelId,
      maxRetries: 0,
      model: new MockLanguageModelV2({
        provider: `${modelId}-provider`,
        modelId,
        doStream: async ({ prompt }) => ({ stream: doStream(prompt) }),
      }),
    });
    const { agent } = await createSharedAgent(getMock(), {
      engine,
      observability,
      errorProcessors: [],
      instructions: 'Call tick, then answer.',
      tools: {
        tick: createTool({
          id: 'tick',
          description: 'Tick',
          inputSchema: z.object({}),
          requireApproval: true,
          execute: async () => ({ ok: true }),
        }),
      },
      model: () => [
        model('down-model', () => {
          throw new Error('primary is down');
        }),
        model('up-model', prompt =>
          fromParts(
            prompt.some(message => message.role === 'tool')
              ? textStep(2, { gateway: { cost: '0.5' } })
              : toolCallStep(1, { gateway: { cost: '0.25' } }),
          ),
        ),
      ],
    } as any);

    const first: any = await (agent as any).stream('Go.');
    for await (const chunk of first.fullStream) if (chunk.type === 'tool-call-approval') break;
    await expect.poll(() => ended(SpanType.MODEL_GENERATION).length).toBe(1);
    const resumed: any = await (agent as any).approveToolCall({ runId: first.runId, toolCallId: 'call-1' });
    expect(await (resumed.output ?? resumed).text).toBe('answer 2');
    await expect.poll(() => ended(SpanType.MODEL_GENERATION).length).toBe(2);

    const parts = ended(SpanType.MODEL_GENERATION);
    expect(parts.map(part => [part.name, part.attributes?.provider])).toEqual([
      ["llm: 'up-model'", 'up-model-provider'],
      ["llm: 'up-model'", 'up-model-provider'],
    ]);
    expect(parts.map(part => part.attributes?.costContext?.estimatedCost)).toEqual([0.25, 0.5]);
  });

  // A gateway bills its own price, so its number replaces the estimate from the price table.
  it('records the cost the provider reported for each step', async () => {
    const reported = (cost: string) => ({ gateway: { cost } });
    const { generation } = await runTwoSteps({
      model: scriptedModel(step =>
        fromParts(step === 1 ? toolCallStep(1, reported('0.25')) : textStep(2, reported('0.5'))),
      ),
    });

    expect(generation?.attributes?.costContext).toMatchObject({
      estimatedCost: 0.75,
      costMetadata: { source: 'provider_reported', reportedStepCount: 2 },
    });
  });

  it('records no response when the last step is aborted mid-stream', async () => {
    const controller = new AbortController();
    const { generation } = await runTwoSteps({
      abortSignal: controller.signal,
      model: scriptedModel((step, { abortSignal }) => {
        if (step === 1) return fromParts(toolCallStep(1));
        return new ReadableStream({
          start(stream) {
            for (const part of textStep(2).slice(0, 4)) stream.enqueue(part);
            abortSignal?.addEventListener('abort', () => stream.error(new DOMException('aborted', 'AbortError')), {
              once: true,
            });
            controller.abort();
          },
        });
      }),
    });

    expect(generation).toMatchObject({ outcome: 'abort', stopReason: 'caller_cancelled' });
    expect(generation?.attributes?.responseId).toBeUndefined();
    expect(generation?.attributes?.responseModel).toBeUndefined();
  });

  it('records no response when an output stream processor rejects the last step', async () => {
    const { generation } = await runTwoSteps({
      outputProcessors: [
        {
          id: 'block-answer',
          processOutputStream: ({ part, abort }: { part: { type: string }; abort: (reason: string) => never }) =>
            part.type === 'text-delta' ? abort('blocked') : part,
        },
      ],
      model: scriptedModel(step => fromParts(step === 1 ? toolCallStep(1) : textStep(2))),
    });

    expect(generation).toMatchObject({ outcome: 'blocked', stopReason: 'guardrail' });
    expect(generation?.attributes?.responseId).toBeUndefined();
    expect(generation?.attributes?.responseModel).toBeUndefined();
  });

  it('records the rejected response when an output result processor rejects the last step', async () => {
    const { generation } = await runTwoSteps({
      outputProcessors: [
        {
          id: 'reject-answer',
          processOutputResult: ({ abort }: { abort: (reason: string) => never }) => abort('rejected'),
        },
      ],
      model: scriptedModel(step => fromParts(step === 1 ? toolCallStep(1) : textStep(2))),
    });

    expect(generation).toMatchObject({ outcome: 'blocked', stopReason: 'guardrail' });
    expect(generation?.attributes).toMatchObject({ responseId: 'resp-2', responseModel: 'served-model-2' });
  });
});
