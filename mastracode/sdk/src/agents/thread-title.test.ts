import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateTextMock = vi.hoisted(() => vi.fn());
const resolveModelMock = vi.hoisted(() =>
  vi.fn(() => ({ __model: 'resolved', specificationVersion: 'v3', doGenerate: vi.fn() })),
);
const computeProviderAccessMock = vi.hoisted(() => vi.fn());
const reloadAuthStorageMock = vi.hoisted(() => vi.fn());

vi.mock('ai', () => ({
  generateText: generateTextMock,
}));

vi.mock('./model.js', () => ({
  resolveModel: resolveModelMock,
}));

vi.mock('./mastracode-gateway.js', () => ({
  getAuthStorage: () => ({ get: () => undefined }),
  MastraCodeGateway: { getMastraGatewayApiKey: () => undefined },
  reloadAuthStorage: reloadAuthStorageMock,
}));

vi.mock('../onboarding/provider-access.js', () => ({
  computeProviderAccess: computeProviderAccessMock,
}));

import { generateThreadTitle, resolveDefaultThreadTitleModel } from './thread-title.js';

const NO_ACCESS = {
  anthropic: false,
  openai: false,
  cerebras: false,
  google: false,
  deepseek: false,
  'github-copilot': false,
};

beforeEach(() => {
  vi.clearAllMocks();
  generateTextMock.mockResolvedValue({ text: 'Auth bug fix' });
  computeProviderAccessMock.mockReturnValue({ ...NO_ACCESS, anthropic: 'apikey' });
});

describe('resolveDefaultThreadTitleModel', () => {
  it('reuses the OM cheap-model pack for the best reachable provider', () => {
    expect(resolveDefaultThreadTitleModel()).toBe('anthropic/claude-haiku-4-5');
  });

  it('falls through to OpenAI when only OpenAI is reachable', () => {
    computeProviderAccessMock.mockReturnValue({ ...NO_ACCESS, openai: 'oauth' });
    expect(resolveDefaultThreadTitleModel()).toBe('openai/gpt-5.4-mini');
  });

  it('returns undefined when no provider is reachable', () => {
    computeProviderAccessMock.mockReturnValue(NO_ACCESS);
    expect(resolveDefaultThreadTitleModel()).toBeUndefined();
  });
});

describe('generateThreadTitle', () => {
  it('generates with the default model for the first credentialed provider', async () => {
    const title = await generateThreadTitle({ prompt: 'Fix the login redirect loop' });

    expect(title).toBe('Auth bug fix');
    expect(resolveModelMock).toHaveBeenCalledWith('anthropic/claude-haiku-4-5', {});
  });

  it('uses the explicit model and thinking level when given', async () => {
    await generateThreadTitle({
      prompt: 'Fix the login redirect loop',
      model: 'google/gemini-2.5-flash',
      thinkingLevel: 'off',
    });

    expect(resolveModelMock).toHaveBeenCalledWith('google/gemini-2.5-flash', { thinkingLevel: 'off' });
  });

  it('forwards the request context so deployed tenants resolve their own credentials', async () => {
    const requestContext = { get: vi.fn() };

    await generateThreadTitle({ prompt: 'hello', model: 'openai/gpt-5.4-mini', requestContext });

    expect(resolveModelMock).toHaveBeenCalledWith('openai/gpt-5.4-mini', expect.objectContaining({ requestContext }));
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

  it('returns undefined when no provider is reachable', async () => {
    computeProviderAccessMock.mockReturnValue(NO_ACCESS);
    expect(await generateThreadTitle({ prompt: 'hello' })).toBeUndefined();
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
    await expect(generateThreadTitle({ prompt: 'hello', model: 'openai/gpt-5.4-mini' })).rejects.toThrow(
      'cannot generate thread titles',
    );
  });
});
