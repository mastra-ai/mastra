import { openai } from '@ai-sdk/openai';
import { describe, it, expect } from 'vitest';

import type { TestCaseWithContext } from '../utils';

import { FaithfulnessMetric } from './index';

const testCases: TestCaseWithContext[] = [
  {
    // Perfect faithfulness
    input: 'What can you tell me about the company?',
    context: [
      'The company was founded in 1995 by John Smith.',
      'It has 500 employees and is headquartered in London.',
      'The company specializes in software development.',
    ],
    output:
      'The company was founded in 1995 by John Smith and has 500 employees. Their headquarters is in London, and they focus on software development.',
    expectedResult: {
      score: 1.0,
      reason: 'All claims made in the output are directly supported by the context, showing perfect faithfulness',
    },
  },
  {
    // Mixed faithfulness with contradictions
    input: 'What can you tell me about the company?',
    context: [
      'The company was founded in 1995 by John Smith.',
      'It has 500 employees and is headquartered in London.',
      'The company specializes in software development.',
    ],
    output:
      'The company was founded in 1995 by John Smith but has 1000 employees. Their headquarters is in Paris, and they focus on software development.',
    expectedResult: {
      score: 0.5,
      reason:
        'Half of the claims (founding date and specialization) are supported by the context, while two claims (employee count and headquarters location) directly contradict it',
    },
  },
  {
    // mixed claims with speculative language
    input: 'What can you tell me about the company?',
    context: ['The company was founded in 1995 by John Smith.', 'It has 500 employees and is headquartered in London.'],
    output: 'The company was founded in 1995 and may have international offices. They might be expanding to Asia soon.',
    expectedResult: {
      score: 0.33,
      reason:
        'Only the founding date claim is supported by context. The other claims are marked as unsure due to speculative language',
    },
  },
  {
    // empty output
    input: 'What can you tell me about the company?',
    context: ['The company was founded in 1995 by John Smith.', 'It has 500 employees and is headquartered in London.'],
    output: '',
    expectedResult: {
      score: 0,
      reason: 'The output is empty',
    },
  },
  {
    // empty context
    input: 'What can you tell me about the company?',
    context: [],
    output: 'The company was founded in 1995.',
    expectedResult: {
      score: 0,
      reason: 'No context provided for verification',
    },
  },
  {
    // subjective claims
    input: 'What can you tell me about the company?',
    context: ['The company was founded in 1995 by John Smith.', 'It has 500 employees and is headquartered in London.'],
    output: 'The company has a great work culture and amazing benefits. Their employees seem very happy.',
    expectedResult: {
      score: 0,
      reason: 'All claims are marked as unsure as they cannot be verified from the context',
    },
  },
  {
    // claims with speculative language
    input: 'What can you tell me about the company?',
    context: ['The company was founded in 1995 by John Smith.', 'It has 500 employees and is headquartered in London.'],
    output: 'Founded in 1995, the company might be planning to expand. They possibly have offices in other cities.',
    expectedResult: {
      score: 0.33,
      reason:
        'Only the founding date is supported by the context, while other claims use speculative language (might, possibly) and are marked as unsure',
    },
  },
  {
    // compound statements
    input: 'What can you tell me about the company?',
    context: ['The company was founded in 1995.', 'John Smith is the CEO.', 'The headquarters has 500 employees.'],
    output:
      'The company was founded in 1995 and has 500 employees at headquarters. John Smith is the CEO and runs global operations.',
    expectedResult: {
      score: 0.75,
      reason:
        'Three claims (founding year, employee count, CEO role) are supported by context, while the global operations claim is not supported',
    },
  },
  {
    // precise numerical claims
    input: 'How many employees work there?',
    context: ['The company has approximately 500 employees as of 2023.'],
    output: 'The company employs 498 people.',
    expectedResult: {
      score: 0,
      reason:
        'The claim about employee count is marked as unsure rather than contradictory, as the context provides an approximate number',
    },
  },
  {
    // partially supported claims
    input: 'Describe the company location.',
    context: ['The company headquarters is in London.'],
    output: 'The company headquarters is in London, in the financial district.',
    expectedResult: {
      score: 0.5,
      reason: 'The London location is supported, but the specific district detail is not mentioned in context',
    },
  },
  {
    // mixed factual and speculative claims
    input: 'Tell me about the company growth.',
    context: ['The company has grown from 100 to 500 employees since 2020.'],
    output: 'The company has grown to 500 employees and will likely continue expanding rapidly.',
    expectedResult: {
      score: 0.5,
      reason:
        'The current employee count is explicitly supported by context. The future expansion claim is marked as unsure due to speculative language',
    },
  },
  {
    // implicit information
    input: 'Who runs the company?',
    context: ['John Smith is the CEO of the company since 2020.'],
    output: 'John Smith has been leading the company for several years.',
    expectedResult: {
      score: 1.0,
      reason: 'The leadership claim is supported by the context, even though the exact duration is phrased differently',
    },
  },
];

const SECONDS = 10000;

const model = openai('gpt-4o');

describe(
  'FaithfulnessMetric',
  () => {
    it('should handle perfect faithfulness', async () => {
      const testCase = testCases[0]!;
      const metric = new FaithfulnessMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);

      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should handle mixed faithfulness with contradictions', async () => {
      const testCase = testCases[1]!;
      const metric = new FaithfulnessMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);

      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should handle claims with speculative language', async () => {
      const testCase = testCases[2]!;
      const metric = new FaithfulnessMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);

      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should handle empty output', async () => {
      const testCase = testCases[3]!;
      const metric = new FaithfulnessMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);

      expect(result.score).toBe(testCase.expectedResult.score);
    });

    it('should handle empty context', async () => {
      const testCase = testCases[4]!;
      const metric = new FaithfulnessMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);

      expect(result.score).toBe(testCase.expectedResult.score);
    });

    it('should handle subjective claims', async () => {
      const testCase = testCases[5]!;
      const metric = new FaithfulnessMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);

      expect(result.score).toBe(testCase.expectedResult.score);
    });

    it('should handle claims with speculative language appropriately', async () => {
      const testCase = testCases[6]!;
      const metric = new FaithfulnessMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);

      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should handle compound statements correctly', async () => {
      const testCase = testCases[7]!;
      const metric = new FaithfulnessMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);

      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should handle precise numerical claims', async () => {
      const testCase = testCases[8]!;
      const metric = new FaithfulnessMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);

      expect(result.score).toBe(testCase.expectedResult.score);
    });

    it('should handle partially supported claims', async () => {
      const testCase = testCases[9]!;
      const metric = new FaithfulnessMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);

      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should handle mixed factual and speculative claims', async () => {
      const testCase = testCases[10]!;
      const metric = new FaithfulnessMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);

      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should handle implicit information appropriately', async () => {
      const testCase = testCases[11]!;
      const metric = new FaithfulnessMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);

      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });
  },
  {
    timeout: 15 * SECONDS,
  },
);
