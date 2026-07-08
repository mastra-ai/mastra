import { describe, it, expect, vi } from 'vitest';

// LLMs frequently wrap the requested numeric score in prose (e.g. "The relevance
// score is 0.42.") even when instructed to output only a number. The old
// implementation returned parseFloat(response), which yields NaN for any
// non-bare-numeric payload. That NaN silently corrupts downstream ranking
// (weights.semantic * NaN === NaN) with no error. This test pins the corrected
// extraction behavior.
const mockGenerate = vi.fn().mockResolvedValue({ text: '0.87' });

vi.mock('../../agent', () => ({
  Agent: class {
    async getModel() {
      return { specificationVersion: 'v3' };
    }
    async generate() {
      return mockGenerate();
    }
  },
  isSupportedLanguageModel: () => true,
}));

import { MastraAgentRelevanceScorer } from './index';

describe('MastraAgentRelevanceScorer.getRelevanceScore', () => {
  it('returns the numeric score when the model emits a bare number', async () => {
    mockGenerate.mockResolvedValue({ text: '0.87' });
    const scorer = new MastraAgentRelevanceScorer('test', {} as any);
    const score = await scorer.getRelevanceScore('query', 'text');
    expect(Number.isNaN(score)).toBe(false);
    expect(score).toBe(0.87);
  });

  it('extracts the number when the model wraps it in prose (regression for NaN)', async () => {
    mockGenerate.mockResolvedValue({ text: 'The relevance score is 0.42.' });
    const scorer = new MastraAgentRelevanceScorer('test', {} as any);
    const score = await scorer.getRelevanceScore('query', 'text');
    expect(Number.isNaN(score)).toBe(false);
    expect(score).toBe(0.42);
  });

  it('falls back to 0 (not NaN) when no number is present in the output', async () => {
    mockGenerate.mockResolvedValue({ text: 'unable to determine a score' });
    const scorer = new MastraAgentRelevanceScorer('test', {} as any);
    const score = await scorer.getRelevanceScore('query', 'text');
    expect(Number.isNaN(score)).toBe(false);
    expect(score).toBe(0);
  });
});
