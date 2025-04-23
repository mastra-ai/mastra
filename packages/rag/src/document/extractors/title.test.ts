import { createOpenAI } from '@ai-sdk/openai';
import { TextNode } from 'llamaindex';
import { describe, it, expect, vi } from 'vitest';
import { TitleExtractor } from './title';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const model = openai('gpt-4o');

vi.setConfig({ testTimeout: 10_000, hookTimeout: 10_000 });

describe('TitleExtractor', () => {
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

  it('handles very long input', async () => {
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
