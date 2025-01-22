import { describe, it, expect, jest } from '@jest/globals';
import { type ModelConfig } from '@mastra/core';

import { SummarizationMetric } from './index';

const testCases = [
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
      score: 0.4,
      reason:
        'The summary has mixed accuracy: correct about location and AI focus, but wrong about founding year and user count. It also misses key information about product launch date.',
    },
  },
  {
    // Missing key information
    input:
      'The company XYZ was founded in 2010 in San Francisco. They specialize in artificial intelligence and have developed several groundbreaking products. Their flagship product, launched in 2015, has over 1 million users worldwide.',
    output: 'XYZ is a technology company based in San Francisco.',
    expectedResult: {
      score: 0.33,
      reason:
        'While accurate, the summary omits crucial information about founding year, AI specialization, and product details',
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
      score: 0.33,
      reason:
        'While the factual information is correct, the summary includes unsupported speculative claims about future expansion',
    },
  },
  {
    // Overly detailed/verbose
    input: 'The company XYZ was founded in 2010.',
    output:
      'XYZ was established in 2010 in what was likely a strategic move to enter the technology sector during the post-recession recovery period.',
    expectedResult: {
      score: 0.5,
      reason:
        'The core fact is correct but the summary adds unsupported context and speculation about business strategy',
    },
  },
  {
    // Partial information with inference
    input: 'The company XYZ specializes in artificial intelligence. Their products are used by major tech companies.',
    output: 'XYZ develops AI solutions that are popular in the technology industry.',
    expectedResult: {
      score: 1.0,
      reason: 'The summary accurately rephrases the key information without adding unsupported claims',
    },
  },
  {
    // Incorrect emphasis
    input:
      'The company XYZ was founded in 2010 in San Francisco. Their groundbreaking AI product has transformed the industry.',
    output: 'XYZ, a San Francisco company since 2010, has offices worldwide.',
    expectedResult: {
      score: 0.33,
      reason:
        'While some facts are correct, the summary misses the main point about AI impact and adds unsupported claims about offices',
    },
  },
  {
    // Technical accuracy with missing context
    input: `XYZ's AI platform processes 1 million transactions per second using distributed computing. The system was developed over 5 years with a team of 100 engineers.`,
    output: `XYZ's platform handles 1 million transactions per second.`,
    expectedResult: {
      score: 0.5,
      reason:
        'While technically accurate, the summary omits important context about AI, development time, and team size',
    },
  },
  {
    // Numerical approximation
    input: 'XYZ has 1,023 employees across 12 offices.',
    output: 'XYZ employs approximately 1,000 people in multiple offices.',
    expectedResult: {
      score: 1.0,
      reason: 'The summary uses acceptable approximation for numbers while maintaining accuracy',
    },
  },
  {
    // Mixed tenses
    input: 'XYZ launched in 2010 and has grown steadily. They plan to expand next year.',
    output: 'XYZ, which started in 2010, continues to grow and has future expansion plans.',
    expectedResult: {
      score: 1.0,
      reason: 'The summary accurately captures past events and future plans while maintaining temporal context',
    },
  },
  {
    // Subjective interpretation
    input: `XYZ's revenue grew by 50% last year, reaching $100 million.`,
    output: 'XYZ had an impressive year with substantial revenue growth to $100 million.',
    expectedResult: {
      score: 0.75,
      reason: 'While the numbers are accurate, the summary adds subjective interpretation ("impressive")',
    },
  },
  {
    // High alignment, low coverage
    input: `The company ABC was founded in 2020 in New York. They have developed revolutionary quantum computing technology. 
    Their first product achieved quantum supremacy in 2022. The team consists of 50 PhD researchers and has secured $100M in funding.
    They have partnerships with major tech companies and are expanding into Europe.`,
    output: 'ABC is a New York-based company founded in 2020.',
    expectedResult: {
      score: 0.3,
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
      score: 0.25,
      reason:
        'While the summary covers most key points (high coverage), it contains factual errors about founding year and location (low alignment).',
    },
  },
  {
    // Perfect alignment with minimal content
    input: `The company ABC was founded in 2020 in New York. They have developed revolutionary quantum computing technology. 
    Their first product achieved quantum supremacy in 2022.`,
    output: 'ABC was founded in 2020.',
    expectedResult: {
      score: 0.2,
      reason:
        'The single claim is perfectly accurate (perfect alignment) but misses most key information (very low coverage).',
    },
  },
  {
    // Single word summary
    input:
      'The company XYZ specializes in artificial intelligence and machine learning, with offices in multiple countries.',
    output: 'AI.',
    expectedResult: {
      score: 0.1,
      reason: 'While technically accurate, the summary is extremely minimal and misses almost all key information',
    },
  },
  {
    // Repetitive summary
    input: 'XYZ develops AI solutions for healthcare.',
    output: 'XYZ is an AI company that develops AI solutions. Their AI technology is used in AI applications.',
    expectedResult: {
      score: 0.4,
      reason:
        'While factually correct, the summary is unnecessarily repetitive and fails to mention the healthcare focus',
    },
  },
  {
    // Summary longer than input
    input: 'XYZ is a tech startup.',
    output:
      'XYZ is a technology company that develops software solutions and might be working on various projects across different sectors with potential future expansion plans.',
    expectedResult: {
      score: 0.2,
      reason: 'The summary adds many unsupported claims and is inappropriately verbose for the given input',
    },
  },
];

