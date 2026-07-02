import { afterEach, describe, expect, it, vi } from 'vitest';
import ZeroEntropy from 'zeroentropy';
import { ZeroEntropyRelevanceScorer } from './';

vi.mock('zeroentropy', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      models: {
        rerank: vi.fn().mockResolvedValue({ results: [{ relevance_score: 0.7 }] }),
      },
    };
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.ZEROENTROPY_API_KEY;
});

describe('ZeroEntropyRelevanceScorer', () => {
  it('uses environment API key and default model when options are omitted', async () => {
    process.env.ZEROENTROPY_API_KEY = 'env-key';

    const scorer = new ZeroEntropyRelevanceScorer();
    await scorer.getRelevanceScore('query', 'document');

    expect(ZeroEntropy).toHaveBeenCalledWith({ apiKey: 'env-key' });
    expect(getRerankMock()).toHaveBeenCalledWith({
      query: 'query',
      documents: ['document'],
      model: 'zerank-1',
      top_n: 1,
    });
  });

  it('preserves explicitly empty API key and model options', async () => {
    process.env.ZEROENTROPY_API_KEY = 'env-key';

    const scorer = new ZeroEntropyRelevanceScorer('', '');
    await scorer.getRelevanceScore('query', 'document');

    expect(ZeroEntropy).toHaveBeenCalledWith({ apiKey: '' });
    expect(getRerankMock()).toHaveBeenCalledWith({
      query: 'query',
      documents: ['document'],
      model: '',
      top_n: 1,
    });
  });
});

function getRerankMock() {
  return vi.mocked(ZeroEntropy).mock.results.at(-1)?.value.models.rerank;
}
