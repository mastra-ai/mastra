import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { TextNode } from '../schema';
import { KeywordExtractor } from './keywords';

vi.setConfig({ testTimeout: 100_000, hookTimeout: 100_000 });

describe('KeywordExtractor', () => {
  let model: any;

  beforeAll(() => {
    model = new MockLanguageModelV1({
      doGenerate: async () => {
        const mockResponse = 'keyword1, keyword2, keyword3';
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: mockResponse,
        };
      },
      doStream: async () => {
        throw new Error('Streaming not implemented for mock');
      },
    });
  });

  it('can use a custom model for keywords extraction', async () => {
    const extractor = new KeywordExtractor({ llm: model });
    const node = new TextNode({ text: 'The quick brown fox jumps over the lazy dog.' });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result).toHaveProperty('excerptKeywords');
    expect(result.excerptKeywords.length).toBeGreaterThan(0);
  });

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
    expect(typeof result.excerptKeywords).toBe('string');
    expect(result.excerptKeywords.length).toBeGreaterThan(0);
  });

  it('extracts keywords from text', async () => {
    const extractor = new KeywordExtractor({ llm: model });
    const node = new TextNode({ text: 'The quick brown fox jumps over the lazy dog.' });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result).toHaveProperty('excerptKeywords');
    expect(typeof result.excerptKeywords).toBe('string');
    expect(result.excerptKeywords.length).toBeGreaterThan(0);
  });

  it('handles very long input', { retry: 2 }, async () => {
    const extractor = new KeywordExtractor({ llm: model });
    const longText = 'A'.repeat(1000);
    const node = new TextNode({ text: longText });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result).toHaveProperty('excerptKeywords');
    expect(typeof result.excerptKeywords).toBe('string');
    expect(result.excerptKeywords.length).toBeGreaterThan(0);
  });

  it('handles whitespace only input', async () => {
    const extractor = new KeywordExtractor({ llm: model });
    const node = new TextNode({ text: '    ' });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result.excerptKeywords).toBe('');
  });

  it('handles special characters and emojis', async () => {
    const extractor = new KeywordExtractor({ llm: model });
    const node = new TextNode({ text: '🚀✨🔥' });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result).toHaveProperty('excerptKeywords');
    expect(typeof result.excerptKeywords).toBe('string');
    expect(result.excerptKeywords.length).toBeGreaterThan(0);
  });

  it('handles numbers only', async () => {
    const extractor = new KeywordExtractor({ llm: model });
    const node = new TextNode({ text: '1234567890' });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result).toHaveProperty('excerptKeywords');
    expect(typeof result.excerptKeywords).toBe('string');
    expect(result.excerptKeywords.length).toBeGreaterThan(0);
  });

  it('handles HTML tags', async () => {
    const extractor = new KeywordExtractor({ llm: model });
    const node = new TextNode({ text: '<h1>Test</h1>' });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result).toHaveProperty('excerptKeywords');
    expect(typeof result.excerptKeywords).toBe('string');
    expect(result.excerptKeywords.length).toBeGreaterThan(0);
  });

  it('handles non-English text', async () => {
    const extractor = new KeywordExtractor({ llm: model });
    const node = new TextNode({ text: '这是一个测试文档。' });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result).toHaveProperty('excerptKeywords');
    expect(typeof result.excerptKeywords).toBe('string');
    expect(result.excerptKeywords.length).toBeGreaterThan(0);
  });

  it('handles duplicate/repeated text', async () => {
    const extractor = new KeywordExtractor({ llm: model });
    const node = new TextNode({ text: 'repeat repeat repeat' });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result).toHaveProperty('excerptKeywords');
    expect(typeof result.excerptKeywords).toBe('string');
    expect(result.excerptKeywords.length).toBeGreaterThan(0);
  });

  it('handles only punctuation', async () => {
    const extractor = new KeywordExtractor({ llm: model });
    const node = new TextNode({ text: '!!!???...' });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result).toHaveProperty('excerptKeywords');
    expect(typeof result.excerptKeywords).toBe('string');
    expect(result.excerptKeywords.length).toBeGreaterThan(0);
  });
});
