import { createOpenAI } from '@ai-sdk/openai';
import { describe, it, expect } from 'vitest';

import { isCloserTo, TestCase } from '../utils';

import { AnswerRelevancyMetric } from './index';

const testCases: TestCase[] = [
  {
    input: 'What is the capital of France?',
    output: 'Paris is the capital of France.',
    expectedResult: {
      score: 1.0,
      reason: 'The output directly and accurately answers the input question without any irrelevant information',
    },
  },
  {
    input: 'What is the capital of France?',
    output:
      "Paris is the capital of France. It's known for the Eiffel Tower and is one of the most visited cities in the world.",
    expectedResult: {
      score: 0.43,
      reason:
        "The output correctly answers the question but includes additional information that's only partially relevant",
    },
  },
  {
    input: 'What is the capital of France?',
    output: 'France is a country in Europe known for its cuisine. Paris is a major city there.',
    expectedResult: {
      score: 0.15,
      reason: "The output provides contextually relevant information but doesn't explicitly answer the question",
    },
  },
  {
    input: 'What is the capital of France?',
    output: 'France is a beautiful country with great food and culture.',
    expectedResult: {
      score: 0,
      reason: "The output discusses France but doesn't address the capital city question",
    },
  },
  {
    input: 'What is the capital of France?',
    output: 'The weather is nice today.',
    expectedResult: {
      score: 0,
      reason: 'The output is completely unrelated to the input question',
    },
  },
  {
    input: 'What is the capital of France?',
    output: '',
    expectedResult: {
      score: 0,
      reason: 'The output is empty',
    },
  },
  {
    input: 'What is the capital of France?',
    output: 'Lyon is the capital of France.',
    expectedResult: {
      score: 0.3,
      reason: 'The output provides an incorrect answer but maintains topic relevance',
    },
  },
  {
    input: 'What is the capital of France?',
    output: 'Paris',
    expectedResult: {
      score: 1.0,
      reason: 'The output provides the correct answer concisely',
    },
  },
  {
    input: 'What is the capital of France?',
    output: 'What about Germany? Or maybe Italy? Many European countries have beautiful capitals.',
    expectedResult: {
      score: 0.1,
      reason: "The output discusses capital cities but doesn't answer the specific question about France",
    },
  },
  {
    input: 'What is the capital of France?',
    output: 'ERROR_CODE_404: NULL_POINTER_EXCEPTION at line 42',
    expectedResult: {
      score: 0,
      reason: 'The output contains technical error messages unrelated to the question',
    },
  },
];

const SECONDS = 10000;

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const model = openai('gpt-4o');

describe(
  'AnswerRelevancyMetric',
  () => {
    const metric = new AnswerRelevancyMetric(model);

    it('should be able to measure a prompt with perfect relevancy', async () => {
      const result = await metric.measure(testCases[0].input, testCases[0].output);
      expect(result.score).toBeCloseTo(testCases[0].expectedResult.score, 1);
    });

    it('should be able to measure a prompt with mostly relevant information', async () => {
      const result = await metric.measure(testCases[1].input, testCases[1].output);
      const expectedScore = testCases[1].expectedResult.score;
      expect(isCloserTo(result.score, expectedScore, 0)).toBe(true);
    });

    it('should be able to measure a prompt with partial relevance', async () => {
      const result = await metric.measure(testCases[2].input, testCases[2].output);
      expect(result.score).toBeCloseTo(testCases[2].expectedResult.score, 1);
    });

    it('should be able to measure a prompt with low relevance', async () => {
      const result = await metric.measure(testCases[3].input, testCases[3].output);
      expect(result.score).toBeCloseTo(testCases[3].expectedResult.score, 1);
    });

    it('should be able to measure a prompt with empty output', async () => {
      const result = await metric.measure(testCases[5].input, testCases[5].output);
      expect(result.score).toBeCloseTo(testCases[5].expectedResult.score, 1);
    });

    it('should be able to measure a prompt with incorrect but relevant answer', async () => {
      const result = await metric.measure(testCases[6].input, testCases[6].output);
      expect(result.score).toBeCloseTo(testCases[6].expectedResult.score, 1);
    });

    it('should be able to measure a prompt with a single word correct answer', async () => {
      const result = await metric.measure(testCases[7].input, testCases[7].output);
      expect(result.score).toBeCloseTo(testCases[7].expectedResult.score, 1);
    });

    it('should be able to measure a prompt with multiple questions', async () => {
      const result = await metric.measure(testCases[8].input, testCases[8].output);
      expect(result.score).toBeCloseTo(testCases[8].expectedResult.score, 1);
    });

    it('should be able to measure a prompt with technical gibberish', async () => {
      const result = await metric.measure(testCases[9].input, testCases[9].output);
      expect(result.score).toBeCloseTo(testCases[9].expectedResult.score, 1);
    });
  },
  {
    timeout: 15 * SECONDS,
  },
);
