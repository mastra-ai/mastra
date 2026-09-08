/**
 * Regression test for #20161:
 * Input processors run through the durable preparation path must receive the
 * `agent` in their context (mirroring the non-durable Agent path). Before the
 * fix, the durable ProcessorRunner was constructed without `agent`, so
 * `context.agent` was `undefined` for input processors — notably when an idle
 * durable agent was woken by a signal or schedule and re-ran preparation.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect } from 'vitest';
import type { Processor } from '../../../processors';
import { Agent } from '../../agent';
import { prepareForDurableExecution } from '../preparation';

function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

describe('DurableAgent input processor agent context (#20161)', () => {
  it('passes the agent into input processor context during durable preparation', async () => {
    let capturedAgentId: string | undefined;
    let sawAgent = false;

    const captureProcessor: Processor = {
      id: 'capture-agent',
      name: 'capture-agent',
      processInput: async ({ agent, messages }) => {
        sawAgent = !!agent;
        capturedAgentId = agent?.id;
        return messages;
      },
    };

    const baseAgent = new Agent({
      id: 'durable-ctx-agent',
      name: 'Durable Ctx Agent',
      instructions: 'You are a helpful assistant.',
      model: createTextModel('ok') as LanguageModelV2,
      inputProcessors: [captureProcessor as any],
    });

    await prepareForDurableExecution({
      agent: baseAgent,
      messages: 'Hello',
    });

    expect(sawAgent).toBe(true);
    expect(capturedAgentId).toBe('durable-ctx-agent');
  });
});
