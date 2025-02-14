import { createOpenAI } from '@ai-sdk/openai';
import { describe, it, expect } from 'vitest';

import { TestCase } from '../utils';

import { PromptAlignmentMetric } from './index';

export type PromptAlignmentTestCase = TestCase & {
  instructions: string[];
  expectedResult: TestCase['expectedResult'] & {
    scoreDetails: {
      totalInstructions: number;
      applicableInstructions: number;
      followedInstructions: number;
      naInstructions: number;
    };
  };
};

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const model = openai('gpt-4o');

const testCases: PromptAlignmentTestCase[] = [
  {
    // Perfect alignment (score: 1.0)
    instructions: ['Reply in all uppercase'],
    input: 'What is the weather?',
    output: 'THE WEATHER IS SUNNY TODAY.',
    expectedResult: {
      score: 1.0,
      reason: 'The output follows the uppercase instruction perfectly',
      scoreDetails: {
        totalInstructions: 1,
        applicableInstructions: 1,
        followedInstructions: 1,
        naInstructions: 0,
      },
    },
  },
  {
    // Zero alignment (score: 0)
    instructions: ['Reply in all uppercase'],
    input: 'What is the weather?',
    output: 'The weather is sunny today.',
    expectedResult: {
      score: 0,
      reason: 'The output does not follow the uppercase instruction',
      scoreDetails: {
        totalInstructions: 1,
        applicableInstructions: 1,
        followedInstructions: 0,
        naInstructions: 0,
      },
    },
  },
  {
    // Multiple instructions - all followed (score: 1.0)
    instructions: ['Reply in all uppercase', 'End with an exclamation mark'],
    input: 'What is the weather?',
    output: 'THE WEATHER IS SUNNY TODAY!',
    expectedResult: {
      score: 1.0,
      reason: 'The output follows both uppercase and exclamation mark instructions',
      scoreDetails: {
        totalInstructions: 2,
        applicableInstructions: 2,
        followedInstructions: 2,
        naInstructions: 0,
      },
    },
  },
  {
    // Multiple instructions - partial follow (score: 0.5)
    instructions: ['Reply in all uppercase', 'End with an exclamation mark'],
    input: 'What is the weather?',
    output: 'THE WEATHER IS SUNNY TODAY.',
    expectedResult: {
      score: 0.5,
      reason: 'The output follows the uppercase instruction but lacks an exclamation mark',
      scoreDetails: {
        totalInstructions: 2,
        applicableInstructions: 2,
        followedInstructions: 1,
        naInstructions: 0,
      },
    },
  },
  {
    // Complex multiple instructions (score: 1.0)
    instructions: ['Start with "Answer:"', 'Use exactly four sentences', 'End with a period'],
    input: 'Describe the seasons.',
    output: 'Answer: Spring brings flowers. Summer brings heat. Fall brings colors. Winter brings snow.',
    expectedResult: {
      score: 1.0,
      reason: 'The output follows all formatting instructions precisely',
      scoreDetails: {
        totalInstructions: 3,
        applicableInstructions: 3,
        followedInstructions: 3,
        naInstructions: 0,
      },
    },
  },
  {
    // Empty output (score: 0)
    instructions: ['Reply in all uppercase'],
    input: 'What is the weather?',
    output: '',
    expectedResult: {
      score: 0,
      reason: 'Empty output cannot follow any instructions',
      scoreDetails: {
        totalInstructions: 1,
        applicableInstructions: 1,
        followedInstructions: 0,
        naInstructions: 0,
      },
    },
  },
  {
    // All instructions not applicable (score: 0)
    instructions: ['Include transaction details', 'Show account balance', 'List recent payments'],
    input: 'What is the weather in Paris?',
    output: 'It is currently 22°C and sunny in Paris.',
    expectedResult: {
      score: 0.0,
      reason: 'No instruction alignment possible - all instructions are not applicable for a weather query',
      scoreDetails: {
        totalInstructions: 3,
        applicableInstructions: 0,
        followedInstructions: 0,
        naInstructions: 3,
      },
    },
  },
  {
    // Mix of applicable and non-applicable instructions in email context (score: 0)
    instructions: [
      'Include email signature',
      'Check account balance',
      'Use professional tone',
      'List transaction history',
    ],
    input: 'Write an email to schedule a meeting',
    output: 'hey lets meet tmrw',
    expectedResult: {
      score: 0,
      reason:
        'The output does not follow any of the applicable instructions - missing signature and uses informal tone',
      scoreDetails: {
        totalInstructions: 4,
        applicableInstructions: 2,
        followedInstructions: 0,
        naInstructions: 2,
      },
    },
  },
  {
    // Mix of yes, no, and n/a with domain-specific instructions (score: 0.5)
    instructions: [
      'Include temperature in weather reports',
      'Mention wind conditions',
      'Show account balance',
      'Use proper English',
      'List recent payments',
      'End with a period',
    ],
    input: 'What is the weather in Paris?',
    output: 'The temperature is 22°C in Paris.',
    expectedResult: {
      score: 0.75,
      reason:
        'Three out of four applicable instructions followed (temperature, English, and period correct, but missing wind conditions)',
      scoreDetails: {
        totalInstructions: 6,
        applicableInstructions: 4,
        followedInstructions: 3,
        naInstructions: 2,
      },
    },
  },
  {
    instructions: [
      'Be concise and direct in your responses while maintaining a professional and friendly tone.',
      'When providing weather information, include temperature, conditions, and any relevant weather alerts.',
      'For transaction analysis, focus on patterns, unusual spending, and actionable insights.',
      'Always prioritize user privacy and security - never share sensitive information.',
      'Use natural, conversational language while maintaining professionalism.',
      'Provide specific, actionable recommendations when appropriate.',
      'Acknowledge uncertainty when present and avoid making assumptions.',
      'Break down complex information into digestible parts.',
      'Ask clarifying questions when user intent is unclear.',
      'Maintain consistent formatting in responses for better readability.',
    ],
    input: 'Get me some financial info',
    output: `I'm here to help with weather information. If you need weather details for a specific location, please let me know the location, and I'll provide the current weather conditions for you.`,
    expectedResult: {
      score: 0.83,
      reason: 'No instruction alignment possible - all instructions are not applicable for a weather query',
      scoreDetails: {
        totalInstructions: 10,
        applicableInstructions: 6,
        followedInstructions: 5,
        naInstructions: 4,
      },
    },
  },
];

