import { createOpenAI } from '@ai-sdk/openai';
import { TextNode } from '@llamaindex/core/schema';
import { describe, it, expect } from 'vitest';
import { TitleExtractor } from './title';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const model = openai('gpt-4o');

describe('TitleExtractor', () => {
  it('extracts title', async () => {
    const extractor = new TitleExtractor({ llm: model });
    const node = new TextNode({ text: 'This is a test document.' });
    const titles = await extractor.extract([node]);
    console.log('New TitleExtractor:', titles);
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
  });
});
