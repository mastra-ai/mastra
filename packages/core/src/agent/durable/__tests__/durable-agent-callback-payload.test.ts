/**
 * Durable and evented agents hand `onStepFinish` and `onFinish` the same payload values a plain
 * Agent does: the run id on every callback, plus `model`, `messages`, `object`, `error` and
 * `usedFallbackValue` on `onFinish` (#26524).
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';

function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

const engines = ['durable', 'evented'] as const;
const modes = ['stream', 'generate'] as const;

describe('durable agent callback payloads', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  function wrap(engine: (typeof engines)[number], text: string) {
    const agent = new Agent({
      id: `payload-agent-${engine}`,
      name: 'Payload Agent',
      instructions: 'Test',
      model: createTextModel(text) as LanguageModelV2,
    });
    return engine === 'durable' ? createDurableAgent({ agent, pubsub }) : createEventedAgent({ agent, pubsub });
  }

  async function run(
    engine: (typeof engines)[number],
    mode: (typeof modes)[number],
    text: string,
    options: Record<string, unknown>,
  ): Promise<string> {
    const wrapped = wrap(engine, text);
    if (mode === 'generate') {
      const out = await wrapped.generate('hi', options);
      return out.runId!;
    }
    const { output, runId, cleanup } = await wrapped.stream('hi', options);
    await output.consumeStream();
    cleanup();
    return runId;
  }

  it('exposes runId on the typed onStepFinish payload', async () => {
    const stepRunIds: string[] = [];
    const { output, runId, cleanup } = await wrap('durable', 'typed').stream('hi', {
      onStepFinish: payload => {
        stepRunIds.push(payload.runId);
      },
    });
    await output.consumeStream();
    cleanup();

    expect(stepRunIds.length).toBeGreaterThan(0);
    expect(stepRunIds.every(id => id === runId)).toBe(true);
  });

  for (const engine of engines) {
    for (const mode of modes) {
      it(`${engine} ${mode}: carries the caller's runId and onFinish fields`, async () => {
        const stepPayloads: any[] = [];
        const finishPayloads: any[] = [];
        const runId = `payload-${engine}-${mode}`;

        const returnedRunId = await run(engine, mode, 'hello there', {
          runId,
          onStepFinish: (payload: any) => {
            stepPayloads.push(payload);
          },
          onFinish: (payload: any) => {
            finishPayloads.push(payload);
          },
        });

        expect(returnedRunId).toBe(runId);
        expect(stepPayloads.length).toBeGreaterThan(0);
        for (const payload of stepPayloads) {
          expect(payload.runId).toBe(runId);
        }

        expect(finishPayloads).toHaveLength(1);
        const finish = finishPayloads[0];
        expect(finish.runId).toBe(runId);
        expect(finish.model).toMatchObject({ modelId: 'mock-model-id', provider: 'mock-provider' });
        expect(finish.error).toBeUndefined();
        expect(finish.usedFallbackValue).toBe(false);
        expect(finish.object).toBeUndefined();
        expect(finish.messages).toEqual([
          expect.objectContaining({
            role: 'assistant',
            content: [expect.objectContaining({ type: 'text', text: 'hello there' })],
          }),
        ]);
      });

      it(`${engine} ${mode}: carries a generated runId when none is passed`, async () => {
        const runIds: string[] = [];
        const returnedRunId = await run(engine, mode, 'hi', {
          onStepFinish: (payload: any) => {
            runIds.push(payload.runId);
          },
          onFinish: (payload: any) => {
            runIds.push(payload.runId);
          },
        });

        expect(returnedRunId).toBeTruthy();
        expect(runIds.length).toBeGreaterThanOrEqual(2);
        expect(new Set(runIds)).toEqual(new Set([returnedRunId]));
      });

      it(`${engine} ${mode}: passes the structured object to onFinish`, async () => {
        let finish: any;
        await run(engine, mode, JSON.stringify({ city: 'Paris' }), {
          structuredOutput: { schema: z.object({ city: z.string() }) },
          onFinish: (payload: any) => {
            finish = payload;
          },
        });

        expect(finish.object).toEqual({ city: 'Paris' });
        expect(finish.usedFallbackValue).toBe(false);
      });

      it(`${engine} ${mode}: reports the fallback value in onFinish`, async () => {
        let finish: any;
        await run(engine, mode, 'not json at all', {
          structuredOutput: {
            schema: z.object({ city: z.string() }),
            errorStrategy: 'fallback',
            fallbackValue: { city: 'unknown' },
          },
          onFinish: (payload: any) => {
            finish = payload;
          },
        });

        expect(finish.object).toEqual({ city: 'unknown' });
        expect(finish.usedFallbackValue).toBe(true);
      });
    }
  }

  it('fires onFinish with the structured object when nobody consumes the stream', async () => {
    const wrapped = createDurableAgent({
      agent: new Agent({
        id: 'payload-agent-unconsumed-structured',
        name: 'Payload Agent',
        instructions: 'Test',
        model: createTextModel(JSON.stringify({ city: 'Rome' })) as LanguageModelV2,
      }),
      pubsub,
    });
    const finished = new Promise<any>(resolve => {
      void wrapped.stream('hi', {
        structuredOutput: { schema: z.object({ city: z.string() }) },
        onFinish: resolve,
      });
    });

    const finish = await finished;
    expect(finish.runId).toBeTruthy();
    expect(finish.object).toEqual({ city: 'Rome' });
  });

  it('fires onFinish with the runId when nobody consumes the stream', async () => {
    const finishPayloads: any[] = [];
    const wrapped = wrap('durable', 'unconsumed');
    let resolveFinished!: () => void;
    const finished = new Promise<void>(resolve => {
      resolveFinished = resolve;
    });

    const { runId, cleanup } = await wrapped.stream('hi', {
      onFinish: (payload: any) => {
        finishPayloads.push(payload);
        resolveFinished();
      },
    });

    await finished;
    cleanup();

    expect(finishPayloads).toHaveLength(1);
    expect(finishPayloads[0].runId).toBe(runId);
    expect(finishPayloads[0].messages).toEqual([
      expect.objectContaining({
        role: 'assistant',
        content: [expect.objectContaining({ type: 'text', text: 'unconsumed' })],
      }),
    ]);
  });
});
