import { createOpenAI } from '@ai-sdk/openai';
import { describe, it, expect } from 'vitest';

import type { TestCaseWithContext } from '../utils';
import { isCloserTo } from '../utils';

import { ContextualRecallMetric } from './index';

const testCases: TestCaseWithContext[] = [
  {
    input: `What are the health benefits of drinking green tea?`,
    output:
      'Green tea contains powerful antioxidants called catechins that help fight free radicals. It has been shown to boost metabolism and aid in weight loss. Regular consumption may reduce the risk of heart disease by lowering bad cholesterol levels. Studies have also linked green tea to improved brain function and potential cancer-fighting properties.',
    context: [
      'Green tea is rich in catechins, which are powerful antioxidants that neutralize harmful free radicals in the body.',
      'Research shows that the compounds in green tea can increase metabolic rate and promote fat burning.',
      'Regular green tea consumption has been linked to reduced levels of LDL (bad) cholesterol, potentially lowering heart disease risk.',
      'Studies indicate that green tea may enhance cognitive function and contains compounds that could help prevent certain types of cancer.',
    ],
    expectedResult: {
      score: 1.0,
    },
  },
  {
    input: `What were the major causes of World War I?`,
    output:
      '"World War I was triggered by the assassination of Archduke Franz Ferdinand. The underlying causes included militarism among European powers, a complex system of alliances, imperialism and competition for colonies, and rising nationalism. The alliance system drew various nations into the conflict, turning it into a global war. Economic competition between major powers also played a significant role.',
    context: [
      'The immediate trigger for World War I was the assassination of Archduke Franz Ferdinand in Sarajevo.',
      'The system of alliances in Europe meant that countries were obligated to support their allies in case of war.',
      'Military buildup among European nations created an atmosphere of tension and distrust.',
    ],
    expectedResult: {
      score: 0.5,
    },
  },
  {
    input: `What is the process of photosynthesis?`,
    output:
      'Photosynthesis is the process by which plants convert light energy into chemical energy. It takes place in the chloroplasts, specifically using chlorophyll in the thylakoids. During photosynthesis, plants take in carbon dioxide and water, using sunlight to convert them into glucose and oxygen. This process occurs in two stages: the light-dependent reactions and the Calvin cycle. The glucose produced serves as food for the plant, while the oxygen is released into the atmosphere.',
    context: [
      "Plants are essential for maintaining Earth's ecosystem balance.",
      'Different species of plants have evolved various adaptations to survive in their environments.',
      'The agricultural revolution led to humans cultivating plants for food production.',
      'Deforestation poses a significant threat to plant biodiversity worldwide.',
    ],
    expectedResult: {
      score: 0,
    },
  },
];

const SECONDS = 10000;

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const model = openai('gpt-4o');

describe(
  'ContextualRecallMetric',
  () => {
    it('should succeed when context is relevant', async () => {
      const testCase = testCases[0]!;
      const metric = new ContextualRecallMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 2);
    });

    it('should be mixed', async () => {
      const testCase = testCases[1]!;
      const metric = new ContextualRecallMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);

      expect(isCloserTo(result.score, testCase.expectedResult.score, 1)).toBe(true);
    });

    it('should be none', async () => {
      const testCase = testCases[2]!;
      const metric = new ContextualRecallMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });
  },
  {
    timeout: 15 * SECONDS,
  },
);
