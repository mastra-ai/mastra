import { createOpenAI } from '@ai-sdk/openai';
import { describe, it, expect } from 'vitest';
import type { TestCase } from '../../utils';
import { createAgentTestRun, createTestMessage } from '../../utils';
import { createAnswerSimilarityScorer } from '.';

interface AnswerSimilarityTestCase extends TestCase {
  groundTruth: string;
}

const testCases: AnswerSimilarityTestCase[] = [
  {
    input: 'What is the capital of France?',
    output: 'Paris is the capital of France.',
    groundTruth: 'The capital of France is Paris.',
    expectedResult: {
      score: 1.0,
      reason: 'Perfect semantic match - both answers convey identical information',
    },
  },
  {
    input: 'What is the capital of France?',
    output: 'The capital city of France is Paris, which is located in the northern part of the country.',
    groundTruth: 'Paris is the capital of France.',
    expectedResult: {
      score: 0.85,
      reason: 'High similarity with additional correct information beyond ground truth',
    },
  },
  {
    input: 'Explain photosynthesis',
    output: 'Photosynthesis is how plants make food using sunlight.',
    groundTruth:
      'Photosynthesis is the process by which plants convert light energy into chemical energy, using carbon dioxide and water to produce glucose and oxygen.',
    expectedResult: {
      score: 0.3,
      reason: 'Partial match - captures the basic concept but missing key scientific details',
    },
  },
  {
    input: 'What is 2+2?',
    output: '4',
    groundTruth: '4',
    expectedResult: {
      score: 1.0,
      reason: 'Exact match of the answer',
    },
  },
  {
    input: 'What is the speed of light?',
    output: 'The speed of light is approximately 300,000 kilometers per second in a vacuum.',
    groundTruth: 'The speed of light in vacuum is 299,792,458 meters per second.',
    expectedResult: {
      score: 0.65,
      reason: 'Semantically equivalent with different units and approximation',
    },
  },
  {
    input: 'Who wrote Romeo and Juliet?',
    output: 'Romeo and Juliet was written by Christopher Marlowe.',
    groundTruth: 'William Shakespeare wrote Romeo and Juliet.',
    expectedResult: {
      score: 0.0,
      reason: 'Contradiction - incorrect author provided',
    },
  },
  {
    input: 'What are the primary colors?',
    output: 'The primary colors are red and blue.',
    groundTruth: 'The primary colors are red, blue, and yellow.',
    expectedResult: {
      score: 0.5,
      reason: 'Partial match - missing one of three primary colors',
    },
  },
  {
    input: 'Describe the water cycle',
    output: 'Water evaporates from oceans and lakes, forms clouds, and falls as rain.',
    groundTruth:
      'The water cycle involves evaporation of water from bodies of water, condensation into clouds, precipitation as rain or snow, and collection back into water bodies.',
    expectedResult: {
      score: 0.4,
      reason: 'Partial match - good coverage of main concepts but missing condensation and collection stages',
    },
  },
  {
    input: 'What is the capital of Japan?',
    output: 'Kyoto is the capital of Japan.',
    groundTruth: 'Tokyo is the capital of Japan.',
    expectedResult: {
      score: 0.0,
      reason: 'Incorrect answer - wrong city identified as capital',
    },
  },
  {
    input: 'Define machine learning',
    output:
      'Machine learning is a type of artificial intelligence where computers learn from data to make predictions or decisions without being explicitly programmed for each specific task.',
    groundTruth:
      'Machine learning is a subset of AI that enables systems to learn and improve from experience without being explicitly programmed.',
    expectedResult: {
      score: 0.6,
      reason: 'Partial match - same core concepts expressed with slightly different wording',
    },
  },
];

// Test with missing ground truth
const missingGroundTruthCase = {
  input: 'What is the meaning of life?',
  output: '42',
  groundTruth: undefined,
  expectedResult: {
    score: 0,
    reason: 'No ground truth provided for comparison',
  },
};

