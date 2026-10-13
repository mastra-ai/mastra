/**
 * #26780: DurableAgent callbacks and results must carry the same step data as the
 * regular Agent — step response messages and model id in onStepFinish, output.steps
 * and onFinish — and a per-call `model` must be the model that runs.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function toolThenTextModel(modelId: string) {
  let calls = 0;
  const model = new MockLanguageModelV2({
    modelId,
    doStream: async () => {
      calls++;
      const parts =
        calls === 1
          ? [
              { type: 'tool-call', toolCallId: 'call-1', toolName: 'probe', input: '{"q":1}', providerExecuted: false },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]
          : [
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: 'done' },
              { type: 'text-end', id: 't' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ];
      return {
        stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...parts] as any),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
  return { model, calls: () => calls };
}

describe('DurableAgent step data (#26780)', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('reports step messages and model id, and runs the per-call model', async () => {
    const agentModel = toolThenTextModel('agent-model');
    const perCallModel = toolThenTextModel('per-call-model');
    const probe = createTool({
      id: 'probe',
      description: 'probe',
      inputSchema: z.object({ q: z.number() }),
      execute: async () => ({ ok: true }),
    });
    const durableAgent = createDurableAgent({
      agent: new Agent({
        id: 'step-data-agent',
        name: 'Step Data Agent',
        instructions: 'Test',
        model: agentModel.model as LanguageModelV2,
        tools: { probe },
      }),
      pubsub,
    });

    const stepEvents: any[] = [];
    let finish: any;
    const { output, cleanup } = await durableAgent.stream('go', {
      maxSteps: 5,
      model: perCallModel.model as LanguageModelV2,
      onStepFinish: (e: any) => void stepEvents.push(e),
      onFinish: (e: any) => void (finish = e),
    } as any);
    await output.consumeStream();
    const steps = await output.steps;
    cleanup();

    expect(perCallModel.calls()).toBe(2);
    expect(agentModel.calls()).toBe(0);

    expect(stepEvents).toHaveLength(2);
    for (const event of stepEvents) {
      expect(event.response.modelId).toBe('per-call-model');
      expect(event.response.messages.length).toBeGreaterThan(0);
    }
    expect(stepEvents[0].response.messages.some((m: any) => m.role === 'tool')).toBe(true);

    expect(steps).toHaveLength(2);
    expect(steps.every(s => s.response.messages!.length > 0)).toBe(true);

    expect(finish.steps).toHaveLength(2);
    expect(finish.steps.every((s: any) => s.response?.messages?.length > 0)).toBe(true);
    expect(finish.response.modelId).toBe('per-call-model');
    expect(finish.response.messages.length).toBeGreaterThan(0);
  });
});
