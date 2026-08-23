import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateTextMock = vi.hoisted(() => vi.fn());
const resolveModelMock = vi.hoisted(() =>
  vi.fn(() => ({ __model: 'resolved', specificationVersion: 'v3', doGenerate: vi.fn() })),
);
const getAnthropicApiKeyMock = vi.hoisted(() => vi.fn<() => string | undefined>());
const getOpenAIApiKeyMock = vi.hoisted(() => vi.fn<() => string | undefined>());
const reloadAuthStorageMock = vi.hoisted(() => vi.fn());

vi.mock('ai', () => ({
  generateText: generateTextMock,
}));

vi.mock('./model.js', () => ({
  resolveModel: resolveModelMock,
}));

vi.mock('./mastracode-gateway.js', () => ({
  getAnthropicApiKey: () => getAnthropicApiKeyMock(),
  getOpenAIApiKey: () => getOpenAIApiKeyMock(),
  reloadAuthStorage: reloadAuthStorageMock,
}));

import { generateThreadTitle, resolveDefaultThreadTitleModel } from './thread-title.js';

beforeEach(() => {
  vi.clearAllMocks();
  generateTextMock.mockResolvedValue({ text: 'Auth bug fix' });
});

describe('resolveDefaultThreadTitleModel', () => {
  it('prefers Anthropic Haiku when an Anthropic key resolves', () => {
    getAnthropicApiKeyMock.mockReturnValue('sk-ant');
    expect(resolveDefaultThreadTitleModel()).toEqual({ modelId: 'anthropic/claude-haiku-4-5' });
  });

  it('falls back to OpenAI Luna at low thinking when only OpenAI credentials resolve', () => {
    getAnthropicApiKeyMock.mockReturnValue(undefined);
    getOpenAIApiKeyMock.mockReturnValue('sk-oai');
    expect(resolveDefaultThreadTitleModel()).toEqual({ modelId: 'openai/gpt-5.6-luna', thinkingLevel: 'low' });
  });

  it('returns undefined when no provider has credentials', () => {
    getAnthropicApiKeyMock.mockReturnValue(undefined);
    getOpenAIApiKeyMock.mockReturnValue(undefined);
    expect(resolveDefaultThreadTitleModel()).toBeUndefined();
  });
});

describe('generateThreadTitle', () => {
  it('generates with the default model for the first credentialed provider', async () => {
    getAnthropicApiKeyMock.mockReturnValue(undefined);
    getOpenAIApiKeyMock.mockReturnValue('sk-oai');

    const title = await generateThreadTitle({ prompt: 'Fix the login redirect loop' });

    expect(title).toBe('Auth bug fix');
    expect(resolveModelMock).toHaveBeenCalledWith('openai/gpt-5.6-luna', { thinkingLevel: 'low' });
  });

  it('uses the explicit model and thinking level when given', async () => {
    getAnthropicApiKeyMock.mockReturnValue('sk-ant');

    await generateThreadTitle({
      prompt: 'Fix the login redirect loop',
      model: 'google/gemini-2.5-flash',
      thinkingLevel: 'off',
    });

    expect(resolveModelMock).toHaveBeenCalledWith('google/gemini-2.5-flash', { thinkingLevel: 'off' });
  });

  it('truncates the prompt sent to the model', async () => {
    await generateThreadTitle({ prompt: 'a'.repeat(5000), maxPromptChars: 100 });
    expect(generateTextMock.mock.calls[0][0].prompt).toHaveLength(100);
  });

  it('sanitizes quoted, prefixed, and multi-line output', async () => {
    generateTextMock.mockResolvedValue({ text: '"Title: Deployment pipeline setup"\nI hope this helps!' });
    expect(await generateThreadTitle({ prompt: 'set up deployments' })).toBe('Deployment pipeline setup');
  });

  it('caps long titles at a word boundary', async () => {
    generateTextMock.mockResolvedValue({ text: 'word '.repeat(40) });
    const title = await generateThreadTitle({ prompt: 'long output' });
    expect(title!.length).toBeLessThanOrEqual(80);
    expect(title!.endsWith('word')).toBe(true);
  });

  it('returns undefined for a blank prompt without calling the model', async () => {
    expect(await generateThreadTitle({ prompt: '   ' })).toBeUndefined();
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it('returns undefined when the model output has no usable line', async () => {
    generateTextMock.mockResolvedValue({ text: '\n \n' });
    expect(await generateThreadTitle({ prompt: 'hello' })).toBeUndefined();
  });

  it('propagates provider failures to the caller', async () => {
    generateTextMock.mockRejectedValue(new Error('provider down'));
    await expect(generateThreadTitle({ prompt: 'hello' })).rejects.toThrow('provider down');
  });

  it('fails loud when the resolved model does not speak an AI SDK v2/v3 interface', async () => {
    resolveModelMock.mockReturnValueOnce({ specificationVersion: 'v4' });
    await expect(generateThreadTitle({ prompt: 'hello' })).rejects.toThrow('cannot generate thread titles');
  });
});
