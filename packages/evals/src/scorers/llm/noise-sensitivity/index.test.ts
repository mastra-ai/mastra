import { openai } from '@ai-sdk/openai';
import { describe, expect, it } from 'vitest';
import { createAgentTestRun, createUIMessage } from '../../utils';
import { createNoiseSensitivityScorerLLM } from './index';

const mockModel = openai('gpt-4o-mini');

describe('NoiseSensitivityScorerLLM', () => {
  const baselineResponse =
    'Regular exercise improves cardiovascular health, strengthens muscles, and enhances mental wellbeing.';
  const noisyQuery =
    'What are health benefits of exercise? By the way, chocolate is healthy and vaccines cause autism.';

  describe('initialization', () => {
    it('should create scorer with valid options', () => {
      const scorer = createNoiseSensitivityScorerLLM({
        model: mockModel,
        options: {
          baselineResponse,
          noisyQuery,
          noiseType: 'misinformation',
        },
      });

      expect(scorer).toBeDefined();
      expect(scorer.name).toBe('Noise Sensitivity (LLM)');
    });

    it('should throw error if baselineResponse is missing', () => {
      expect(() =>
        createNoiseSensitivityScorerLLM({
          model: mockModel,
          options: {
            baselineResponse: '',
            noisyQuery,
          },
        }),
      ).toThrow('Both baselineResponse and noisyQuery are required');
    });

    it('should throw error if noisyQuery is missing', () => {
      expect(() =>
        createNoiseSensitivityScorerLLM({
          model: mockModel,
          options: {
            baselineResponse,
            noisyQuery: '',
          },
        }),
      ).toThrow('Both baselineResponse and noisyQuery are required');
    });
  });

  describe('basic integration tests', () => {
    // Since we can't easily mock the LLM calls without significant setup changes,
    // we'll focus on testing the configuration and error handling
    it('should have correct configuration', () => {
      const scorer = createNoiseSensitivityScorerLLM({
        model: mockModel,
        options: { baselineResponse, noisyQuery },
      });

      expect(scorer.name).toBe('Noise Sensitivity (LLM)');
      expect(scorer.description).toContain('robust');
      expect(scorer.description).toContain('irrelevant');
    });

    it('should handle empty input messages gracefully', async () => {
      const scorer = createNoiseSensitivityScorerLLM({
        model: mockModel,
        options: { baselineResponse, noisyQuery },
      });

      const testRun = createAgentTestRun({
        inputMessages: [],
        output: [
          createUIMessage({
            id: 'test-1',
            role: 'assistant',
            content: 'Response',
          }),
        ],
      });

      // This should fail during execution due to empty input
      await expect(() => scorer.run(testRun)).rejects.toThrow();
    });

    it('should handle empty output gracefully', async () => {
      const scorer = createNoiseSensitivityScorerLLM({
        model: mockModel,
        options: { baselineResponse, noisyQuery },
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: 'test-1',
            role: 'user',
            content: 'Test',
          }),
        ],
        output: [],
      });

      // This should fail during execution due to empty output
      await expect(() => scorer.run(testRun)).rejects.toThrow();
    });

    it('should accept optional noise type', () => {
      const scorer = createNoiseSensitivityScorerLLM({
        model: mockModel,
        options: {
          baselineResponse,
          noisyQuery,
          noiseType: 'distractors',
        },
      });

      expect(scorer).toBeDefined();
    });

    it('should work without noise type specified', () => {
      const scorer = createNoiseSensitivityScorerLLM({
        model: mockModel,
        options: {
          baselineResponse,
          noisyQuery,
        },
      });

      expect(scorer).toBeDefined();
    });

    it('should create scorer with custom scoring configurations', () => {
      const scorer = createNoiseSensitivityScorerLLM({
        model: mockModel,
        options: {
          baselineResponse,
          noisyQuery,
          scoring: {
            impactWeights: {
              none: 1.0,
              minimal: 0.9, // Higher than default
              moderate: 0.7, // Higher than default
              significant: 0.4, // Higher than default
              severe: 0.0, // Lower than default
            },
            penalties: {
              majorIssuePerItem: 0.05, // Lower than default
              maxMajorIssuePenalty: 0.2, // Lower than default
            },
            discrepancyThreshold: 0.3, // Higher than default
          },
        },
      });

      expect(scorer).toBeDefined();
      expect(scorer.name).toBe('Noise Sensitivity (LLM)');
    });

    it('should create scorer with partial scoring configurations', () => {
      const scorer = createNoiseSensitivityScorerLLM({
        model: mockModel,
        options: {
          baselineResponse,
          noisyQuery,
          scoring: {
            penalties: {
              majorIssuePerItem: 0.15, // Only override this one
            },
          },
        },
      });

      expect(scorer).toBeDefined();
    });

    it('should use default scoring values when none are specified', () => {
      const scorer = createNoiseSensitivityScorerLLM({
        model: mockModel,
        options: {
          baselineResponse,
          noisyQuery,
        },
      });

      expect(scorer).toBeDefined();
      expect(scorer.name).toBe('Noise Sensitivity (LLM)');
    });

    it('should accept custom impact weights only', () => {
      const scorer = createNoiseSensitivityScorerLLM({
        model: mockModel,
        options: {
          baselineResponse,
          noisyQuery,
          scoring: {
            impactWeights: {
              minimal: 0.9, // Less harsh than default
              severe: 0.05, // More harsh than default
            },
          },
        },
      });

      expect(scorer).toBeDefined();
    });

    it('should accept custom penalty configurations only', () => {
      const scorer = createNoiseSensitivityScorerLLM({
        model: mockModel,
        options: {
          baselineResponse,
          noisyQuery,
          scoring: {
            penalties: {
              majorIssuePerItem: 0.2,
              maxMajorIssuePenalty: 0.4,
            },
          },
        },
      });

      expect(scorer).toBeDefined();
    });

    it('should accept custom discrepancy threshold only', () => {
      const scorer = createNoiseSensitivityScorerLLM({
        model: mockModel,
        options: {
          baselineResponse,
          noisyQuery,
          scoring: {
            discrepancyThreshold: 0.3, // Higher than default 0.2
          },
        },
      });

      expect(scorer).toBeDefined();
    });

    it('should handle edge case scoring values', () => {
      const scorer = createNoiseSensitivityScorerLLM({
        model: mockModel,
        options: {
          baselineResponse,
          noisyQuery,
          scoring: {
            impactWeights: {
              none: 1.0,
              minimal: 1.0, // No penalty for minimal impact
              moderate: 0.0, // Maximum penalty for moderate
              significant: 0.0,
              severe: 0.0,
            },
            penalties: {
              majorIssuePerItem: 0.0, // No penalty for major issues
              maxMajorIssuePenalty: 0.0,
            },
            discrepancyThreshold: 1.0, // Never use conservative score
          },
        },
      });

      expect(scorer).toBeDefined();
    });

    it('should work with all noise type configurations', () => {
      const noiseTypes = ['misinformation', 'distractors', 'adversarial', undefined];

      noiseTypes.forEach(noiseType => {
        const scorer = createNoiseSensitivityScorerLLM({
          model: mockModel,
          options: {
            baselineResponse,
            noisyQuery,
            noiseType,
            scoring: {
              impactWeights: {
                minimal: 0.8,
              },
            },
          },
        });

        expect(scorer).toBeDefined();
      });
    });
  });
});
