import { createOpenAI } from '@ai-sdk/openai';
import { describe, it, expect, vi } from 'vitest';

import type { TestCase } from '../utils';
import { isCloserTo } from '../utils';

import { SummarizationMetric } from './index';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const model = openai('gpt-4o');

const testCases: TestCase[] = [
  {
    // Perfect summarization
    input:
      'The company XYZ was founded in 2010 in San Francisco. They specialize in artificial intelligence and have developed several groundbreaking products. Their flagship product, launched in 2015, has over 1 million users worldwide.',
    output:
      'XYZ, founded in 2010 in San Francisco, is an AI company known for their groundbreaking products. Their main product, released in 2015, serves over 1 million users globally.',
    expectedResult: {
      score: 1.0,
      reason:
        'The summary accurately captures all key information and contains no contradictions or unsupported claims',
    },
  },
  {
    // Mixed accuracy with contradictions
    input:
      'The company XYZ was founded in 2010 in San Francisco. They specialize in artificial intelligence and have developed several groundbreaking products. Their flagship product, launched in 2015, has over 1 million users worldwide.',
    output: 'XYZ, founded in 2012 in San Francisco, is an AI company. Their main product has 2 million users globally.',
    expectedResult: {
      score: 0.33,
      reason:
        'Contains both accurate information (location, AI focus) and contradictions (founding year, user count). Misses key information about product launch date and multiple products. Incorrect numbers are treated as contradictions, not approximations.',
    },
  },
  {
    // Missing key information
    input:
      'The company XYZ was founded in 2010 in San Francisco. They specialize in artificial intelligence and have developed several groundbreaking products. Their flagship product, launched in 2015, has over 1 million users worldwide.',
    output: 'XYZ is a technology company based in San Francisco.',
    expectedResult: {
      score: 0.2,
      reason:
        'While factually accurate about location, the summary omits founding year, AI focus, products, and user base. Tech company claim is unverifiable.',
    },
  },
  {
    // Empty output
    input: 'The company XYZ was founded in 2010 in San Francisco.',
    output: '',
    expectedResult: {
      score: 0,
      reason: 'No summary provided for evaluation',
    },
  },
  {
    // Speculative additions
    input: 'The company XYZ was founded in 2010 in San Francisco.',
    output: 'XYZ, founded in 2010 in San Francisco, might expand to Europe next year and could become a market leader.',
    expectedResult: {
      score: 0.5,
      reason:
        'The factual claims about founding year and location are correct, but includes unsupported speculative claims about expansion and market position',
    },
  },
  {
    // Incorrect emphasis
    input:
      'The company XYZ was founded in 2010 in San Francisco. Their groundbreaking AI product has transformed the industry.',
    output: 'XYZ, a San Francisco company since 2010, has offices worldwide.',
    expectedResult: {
      score: 0.5,
      reason:
        'While location and founding date are correct, misses key AI impact and adds unsupported claims about offices',
    },
  },
  {
    // Technical accuracy with missing context
    input: `XYZ's AI platform processes 1 million transactions per second using distributed computing. The system was developed over 5 years with a team of 100 engineers.`,
    output: `XYZ's platform handles 1 million transactions per second.`,
    expectedResult: {
      score: 0.25,
      reason:
        'While the transaction speed is accurately reported (perfect alignment), the summary omits crucial technical context about AI, distributed computing, development time, and team size (poor coverage: 1/4 key points).',
    },
  },
  {
    // Numerical approximation
    input: 'XYZ has 1,023 employees across 12 offices.',
    output: 'XYZ employs approximately 1,000 people in multiple offices.',
    expectedResult: {
      score: 0,
      reason: 'While using acceptable approximations, fails to precisely convey the specific numbers from the source',
    },
  },
  {
    // Mixed tenses
    input: 'XYZ launched in 2010 and has grown steadily. They plan to expand next year.',
    output: 'XYZ, which started in 2010, continues to grow and has future expansion plans.',
    expectedResult: {
      score: 0.33,
      reason:
        'While factually accurate, the summary unnecessarily loses precision by making specific details vague (steady growth → continues to grow, next year → future plans) without gaining brevity or clarity.',
    },
  },
  {
    // Subjective interpretation
    input: `XYZ's revenue grew by 50% last year, reaching $100 million.`,
    output: 'XYZ had an impressive year with substantial revenue growth to $100 million.',
    expectedResult: {
      score: 0.5,
      reason:
        'While revenue numbers are accurate, adds subjective interpretation ("impressive") and omits specific growth percentage',
    },
  },
  {
    // High alignment, low coverage
    input: `The company ABC was founded in 2020 in New York. They have developed revolutionary quantum computing technology. 
    Their first product achieved quantum supremacy in 2022. The team consists of 50 PhD researchers and has secured $100M in funding.
    They have partnerships with major tech companies and are expanding into Europe.`,
    output: 'ABC is a New York-based company founded in 2020.',
    expectedResult: {
      score: 0.2,
      reason:
        'While all stated facts are accurate (high alignment), the summary misses crucial information about quantum computing, achievements, team, funding, and expansion plans (low coverage).',
    },
  },
  {
    // Low alignment, high coverage
    input: `The company ABC was founded in 2020 in New York. They have developed revolutionary quantum computing technology. 
    Their first product achieved quantum supremacy in 2022.`,
    output: `ABC, founded in 2021 in Boston, has made breakthroughs in quantum computing with their first product achieving quantum supremacy in 2022. 
    They are leaders in the quantum computing field.`,
    expectedResult: {
      score: 0.5,
      reason:
        'While the summary covers most key points (high coverage), it contains factual errors about founding year and location (low alignment).',
    },
  },
  {
    // Single word summary
    input:
      'The company XYZ specializes in artificial intelligence and machine learning, with offices in multiple countries.',
    output: 'AI.',
    expectedResult: {
      score: 0,
      reason: 'While technically accurate, the summary is extremely minimal and misses almost all key information',
    },
  },
  {
    // Repetitive summary
    input: 'XYZ develops AI solutions for healthcare.',
    output: 'XYZ is an AI company that develops AI solutions. Their AI technology is used in AI applications.',
    expectedResult: {
      score: 0.33,
      reason:
        'While factually correct about AI, the summary is unnecessarily repetitive and fails to mention the healthcare focus',
    },
  },
  {
    // Summary longer than input
    input: 'XYZ is a tech startup.',
    output:
      'XYZ is a technology company that develops software solutions and might be working on various projects across different sectors with potential future expansion plans.',
    expectedResult: {
      score: 0,
      reason: 'The summary adds many unsupported claims and is inappropriately verbose for the given input',
    },
  },
];

