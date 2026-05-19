import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('exa-js', () => {
  class FakeExa {
    headers = { set: vi.fn() };
    search = vi.fn().mockResolvedValue({ results: [] });
    findSimilar = vi.fn().mockResolvedValue({ results: [] });
    getContents = vi.fn().mockResolvedValue({ results: [] });
    answer = vi.fn().mockResolvedValue({ answer: '', citations: [] });
    constructor(apiKey: string) {
      if (!apiKey) throw new Error('Exa SDK was constructed without an API key');
    }
  }
  return { default: FakeExa };
});

import { createExaAnswerTool } from '../answer.js';
import { createExaFindSimilarTool } from '../find-similar.js';
import { createExaGetContentsTool } from '../get-contents.js';
import { createExaSearchTool } from '../search.js';

describe('Exa tools without an API key', () => {
  const originalEnv = process.env.EXA_API_KEY;

  beforeEach(() => {
    delete process.env.EXA_API_KEY;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.EXA_API_KEY = originalEnv;
    } else {
      delete process.env.EXA_API_KEY;
    }
  });

  it('still constructs tools so they can be wired into agents at config time', () => {
    expect(createExaSearchTool().id).toBe('exa-search');
    expect(createExaFindSimilarTool().id).toBe('exa-find-similar');
    expect(createExaGetContentsTool().id).toBe('exa-get-contents');
    expect(createExaAnswerTool().id).toBe('exa-answer');
  });

  it('throws a clear error at execute time when no API key is set anywhere', async () => {
    const tool = createExaSearchTool();
    await expect(tool.execute!({ query: 'q' }, {} as any)).rejects.toThrow(/Exa API key is required/);
  });

  it('uses the env var when present', async () => {
    process.env.EXA_API_KEY = 'env-key';
    const tool = createExaSearchTool();
    const result = (await tool.execute!({ query: 'q' }, {} as any)) as any;
    expect(result.results).toEqual([]);
  });
});
