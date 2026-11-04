import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { MockMemory } from '../../memory/mock';
import type { InputProcessor } from '../../processors';
import { Agent } from '../agent';
import { createDurableAgent } from '../durable/create-durable-agent';

/**
 * Bedrock and Gemini reject conversations whose first non-system turn is the
 * assistant's, so the agent loops insert a placeholder user turn for them after
 * `processLLMRequest`. Every other provider gets the history as-is.
 *
 * @see https://github.com/mastra-ai/mastra/issues/22874
 */
function createModel(provider: string, modelId: string) {
  const prompts: LanguageModelV2Prompt[] = [];
  const model = new MockLanguageModelV2({
    provider,
    modelId,
    doStream: async options => {
      prompts.push(options.prompt);
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'text-start' as const, id: 'text-1' },
          { type: 'text-delta' as const, id: 'text-1', delta: '4' },
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
    },
  });
  return { model, prompts };
}

function createPromptSpy() {
  const seen: LanguageModelV2Prompt[] = [];
  const processor: InputProcessor = {
    id: 'prompt-spy',
    processLLMRequest: ({ prompt }) => {
      seen.push(prompt);
    },
  };
  return { processor, seen };
}

const greetingFirst = [
  { role: 'assistant' as const, content: 'Hi! How can I help?' },
  { role: 'user' as const, content: 'What is 2+2?' },
];

const turns = (prompt: LanguageModelV2Prompt) =>
  prompt
    .filter(message => message.role !== 'system')
    .map(message => {
      const text = Array.isArray(message.content)
        ? message.content.map(part => ('text' in part ? part.text : '')).join('')
        : message.content;
      return [message.role, text];
    });

const placeholderFirst = [
  ['user', '.'],
  ['assistant', 'Hi! How can I help?'],
  ['user', 'What is 2+2?'],
];
const unchanged = [
  ['assistant', 'Hi! How can I help?'],
  ['user', 'What is 2+2?'],
];

const providers = [
  { name: 'Bedrock', provider: 'amazon-bedrock', modelId: 'amazon.nova-lite-v1:0', expected: placeholderFirst },
  { name: 'Gemini', provider: 'google.generative-ai', modelId: 'gemini-2.5-flash', expected: placeholderFirst },
  { name: 'OpenAI', provider: 'openai.responses', modelId: 'gpt-4o-mini', expected: unchanged },
  { name: 'Groq', provider: 'groq.chat', modelId: 'openai/gpt-oss-20b', expected: unchanged },
];

describe('leading assistant turn', () => {
  it.each(providers)('agent loop sends the expected first turn to $name', async ({ provider, modelId, expected }) => {
    const { model, prompts } = createModel(provider, modelId);
    const spy = createPromptSpy();
    const memory = new MockMemory();
    const agent = new Agent({
      id: 'greeter',
      name: 'greeter',
      instructions: 'Be terse.',
      model,
      memory,
      inputProcessors: [spy.processor],
    });

    const result = await agent.stream(greetingFirst, { memory: { thread: 'thread-1', resource: 'resource-1' } });
    await result.consumeStream();

    expect(turns(prompts[0]!)).toEqual(expected);
    // Request processors see the real history, never the placeholder.
    expect(turns(spy.seen[0]!)).toEqual(unchanged);

    const { messages } = await memory.recall({ threadId: 'thread-1', resourceId: 'resource-1' });
    expect(messages.map(message => message.role)).toEqual(['assistant', 'user', 'assistant']);
  });

  describe('durable agent', () => {
    let pubsub: EventEmitterPubSub;

    beforeEach(() => {
      pubsub = new EventEmitterPubSub();
    });

    afterEach(async () => {
      await pubsub.close();
    });

    it.each(providers)('sends the expected first turn to $name', async ({ provider, modelId, expected }) => {
      const { model, prompts } = createModel(provider, modelId);
      const spy = createPromptSpy();
      const durableAgent = createDurableAgent({
        agent: new Agent({
          id: 'durable-greeter',
          name: 'durable-greeter',
          instructions: 'Be terse.',
          model,
          inputProcessors: [spy.processor],
        }),
        pubsub,
      });

      const result = await durableAgent.stream(greetingFirst);
      for await (const _chunk of result.fullStream as AsyncIterable<unknown>) {
        // drain
      }

      expect(turns(prompts[0]!)).toEqual(expected);
      expect(turns(spy.seen[0]!)).toEqual(unchanged);
    });
  });
});