const SECONDS = 1000;

vi.setConfig({
  testTimeout: 30 * SECONDS,
});

describe('SummarizationMetric', () => {
  const metric = new SummarizationMetric(model);

  it('should handle perfect summarization', async () => {
    const testCase = testCases[0]!;
    const result = await metric.measure(testCase.input, testCase.output);
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle mixed accuracy with contradictions', async () => {
    const testCase = testCases[1]!;
    const result = await metric.measure(testCase.input, testCase.output);
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle missing key information', async () => {
    const testCase = testCases[2]!;
    const result = await metric.measure(testCase.input, testCase.output);
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle empty output', async () => {
    const testCase = testCases[3]!;
    const result = await metric.measure(testCase.input, testCase.output);
    expect(result.score).toBe(testCase.expectedResult.score);
  });

  it('should handle speculative additions', async () => {
    const testCase = testCases[4]!;
    const result = await metric.measure(testCase.input, testCase.output);
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle incorrect emphasis', async () => {
    const testCase = testCases[5]!;
    const result = await metric.measure(testCase.input, testCase.output);
    expect(isCloserTo(result.score, testCase.expectedResult.score, 0)).toBe(true);
  });

  it('should handle technical accuracy with missing context', async () => {
    const testCase = testCases[6]!;
    const result = await metric.measure(testCase.input, testCase.output);
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle numerical approximation', async () => {
    const testCase = testCases[7]!;
    const result = await metric.measure(testCase.input, testCase.output);
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle mixed tenses', async () => {
    const testCase = testCases[8]!;
    const result = await metric.measure(testCase.input, testCase.output);
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle subjective interpretation', async () => {
    const testCase = testCases[9]!;
    const result = await metric.measure(testCase.input, testCase.output);
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle high alignment with low coverage', async () => {
    const testCase = testCases[10]!;
    const result = await metric.measure(testCase.input, testCase.output);
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle low alignment with high coverage', async () => {
    const testCase = testCases[11]!;
    const result = await metric.measure(testCase.input, testCase.output);
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle single word summary', async () => {
    const testCase = testCases[12]!;
    const result = await metric.measure(testCase.input, testCase.output);
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle repetitive summary', async () => {
    const testCase = testCases[13]!;
    const result = await metric.measure(testCase.input, testCase.output);
    expect(isCloserTo(result.score, testCase.expectedResult.score, 1)).toBe(true);
  });

  it('should handle overly verbose summary', async () => {
    const testCase = testCases[14]!;
    const result = await metric.measure(testCase.input, testCase.output);
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });
});
