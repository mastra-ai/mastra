import { describe, it, expect } from 'vitest';
import { buildLlmPromptArgs } from './build-llm-prompt-args';

describe('buildLlmPromptArgs', () => {
  it('returns undefined supportedUrls when the model has none', async () => {
    const result = await buildLlmPromptArgs({ model: { supportedUrls: undefined } });
    expect(result).toEqual({
      supportedUrls: undefined,
      downloadRetries: undefined,
      downloadConcurrency: undefined,
    });
  });

  it('returns supportedUrls directly when model exposes a sync record', async () => {
    const supportedUrls = { 'application/pdf': [/^https:\/\/example\.com\/.+\.pdf$/] };
    const result = await buildLlmPromptArgs({ model: { supportedUrls } });
    expect(result.supportedUrls).toBe(supportedUrls);
  });

  it('awaits a PromiseLike supportedUrls (e.g. ModelRouterLanguageModel / Mistral)', async () => {
    const supportedUrls = { 'application/pdf': [/^gs:\/\/.+/] };
    const result = await buildLlmPromptArgs({
      model: { supportedUrls: Promise.resolve(supportedUrls) },
    });
    expect(result.supportedUrls).toEqual(supportedUrls);
  });

  it('passes downloadRetries and downloadConcurrency through unchanged', async () => {
    const result = await buildLlmPromptArgs({
      model: { supportedUrls: undefined },
      downloadRetries: 5,
      downloadConcurrency: 2,
    });
    expect(result.downloadRetries).toBe(5);
    expect(result.downloadConcurrency).toBe(2);
  });

  it('tolerates a null/undefined model (e.g. resolved-too-early)', async () => {
    const result = await buildLlmPromptArgs({ model: null });
    expect(result.supportedUrls).toBeUndefined();
  });
});
