import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { createDurableAgent } from '../../agent/durable/create-durable-agent';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { Processor } from '../index';
import { PromptCacheProcessor } from './prompt-cache';

function capturingModel(provider: string) {
  const prompts: LanguageModelV2Prompt[] = [];
  const model = new MockLanguageModelV2({
    provider,
    doGenerate: async ({ prompt }) => {
      prompts.push(prompt);
      return {
        content: [{ type: 'text', text: 'ok' }],
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 },
        rawCall: { rawPrompt: [], rawSettings: {} },
        warnings: [],
      };
    },
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'ok' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 } },
        ]),
        rawCall: { rawPrompt: [], rawSettings: {} },
        warnings: [],
      };
    },
  });
  return { model, prompts };
}

/** Adds a system message after the agent's instructions, the way Memory or skills do. */
const addsContext: Processor<'adds-context'> = {
  id: 'adds-context',
  processInputStep: async ({ messageList }) => {
    messageList.addSystem('Context from a processor.', 'context');
    return messageList;
  },
};

function marked(prompt: LanguageModelV2Prompt) {
  return prompt.flatMap((message, index) =>
    message.providerOptions ? [{ index, role: message.role, options: message.providerOptions }] : [],
  );
}

async function sendThrough(provider: string, processor: PromptCacheProcessor, mode: 'stream' | 'generate' = 'stream') {
  const { model, prompts } = capturingModel(provider);
  const agent = new Agent({
    id: 'cache-agent',
    name: 'cache-agent',
    instructions: 'You are a helpful assistant.',
    model,
    inputProcessors: [addsContext, processor],
  });
  if (mode === 'stream') {
    await (await agent.stream('hello')).consumeStream();
  } else {
    await agent.generate('hello');
  }
  return prompts[0]!;
}