const SECONDS = 10000;
jest.setTimeout(15 * SECONDS);

const modelConfig: ModelConfig = {
  provider: 'OPEN_AI',
  name: 'gpt-4o',
  toolChoice: 'auto',
  apiKey: process.env.OPENAI_API_KEY,
};

describe('SummarizationMetric', () => {
  const metric = new SummarizationMetric(modelConfig);

  it('should handle perfect summarization', async () => {
    const testCase = testCases[0]!;
    console.log('perfect summarization');
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
    });

    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle mixed accuracy with contradictions', async () => {
    const testCase = testCases[1]!;
    console.log('mixed accuracy with contradictions');
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
    });

    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle missing key information', async () => {
    const testCase = testCases[2]!;
    console.log('missing key information');
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
    });

    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle empty output', async () => {
    const testCase = testCases[3]!;
    console.log('empty output');
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
    });

    expect(result.score).toBe(testCase.expectedResult.score);
  });

  it('should handle speculative additions', async () => {
    const testCase = testCases[4]!;
    console.log('speculative additions');
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
    });

    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle overly detailed summaries', async () => {
    const testCase = testCases[5]!;
    console.log('overly detailed summaries');
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
    });

    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle partial information with inference', async () => {
    const testCase = testCases[6]!;
    console.log('partial information with inference');
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
    });

    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle incorrect emphasis', async () => {
    const testCase = testCases[7]!;
    console.log('incorrect emphasis');
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
    });

    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle technical accuracy with missing context', async () => {
    const testCase = testCases[8]!;
    console.log('technical accuracy with missing context');
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
    });

    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle numerical approximation', async () => {
    const testCase = testCases[9]!;
    console.log('numerical approximation');
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
    });

    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle mixed tenses', async () => {
    const testCase = testCases[10]!;
    console.log('mixed tenses');
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
    });

    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle subjective interpretation', async () => {
    const testCase = testCases[11]!;
    console.log('subjective interpretation');
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
    });

    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle high alignment with low coverage', async () => {
    const testCase = testCases.find(t => t.expectedResult.reason.includes('high alignment'))!;
    console.log('high alignment with low coverage');
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
    });
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle low alignment with high coverage', async () => {
    const testCase = testCases.find(t => t.expectedResult.reason.includes('low alignment'))!;
    console.log('low alignment with high coverage');
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
    });
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle perfect alignment with minimal content', async () => {
    const testCase = testCases.find(t => t.expectedResult.reason.includes('perfect alignment'))!;
    console.log('perfect alignment with minimal content');
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
    });
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle single word summary', async () => {
    const testCase = testCases.find(t => t.expectedResult.reason.includes('extremely minimal'))!;
    console.log('single word summary');
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
    });
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle repetitive summary', async () => {
    const testCase = testCases.find(t => t.expectedResult.reason.includes('repetitive'))!;
    console.log('repetitive summary');
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
    });
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle overly verbose summary', async () => {
    const testCase = testCases.find(t => t.expectedResult.reason.includes('inappropriately verbose'))!;
    console.log('overly verbose summary');
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
    });
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });
});
