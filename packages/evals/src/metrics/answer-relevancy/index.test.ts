import { it, expect, jest } from '@jest/globals';
import { type ModelConfig } from '@mastra/core';

import { AnswerRelevancyMetric } from './index';

const testCases = [
  {
    // Perfect relevancy (score: 10)
    input: 'What is the capital of France?',
    output: 'Paris is the capital of France.',
    expectedResult: {
      score: 10,
      reason: 'The output directly and accurately answers the input question without any irrelevant information',
    },
  },
  {
    // Mostly relevant with extra info (score: 5)
    input: 'What is the capital of France?',
    output:
      "Paris is the capital of France. It's known for the Eiffel Tower and is one of the most visited cities in the world.",
    expectedResult: {
      score: 5,
      reason:
        "The output correctly answers the question but includes additional information that's only partially relevant",
    },
  },
  {
    // Partially relevant (score: 2)
    input: 'What is the capital of France?',
    output: 'France is a country in Europe known for its cuisine. Paris is a major city there.',
    expectedResult: {
      score: 2,
      reason: "The output provides contextually relevant information but doesn't explicitly answer the question",
    },
  },
  {
    // Low relevancy (score: 0)
    input: 'What is the capital of France?',
    output: 'France is a beautiful country with great food and culture.',
    expectedResult: {
      score: 0,
      reason: "The output discusses France but doesn't address the capital city question",
    },
  },
  {
    // Zero relevancy (score: 0)
    input: 'What is the capital of France?',
    output: 'The weather is nice today.',
    expectedResult: {
      score: 0,
      reason: 'The output is completely unrelated to the input question',
    },
  },
  {
    // Empty output (score: 0)
    input: 'What is the capital of France?',
    output: '',
    expectedResult: {
      score: 0,
      reason: 'The output is empty',
    },
  },
  {
    // Incorrect but relevant answer (score: 3)
    input: 'What is the capital of France?',
    output: 'Lyon is the capital of France.',
    expectedResult: {
      score: 3,
      reason: 'The output provides an incorrect answer but maintains topic relevance',
    },
  },
  {
    // Single word correct answer (score: 10)
    input: 'What is the capital of France?',
    output: 'Paris',
    expectedResult: {
      score: 10,
      reason: 'The output provides the correct answer concisely',
    },
  },
  {
    // Multiple questions (score: 1)
    input: 'What is the capital of France?',
    output: 'What about Germany? Or maybe Italy? Many European countries have beautiful capitals.',
    expectedResult: {
      score: 1,
      reason: "The output discusses capital cities but doesn't answer the specific question about France",
    },
  },
  {
    // Technical gibberish (score: 0)
    input: 'What is the capital of France?',
    output: 'ERROR_CODE_404: NULL_POINTER_EXCEPTION at line 42',
    expectedResult: {
      score: 0,
      reason: 'The output contains technical error messages unrelated to the question',
    },
  },
] as const;

const SECONDS = 1000;
jest.setTimeout(15 * SECONDS);

const modelConfig: ModelConfig = {
  provider: 'OPEN_AI',
  name: 'gpt-4o',
  toolChoice: 'auto',
  apiKey: process.env.OPENAI_API_KEY,
};

describe('AnswerRelevancyMetric', () => {
  const metric = new AnswerRelevancyMetric(modelConfig);

  it('should be able to measure a prompt with perfect relevancy', async () => {
    const result = await metric.measure({
      input: testCases[0].input,
      output: testCases[0].output,
    });

    expect(result.score).toBe(10);
  });

  it('should be able to measure a prompt with mostly relevant information', async () => {
    const result = await metric.measure({
      input: testCases[1].input,
      output: testCases[1].output,
    });

    expect(result.score).toBe(5);
  });

  it('should be able to measure a prompt with partial relevance', async () => {
    const result = await metric.measure({
      input: testCases[2].input,
      output: testCases[2].output,
    });

    expect(result.score).toBe(2);
  });

  it('should be able to measure a prompt with low relevance', async () => {
    const result = await metric.measure({
      input: testCases[3].input,
      output: testCases[3].output,
    });

    expect(result.score).toBe(0);
  });

  it('should be able to measure a prompt with empty output', async () => {
    const result = await metric.measure({
      input: testCases[5].input,
      output: testCases[5].output,
    });

    expect(result.score).toBe(0);
  });

  it('should be able to measure a prompt with incorrect but relevant answer', async () => {
    const result = await metric.measure({
      input: testCases[6].input,
      output: testCases[6].output,
    });
    expect(result.score).toBe(3);
  });

  it('should be able to measure a prompt with a single word correct answer', async () => {
    const result = await metric.measure({
      input: testCases[7].input,
      output: testCases[7].output,
    });

    expect(result.score).toBe(10);
  });

  it('should be able to measure a prompt with multiple questions', async () => {
    const result = await metric.measure({
      input: testCases[8].input,
      output: testCases[8].output,
    });

    expect(result.score).toBe(1);
  });

  it('should be able to measure a prompt with technical gibberish', async () => {
    const result = await metric.measure({
      input: testCases[9].input,
      output: testCases[9].output,
    });

    expect(result.score).toBe(0);
  });
});
