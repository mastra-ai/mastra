import { openai } from '@ai-sdk/openai';
import { describe, it, expect, vi } from 'vitest';

import type { TestCaseWithContext } from '../utils';

import { HallucinationMetric } from './index';

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

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
    // Complete hallucination - output contradicts context
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
    // Empty output
    input: 'Tell me about Tesla.',
    context: ['Tesla was founded in 2003.', 'Elon Musk joined Tesla in 2004.'],
    output: '',
    expectedResult: {
      score: 0.0,
      reason: 'Empty output cannot contain hallucinations.',
    },
  },
  {
    // Speculative language with known facts
    input: 'Tell me about Tesla.',
    context: ['Tesla was founded in 2003.', 'Elon Musk joined Tesla in 2004.'],
    output: 'Tesla might have been founded around 2003, and I believe Elon Musk possibly joined a year later.',
    expectedResult: {
      score: 0.0,
      reason: 'Speculative language about facts that match context is not considered hallucination.',
    },
  },
  {
    // Empty context
    input: 'Tell me about Tesla.',
    context: [],
    output: 'Tesla was founded in 2001 by Elon Musk.',
    expectedResult: {
      score: 1.0,
      reason: 'With no context provided, any factual claims are considered hallucinations.',
    },
  },
  {
    // Implicit contradictions
    input: 'Tell me about SpaceX achievements.',
    context: ['SpaceX achieved first successful landing in 2015.', 'Their first crewed mission was in 2020.'],
    output: 'Before anyone else, SpaceX pioneered reusable rockets with their first landing in 2014.',
    expectedResult: {
      score: 1.0,
      reason:
        'Both the timing claim (2014 vs 2015) and the unsupported "Before anyone else" pioneering claim are hallucinations.',
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
    output: 'The company, founded in New York, specializes in software and has offices worldwide.',
    expectedResult: {
      score: 0.33,
      reason:
        'One out of three claims (worldwide offices) is a hallucination, while founding location and specialization are supported.',
    },
  },
  {
    // Temporal sequence
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
        'Two out of three claims are hallucinations: Phase 2 completion date and the claim about Phase 2 finishing before Phase 1.',
    },
  },
  {
    // Numerical contradiction
    input: 'Tell me about the company size.',
    context: ['The company employs 300 people globally.'],
    output: 'The company has approximately 1000 employees worldwide.',
    expectedResult: {
      score: 1.0,
      reason:
        'Despite using "approximately", the claimed number (1000) represents a deviation too large from the actual value (300).',
    },
  },
  {
    // Additional information
    input: 'Tell me about Tesla.',
    context: ['Tesla was founded in 2003.'],
    output: 'Tesla, founded in 2003, is a leading electric car manufacturer with global operations.',
    expectedResult: {
      score: 0.67,
      reason:
        'Two out of three claims (being a leading manufacturer and having global operations) are not supported by context.',
    },
  },
  {
    // Speculative claims about unknown facts
    input: 'Tell me about Tesla.',
    context: ['Tesla was founded in 2003.', 'Elon Musk joined Tesla in 2004.'],
    output: 'Tesla was founded in 2003, and might be the most innovative car company in history.',
    expectedResult: {
      score: 0.5,
      reason: 'While founding date is supported, speculative claim about being most innovative is not in context.',
    },
  },
  {
    // Date precision
    input: 'Tell me about SpaceX achievements.',
    context: ['SpaceX achieved first successful landing in December 2015.'],
    output: 'SpaceX made history with their first successful landing in 2015.',
    expectedResult: {
      score: 1.0,
      reason:
        'The statement contains an unsupported subjective claim ("made history") that modifies the factual landing claim.',
    },
  },
  {
    // Numerical precision
    input: 'Tell me about the company size.',
    context: ['The company employs exactly 300 people globally.'],
    output: 'The company has approximately 300 employees worldwide.',
    expectedResult: {
      score: 0.0,
      reason: 'Using "approximately" when context specifies "exactly" is still considered a reasonable approximation.',
    },
  },
  {
    // Mixed precision levels
    input: 'Tell me about revenue growth.',
    context: ['Company revenue grew from exactly $10.5M in Q1 to approximately $20M in Q2.'],
    output: 'Revenue was about $10M in Q1 and exactly $20M in Q2.',
    expectedResult: {
      score: 1.0,
      reason:
        'Mismatched precision levels: uses "about" when context specifies "exactly" for Q1, and uses "exactly" when context specifies "approximately" for Q2.',
    },
  },
  {
    // Relative comparisons
    input: 'Tell me about the market share.',
    context: ['Company A has 30% market share.', 'Company B has 25% market share.'],
    output: 'Company A leads the market with 30% share, ahead of Company B.',
    expectedResult: {
      score: 0.5,
      reason:
        'While the market share numbers are correct, the claim about "leading the market" is not supported as we don\'t know about other companies.',
    },
  },
];

const model = openai('gpt-4o');
describe('HallucinationMetric', () => {
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

  // New tests for stricter hallucination checking
  it('should detect additional information as hallucination', async () => {
    const testCase = testCases[11]!;
    const metric = new HallucinationMetric(model, { context: testCase.context });
    const result = await metric.measure(testCase.input, testCase.output);
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 2);
  });

  it('should detect speculative claims about unknown facts as hallucination', async () => {
    const testCase = testCases[12]!;
    const metric = new HallucinationMetric(model, { context: testCase.context });
    const result = await metric.measure(testCase.input, testCase.output);
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 2);
  });

  it('should enforce strict date matching', async () => {
    const testCase = testCases[13]!;
    const metric = new HallucinationMetric(model, { context: testCase.context });
    const result = await metric.measure(testCase.input, testCase.output);
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 2);
  });

  it('should enforce strict numerical matching', async () => {
    const testCase = testCases[14]!;
    const metric = new HallucinationMetric(model, { context: testCase.context });
    const result = await metric.measure(testCase.input, testCase.output);
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 2);
  });

  it('should handle mixed precision levels', async () => {
    const testCase = testCases[15]!;
    const metric = new HallucinationMetric(model, { context: testCase.context });
    const result = await metric.measure(testCase.input, testCase.output);
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 2);
  });

  it('should handle relative comparisons', async () => {
    const testCase = testCases[16]!;
    const metric = new HallucinationMetric(model, { context: testCase.context });
    const result = await metric.measure(testCase.input, testCase.output);
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 2);
  });
});