describe('PromptCacheProcessor', () => {
  it.each(['stream', 'generate'] as const)(
    'marks the last system message and the last message for Anthropic (%s)',
    async mode => {
      const prompt = await sendThrough('anthropic.messages', new PromptCacheProcessor({ ttl: '1h' }), mode);
      const lastSystem = prompt.findLastIndex(message => message.role === 'system');

      expect(prompt[lastSystem]!.content).toBe('Context from a processor.');
      expect(marked(prompt)).toEqual([
        {
          index: lastSystem,
          role: 'system',
          options: { anthropic: { cacheControl: { type: 'ephemeral', ttl: '1h' } } },
        },
        {
          index: prompt.length - 1,
          role: 'user',
          options: { anthropic: { cacheControl: { type: 'ephemeral', ttl: '1h' } } },
        },
      ]);
    },
  );

  it('marks the prompt on the durable engine too', async () => {
    const { model, prompts } = capturingModel('anthropic.messages');
    const agent = new Agent({
      id: 'durable-cache-agent',
      name: 'durable-cache-agent',
      instructions: 'You are a helpful assistant.',
      model,
      inputProcessors: [addsContext, new PromptCacheProcessor()],
    });
    const pubsub = new EventEmitterPubSub();
    try {
      const { output, cleanup } = await createDurableAgent({ agent, pubsub }).stream('hello');
      await output.text;
      await cleanup();
    } finally {
      await pubsub.close();
    }

    const prompt = prompts[0]!;
    expect(marked(prompt).map(({ index, role }) => ({ index, role }))).toEqual([
      { index: prompt.findLastIndex(message => message.role === 'system'), role: 'system' },
      { index: prompt.length - 1, role: 'user' },
    ]);
  });

  it('uses Bedrock cache points for Bedrock models', async () => {
    const prompt = await sendThrough('amazon-bedrock', new PromptCacheProcessor({ ttl: '1h' }));

    expect(marked(prompt).map(({ role, options }) => ({ role, options }))).toEqual([
      { role: 'system', options: { bedrock: { cachePoint: { type: 'default' } } } },
      { role: 'user', options: { bedrock: { cachePoint: { type: 'default' } } } },
    ]);
  });

  it('leaves the prompt alone for other providers', async () => {
    const prompt = await sendThrough('openai.responses', new PromptCacheProcessor());

    expect(marked(prompt)).toEqual([]);
  });

  it('omits the TTL when none is set, so Anthropic uses its default', async () => {
    const prompt = await sendThrough('anthropic.messages', new PromptCacheProcessor());

    expect(marked(prompt).map(m => m.options)).toEqual([
      { anthropic: { cacheControl: { type: 'ephemeral' } } },
      { anthropic: { cacheControl: { type: 'ephemeral' } } },
    ]);
  });

  describe('with breakpoints the caller already set', () => {
    const processor = new PromptCacheProcessor();
    const mark = { anthropic: { cacheControl: { type: 'ephemeral' as const } } };
    const run = (prompt: LanguageModelV2Prompt) =>
      processor.processLLMRequest({
        prompt,
        model: { provider: 'anthropic.messages' } as never,
        apiProviderId: 'anthropic.messages',
      } as never)?.prompt ?? prompt;

    it('keeps a marked message as it is and keeps its other provider options', () => {
      const prompt: LanguageModelV2Prompt = [
        {
          role: 'system',
          content: 'a',
          providerOptions: { anthropic: { cacheControl: { type: 'ephemeral', ttl: '1h' } } },
        },
        { role: 'user', content: [{ type: 'text', text: 'hi' }], providerOptions: { anthropic: { other: true } } },
      ];

      expect(run(prompt)).toEqual([
        prompt[0],
        {
          ...prompt[1],
          providerOptions: { anthropic: { other: true, cacheControl: { type: 'ephemeral' } } },
        },
      ]);
    });

    it('never goes over four breakpoints, counting marks on parts', () => {
      const prompt: LanguageModelV2Prompt = [
        { role: 'system', content: 'a', providerOptions: mark },
        { role: 'system', content: 'b', providerOptions: mark },
        { role: 'user', content: [{ type: 'text', text: 'x', providerOptions: mark }] },
        { role: 'system', content: 'c' },
        { role: 'user', content: [{ type: 'text', text: 'y' }] },
      ];

      const result = run(prompt);

      // One slot left: the last message takes it, since it caches the system prompt as well.
      expect(result.filter(message => message.providerOptions)).toHaveLength(3);
      expect(result[4]!.providerOptions).toEqual(mark);
      expect(result[3]!.providerOptions).toBeUndefined();
    });

    // Anthropic rejects a request whose breakpoints go from a shorter TTL to a longer one.
    describe('keeps TTLs in the order Anthropic requires (longer first)', () => {
      const oneHour = { anthropic: { cacheControl: { type: 'ephemeral' as const, ttl: '1h' } } };
      const runWith = (ttl: '5m' | '1h' | undefined, prompt: LanguageModelV2Prompt) =>
        new PromptCacheProcessor({ ttl }).processLLMRequest({
          prompt,
          model: { provider: 'anthropic.messages' } as never,
          apiProviderId: 'anthropic.messages',
        } as never)?.prompt ?? prompt;

      it('shortens its own mark to 5m after a caller mark with the default TTL', () => {
        const prompt: LanguageModelV2Prompt = [
          { role: 'system', content: 'a', providerOptions: mark },
          { role: 'user', content: [{ type: 'text', text: 'hi' }] },
        ];

        expect(runWith('1h', prompt)[1]!.providerOptions).toEqual({
          anthropic: { cacheControl: { type: 'ephemeral', ttl: '5m' } },
        });
      });

      it('leaves out a default-TTL mark before a caller 1h mark', () => {
        const prompt: LanguageModelV2Prompt = [
          { role: 'system', content: 'a' },
          { role: 'user', content: [{ type: 'text', text: 'hi' }], providerOptions: oneHour },
        ];

        expect(runWith(undefined, prompt)).toBe(prompt);
      });

      it('reads caller TTLs on parts too', () => {
        const prompt: LanguageModelV2Prompt = [
          { role: 'system', content: 'a' },
          { role: 'user', content: [{ type: 'text', text: 'x', providerOptions: oneHour }] },
          { role: 'assistant', content: [{ type: 'text', text: 'y' }] },
        ];

        const result = runWith('5m', prompt);

        // The assistant mark comes after the 1h part, so 5m is fine there; the system one would come before it.
        expect(result[2]!.providerOptions).toEqual({
          anthropic: { cacheControl: { type: 'ephemeral', ttl: '5m' } },
        });
        expect(result[0]!.providerOptions).toBeUndefined();
      });

      // Anthropic sends the first run of system messages as the top-level system prompt, ahead of every message.
      it('checks order as Anthropic sends it, with the first system messages moved to the front', () => {
        const prompt: LanguageModelV2Prompt = [
          { role: 'user', content: [{ type: 'text', text: 'hi' }], providerOptions: oneHour },
          { role: 'system', content: 'added after the user message' },
        ];

        expect(runWith(undefined, prompt)).toBe(prompt);
        expect(runWith('1h', prompt)[1]!.providerOptions).toEqual(oneHour);
      });

      it('keeps later system messages where they are', () => {
        const prompt: LanguageModelV2Prompt = [
          { role: 'system', content: 'a' },
          { role: 'user', content: [{ type: 'text', text: 'x' }], providerOptions: mark },
          { role: 'system', content: 'b' },
          { role: 'user', content: [{ type: 'text', text: 'y' }] },
        ];

        // System b stays after the caller's 5m mark on x, so a 1h mark on it would be out of order.
        expect(runWith('1h', prompt)[2]!.providerOptions).toEqual({
          anthropic: { cacheControl: { type: 'ephemeral', ttl: '5m' } },
        });
      });

      it('marks both with 1h when the caller set none', () => {
        const prompt: LanguageModelV2Prompt = [
          { role: 'system', content: 'a' },
          { role: 'user', content: [{ type: 'text', text: 'hi' }] },
        ];

        expect(runWith('1h', prompt).map(m => m.providerOptions)).toEqual([oneHour, oneHour]);
      });
    });

    it("ignores another provider's marks, which that request never sends", () => {
      const bedrock = { bedrock: { cachePoint: { type: 'default' as const } } };
      const prompt: LanguageModelV2Prompt = [
        { role: 'system', content: 'a', providerOptions: bedrock },
        { role: 'system', content: 'b', providerOptions: bedrock },
        { role: 'system', content: 'c', providerOptions: bedrock },
        { role: 'user', content: [{ type: 'text', text: 'x', providerOptions: bedrock }] },
        { role: 'system', content: 'd' },
        { role: 'user', content: [{ type: 'text', text: 'y' }] },
      ];

      const result = run(prompt);

      expect(result[4]!.providerOptions).toEqual(mark);
      expect(result[5]!.providerOptions).toEqual(mark);
    });

    it('adds nothing when the caller already used all four', () => {
      const prompt: LanguageModelV2Prompt = [
        { role: 'system', content: 'a', providerOptions: mark },
        { role: 'system', content: 'b', providerOptions: mark },
        { role: 'system', content: 'c', providerOptions: mark },
        { role: 'user', content: [{ type: 'text', text: 'x' }], providerOptions: mark },
        { role: 'system', content: 'd' },
        { role: 'user', content: [{ type: 'text', text: 'y' }] },
      ];

      expect(run(prompt)).toBe(prompt);
    });
  });
});
