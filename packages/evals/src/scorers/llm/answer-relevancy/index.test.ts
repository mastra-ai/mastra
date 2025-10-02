import { createOpenAI } from '@ai-sdk/openai';
import { describe, it, expect } from 'vitest';
import type { TestCase } from '../../../metrics/llm/utils';
import { isCloserTo } from '../../../metrics/llm/utils';
import { createAgentTestRun, createUIMessage } from '../../utils';
import { createAnswerRelevancyScorer } from '.';

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

const TIMEOUT = 15 * SECONDS;

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const model = openai('gpt-4o');

// const scorer = new AnswerRelevancyScorer({ model });
const scorer = createAnswerRelevancyScorer({ model });

describe('AnswerRelevancyScorer', () => {
  it(
    'should be able to measure a prompt with perfect relevancy',
    async () => {
      const inputMessages = [createUIMessage({ role: 'user', content: testCases[0].input })];
      const output = [createUIMessage({ role: 'assistant', content: testCases[0].output })];

      const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
      expect(result.score).toBeCloseTo(testCases[0].expectedResult.score, 1);
    },
    TIMEOUT,
  );

  it(
    'should be able to measure a prompt with mostly relevant information',
    async () => {
      const inputMessages = [createUIMessage({ role: 'user', content: testCases[1].input })];
      const output = [createUIMessage({ role: 'assistant', content: testCases[1].output })];

      const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
      const expectedScore = testCases[1].expectedResult.score;
      expect(isCloserTo(result.score!, expectedScore, 0)).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'should be able to measure a prompt with partial relevance',
    async () => {
      const inputMessages = [createUIMessage({ role: 'user', content: testCases[2].input })];
      const output = [createUIMessage({ role: 'assistant', content: testCases[2].output })];

      const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
      expect(result.score).toBeCloseTo(testCases[2].expectedResult.score, 1);
    },
    TIMEOUT,
  );

  it(
    'should be able to measure a prompt with low relevance',
    async () => {
      const inputMessages = [createUIMessage({ role: 'user', content: testCases[3].input })];
      const output = [createUIMessage({ role: 'assistant', content: testCases[3].output })];

      const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
      expect(result.score).toBeCloseTo(testCases[3].expectedResult.score, 1);
    },
    TIMEOUT,
  );

  it(
    'should be able to measure a prompt with empty output',
    async () => {
      const inputMessages = [createUIMessage({ role: 'user', content: testCases[5].input })];
      const output = [createUIMessage({ role: 'assistant', content: testCases[5].output })];

      const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
      expect(result.score).toBeCloseTo(testCases[5].expectedResult.score, 1);
    },
    TIMEOUT,
  );

  it(
    'should be able to measure a prompt with incorrect but relevant answer',
    async () => {
      const inputMessages = [createUIMessage({ role: 'user', content: testCases[6].input })];
      const output = [createUIMessage({ role: 'assistant', content: testCases[6].output })];

      const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
      expect(result.score).toBeCloseTo(testCases[6].expectedResult.score, 1);
    },
    TIMEOUT,
  );

  it(
    'should be able to measure a prompt with a single word correct answer',
    async () => {
      const inputMessages = [createUIMessage({ role: 'user', content: testCases[7].input })];
      const output = [createUIMessage({ role: 'assistant', content: testCases[7].output })];

      const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
      expect(result.score).toBeCloseTo(testCases[7].expectedResult.score, 1);
    },
    TIMEOUT,
  );

  it(
    'should be able to measure a prompt with multiple questions',
    async () => {
      const inputMessages = [createUIMessage({ role: 'user', content: testCases[8].input })];
      const output = [createUIMessage({ role: 'assistant', content: testCases[8].output })];

      const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
      expect(result.score).toBeCloseTo(testCases[8].expectedResult.score, 1);
    },
    TIMEOUT,
  );

  it(
    'should be able to measure a prompt with technical gibberish',
    async () => {
      const inputMessages = [createUIMessage({ role: 'user', content: testCases[9].input })];
      const output = [createUIMessage({ role: 'assistant', content: testCases[9].output })];

      const result = await scorer.run(createAgentTestRun({ inputMessages, output }));
      expect(result.score).toBeCloseTo(testCases[9].expectedResult.score, 1);
    },
    TIMEOUT,
  );
});
