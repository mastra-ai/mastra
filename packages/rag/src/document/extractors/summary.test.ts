import { createOpenAI } from '@ai-sdk/openai';
import { TextNode } from '@llamaindex/core/schema';
import { describe, it, expect } from 'vitest';
import { SummaryExtractor } from './summary';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const model = openai('gpt-4o');

describe('SummaryExtractor', () => {
  it('extracts summary', async () => {
    const extractor = new SummaryExtractor({ llm: model });
    const node = new TextNode({ text: 'This is a test document.' });
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
  });
});
