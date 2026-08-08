/**
 * Durable agent tool-error recovery (#21054)
 *
 * When a tool's execute() throws (e.g. ENOENT / EACCES filesystem errors), the
 * durable agentic loop must feed the error back to the model as a tool error
 * and continue, so the model can see the failure and self-correct — not halt
 * the run.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

const enoentError = Object.assign(new Error("ENOENT: no such file or directory, open '/tmp/missing.txt'"), {
  code: 'ENOENT',
  path: '/tmp/missing.txt',
});

function createToolCallThenTextModel(finalText: string, prompts: unknown[]) {
  let callCount = 0;
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }: any) => {
      callCount++;
      prompts.push(prompt);
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: 'call-1',
              toolName: 'readFile',
              input: JSON.stringify({ path: '/tmp/missing.txt' }),
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
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
            usage: { inputTokens: 10, outputTokens: 9, totalTokens: 19 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
  return { model, getCallCount: () => callCount };
}

describe('DurableAgent tool-error recovery (#21054)', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('continues the loop after a tool throws and lets the model see the error', async () => {
    const prompts: unknown[] = [];
    const { model, getCallCount } = createToolCallThenTextModel('The file does not exist.', prompts);

    const readFile = createTool({
      id: 'readFile',
      description: 'Read a file from disk',
      inputSchema: z.object({ path: z.string() }),
      execute: async () => {
        throw enoentError;
      },
    });

    const baseAgent = new Agent({
      id: 'durable-tool-error-agent',
      name: 'Durable Tool Error Agent',
      instructions: 'You are a helpful assistant.',
      model: model as LanguageModelV2,
      tools: { readFile },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const out = await durableAgent.generate('Read /tmp/missing.txt', { maxSteps: 3 });

    // The run must not end in error — the loop continued and produced text.
    expect(out.error).toBeUndefined();
    expect(out.text).toBe('The file does not exist.');
    expect(getCallCount()).toBe(2);

    // The second model call must include the tool error so the model can recover.
    const secondPrompt = JSON.stringify(prompts[1] ?? []);
    expect(secondPrompt).toMatch(/ENOENT/);
  });
});
