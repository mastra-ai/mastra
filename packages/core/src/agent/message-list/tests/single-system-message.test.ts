import { describe, expect, it } from 'vitest';
import { MessageList } from '../index';
import { normalizeSystemMessagesForProvider } from '../utils/provider-compat';

// https://github.com/mastra-ai/mastra/issues/25435
describe('single leading system message for OpenAI-compatible providers', () => {
  const build = () => {
    const list = new MessageList();
    list.addSystem('a');
    list.addSystem('b', 'tag');
    list.add({ role: 'user', content: 'hi' }, 'input');
    list.add({ role: 'assistant', content: 'hello' }, 'response');
    list.add({ role: 'user', content: 'again' }, 'input');
    return list;
  };

  it('merges system buckets into one index-0 message', async () => {
    const prompt = await build().get.all.aiV5.llmPrompt({ targetProvider: 'openai-compatible.chat' });
    expect(prompt[0]).toMatchObject({ role: 'system', content: 'a\n\nb' });
    expect(prompt.filter(m => m.role === 'system')).toHaveLength(1);
  });

  it('leaves Anthropic prompts unchanged', async () => {
    const prompt = await build().get.all.aiV5.llmPrompt({ targetProvider: 'anthropic.messages' });
    expect(prompt.filter(m => m.role === 'system')).toHaveLength(2);
  });

  it.each(['openai', 'openai.responses', 'openai.chat', 'azure.chat'])(
    'leaves %s prompts unchanged',
    async targetProvider => {
      const prompt = await build().get.all.aiV5.llmPrompt({ targetProvider });
      expect(prompt.filter(m => m.role === 'system')).toHaveLength(2);
    },
  );

  it('still normalizes the openai-compatible fallback id', async () => {
    const prompt = await build().get.all.aiV5.llmPrompt({ targetProvider: 'openai-compatible' });
    expect(prompt.filter(m => m.role === 'system')).toHaveLength(1);
  });

  it('keeps the last providerOptions when merging', () => {
    const cache = { openrouter: { cacheControl: { type: 'ephemeral' } } };
    const out = normalizeSystemMessagesForProvider(
      [
        { role: 'system', content: 'a', providerOptions: { x: { y: 1 } } },
        { role: 'system', content: 'b', providerOptions: cache },
        { role: 'system', content: 'c' },
        { role: 'user', content: 'u' },
      ],
      'openrouter.chat',
    );
    expect(out[0]).toEqual({ role: 'system', content: 'a\n\nb\n\nc', providerOptions: cache });
  });

  it('demotes mid-conversation system messages to user reminders', () => {
    const out = normalizeSystemMessagesForProvider(
      [
        { role: 'system', content: 'a' },
        { role: 'user', content: 'u' },
        { role: 'system', content: 'late', providerOptions: { x: { y: 1 } } },
      ],
      'vllm.chat',
    );
    expect(out).toEqual([
      { role: 'system', content: 'a' },
      { role: 'user', content: 'u' },
      { role: 'user', content: '<system-reminder>late</system-reminder>', providerOptions: { x: { y: 1 } } },
    ]);
  });

  it('is a no-op with a single system message or unknown provider', () => {
    const msgs = [
      { role: 'system' as const, content: 'a' },
      { role: 'user' as const, content: 'u' },
    ];
    expect(normalizeSystemMessagesForProvider(msgs, 'vllm.chat')).toBe(msgs);
    expect(normalizeSystemMessagesForProvider([...msgs, msgs[0]!], undefined)).toHaveLength(3);
  });
});
