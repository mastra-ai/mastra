import { describe, expect, it } from 'vitest';
import { addBedrockCachePoints, supportsBedrockPromptCaching } from '../amazon-bedrock-gateway.js';

describe('supportsBedrockPromptCaching', () => {
  it.each([
    'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    'eu.anthropic.claude-3-7-sonnet-20250219-v1:0',
    'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    'us.anthropic.claude-opus-4-6-v1',
  ])('enables caching for %s', modelId => {
    expect(supportsBedrockPromptCaching(modelId)).toBe(true);
  });

  it('leaves unsupported models unchanged', () => {
    expect(supportsBedrockPromptCaching('meta.llama3-70b-instruct-v1:0')).toBe(false);
  });
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
