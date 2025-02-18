import { openai } from '@ai-sdk/openai';
import { describe, it, expect } from 'vitest';

import type { TestCaseWithContext } from '../utils';

import { HallucinationMetric } from './index';

const testCases: TestCaseWithContext[] = [
  {
    // No hallucination - output aligns with context
    input: 'Tell me about Tesla.',
    context: ['Tesla was founded in 2003.', 'Elon Musk joined Tesla in 2004.', 'The first Tesla car was the Roadster.'],
    output: 'Tesla, founded in 2003, welcomed Elon Musk in 2004. Their first vehicle was the Roadster.',
    expectedResult: {
      score: 0.0,
      reason: 'The output perfectly aligns with all context statements without any contradictions.',
    },
  },
  {
    // Complete hallucination - output contradicts all context
    input: 'Tell me about Tesla.',
    context: ['Tesla was founded in 2003.', 'Elon Musk joined Tesla in 2004.', 'The first Tesla car was the Roadster.'],
    output: 'Tesla was established in 2001 by Elon Musk himself. Their first car was the Model S.',
    expectedResult: {
      score: 1.0,
      reason: "The output contradicts all context statements about founding date, Musk's role, and first car model.",
    },
  },
  {
    // Partial hallucination - output contradicts some context
    input: 'Tell me about Tesla.',
    context: ['Tesla was founded in 2003.', 'Elon Musk joined Tesla in 2004.', 'The first Tesla car was the Roadster.'],
    output: 'Tesla was founded in 2003. Elon Musk started the company. The Roadster was their first car.',
    expectedResult: {
      score: 0.33,
      reason:
        "One out of three statements contradicts the context (Musk's role), while founding date and first car are accurate.",
    },
  },
  {
    // Empty output - should have no contradictions
    input: 'Tell me about Tesla.',
    context: ['Tesla was founded in 2003.', 'Elon Musk joined Tesla in 2004.'],
    output: '',
    expectedResult: {
      score: 0.0,
      reason: 'Empty output cannot contradict any context statements.',
    },
  },
  {
    // Speculative language - should not count as contradictions
    input: 'Tell me about Tesla.',
    context: ['Tesla was founded in 2003.', 'Elon Musk joined Tesla in 2004.'],
    output: 'Tesla might have been founded around 2003, and I believe Elon Musk possibly joined a year later.',
    expectedResult: {
      score: 0.0,
      reason: 'Speculative language (might, possibly, believe) does not constitute contradictions with context.',
    },
  },
  {
    // Empty context - should return score of 0
    input: 'Tell me about Tesla.',
    context: [],
    output: 'Tesla was founded in 2001 by Elon Musk.',
    expectedResult: {
      score: 0.0,
      reason: 'No context statements to contradict, resulting in zero hallucination score.',
    },
  },
  {
    // Implicit contradictions
    input: 'Tell me about SpaceX achievements.',
    context: ['SpaceX achieved first successful landing in 2015.', 'Their first crewed mission was in 2020.'],
    output: 'Before anyone else, SpaceX pioneered reusable rockets with their first landing in 2014.',
    expectedResult: {
      score: 0.5,
      reason: 'One context statement is contradicted through implicit claim about timing (2014 vs 2015).',
    },
  },
  {
    // Numerical approximations
    input: 'Describe company metrics.',
    context: ['The company has exactly 1,234 employees.', 'Revenue reached $50.5 million in 2022.'],
    output: 'The company employs around 1,200 people and made about $50 million in 2022.',
    expectedResult: {
      score: 0.0,
      reason: 'Approximate numbers that reasonably represent the actual figures are not considered contradictions.',
    },
  },
  {
    // Out of scope additions
    input: 'Tell me about the company.',
    context: ['The company was founded in New York.', 'They specialize in software.'],
    output:
      'The company, founded in New York, specializes in software and has offices worldwide with plans to expand into AI.',
    expectedResult: {
      score: 0.0,
      reason:
        'Additional information beyond context scope is not counted as contradictions unless it directly conflicts with context.',
    },
  },
  {
    // Temporal contradictions
    input: 'Describe the project timeline.',
    context: [
      'Project started in January 2023.',
      'Phase 1 completed in March 2023.',
      'Phase 2 completed in June 2023.',
    ],
    output: 'The project began in January 2023, with Phase 2 finishing before Phase 1 in February.',
    expectedResult: {
      score: 0.67,
      reason:
        'Two context statements are contradicted through temporal inconsistency in phase completion order and dates.',
    },
  },
  {
    // Numerical contradiction despite approximation
    input: 'Tell me about the company size.',
    context: ['The company employs 300 people globally.'],
    output: 'The company has approximately 1000 employees worldwide.',
    expectedResult: {
      score: 1.0,
      reason:
        'Despite using "approximately", the claimed number (1000) represents a deviation too large from the actual value (300) to be considered a reasonable approximation.',
    },
  },
];

const model = openai('gpt-4o');
describe(
  'HallucinationMetric',
  () => {
    it('should handle perfect alignment', async () => {
      const testCase = testCases[0]!;
      const metric = new HallucinationMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 2);
    });

    it('should handle complete hallucination', async () => {
      const testCase = testCases[1]!;
      const metric = new HallucinationMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 2);
    });

    it('should handle partial hallucination', async () => {
      const testCase = testCases[2]!;
      const metric = new HallucinationMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 2);
    });

    it('should handle empty output', async () => {
      const testCase = testCases[3]!;
      const metric = new HallucinationMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBe(testCase.expectedResult.score);
    });

    it('should handle speculative language', async () => {
      const testCase = testCases[4]!;
      const metric = new HallucinationMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 2);
    });

    it('should handle empty context', async () => {
      const testCase = testCases[5]!;
      const metric = new HallucinationMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBe(testCase.expectedResult.score);
    });

    it('should handle implicit contradictions', async () => {
      const testCase = testCases[6]!;
      const metric = new HallucinationMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 2);
    });

    it('should handle numerical approximations', async () => {
      const testCase = testCases[7]!;
      const metric = new HallucinationMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 2);
    });

    it('should handle out of scope additions', async () => {
      const testCase = testCases[8]!;
      const metric = new HallucinationMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 2);
    });

    it('should handle temporal contradictions', async () => {
      const testCase = testCases[9]!;
      const metric = new HallucinationMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 2);
    });

    it('should handle numerical contradiction despite approximation', async () => {
      const testCase = testCases[10]!;
      const metric = new HallucinationMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 2);
    });
  },
  {
    timeout: 15 * 10000,
  },
);
