import { it, expect, jest } from '@jest/globals';
import { type ModelConfig } from '@mastra/core';

import { ContextPositionMetric } from './index';

type TestCase = {
  input: string;
  output: string;
  context: string[];
  expectedResult: {
    score: number;
    reason: string;
  };
};

const testCases: TestCase[] = [
  {
    // Perfect ordering with all relevant pieces [1,1,1]
    input: 'What is the Sun?',
    output: 'The Sun is a star that produces its own light.',
    context: [
      'The Sun is a star at the center of our solar system.',
      'Stars like the Sun produce their own light through nuclear fusion.',
      'The Sun provides light and heat to Earth.',
    ],
    expectedResult: {
      score: 10,
      reason: 'All context pieces are relevant and optimally ordered, with the most important definition first.',
    },
  },
  {
    // Mixed relevance case [1,0,1]
    input: 'What is photosynthesis?',
    output: 'Photosynthesis is how plants make food using sunlight.',
    context: [
      'Plants use sunlight to create food through photosynthesis.',
      'Chlorophyll gives plants their green color.',
      'Plants need water and CO2 for photosynthesis.',
    ],
    expectedResult: {
      score: 7.27,
      reason:
        'First and third pieces are relevant, with an irrelevant piece in between, demonstrating proper handling of mixed relevance.',
    },
  },
  {
    // Domain knowledge relevance [1,1,1]
    input: 'How does a car engine work?',
    output: 'A car engine converts gasoline into mechanical energy through combustion.',
    context: [
      'Car engines burn gasoline for power.',
      'Pistons move up and down in the engine.',
      'Spark plugs create electrical sparks.',
    ],
    expectedResult: {
      score: 10,
      reason: 'All pieces contribute domain knowledge: direct explanation, mechanical process, and enabling mechanism.',
    },
  },
  {
    // Mixed relevance with good ordering [1,1,0]
    input: 'What is JavaScript?',
    output: 'JavaScript is a programming language used for web development.',
    context: [
      'JavaScript is a popular programming language.',
      'Web browsers can run JavaScript code.',
      'Computers use binary code.',
    ],
    expectedResult: {
      score: 8.18,
      reason: 'Two relevant pieces at the start, followed by an irrelevant piece.',
    },
  },
  {
    // Single relevant at start [1,0,0]
    input: 'What is precipitation?',
    output: 'Precipitation is water falling from clouds as rain or snow.',
    context: ['Precipitation is water falling from clouds.', 'The Earth is round.', 'Plants are green.'],
    expectedResult: {
      score: 5.45,
      reason: 'Single relevant piece at the start, followed by irrelevant pieces.',
    },
  },
  {
    // Single relevant in middle [0,1,0]
    input: 'What are clouds?',
    output: 'Clouds are visible masses of water droplets in the sky.',
    context: ['The sky is blue.', 'Clouds are made of water droplets.', 'Birds have feathers.'],
    expectedResult: {
      score: 2.73,
      reason: 'Single relevant piece in middle position, with irrelevant pieces before and after.',
    },
  },
  {
    // Single relevant at end [0,0,1]
    input: 'What is the moon?',
    output: "The Moon is Earth's natural satellite.",
    context: ['Stars twinkle at night.', 'The sky appears blue.', 'The Moon orbits around Earth.'],
    expectedResult: {
      score: 1.82,
      reason: 'Single relevant piece at the end, with irrelevant pieces before it.',
    },
  },
  {
    // Empty context (edge case)
    input: 'What is gravity?',
    output: 'Gravity is a force that attracts objects together.',
    context: [],
    expectedResult: {
      score: 0,
      reason: 'No context provided to evaluate.',
    },
  },
  {
    // All irrelevant [0,0,0]
    input: 'What is electricity?',
    output: 'Electricity is the flow of electrical charge.',
    context: ['The weather is sunny today.', 'Birds can fly.', 'Trees grow tall.'],
    expectedResult: {
      score: 0,
      reason: 'No relevant context pieces found.',
    },
  },
  {
    // Complex interdependent context [1,1,1]
    input: 'How do plants grow?',
    output: 'Plants grow through photosynthesis, using water and nutrients from soil.',
    context: [
      'Plants need nutrients from soil to grow.',
      'Photosynthesis converts sunlight to energy.',
      'Roots absorb water from the soil.',
    ],
    expectedResult: {
      score: 10,
      reason: 'All pieces are relevant and work together to explain the concept, with logical ordering.',
    },
  },
  {
    // Single relevant piece [1]
    input: 'What is DNA?',
    output: 'DNA contains genetic information.',
    context: ['DNA stores genetic information in cells.'],
    expectedResult: {
      score: 10,
      reason: 'Single relevant piece in optimal first position.',
    },
  },
  {
    // Two relevant at end [0,1,1]
    input: 'What is a volcano?',
    output: 'A volcano is a mountain that erupts hot lava.',
    context: ['Mountains can be found worldwide.', 'Volcanoes erupt molten rock.', 'Lava flows from volcanic vents.'],
    expectedResult: {
      score: 4.55,
      reason: 'Two relevant pieces appear at the end, after an irrelevant general statement.',
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

describe('ContextPositionMetric', () => {
  const metric = new ContextPositionMetric(modelConfig);

  it('should handle perfect ordering with all relevant pieces', async () => {
    const testCase = testCases[0]!;
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
      context: testCase.context,
    });
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle mixed relevance case', async () => {
    const testCase = testCases[1]!;
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
      context: testCase.context,
    });
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle domain knowledge relevance', async () => {
    const testCase = testCases[2]!;
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
      context: testCase.context,
    });
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle mixed relevance with good ordering', async () => {
    const testCase = testCases[3]!;
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
      context: testCase.context,
    });
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle single relevant piece at start', async () => {
    const testCase = testCases[4]!;
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
      context: testCase.context,
    });
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle single relevant piece in middle', async () => {
    const testCase = testCases[5]!;
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
      context: testCase.context,
    });
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle single relevant piece at end', async () => {
    const testCase = testCases[6]!;
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
      context: testCase.context,
    });
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle empty context', async () => {
    const testCase = testCases[7]!;
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
      context: testCase.context,
    });
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle all irrelevant context', async () => {
    const testCase = testCases[8]!;
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
      context: testCase.context,
    });
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle complex interdependent context', async () => {
    const testCase = testCases[9]!;
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
      context: testCase.context,
    });
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle single piece context', async () => {
    const testCase = testCases[10]!;
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
      context: testCase.context,
    });
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should handle two relevant pieces at end', async () => {
    const testCase = testCases[11]!;
    const result = await metric.measure({
      input: testCase.input,
      output: testCase.output,
      context: testCase.context,
    });
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });
});