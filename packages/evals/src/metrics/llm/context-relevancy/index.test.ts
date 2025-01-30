import type { ModelConfig } from '@mastra/core/llm';
import { describe, it, expect, vi } from 'vitest';

import { isCloserTo } from '../utils';
import { TestCaseWithContext } from '../utils';

import { ContextRelevancyMetric } from './index';

vi.setConfig({
  testTimeout: 15000,
});

const testCases: TestCaseWithContext[] = [
  {
    input: 'What are the symptoms and treatment options for type 2 diabetes?',
    output:
      'Type 2 diabetes symptoms include increased thirst, frequent urination, fatigue, and blurred vision. Treatment options include lifestyle changes, blood sugar monitoring, and medications like metformin or insulin therapy.',
    context: [
      'Common symptoms of type 2 diabetes include increased thirst, frequent urination, unexplained weight loss, fatigue, and blurred vision. Early detection of these symptoms is crucial for proper management.',
      'Treatment options for type 2 diabetes typically include lifestyle modifications such as diet changes and regular exercise. Regular monitoring of blood sugar levels is essential for managing the condition.',
      'Medications for type 2 diabetes may include metformin, sulfonylureas, or insulin therapy, depending on the severity of the condition and individual patient factors.',
    ],
    expectedResult: {
      score: 1.0,
      reason:
        'All context pieces are highly relevant to the question, providing specific information about both symptoms and treatments for type 2 diabetes. Each piece of context directly contributes to answering the question comprehensively.',
    },
  },
  {
    input: 'What caused the 2008 financial crisis?',
    output:
      'The 2008 financial crisis was caused by the collapse of the subprime mortgage market, though there were other contributing factors in the banking sector.',
    context: [
      'The 2008 financial crisis was primarily triggered by the collapse of the subprime mortgage market in the United States.',
      'The history of banking regulation in the United States dates back to the Great Depression of the 1930s.',
      'Modern investment banking practices involve various financial instruments and risk management strategies.',
    ],
    expectedResult: {
      score: 0.5,
      reason:
        "Only one context piece directly addresses the cause of the 2008 financial crisis. The other two pieces provide general banking information that isn't specifically relevant to the question about the crisis's causes.",
    },
  },
  {
    input: 'How does a solar eclipse occur?',
    output:
      "A solar eclipse occurs when the Moon passes between the Earth and the Sun, temporarily blocking part or all of the Sun's light.",
    context: [
      'Volcanic eruptions can have significant impacts on local weather patterns and air quality.',
      'The Amazon rainforest is home to countless species of plants and animals.',
      'Wind turbines convert kinetic energy from wind into electrical power.',
    ],
    expectedResult: {
      score: 0.0,
      reason:
        'None of the provided context pieces contain any information about solar eclipses or related astronomical phenomena. The contexts discuss entirely unrelated topics such as volcanoes, rainforests, and wind power.',
    },
  },
];

const SECONDS = 10000;

const modelConfig: ModelConfig = {
  provider: 'OPEN_AI',
  name: 'gpt-4o',
  toolChoice: 'auto',
  apiKey: process.env.OPENAI_API_KEY,
};

describe('ContextPrecisionMetric', () => {
  it('should measure perfect context relevancy with all relevant items', async () => {
    const testCase = testCases[0]!;
    const metric = new ContextRelevancyMetric(modelConfig, { context: testCase.context });
    const result = await metric.measure(testCase.input, testCase.output);
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });

  it('should measure mixed relevancy where only some contexts are relevant', async () => {
    const testCase = testCases[1]!;
    const metric = new ContextRelevancyMetric(modelConfig, { context: testCase.context });
    const result = await metric.measure(testCase.input, testCase.output);
    expect(isCloserTo(result.score, testCase.expectedResult.score, 0)).toBe(true);
  });

  it('should measure no relevancy where contexts are completely unrelated', async () => {
    const testCase = testCases[2]!;
    const metric = new ContextRelevancyMetric(modelConfig, { context: testCase.context });
    const result = await metric.measure(testCase.input, testCase.output);
    expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
  });
});
