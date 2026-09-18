/**
 * Repro for https://github.com/mastra-ai/mastra/issues/22618 — DurableAgent path.
 *
 * A tool's `toModelOutput` returns a LanguageModelV3 `image-url` content part
 * (with `providerOptions`). The V3 spec supports `image-url` in tool-result
 * content directly, so a v3 model should receive it untouched.
 *
 * Regression: normalizeModelOutput
 * (agent/durable/workflows/steps/normalize-model-output.ts) used to rewrite
 * it into a V2-style `media` part, stuffing the URL into the Base64-only
 * `data` field and dropping `providerOptions`. The v5→v6 prompt conversion
 * then turned that into `image-data` with the URL still in the Base64-only
 * field.
 */

import {
  convertArrayToReadableStream as convertArrayToReadableStreamV3,
  MockLanguageModelV3,
} from '@internal/ai-v6/test';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

const IMAGE_URL = 'https://example.com/radar.png';
const PROVIDER_OPTIONS = { repro: { traceId: 'preserve-me' } };

const usageV3 = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

function createImageToolCallingModel(onPrompt: (prompt: unknown) => void) {
  let callCount = 0;
  return new MockLanguageModelV3({
    doStream: async ({ prompt }) => {
      onPrompt(prompt);
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStreamV3([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'image-call',
              toolName: 'image_output',
              input: '{}',
            },
            {
              type: 'finish',
              finishReason: { unified: 'tool-calls', raw: undefined },
              usage: usageV3,
            },
          ]),
        };
      }
      return {
        stream: convertArrayToReadableStreamV3([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'resp-2', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'done' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: undefined },
            usage: usageV3,
          },
        ]),
      };
    },
  });
}

function createImageTool() {
  return createTool({
    id: 'image_output',
    description: 'Return an image URL for the next model step.',
    inputSchema: z.object({}),
    outputSchema: z.object({ ok: z.boolean() }),
    execute: async () => ({ ok: true }),
    toModelOutput: () => ({
      type: 'content',
      value: [
        { type: 'text', text: 'radar image' },
        { type: 'image-url', url: IMAGE_URL, providerOptions: PROVIDER_OPTIONS },
      ],
    }),
  });
}

describe('DurableAgent toModelOutput image-url passthrough (issue #22618)', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends the image-url part untouched to a v3 model on the follow-up step', async () => {
    const prompts: any[] = [];
    const model = createImageToolCallingModel(prompt => prompts.push(prompt));

    const baseAgent = new Agent({
      id: 'durable-image-url-repro-agent',
      name: 'Durable image URL repro',
      instructions: 'Call image_output once, then answer done.',
      model,
      tools: { image_output: createImageTool() },
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    new Mastra({
      agents: { 'durable-image-url-repro-agent': durableAgent as any },
      storage: new InMemoryStore(),
    });

    const result = await durableAgent.stream('Run the image tool');
    for await (const _chunk of result.fullStream) {
      // drain
    }

    expect(prompts).toHaveLength(2);

    const toolMessages = prompts[1].filter((m: any) => m.role === 'tool');
    expect(toolMessages).toHaveLength(1);
    const toolResult = toolMessages[0].content.find((p: any) => p.type === 'tool-result');
    expect(toolResult).toBeDefined();
    expect(toolResult.output.type).toBe('content');

    // LanguageModelV3 tool-result content supports image-url directly.
    // Currently fails: the part arrives as { type: 'image-data', data: <url>,
    // mediaType: 'image/jpeg' } — the URL in the Base64-only data field — and
    // providerOptions are gone.
    expect(toolResult.output.value).toEqual([
      { type: 'text', text: 'radar image' },
      { type: 'image-url', url: IMAGE_URL, providerOptions: PROVIDER_OPTIONS },
    ]);

    // The durable step is a separately maintained copy of the loop step, so the
    // provider-boundary strip in `llm-execution.ts` needs its own guard here. Mastra's
    // internal `modelOutput` provenance marker must not be forwarded to the provider.
    expect(JSON.stringify(prompts[1])).not.toContain('modelOutput');
  });
});
