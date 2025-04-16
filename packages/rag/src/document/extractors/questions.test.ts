import { createOpenAI } from '@ai-sdk/openai';
import { TextNode } from 'llamaindex';
import { describe, it, expect, vi } from 'vitest';
import { QuestionsAnsweredExtractor } from './questions';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const model = openai('gpt-4o');

vi.setConfig({ testTimeout: 10_000, hookTimeout: 10_000 });

describe('QuestionsAnsweredExtractor', () => {
  it('can use a custom model for questions extraction', async () => {
    const extractor = new QuestionsAnsweredExtractor({ llm: model });
    const node = new TextNode({ text: 'What is the capital of Spain?' });
    const result = await extractor.extractQuestionsFromNode(node);
    expect(result).toHaveProperty('questionsThisExcerptCanAnswer');
    expect(result.questionsThisExcerptCanAnswer.length).toBeGreaterThan(0);
  });

  it('extracts questions', async () => {
    const extractor = new QuestionsAnsweredExtractor();
    const node = new TextNode({ text: 'What is the capital of France? What is the color of the sky?' });
    const result = await extractor.extractQuestionsFromNode(node);
    expect(result).toHaveProperty('questionsThisExcerptCanAnswer');
    expect(typeof result.questionsThisExcerptCanAnswer).toBe('string');
    expect(result.questionsThisExcerptCanAnswer.length).toBeGreaterThan(0);
  });

  it('handles empty input gracefully', async () => {
    const extractor = new QuestionsAnsweredExtractor();
    const node = new TextNode({ text: '' });
    const result = await extractor.extractQuestionsFromNode(node);
    expect(result).toHaveProperty('questionsThisExcerptCanAnswer');
    expect(result.questionsThisExcerptCanAnswer).toBe('');
  });

  it('supports prompt customization', async () => {
    const extractor = new QuestionsAnsweredExtractor({
      promptTemplate: 'List questions in: {context}. Limit to {numQuestions}.',
    });
    const node = new TextNode({ text: 'Test document for prompt customization.' });
    const result = await extractor.extractQuestionsFromNode(node);
    expect(result).toHaveProperty('questionsThisExcerptCanAnswer');
    expect(typeof result.questionsThisExcerptCanAnswer).toBe('string');
    expect(result.questionsThisExcerptCanAnswer.length).toBeGreaterThan(0);
  });
  it('handles very long input', async () => {
    const extractor = new QuestionsAnsweredExtractor();
    const longText = 'A'.repeat(1000);
    const node = new TextNode({ text: longText });
    const result = await extractor.extractQuestionsFromNode(node);
    expect(result).toHaveProperty('questionsThisExcerptCanAnswer');
    expect(typeof result.questionsThisExcerptCanAnswer).toBe('string');
    expect(result.questionsThisExcerptCanAnswer.length).toBeGreaterThan(0);
  });

  it('handles whitespace only input', async () => {
    const extractor = new QuestionsAnsweredExtractor();
    const node = new TextNode({ text: '    ' });
    const result = await extractor.extractQuestionsFromNode(node);
    expect(result.questionsThisExcerptCanAnswer).toBe('');
  });

  it('handles special characters and emojis', async () => {
    const extractor = new QuestionsAnsweredExtractor();
    const node = new TextNode({ text: '🚀✨🔥' });
    const result = await extractor.extractQuestionsFromNode(node);
    expect(result).toHaveProperty('questionsThisExcerptCanAnswer');
    expect(typeof result.questionsThisExcerptCanAnswer).toBe('string');
    expect(result.questionsThisExcerptCanAnswer.length).toBeGreaterThan(0);
  });

  it('handles numbers only', async () => {
    const extractor = new QuestionsAnsweredExtractor();
    const node = new TextNode({ text: '1234567890' });
    const result = await extractor.extractQuestionsFromNode(node);
    expect(result).toHaveProperty('questionsThisExcerptCanAnswer');
    expect(typeof result.questionsThisExcerptCanAnswer).toBe('string');
    expect(result.questionsThisExcerptCanAnswer.length).toBeGreaterThan(0);
  });

  it('handles HTML tags', async () => {
    const extractor = new QuestionsAnsweredExtractor();
    const node = new TextNode({ text: '<h1>Test</h1>' });
    const result = await extractor.extractQuestionsFromNode(node);
    expect(result).toHaveProperty('questionsThisExcerptCanAnswer');
    expect(typeof result.questionsThisExcerptCanAnswer).toBe('string');
    expect(result.questionsThisExcerptCanAnswer.length).toBeGreaterThan(0);
  });

  it('handles non-English text', async () => {
    const extractor = new QuestionsAnsweredExtractor();
    const node = new TextNode({ text: '这是一个测试文档。' });
    const result = await extractor.extractQuestionsFromNode(node);
    expect(result).toHaveProperty('questionsThisExcerptCanAnswer');
    expect(typeof result.questionsThisExcerptCanAnswer).toBe('string');
    expect(result.questionsThisExcerptCanAnswer.length).toBeGreaterThan(0);
  });

  it('handles duplicate/repeated text', async () => {
    const extractor = new QuestionsAnsweredExtractor();
    const node = new TextNode({ text: 'repeat repeat repeat' });
    const result = await extractor.extractQuestionsFromNode(node);
    expect(result).toHaveProperty('questionsThisExcerptCanAnswer');
    expect(typeof result.questionsThisExcerptCanAnswer).toBe('string');
    expect(result.questionsThisExcerptCanAnswer.length).toBeGreaterThan(0);
  });

  it('handles only punctuation', async () => {
    const extractor = new QuestionsAnsweredExtractor();
    const node = new TextNode({ text: '!!!???...' });
    const result = await extractor.extractQuestionsFromNode(node);
    expect(result).toHaveProperty('questionsThisExcerptCanAnswer');
    expect(typeof result.questionsThisExcerptCanAnswer).toBe('string');
    expect(result.questionsThisExcerptCanAnswer.length).toBeGreaterThan(0);
  });
});
