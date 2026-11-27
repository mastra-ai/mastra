import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { TextNode } from '../schema';
import { SummaryExtractor } from './summary';

vi.setConfig({ testTimeout: 100_000, hookTimeout: 100_000 });

describe('SummaryExtractor', () => {
  let model: any;

  beforeAll(() => {
    model = new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        text: 'Mocked summary text',
      }),
      doStream: async () => {
        throw new Error('Streaming not implemented for mock');
      },
    });
  });

  it.each([
    ['can use a custom model from the test suite', 'A summary test using a custom model.'],
    ['extracts summary from normal text', 'This is a test document.'],
    ['handles special characters and emojis', '🚀✨🔥'],
    ['handles numbers only', '1234567890'],
    ['handles HTML tags', '<h1>Test</h1>'],
    ['handles non-English text', '这是一个测试文档。'],
    ['handles duplicate/repeated text', 'repeat repeat repeat'],
    ['handles only punctuation', '!!!???...'],
  ] as const)('%s', async (_title, text) => {
    const extractor = new SummaryExtractor({ llm: model });
    const node = new TextNode({ text });
    const summary = await extractor.generateNodeSummary(node);
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
  });

  it('handles empty input gracefully', async () => {
    const extractor = new SummaryExtractor({ llm: model });
    const node = new TextNode({ text: '' });
    const summary = await extractor.generateNodeSummary(node);
    expect(summary).toBe('');
  });

  it('supports prompt customization', async () => {
    const extractor = new SummaryExtractor({ llm: model, promptTemplate: 'Summarize: {context}' });
    const node = new TextNode({ text: 'Test document for prompt customization.' });
    const summary = await extractor.generateNodeSummary(node);
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
  });

  it('handles very long input', async () => {
    const extractor = new SummaryExtractor({ llm: model });
    const longText = 'A'.repeat(1000);
    const node = new TextNode({ text: longText });
    const summary = await extractor.generateNodeSummary(node);
    expect(typeof summary).toBe('string');
  });

  it('handles whitespace only input', async () => {
    const extractor = new SummaryExtractor({ llm: model });
    const node = new TextNode({ text: '    ' });
    const summary = await extractor.generateNodeSummary(node);
    expect(summary).toBe('');
  });
});
