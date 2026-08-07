/**
 * DurableAgent prepareStep tests.
 *
 * Verifies that `options.prepareStep` is stored on the in-process run registry
 * and invoked as a `PrepareStepProcessor` at the start of every iteration of
 * the durable agentic loop, the same way it runs in the non-durable agent.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function createTwoStepToolThenTextModel(toolName: string, finalText: string) {
  let callCount = 0;
  const seenActiveTools: Array<string[] | undefined> = [];
  const model = new MockLanguageModelV2({
    doStream: async (options: any) => {
      callCount++;
      // The MockLanguageModelV2 exposes the prompt+tools the loop handed it.
      // We can inspect which tools were enabled for this step via options.tools.
      const tools = Array.isArray(options.tools) ? options.tools.map((t: any) => t.name) : undefined;
      seenActiveTools.push(tools);

      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName,
              input: JSON.stringify({}),
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: finalText },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
  return { model, seenActiveTools, getCallCount: () => callCount };
}

async function drain(stream: ReadableStream<any>) {
  const out: any[] = [];
  for await (const _ of stream) out.push(_);
  return out;
}

describe('DurableAgent prepareStep', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('fires once per iteration and narrows the activeTools handed to the LLM', async () => {
    const tool = createTool({
      id: 'allowedTool',
      description: 'allowed',
      inputSchema: z.object({}),
      execute: async () => 'done',
    });
    const hidden = createTool({
      id: 'hiddenTool',
      description: 'hidden',
      inputSchema: z.object({}),
      execute: async () => 'hidden',
    });

    const { model, seenActiveTools } = createTwoStepToolThenTextModel('allowedTool', 'final');

    const baseAgent = new Agent({
      id: 'prepare-step-agent',
      name: 'Prepare Step Agent',
      instructions: 'noop',
      model: model as LanguageModelV2,
      tools: { allowedTool: tool, hiddenTool: hidden },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const prepareStep = vi.fn().mockResolvedValue({ activeTools: ['allowedTool'] });

    const { output, cleanup } = await durableAgent.stream('go', {
      prepareStep,
      maxSteps: 3,
    });
    await drain(output.fullStream as unknown as ReadableStream<any>);
    await cleanup();

    // The hook fires once per LLM iteration; we expect 2 LLM calls and 2 fires.
    expect(prepareStep).toHaveBeenCalledTimes(2);
    // Each fire receives a step counter and the running step list.
    const firstArgs = prepareStep.mock.calls[0]![0] as { stepNumber: number };
    const secondArgs = prepareStep.mock.calls[1]![0] as { stepNumber: number };
    expect(firstArgs.stepNumber).toBe(0);
    expect(secondArgs.stepNumber).toBe(1);

    // The narrowed activeTools must actually reach the LLM call. The mock
    // language model captures `options.tools` for each `doStream`.
    expect(seenActiveTools[0]).toEqual(['allowedTool']);
    expect(seenActiveTools[1]).toEqual(['allowedTool']);
  });

  it('stores the prepareStep closure on the run registry, never on workflowInput', async () => {
    const baseAgent = new Agent({
      id: 'prepare-step-prep-agent',
      name: 'Prepare Step Prep Agent',
      instructions: 'noop',
      model: createTwoStepToolThenTextModel('t', 'x').model as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const prepareStep = vi.fn();
    const { workflowInput, registryEntry } = await durableAgent.prepare('hello', { prepareStep });

    expect((workflowInput.options as any).prepareStep).toBeUndefined();
    expect(registryEntry.prepareStep).toBe(prepareStep);
  });
});
