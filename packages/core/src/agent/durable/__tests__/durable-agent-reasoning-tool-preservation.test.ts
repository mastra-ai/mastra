/**
 * Regression test for #19365:
 *
 * DurableAgent crashes on the second turn when using OpenAI reasoning models
 * (e.g. gpt-5-mini) with tools because reasoning parts — including the
 * empty-reasoning-with-itemId marker — are discarded when the assistant
 * message is reconstructed inside the durable llm-execution step.
 *
 * When the model emits a `reasoning-start` with `providerMetadata.openai.itemId`
 * followed by a `tool-call` (with its own `providerMetadata.openai.itemId`), the
 * regular Agent path preserves both via `buildMessagesFromChunks`. The durable
 * path only preserves the tool-call, so the next request to OpenAI contains a
 * `function_call` referencing a reasoning item that was never sent, producing:
 *
 *   Item 'fc_...' of type 'function_call' was provided without its
 *   required 'reasoning' item: 'rs_...'
 *
 * These tests drive a full durable stream through a two-turn tool cycle and
 * inspect the AI SDK prompt seen on turn 2 to prove the reasoning part
 * (and its itemId) are preserved before the follow-up call.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

const REASONING_ITEM_ID = 'rs_test_19365_reasoning';
const TOOL_CALL_ITEM_ID = 'fc_test_19365_toolcall';

/**
 * Extract all assistant-message content parts from an AI SDK prompt captured
 * inside a mock model's `doStream`. Used to assert what the durable step
 * actually replays back to the model on the next turn.
 */
function assistantPartsFromPrompt(prompt: unknown): Array<Record<string, any>> {
  const messages = prompt as Array<{ role: string; content: any }>;
  return messages
    .filter(m => m.role === 'assistant')
    .flatMap(m => (Array.isArray(m.content) ? (m.content as Array<Record<string, any>>) : []));
}

/**
 * Two-turn model that mimics an OpenAI reasoning model:
 *  - turn 1: empty reasoning span carrying openai.itemId, followed by a tool-call
 *  - turn 2: plain text response
 */
function createReasoningThenToolModel(finalText: string, prompts: unknown[]) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async (options: any) => {
      prompts.push(options.prompt);
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'gpt-5-mini', timestamp: new Date(0) },
            {
              type: 'reasoning-start',
              id: 'reasoning-1',
              providerMetadata: {
                openai: {
                  itemId: REASONING_ITEM_ID,
                  reasoningEncryptedContent: null,
                },
              },
            },
            { type: 'reasoning-end', id: 'reasoning-1' },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'echo',
              input: JSON.stringify({ text: 'hello' }),
              providerExecuted: false,
              providerMetadata: {
                openai: {
                  itemId: TOOL_CALL_ITEM_ID,
                },
              },
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-1', modelId: 'gpt-5-mini', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: finalText },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 20, outputTokens: 15, totalTokens: 35 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

