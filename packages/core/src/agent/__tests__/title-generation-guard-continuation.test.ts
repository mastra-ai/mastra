import type { LanguageModelV2, LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';
import { createDurableAgent } from '../durable/create-durable-agent';
import { createEventedAgent } from '../durable/create-evented-agent';

/**
 * Gemini 3 rejects a prompt that ends on a model turn, so TrailingAssistantGuard
 * appends a synthetic "Continue." user message to the run's MessageList. That
 * message is run context, not something the user said: it must not become the
 * thread title, and must not appear in the title prompt (#25541).
 */

function textStream(text: string) {
  return {
    stream: convertArrayToReadableStream([
      { type: 'stream-start' as const, warnings: [] },
      { type: 'text-start' as const, id: 'text-1' },
      { type: 'text-delta' as const, id: 'text-1', delta: text },
      { type: 'text-end' as const, id: 'text-1' },
      {
        type: 'finish' as const,
        finishReason: 'stop' as const,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      },
    ]),
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
  };
}

function setup() {
  const agentPrompts: LanguageModelV2Prompt[] = [];
  const titlePrompts: LanguageModelV2Prompt[] = [];

  const model = new MockLanguageModelV2({
    provider: 'google.generative-ai',
    modelId: 'gemini-3.5-flash-lite',
    doStream: async options => {
      agentPrompts.push(options.prompt);
      return textStream('Sure, here you go.');
    },
  });

  const titleResult = {
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop' as const,
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    content: [{ type: 'text' as const, text: 'Generated Title' }],
    warnings: [],
  };
  const titleModel = new MockLanguageModelV2({
    doGenerate: async options => {
      titlePrompts.push(options.prompt);
      return titleResult;
    },
    doStream: async options => {
      titlePrompts.push(options.prompt);
      return textStream('Generated Title');
    },
  });

  const memory = new MockMemory();
  memory.getMergedThreadConfig = () => ({ generateTitle: { model: titleModel as LanguageModelV2 } });

  const agent = new Agent({ id: 'title-guard', name: 'title-guard', instructions: 'x', model, memory });
  const genTitle = vi.spyOn(agent, 'genTitle');

  return { agent, memory, genTitle, agentPrompts, titlePrompts };
}

const titlePromptText = (prompt: LanguageModelV2Prompt) =>
  prompt
    .filter(m => m.role === 'user')
    .flatMap(m => (Array.isArray(m.content) ? m.content : []))
    .map(part => (part.type === 'text' ? part.text : ''))
    .join('\n');

describe.each(['plain', 'durable', 'evented'] as const)(
  '%s agent title generation with the trailing assistant guard',
  engine => {
    let pubsub: EventEmitterPubSub;

    beforeEach(() => {
      pubsub = new EventEmitterPubSub();
    });

    afterEach(async () => {
      await pubsub.close();
    });

    async function run(agent: Agent, messages: Array<{ role: 'user' | 'assistant'; content: string }>, thread: string) {
      const memory = { thread, resource: 'resource-title-guard' };
      if (engine === 'plain') {
        const result = await agent.stream(messages, { memory });
        await result.consumeStream();
        return;
      }
      const wrapped =
        engine === 'durable' ? createDurableAgent({ agent, pubsub }) : createEventedAgent({ agent, pubsub });
      const result = await wrapped.stream(messages, { memory });
      for await (const _chunk of result.fullStream as AsyncIterable<unknown>) {
        // drain
      }
      result.cleanup();
    }

    it('does not title an assistant-only thread from the synthetic continuation', async () => {
      const { agent, memory, genTitle, agentPrompts } = setup();

      await run(agent, [{ role: 'assistant', content: 'Hi! How can I help you today?' }], 'thread-greeting');

      // The guard did fire: the model saw a trailing synthetic user turn.
      expect(JSON.stringify(agentPrompts[0])).toContain('Continue.');
      // Let any fire-and-forget title work settle before asserting it never happened.
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(genTitle).not.toHaveBeenCalled();
      expect((await memory.getThreadById({ threadId: 'thread-greeting' }))?.title).not.toBe('Generated Title');
    });

    it('keeps the synthetic continuation out of the title prompt', async () => {
      const { agent, memory, titlePrompts, agentPrompts } = setup();

      await run(
        agent,
        [
          { role: 'user', content: 'Plan a weekend in Lisbon' },
          { role: 'assistant', content: 'Day one:' },
        ],
        'thread-prefill',
      );

      expect(JSON.stringify(agentPrompts[0])).toContain('Continue.');
      await vi.waitFor(async () => {
        expect((await memory.getThreadById({ threadId: 'thread-prefill' }))?.title).toBe('Generated Title');
      });
      expect(titlePrompts).toHaveLength(1);
      const text = titlePromptText(titlePrompts[0]!);
      expect(text).toContain('Plan a weekend in Lisbon');
      expect(text).not.toContain('Continue.');
    });
  },
);
