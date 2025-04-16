import { createOpenAI } from '@ai-sdk/openai';
import { TextNode } from 'llamaindex';
import { describe, it, expect, vi } from 'vitest';
import { SummaryExtractor } from './summary';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const model = openai('gpt-4o');

vi.setConfig({ testTimeout: 10_000, hookTimeout: 10_000 });

describe('SummaryExtractor', () => {
  it('can use a custom model from the test suite', async () => {
    const extractor = new SummaryExtractor({ llm: model });
    const node = new TextNode({ text: 'A summary test using a custom model.' });
    const summary = await extractor.generateNodeSummary(node);
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
  });
  it('extracts summary from normal text', async () => {
    const extractor = new SummaryExtractor();
    const node = new TextNode({ text: 'This is a test document.' });
    const summary = await extractor.generateNodeSummary(node);
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
  });

  it('handles empty input gracefully', async () => {
    const extractor = new SummaryExtractor();
    const node = new TextNode({ text: '' });
    const summary = await extractor.generateNodeSummary(node);
    expect(summary).toBe('');
  });

  it('supports prompt customization', async () => {
    const extractor = new SummaryExtractor({ promptTemplate: 'Summarize: {context}' });
    const node = new TextNode({ text: 'Test document for prompt customization.' });
    const summary = await extractor.generateNodeSummary(node);
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
  });

  it('handles very long input', async () => {
    const extractor = new SummaryExtractor();
    const longText = 'A'.repeat(1000);
    const node = new TextNode({ text: longText });
    const summary = await extractor.generateNodeSummary(node);
    expect(typeof summary).toBe('string');
  });

  it('handles whitespace only input', async () => {
    const extractor = new SummaryExtractor();
    const node = new TextNode({ text: '    ' });
    const summary = await extractor.generateNodeSummary(node);
    expect(summary).toBe('');
  });

  it('handles special characters and emojis', async () => {
    const extractor = new SummaryExtractor();
    const node = new TextNode({ text: '🚀✨🔥' });
    const summary = await extractor.generateNodeSummary(node);
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
  });

  it('handles numbers only', async () => {
    const extractor = new SummaryExtractor();
    const node = new TextNode({ text: '1234567890' });
    const summary = await extractor.generateNodeSummary(node);
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
  });

  it('handles HTML tags', async () => {
    const extractor = new SummaryExtractor();
    const node = new TextNode({ text: '<h1>Test</h1>' });
    const summary = await extractor.generateNodeSummary(node);
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
  });

  it('handles non-English text', async () => {
    const extractor = new SummaryExtractor();
    const node = new TextNode({ text: '这是一个测试文档。' });
    const summary = await extractor.generateNodeSummary(node);
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
  });

  it('handles duplicate/repeated text', async () => {
    const extractor = new SummaryExtractor();
    const node = new TextNode({ text: 'repeat repeat repeat' });
    const summary = await extractor.generateNodeSummary(node);
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
  });

  it('handles only punctuation', async () => {
    const extractor = new SummaryExtractor();
    const node = new TextNode({ text: '!!!???...' });
    const summary = await extractor.generateNodeSummary(node);
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
  });
});