describe('DurableAgent — reasoning + tool call preservation (#19365)', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('preserves an empty reasoning part with openai.itemId when a tool-call follows in the same step', async () => {
    const prompts: unknown[] = [];
    const model = createReasoningThenToolModel('done', prompts);

    const echoTool = createTool({
      id: 'echo',
      description: 'Echo the input',
      inputSchema: z.object({ text: z.string() }),
      outputSchema: z.object({ echoed: z.string() }),
      execute: async ({ text }) => ({ echoed: text }),
    });

    const baseAgent = new Agent({
      id: 'durable-reasoning-tool-agent',
      name: 'Durable Reasoning Tool Agent',
      instructions: 'Use the echo tool.',
      model: model as LanguageModelV2,
      tools: { echo: echoTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const { output, cleanup } = await durableAgent.stream('Echo hello.', { maxSteps: 4 });
    await output.consumeStream();

    // Two model calls: reasoning+tool-call, then final text.
    expect(prompts).toHaveLength(2);

    // The second prompt is what actually gets sent back to OpenAI on turn 2.
    // The reasoning part (with its itemId) MUST appear before the tool-call
    // or OpenAI rejects the request with the "required 'reasoning' item" error.
    const assistantParts = assistantPartsFromPrompt(prompts[1]);
    expect(assistantParts.length).toBeGreaterThan(0);

    const reasoningParts = assistantParts.filter(p => p.type === 'reasoning');
    const toolCallParts = assistantParts.filter(p => p.type === 'tool-call');

    expect(reasoningParts.length).toBeGreaterThan(0);
    expect(reasoningParts[0]?.providerOptions?.openai?.itemId).toBe(REASONING_ITEM_ID);

    expect(toolCallParts.length).toBeGreaterThan(0);
    expect(toolCallParts[0]?.providerOptions?.openai?.itemId).toBe(TOOL_CALL_ITEM_ID);

    // Reasoning must precede the tool-call within the assistant turn.
    const reasoningIndex = assistantParts.findIndex(p => p.type === 'reasoning');
    const toolCallIndex = assistantParts.findIndex(p => p.type === 'tool-call');
    expect(reasoningIndex).toBeGreaterThanOrEqual(0);
    expect(toolCallIndex).toBeGreaterThan(reasoningIndex);

    cleanup();
  });

  it('preserves reasoning text content and ordering when reasoning precedes a tool-call in the same step', async () => {
    const prompts: unknown[] = [];
    let callCount = 0;
    const model = new MockLanguageModelV2({
      doStream: async (options: any) => {
        prompts.push(options.prompt);
        callCount++;
        if (callCount === 1) {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'gpt-5-mini', timestamp: new Date(0) },
              {
                type: 'reasoning-start',
                id: 'reasoning-1',
                providerMetadata: {
                  openai: { itemId: 'rs_test_second_case', reasoningEncryptedContent: null },
                },
              },
              { type: 'reasoning-delta', id: 'reasoning-1', delta: 'Thinking about the answer' },
              { type: 'reasoning-delta', id: 'reasoning-1', delta: ' step by step.' },
              { type: 'reasoning-end', id: 'reasoning-1' },
              {
                type: 'tool-call',
                toolCallId: 'call-2',
                toolName: 'echo',
                input: JSON.stringify({ text: 'hi' }),
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        }
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'gpt-5-mini', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-2' },
            { type: 'text-delta', id: 'text-2', delta: 'done' },
            { type: 'text-end', id: 'text-2' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 15, outputTokens: 5, totalTokens: 20 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });

    const echoTool = createTool({
      id: 'echo',
      description: 'Echo the input',
      inputSchema: z.object({ text: z.string() }),
      outputSchema: z.object({ echoed: z.string() }),
      execute: async ({ text }) => ({ echoed: text }),
    });

    const baseAgent = new Agent({
      id: 'durable-reasoning-text-agent',
      name: 'Durable Reasoning Text Agent',
      instructions: 'Think, then use the echo tool.',
      model: model as LanguageModelV2,
      tools: { echo: echoTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const { output, cleanup } = await durableAgent.stream('Echo hi.', { maxSteps: 4 });
    await output.consumeStream();

    expect(prompts).toHaveLength(2);

    // Inspect the second-turn prompt — the reasoning content and ordering
    // (reasoning before tool-call) must be preserved from turn 1.
    const assistantParts = assistantPartsFromPrompt(prompts[1]);

    const reasoningParts = assistantParts.filter(p => p.type === 'reasoning');
    const toolCallParts = assistantParts.filter(p => p.type === 'tool-call');

    expect(reasoningParts.length).toBeGreaterThan(0);
    expect(reasoningParts[0]?.text ?? reasoningParts[0]?.reasoning).toContain('Thinking about the answer');
    expect(reasoningParts[0]?.providerOptions?.openai?.itemId).toBe('rs_test_second_case');

    expect(toolCallParts.length).toBeGreaterThan(0);

    const reasoningIndex = assistantParts.findIndex(p => p.type === 'reasoning');
    const toolCallIndex = assistantParts.findIndex(p => p.type === 'tool-call');
    expect(toolCallIndex).toBeGreaterThan(reasoningIndex);

    cleanup();
  });
});
