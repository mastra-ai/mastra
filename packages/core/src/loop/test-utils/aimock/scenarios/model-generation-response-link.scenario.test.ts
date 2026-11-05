import { stepCountIs } from '@internal/ai-sdk-v5';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { SpanType } from '../../../../observability';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { captureOutcomeEvents as capture } from '../outcome-test-utils';

const usage = { inputTokens: 3, outputTokens: 4, totalTokens: 7 };

const metadata = (step: number) => ({
  type: 'response-metadata',
  id: `resp-${step}`,
  modelId: `served-model-${step}`,
  timestamp: new Date(0),
});

const toolCallStep = (step: number) => [
  { type: 'stream-start', warnings: [] },
  metadata(step),
  { type: 'tool-call', toolCallId: `call-${step}`, toolName: 'tick', input: '{}', providerExecuted: false },
  { type: 'finish', finishReason: 'tool-calls', usage },
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
