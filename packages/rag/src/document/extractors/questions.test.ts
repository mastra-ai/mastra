import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { TextNode } from '../schema';
import { QuestionsAnsweredExtractor } from './questions';

vi.setConfig({ testTimeout: 100_000, hookTimeout: 100_000 });

describe('QuestionsAnsweredExtractor', () => {
  let model: any;

  beforeAll(() => {
    model = new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        text: 'What is the main topic? How does it work?',
      }),
      doStream: async () => {
        throw new Error('Streaming not implemented for mock');
      },
    });
  });

  it('can use a custom model for questions extraction', async () => {
    const extractor = new QuestionsAnsweredExtractor({ llm: model });
    const node = new TextNode({ text: 'What is the capital of Spain?' });
    const result = await extractor.extractQuestionsFromNode(node);
    expect(result).toHaveProperty('questionsThisExcerptCanAnswer');
    expect(result.questionsThisExcerptCanAnswer.length).toBeGreaterThan(0);
  });

  it.each([
    ['extracts questions', 'What is the capital of France? What is the color of the sky?'],
    ['handles special characters and emojis', '🚀✨🔥'],
    ['handles numbers only', '1234567890'],
    ['handles HTML tags', '<h1>Test</h1>'],
    ['handles non-English text', '这是一个测试文档。'],
    ['handles duplicate/repeated text', 'repeat repeat repeat'],
    ['handles only punctuation', '!!!???...'],
  ] as const)('%s', async (_title, text) => {
    const extractor = new QuestionsAnsweredExtractor({ llm: model });
    const node = new TextNode({ text });
    const result = await extractor.extractQuestionsFromNode(node);
    expect(result).toHaveProperty('questionsThisExcerptCanAnswer');
    expect(typeof result.questionsThisExcerptCanAnswer).toBe('string');
    expect(result.questionsThisExcerptCanAnswer.length).toBeGreaterThan(0);
  });

  it('handles empty input gracefully', async () => {
    const extractor = new QuestionsAnsweredExtractor({ llm: model });
    const node = new TextNode({ text: '' });
    const result = await extractor.extractQuestionsFromNode(node);
    expect(result).toHaveProperty('questionsThisExcerptCanAnswer');
    expect(result.questionsThisExcerptCanAnswer).toBe('');
  });

  it('supports prompt customization', async () => {
    const extractor = new QuestionsAnsweredExtractor({
      llm: model,
      promptTemplate: 'List questions in: {context}. Limit to {numQuestions}.',
    });
    const node = new TextNode({ text: 'Test document for prompt customization.' });
    const result = await extractor.extractQuestionsFromNode(node);
    expect(result).toHaveProperty('questionsThisExcerptCanAnswer');
    expect(typeof result.questionsThisExcerptCanAnswer).toBe('string');
    expect(result.questionsThisExcerptCanAnswer.length).toBeGreaterThan(0);
  });

  it('handles very long input', async () => {
    const extractor = new QuestionsAnsweredExtractor({ llm: model });
    const longText = 'A'.repeat(1000);
    const node = new TextNode({ text: longText });
    const result = await extractor.extractQuestionsFromNode(node);
    expect(result).toHaveProperty('questionsThisExcerptCanAnswer');
    expect(typeof result.questionsThisExcerptCanAnswer).toBe('string');
    expect(result.questionsThisExcerptCanAnswer.length).toBeGreaterThan(0);
  });

  it('handles whitespace only input', async () => {
    const extractor = new QuestionsAnsweredExtractor({ llm: model });
    const node = new TextNode({ text: '    ' });
    const result = await extractor.extractQuestionsFromNode(node);
    expect(result.questionsThisExcerptCanAnswer).toBe('');
  });
});
