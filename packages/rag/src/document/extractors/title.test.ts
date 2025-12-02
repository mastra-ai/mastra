import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { TextNode } from '../schema';
import { TitleExtractor } from './title';

vi.setConfig({ testTimeout: 300_000, hookTimeout: 300_000 });

describe('TitleExtractor', () => {
  let model: any;

  beforeAll(() => {
    model = new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        text: 'Mocked Document Title',
      }),
      doStream: async () => {
        throw new Error('Streaming not implemented for mock');
      },
    });
  });

  it('can use a custom model from the test suite', async () => {
    const extractor = new TitleExtractor({ llm: model });
    const node = new TextNode({ text: 'A title test using a custom model.' });
    const titles = await extractor.extract([node]);
    expect(Array.isArray(titles)).toBe(true);
    expect(titles[0]).toHaveProperty('documentTitle');
    expect(typeof titles[0].documentTitle).toBe('string');
    expect(titles[0].documentTitle.length).toBeGreaterThan(0);
  });

  it('extracts title', async () => {
    const extractor = new TitleExtractor({ llm: model });
    const node = new TextNode({ text: 'This is a test document.' });
    const titles = await extractor.extract([node]);
    expect(Array.isArray(titles)).toBe(true);
    expect(titles[0]).toHaveProperty('documentTitle');
    expect(typeof titles[0].documentTitle).toBe('string');
    expect(titles[0].documentTitle.length).toBeGreaterThan(0);
  });

  it('handles empty input gracefully', async () => {
    const extractor = new TitleExtractor({ llm: model });
    const node = new TextNode({ text: '' });
    const titles = await extractor.extract([node]);
    expect(titles[0].documentTitle).toBe('');
  });

  it('supports prompt customization', async () => {
    const extractor = new TitleExtractor({ llm: model, nodeTemplate: 'Title for: {context}' });
    const node = new TextNode({ text: 'Test document for prompt customization.' });
    const titles = await extractor.extract([node]);
    expect(titles[0]).toHaveProperty('documentTitle');
    expect(typeof titles[0].documentTitle).toBe('string');
    expect(titles[0].documentTitle.length).toBeGreaterThan(0);
  });

  it('handles very long input', { retry: 2 }, async () => {
    const extractor = new TitleExtractor({ llm: model });
    const longText = 'A'.repeat(1000);
    const node = new TextNode({ text: longText });
    const titles = await extractor.extract([node]);
    expect(titles[0]).toHaveProperty('documentTitle');
    expect(typeof titles[0].documentTitle).toBe('string');
    expect(titles[0].documentTitle.length).toBeGreaterThan(0);
  });

  it('handles whitespace only input', async () => {
    const extractor = new TitleExtractor({ llm: model });
    const node = new TextNode({ text: '    ' });
    const titles = await extractor.extract([node]);
    expect(titles[0].documentTitle).toBe('');
  });

  it('handles special characters and emojis', async () => {
    const extractor = new TitleExtractor({ llm: model });
    const node = new TextNode({ text: '🚀✨🔥' });
    const titles = await extractor.extract([node]);
    expect(titles[0]).toHaveProperty('documentTitle');
    expect(typeof titles[0].documentTitle).toBe('string');
    expect(titles[0].documentTitle.length).toBeGreaterThan(0);
  });

  it('handles numbers only', async () => {
    const extractor = new TitleExtractor({ llm: model });
    const node = new TextNode({ text: '1234567890' });
    const titles = await extractor.extract([node]);
    expect(titles[0]).toHaveProperty('documentTitle');
    expect(typeof titles[0].documentTitle).toBe('string');
    expect(titles[0].documentTitle.length).toBeGreaterThan(0);
  });

  it('handles HTML tags', async () => {
    const extractor = new TitleExtractor({ llm: model });
    const node = new TextNode({ text: '<h1>Test</h1>' });
    const titles = await extractor.extract([node]);
    expect(titles[0]).toHaveProperty('documentTitle');
    expect(typeof titles[0].documentTitle).toBe('string');
    expect(titles[0].documentTitle.length).toBeGreaterThan(0);
  });

  it('handles non-English text', async () => {
    const extractor = new TitleExtractor({ llm: model });
    const node = new TextNode({ text: '这是一个测试文档。' });
    const titles = await extractor.extract([node]);
    expect(titles[0]).toHaveProperty('documentTitle');
    expect(typeof titles[0].documentTitle).toBe('string');
    expect(titles[0].documentTitle.length).toBeGreaterThan(0);
  });

  it('handles duplicate/repeated text', async () => {
    const extractor = new TitleExtractor({ llm: model });
    const node = new TextNode({ text: 'repeat repeat repeat' });
    const titles = await extractor.extract([node]);
    expect(titles[0]).toHaveProperty('documentTitle');
    expect(typeof titles[0].documentTitle).toBe('string');
    expect(titles[0].documentTitle.length).toBeGreaterThan(0);
  });

  it('handles only punctuation', async () => {
    const extractor = new TitleExtractor({ llm: model });
    const node = new TextNode({ text: '!!!???...' });
    const titles = await extractor.extract([node]);
    expect(titles[0]).toHaveProperty('documentTitle');
    expect(typeof titles[0].documentTitle).toBe('string');
    expect(titles[0].documentTitle.length).toBeGreaterThan(0);
  });
});
