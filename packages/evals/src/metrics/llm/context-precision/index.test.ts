import { createOpenAI } from '@ai-sdk/openai';
import { describe, it, expect } from 'vitest';

import type { TestCaseWithContext } from '../utils';

import { ContextPrecisionMetric } from './index';

const testCases: TestCaseWithContext[] = [
  {
    input: 'Who invented the light bulb?',
    output: 'Thomas Edison invented the light bulb.',
    context: [
      'Thomas Edison invented the light bulb in 1879 after many experiments.',
      'Edison spent years perfecting the light bulb design.',
      'Edison tested thousands of materials before finding the right filament.',
    ],
    expectedResult: {
      score: 1.0,
      reason: 'All context pieces are highly relevant',
    },
  },
  {
    input: 'Tell me about Tokyo, Japan',
    output: 'Tokyo is the capital of Japan and a major city.',
    context: [
      'Tokyo is the capital city of Japan.',
      'Tokyo is a major economic and cultural center.',
      'Japan has many beautiful mountains.',
    ],
    expectedResult: {
      score: 1.0,
      reason: 'First two contexts are relevant, last one irrelevant',
    },
  },
  {
    input: 'What is quantum computing?',
    output: 'Quantum computing uses quantum mechanics for computation.',
    context: [
      'Classical computers use bits.',
      'Quantum computing uses quantum mechanics principles.',
      'Quantum computers process information using quantum states.',
    ],
    expectedResult: {
      score: 0.583,
      reason: 'Two relevant pieces, but after irrelevant first item',
    },
  },
  {
    input: 'What are programming languages?',
    output: 'Programming languages are used to write computer code.',
    context: [
      'Python is a popular programming language.',
      'Computers run on binary.',
      'JavaScript is used for web development.',
    ],
    expectedResult: {
      score: 0.833,
      reason: 'Two relevant pieces with alternating relevance',
    },
  },
  {
    input: 'What is machine learning?',
    output: 'Machine learning is a type of artificial intelligence.',
    context: [
      'Machine learning uses data to make predictions.',
      'Data science is a broad field.',
      'Statistics help analyze results.',
    ],
    expectedResult: {
      score: 1.0,
      reason: 'Single relevant piece at the start',
    },
  },
  {
    input: 'What started World War 1?',
    output: 'The assassination of Archduke Franz Ferdinand sparked WWI.',
    context: [
      'The weather was mild that summer.',
      'Many people enjoyed picnics in the park.',
      'Local farmers had a good harvest.',
    ],
    expectedResult: {
      score: 0,
      reason: 'No context pieces are relevant to WWI',
    },
  },
  {
    input: 'Tell me about Romeo and Juliet',
    output: 'Romeo and Juliet was written by Shakespeare.',
    context: ['William Shakespeare wrote the famous play Romeo and Juliet in the late 16th century.'],
    expectedResult: {
      score: 1.0,
      reason: 'Single context is perfectly relevant',
    },
  },
  {
    input: 'How do I install Node.js?',
    output: 'You need to download Node.js from the official website.',
    context: [
      'ERROR: Installation failed due to permissions.',
      'Node.js is a JavaScript runtime.',
      'To install Node.js, first download it from nodejs.org.',
    ],
    expectedResult: {
      score: 0.333,
      reason: 'Single relevant piece at the end',
    },
  },
  {
    input: 'Empty context test',
    output: 'Test output',
    context: [],
    expectedResult: {
      score: 0,
      reason: 'Empty context should score 0',
    },
  },
  {
    input: 'Single irrelevant test',
    output: 'Test output',
    context: ['Completely unrelated information'],
    expectedResult: {
      score: 0,
      reason: 'Single irrelevant context should score 0',
    },
  },
];

const SECONDS = 10000;

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const model = openai('gpt-4o');

describe(
  'ContextPrecisionMetric',
  () => {
    it('should measure perfect context precision with all relevant items', async () => {
      const testCase = testCases[0]!;
      const metric = new ContextPrecisionMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should measure high precision with irrelevant item at end', async () => {
      const testCase = testCases[1]!;
      const metric = new ContextPrecisionMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should measure precision with two relevant items after irrelevant start', async () => {
      const testCase = testCases[2]!;
      const metric = new ContextPrecisionMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should measure precision with alternating relevant items', async () => {
      const testCase = testCases[3]!;
      const metric = new ContextPrecisionMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should measure precision with single relevant item at start', async () => {
      const testCase = testCases[4]!;
      const metric = new ContextPrecisionMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should handle completely irrelevant context', async () => {
      const testCase = testCases[5]!;
      const metric = new ContextPrecisionMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should handle single relevant context perfectly', async () => {
      const testCase = testCases[6]!;
      const metric = new ContextPrecisionMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should measure precision with single relevant item at end', async () => {
      const testCase = testCases[7]!;
      const metric = new ContextPrecisionMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should handle empty context', async () => {
      const testCase = testCases[8]!;
      const metric = new ContextPrecisionMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should handle single irrelevant context', async () => {
      const testCase = testCases[9]!;
      const metric = new ContextPrecisionMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });
  },
  {
    timeout: 15 * SECONDS,
  },
);
