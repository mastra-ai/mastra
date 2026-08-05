import { describe, expect, it, vi } from 'vitest';
import { addBedrockCachePoints, supportsBedrockPromptCaching, withBedrockCache } from '../amazon-bedrock-gateway.js';

describe('supportsBedrockPromptCaching', () => {
  it.each([
    'us.anthropic.claude-3-5-haiku-20241022-v1:0',
    'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    'eu.anthropic.claude-3-7-sonnet-20250219-v1:0',
    'global.anthropic.claude-fable-5',
    'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    'global.anthropic.claude-sonnet-5',
    'us.anthropic.claude-opus-4-8',
  ])('enables caching for %s', modelId => {
    expect(supportsBedrockPromptCaching(modelId)).toBe(true);
  });

  it.each(['anthropic.claude-3-haiku-20240307-v1:0', 'amazon.nova-lite-v1:0', 'meta.llama3-70b-instruct-v1:0'])(
    'leaves unsupported model %s unchanged',
    modelId => {
      expect(supportsBedrockPromptCaching(modelId)).toBe(false);
    },
  );
});

describe('addBedrockCachePoints', () => {
  it('marks the last system message and most recent message as cache points', () => {
    const prompt = addBedrockCachePoints([
      { role: 'system', content: 'first system prompt' },
      { role: 'system', content: 'latest system prompt' },
      { role: 'user', content: [{ type: 'text', text: 'first message' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'response' }] },
      { role: 'user', content: [{ type: 'text', text: 'latest message' }] },
    ]);

    expect(prompt[0]!.providerOptions?.bedrock).toBeUndefined();
    expect(prompt[1]!.providerOptions?.bedrock).toEqual({ cachePoint: { type: 'default' } });
    expect(prompt[2]!.providerOptions?.bedrock).toBeUndefined();
    expect(prompt[3]!.providerOptions?.bedrock).toBeUndefined();
    expect(prompt[4]!.providerOptions?.bedrock).toEqual({ cachePoint: { type: 'default' } });
  });

  it('marks only the last message when there is no system message', () => {
    const prompt = addBedrockCachePoints([
      { role: 'user', content: [{ type: 'text', text: 'first message' }] },
      { role: 'user', content: [{ type: 'text', text: 'latest message' }] },
    ]);

    expect(prompt[0]!.providerOptions?.bedrock).toBeUndefined();
    expect(prompt[1]!.providerOptions?.bedrock).toEqual({ cachePoint: { type: 'default' } });
  });

  it('marks the latest non-system message when a system message is last', () => {
    const prompt = addBedrockCachePoints([
      { role: 'user', content: [{ type: 'text', text: 'latest message' }] },
      { role: 'system', content: 'system prompt' },
    ]);

    expect(prompt[0]!.providerOptions?.bedrock).toEqual({ cachePoint: { type: 'default' } });
    expect(prompt[1]!.providerOptions?.bedrock).toEqual({ cachePoint: { type: 'default' } });
  });

  it('preserves existing Bedrock and unrelated provider options', () => {
    const prompt = addBedrockCachePoints([
      {
        role: 'user',
        content: [{ type: 'text', text: 'latest message' }],
        providerOptions: {
          bedrock: { guardrailConfig: { guardrailIdentifier: 'guardrail-id', guardrailVersion: '1' } },
          openai: { store: false },
        },
      },
    ]);

    expect(prompt[0]!.providerOptions).toEqual({
      bedrock: {
        guardrailConfig: { guardrailIdentifier: 'guardrail-id', guardrailVersion: '1' },
        cachePoint: { type: 'default' },
      },
      openai: { store: false },
    });
  });
});

describe('withBedrockCache', () => {
  const prompt = [
    { role: 'system' as const, content: 'system prompt' },
    { role: 'user' as const, content: [{ type: 'text' as const, text: 'latest message' }] },
  ];

  const expectedPrompt = [
    {
      ...prompt[0],
      providerOptions: { bedrock: { cachePoint: { type: 'default' } } },
    },
    {
      ...prompt[1],
      providerOptions: { bedrock: { cachePoint: { type: 'default' } } },
    },
  ];

  it('adds cache points before doGenerate', async () => {
    const doGenerate = vi.fn().mockResolvedValue({});
    const model = withBedrockCache({ doGenerate } as unknown as Parameters<typeof withBedrockCache>[0]);

    await model.doGenerate({ prompt } as Parameters<typeof model.doGenerate>[0]);

    expect(doGenerate).toHaveBeenCalledWith({ prompt: expectedPrompt });
  });

  it('adds cache points before doStream', async () => {
    const doStream = vi.fn().mockResolvedValue({});
    const model = withBedrockCache({ doStream } as unknown as Parameters<typeof withBedrockCache>[0]);

    await model.doStream({ prompt } as Parameters<typeof model.doStream>[0]);

    expect(doStream).toHaveBeenCalledWith({ prompt: expectedPrompt });
  });
});