describe('Answer Similarity Scorer', () => {
  const model = createOpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })('gpt-4o-mini');
  const scorer = createAnswerSimilarityScorer({ model });

  it.each(testCases)(
    'should score "$input" with ground truth correctly',
    async ({ input, output, groundTruth, expectedResult }) => {
      const run = createAgentTestRun({
        inputMessages: [
          createTestMessage({
            id: 'test-input',
            role: 'user',
            content: input,
          }),
        ],
        output: [
          createTestMessage({
            id: 'test-output',
            role: 'assistant',
            content: output,
          }),
        ],
      });
      const runWithGroundTruth = { ...run, groundTruth };

      const result = await scorer.run(runWithGroundTruth);

      expect(result).toBeDefined();
      expect(result.score).toBeDefined();
      expect(typeof result.score).toBe('number');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);

      // Check if score is within reasonable range of expected
      // For contradictory answers (expected score 0), use stricter tolerance
      const tolerance = expectedResult.score === 0 ? 0.15 : 0.25;
      expect(Math.abs(result.score - expectedResult.score)).toBeLessThanOrEqual(tolerance);
    },
    30000,
  );

  it('should handle missing ground truth with requireGroundTruth=true', async () => {
    const scorerStrict = createAnswerSimilarityScorer({
      model,
      options: { requireGroundTruth: true },
    });

    const run = createAgentTestRun({
      inputMessages: [
        createTestMessage({
          id: 'test-input',
          role: 'user',
          content: missingGroundTruthCase.input,
        }),
      ],
      output: [
        createTestMessage({
          id: 'test-output',
          role: 'assistant',
          content: missingGroundTruthCase.output,
        }),
      ],
    });

    await expect(scorerStrict.run(run)).rejects.toThrow(
      'Answer Similarity Scorer requires ground truth to be provided',
    );
  });

  it('should handle missing ground truth with requireGroundTruth=false', async () => {
    const scorerLenient = createAnswerSimilarityScorer({
      model,
      options: { requireGroundTruth: false },
    });

    const run = createAgentTestRun({
      inputMessages: [
        createTestMessage({
          id: 'test-input',
          role: 'user',
          content: missingGroundTruthCase.input,
        }),
      ],
      output: [
        createTestMessage({
          id: 'test-output',
          role: 'assistant',
          content: missingGroundTruthCase.output,
        }),
      ],
    });

    const result = await scorerLenient.run(run);

    expect(result).toBeDefined();
    expect(result.score).toBe(0);
    expect(result.reason?.toLowerCase()).toContain('no ground truth');
  });

  it('should handle different option configurations', async () => {
    const customScorer = createAnswerSimilarityScorer({
      model,
      options: {
        semanticThreshold: 0.7,
        exactMatchBonus: 0.3,
        missingPenalty: 0.2,
        contradictionPenalty: 0.5,
        scale: 10,
      },
    });

    const run = createAgentTestRun({
      inputMessages: [
        createTestMessage({
          id: 'test-input',
          role: 'user',
          content: 'What is 2+2?',
        }),
      ],
      output: [
        createTestMessage({
          id: 'test-output',
          role: 'assistant',
          content: '4',
        }),
      ],
    });
    const runWithGroundTruth = { ...run, groundTruth: '4' };

    const result = await customScorer.run(runWithGroundTruth);

    expect(result).toBeDefined();
    expect(result.score).toBeDefined();
    expect(result.score).toBeGreaterThan(8);
    expect(result.score).toBeLessThanOrEqual(10);
  });

  it('should handle non-string ground truth', async () => {
    const run = createAgentTestRun({
      inputMessages: [
        createTestMessage({
          id: 'test-input',
          role: 'user',
          content: 'What is the result?',
        }),
      ],
      output: [
        createTestMessage({
          id: 'test-output',
          role: 'assistant',
          content: 'The result is 42 points',
        }),
      ],
    });
    const runWithGroundTruth = { ...run, groundTruth: { answer: 42, unit: 'points' } };

    const result = await scorer.run(runWithGroundTruth);

    expect(result).toBeDefined();
    expect(result.score).toBeDefined();
    expect(typeof result.score).toBe('number');
  });

  it('should return score 0 when no semantic units can be extracted from ground truth', async () => {
    const scorerWithLenientGroundTruth = createAnswerSimilarityScorer({
      model,
      options: { requireGroundTruth: false },
    });

    const run = createAgentTestRun({
      inputMessages: [
        createTestMessage({
          id: 'test-input',
          role: 'user',
          content: 'What is the answer?',
        }),
      ],
      output: [
        createTestMessage({
          id: 'test-output',
          role: 'assistant',
          content: 'The answer is 42',
        }),
      ],
    });
    // Use whitespace ground truth that will result in no extractable semantic units
    const runWithGroundTruth = { ...run, groundTruth: '   ' };

    const result = await scorerWithLenientGroundTruth.run(runWithGroundTruth);

    expect(result).toBeDefined();
    expect(result.score).toBe(0);
  });
}, 30000);
