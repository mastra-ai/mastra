import type { MastraLanguageModel } from '@mastra/core/agent';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { MastraAgentRelevanceScorer } from './';

const TEST_MODEL = {} as MastraLanguageModel;

const agentMock = vi.hoisted(() => ({
  responseText: '0.5',
  generate: vi.fn(),
  getModel: vi.fn(),
}));

vi.mock('@mastra/core/agent', () => ({
  Agent: class {
    getModel = agentMock.getModel;
    generate = agentMock.generate;
  },
}));

describe('MastraAgentRelevanceScorer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agentMock.responseText = '0.5';
    agentMock.getModel.mockResolvedValue({});
    agentMock.generate.mockImplementation(async () => ({ text: agentMock.responseText }));
  });

  it('returns a numeric relevance score from model output', async () => {
    agentMock.responseText = ' 0.75 ';
    const scorer = new MastraAgentRelevanceScorer('test', TEST_MODEL);

    await expect(scorer.getRelevanceScore('query', 'text')).resolves.toBe(0.75);
  });

  it.each([
    ['non-numeric text', 'not a number'],
    ['partial numeric text', '0.4 relevant'],
    ['empty text', ''],
    ['NaN', 'NaN'],
    ['Infinity', 'Infinity'],
    ['negative score', '-0.1'],
    ['score above one', '1.1'],
  ])('rejects %s model output', async (_name, responseText) => {
    agentMock.responseText = responseText;
    const scorer = new MastraAgentRelevanceScorer('test', TEST_MODEL);

    await expect(scorer.getRelevanceScore('query', 'text')).rejects.toThrow(
      'Invalid relevance score returned by model',
    );
  });
});
