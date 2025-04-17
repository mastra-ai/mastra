import { createOpenAI } from '@ai-sdk/openai';
import { TextNode } from 'llamaindex';
import { describe, it, expect, vi } from 'vitest';
import { KeywordExtractor } from './keywords';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const model = openai('gpt-4o');

vi.setConfig({ testTimeout: 10_000, hookTimeout: 10_000 });

describe('KeywordExtractor', () => {
  it('can use a custom model for keywords extraction', async () => {
    const extractor = new KeywordExtractor({ llm: model });
    const node = new TextNode({ text: 'The quick brown fox jumps over the lazy dog.' });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result).toHaveProperty('excerptKeywords');
    expect(result.excerptKeywords.length).toBeGreaterThan(0);
  });

  it('handles empty input gracefully', async () => {
    const extractor = new KeywordExtractor();
    const node = new TextNode({ text: '' });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result.excerptKeywords).toBe('');
  });

  it('supports prompt customization', async () => {
    const extractor = new KeywordExtractor({
      promptTemplate: 'List keywords in: {context}. Limit to {maxKeywords}.',
    });
    const node = new TextNode({ text: 'Test document for prompt customization.' });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result).toHaveProperty('excerptKeywords');
    expect(typeof result.excerptKeywords).toBe('string');
    expect(result.excerptKeywords.length).toBeGreaterThan(0);
  });

  it('extracts keywords from text', async () => {
    const extractor = new KeywordExtractor();
    const node = new TextNode({ text: 'The quick brown fox jumps over the lazy dog.' });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result).toHaveProperty('excerptKeywords');
    expect(typeof result.excerptKeywords).toBe('string');
    expect(result.excerptKeywords.length).toBeGreaterThan(0);
  });
  it('handles very long input', async () => {
    const extractor = new KeywordExtractor();
    const longText = 'A'.repeat(1000);
    const node = new TextNode({ text: longText });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result).toHaveProperty('excerptKeywords');
    expect(typeof result.excerptKeywords).toBe('string');
    expect(result.excerptKeywords.length).toBeGreaterThan(0);
  });

  it('handles whitespace only input', async () => {
    const extractor = new KeywordExtractor();
    const node = new TextNode({ text: '    ' });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result.excerptKeywords).toBe('');
  });

  it('handles special characters and emojis', async () => {
    const extractor = new KeywordExtractor();
    const node = new TextNode({ text: '🚀✨🔥' });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result).toHaveProperty('excerptKeywords');
    expect(typeof result.excerptKeywords).toBe('string');
    expect(result.excerptKeywords.length).toBeGreaterThan(0);
  });

  it('handles numbers only', async () => {
    const extractor = new KeywordExtractor();
    const node = new TextNode({ text: '1234567890' });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result).toHaveProperty('excerptKeywords');
    expect(typeof result.excerptKeywords).toBe('string');
    expect(result.excerptKeywords.length).toBeGreaterThan(0);
  });

  it('handles HTML tags', async () => {
    const extractor = new KeywordExtractor();
    const node = new TextNode({ text: '<h1>Test</h1>' });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result).toHaveProperty('excerptKeywords');
    expect(typeof result.excerptKeywords).toBe('string');
    expect(result.excerptKeywords.length).toBeGreaterThan(0);
  });

  it('handles non-English text', async () => {
    const extractor = new KeywordExtractor();
    const node = new TextNode({ text: '这是一个测试文档。' });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result).toHaveProperty('excerptKeywords');
    expect(typeof result.excerptKeywords).toBe('string');
    expect(result.excerptKeywords.length).toBeGreaterThan(0);
  });

  it('handles duplicate/repeated text', async () => {
    const extractor = new KeywordExtractor();
    const node = new TextNode({ text: 'repeat repeat repeat' });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result).toHaveProperty('excerptKeywords');
    expect(typeof result.excerptKeywords).toBe('string');
    expect(result.excerptKeywords.length).toBeGreaterThan(0);
  });

  it('handles only punctuation', async () => {
    const extractor = new KeywordExtractor();
    const node = new TextNode({ text: '!!!???...' });
    const result = await extractor.extractKeywordsFromNodes(node);
    expect(result).toHaveProperty('excerptKeywords');
    expect(typeof result.excerptKeywords).toBe('string');
    expect(result.excerptKeywords.length).toBeGreaterThan(0);
  });
});