const SECONDS = 10000;

describe(
  'PromptAlignmentMetric',
  () => {
    it('should measure perfect alignment with single instruction', async () => {
      const testCase = testCases[0]!;
      const metric = new PromptAlignmentMetric(model, {
        instructions: testCase.instructions,
      });

      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBe(testCase.expectedResult.score);
      expect(result.info.scoreDetails).toEqual(testCase.expectedResult.scoreDetails);
    });

    it('should measure zero alignment with single instruction', async () => {
      const testCase = testCases[1]!;
      const metric = new PromptAlignmentMetric(model, {
        instructions: testCase.instructions,
      });

      const result = await metric.measure(testCase.input, testCase.output);

      expect(result.score).toBe(testCase.expectedResult.score);
      expect(result.info.scoreDetails).toEqual(testCase.expectedResult.scoreDetails);
    });

    it('should measure perfect alignment with multiple instructions', async () => {
      const testCase = testCases[2]!;
      const metric = new PromptAlignmentMetric(model, {
        instructions: testCase.instructions,
      });

      const result = await metric.measure(testCase.input, testCase.output);

      expect(result.score).toBe(testCase.expectedResult.score);
      expect(result.info.scoreDetails).toEqual(testCase.expectedResult.scoreDetails);
    });

    it('should measure partial alignment with multiple instructions', async () => {
      const testCase = testCases[3]!;
      const metric = new PromptAlignmentMetric(model, {
        instructions: testCase.instructions,
      });

      const result = await metric.measure(testCase.input, testCase.output);

      expect(result.score).toBe(testCase.expectedResult.score);
      expect(result.info.scoreDetails).toEqual(testCase.expectedResult.scoreDetails);
    });

    it('should measure alignment with complex formatting instructions', async () => {
      const testCase = testCases[4]!;
      const metric = new PromptAlignmentMetric(model, {
        instructions: testCase.instructions,
      });

      const result = await metric.measure(testCase.input, testCase.output);

      expect(result.score).toBe(testCase.expectedResult.score);
      expect(result.info.scoreDetails).toEqual(testCase.expectedResult.scoreDetails);
    });

    it('should handle empty output', async () => {
      const testCase = testCases[5]!;
      const metric = new PromptAlignmentMetric(model, {
        instructions: testCase.instructions,
      });

      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBe(testCase.expectedResult.score);
      expect(result.info.scoreDetails).toEqual(testCase.expectedResult.scoreDetails);
    });

    it('should handle all instructions being not applicable', async () => {
      const testCase = testCases[6]!;
      const metric = new PromptAlignmentMetric(model, {
        instructions: testCase.instructions,
      });

      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBe(testCase.expectedResult.score);
      expect(result.info.scoreDetails).toEqual(testCase.expectedResult.scoreDetails);
    });

    it('should handle mix of applicable and not applicable instructions', async () => {
      const testCase = testCases[7]!;
      const metric = new PromptAlignmentMetric(model, {
        instructions: testCase.instructions,
      });

      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBe(testCase.expectedResult.score);
      expect(result.info.scoreDetails).toEqual(testCase.expectedResult.scoreDetails);
    });

    it('should calculate correct score with mix of yes, no, and n/a verdicts', async () => {
      const testCase = testCases[8]!;
      const metric = new PromptAlignmentMetric(model, {
        instructions: testCase.instructions,
      });

      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 2);
      expect(result.info.scoreDetails).toEqual(testCase.expectedResult.scoreDetails);
    });

    it('should calculate correct score with complex formatting instructions', async () => {
      const testCase = testCases[9]!;
      const metric = new PromptAlignmentMetric(model, {
        instructions: testCase.instructions,
      });

      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 2);
      expect(result.info.scoreDetails).toEqual(testCase.expectedResult.scoreDetails);
    });
  },
  {
    timeout: 15 * SECONDS,
  },
);
