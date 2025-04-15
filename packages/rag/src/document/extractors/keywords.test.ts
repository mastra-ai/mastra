import { createOpenAI } from '@ai-sdk/openai';
import { TextNode } from '@llamaindex/core/schema';
import { describe, it, expect } from 'vitest';
import { KeywordExtractor } from './keywords';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const model = openai('gpt-4o');

describe('KeywordExtractor', () => {
  it('handles empty input gracefully', async () => {
    const extractor = new KeywordExtractor({ llm: model });
    const node = new TextNode({ text: '' });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result.excerptKeywords).toBe('');
  });

  it('supports prompt customization', async () => {
    const extractor = new KeywordExtractor({
      llm: model,
      promptTemplate: 'List keywords in: {context}. Limit to {maxKeywords}.',
    });
    const node = new TextNode({ text: 'Test document for prompt customization.' });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result).toHaveProperty('excerptKeywords');
  });

  it('extracts keywords from text', async () => {
    const extractor = new KeywordExtractor({ llm: model });
    const node = new TextNode({ text: 'The quick brown fox jumps over the lazy dog.' });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result).toHaveProperty('excerptKeywords');
    expect(typeof result.excerptKeywords).toBe('string');
    expect(result.excerptKeywords.length).toBeGreaterThan(0);
  });
});
