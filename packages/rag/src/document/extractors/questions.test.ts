import { createOpenAI } from '@ai-sdk/openai';
import { TextNode } from '@llamaindex/core/schema';
import { describe, it, expect } from 'vitest';
import { QuestionsAnsweredExtractor } from './questions';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const model = openai('gpt-4o');

describe('QuestionsAnsweredExtractor', () => {
  it('extracts questions', async () => {
    const extractor = new QuestionsAnsweredExtractor({ llm: model });
    const node = new TextNode({ text: 'What is the capital of France? What is the color of the sky?' });
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
});
