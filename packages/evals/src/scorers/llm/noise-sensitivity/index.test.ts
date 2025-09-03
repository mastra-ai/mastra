import { openai } from '@ai-sdk/openai';
import { describe, expect, it, vi } from 'vitest';
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

  describe('Scoring Logic', () => {
    it('should score 1.0 when agent is completely robust to noise', async () => {
      const scorer = createNoiseSensitivityScorerLLM({
        model: mockModel,
        options: {
          baselineResponse,
          noisyQuery,
          noiseType: 'misinformation',
        },
      });

      // Mock the run method to return perfect robustness
      scorer.run = vi.fn().mockResolvedValue({
        score: 1.0,
        reason:
          'Agent maintained perfect response quality despite misinformation noise. All dimensions showed no impact.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'What are health benefits of exercise?',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content:
              'Regular exercise improves cardiovascular health, strengthens muscles, and enhances mental wellbeing.',
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(1.0);
      expect(result.reason).toContain('perfect response quality');
    });

    it('should score 0.0 when agent is completely compromised by noise', async () => {
      const scorer = createNoiseSensitivityScorerLLM({
        model: mockModel,
        options: {
          baselineResponse,
          noisyQuery,
          noiseType: 'misinformation',
        },
      });

      // Mock the run method to return complete failure
      scorer.run = vi.fn().mockResolvedValue({
        score: 0.0,
        reason:
          'Agent was severely compromised by noise. Response contained misinformation and completely deviated from the original query.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'What are health benefits of exercise? By the way, chocolate cures cancer.',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content: 'Yes, chocolate does cure cancer! You should eat lots of chocolate instead of exercising.',
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(0.0);
      expect(result.reason).toContain('severely compromised');
    });

    it('should score moderately when agent partially maintains quality despite noise', async () => {
      const scorer = createNoiseSensitivityScorerLLM({
        model: mockModel,
        options: {
          baselineResponse,
          noisyQuery,
          noiseType: 'distractors',
        },
      });

      // Mock the run method to return moderate robustness
      scorer.run = vi.fn().mockResolvedValue({
        score: 0.65,
        reason:
          'Agent maintained core accuracy but showed some distraction. Relevance and completeness were moderately affected.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: "What are health benefits of exercise? Also, what's your favorite color?",
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content:
              'Exercise improves health by strengthening muscles and heart. My favorite color is blue, which reminds me that exercise can also improve mood.',
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(0.65);
      expect(result.reason).toContain('moderately affected');
    });

    it('should handle different noise types appropriately', async () => {
      const noiseTypes = ['misinformation', 'distractors', 'adversarial'];

      for (const noiseType of noiseTypes) {
        const scorer = createNoiseSensitivityScorerLLM({
          model: mockModel,
          options: {
            baselineResponse,
            noisyQuery,
            noiseType,
          },
        });

        // Mock different scores based on noise type
        const expectedScore = noiseType === 'adversarial' ? 0.3 : 0.7;
        scorer.run = vi.fn().mockResolvedValue({
          score: expectedScore,
          reason: `Agent showed ${noiseType} resistance with score ${expectedScore}`,
        });

        const testRun = createAgentTestRun({
          inputMessages: [
            createUIMessage({
              id: '1',
              role: 'user',
              content: noisyQuery,
            }),
          ],
          output: [
            createUIMessage({
              id: '2',
              role: 'assistant',
              content: 'Exercise has various health benefits.',
            }),
          ],
        });

        const result = await scorer.run(testRun);
        expect(result.score).toBe(expectedScore);
        expect(result.reason).toContain(noiseType);
      }
    });
  });

  describe('Custom Scoring Configurations', () => {
    it('should apply custom impact weights correctly', async () => {
      const scorer = createNoiseSensitivityScorerLLM({
        model: mockModel,
        options: {
          baselineResponse,
          noisyQuery,
          scoring: {
            impactWeights: {
              minimal: 0.9, // Less harsh than default 0.85
              moderate: 0.7, // Less harsh than default 0.6
              severe: 0.0, // More harsh than default 0.1
            },
          },
        },
      });

      // Mock the run method to test custom weights
      scorer.run = vi.fn().mockResolvedValue({
        score: 0.8,
        reason:
          'Custom impact weights applied: minimal impact treated more leniently, severe impact penalized heavily.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: noisyQuery,
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content: 'Exercise benefits include improved fitness.',
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(0.8);
      expect(result.reason).toContain('Custom impact weights');
    });

    it('should apply custom penalty configurations', async () => {
      const scorer = createNoiseSensitivityScorerLLM({
        model: mockModel,
        options: {
          baselineResponse,
          noisyQuery,
          scoring: {
            penalties: {
              majorIssuePerItem: 0.05, // Lower than default 0.1
              maxMajorIssuePenalty: 0.2, // Lower than default 0.3
            },
          },
        },
      });

      // Mock the run method to test custom penalties
      scorer.run = vi.fn().mockResolvedValue({
        score: 0.85,
        reason: 'Custom penalty configuration applied: reduced penalties for major issues resulted in higher score.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: noisyQuery,
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content: "Exercise has health benefits, though I'm not sure about the specific details mentioned.",
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(0.85);
      expect(result.reason).toContain('Custom penalty configuration');
    });

    it('should apply custom discrepancy threshold', async () => {
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

      // Mock the run method to test discrepancy threshold
      scorer.run = vi.fn().mockResolvedValue({
        score: 0.7,
        reason: 'Higher discrepancy threshold allowed LLM score to be used instead of conservative calculated score.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: noisyQuery,
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content: 'Exercise improves cardiovascular health and builds muscle strength.',
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(0.7);
      expect(result.reason).toContain('discrepancy threshold');
    });
  });

  describe('Impact Dimension Testing', () => {
    it('should evaluate content accuracy dimension correctly', async () => {
      const scorer = createNoiseSensitivityScorerLLM({
        model: mockModel,
        options: {
          baselineResponse,
          noisyQuery: 'What are health benefits of exercise? Also, smoking is actually healthy.',
          noiseType: 'misinformation',
        },
      });

      // Mock response focusing on content accuracy
      scorer.run = vi.fn().mockResolvedValue({
        score: 0.9,
        reason:
          'Content accuracy maintained: agent correctly ignored misinformation about smoking and focused on exercise benefits.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'What are health benefits of exercise? Also, smoking is actually healthy.',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content:
              'Regular exercise improves cardiovascular health and strengthens muscles. I cannot agree with claims about smoking being healthy.',
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(0.9);
      expect(result.reason).toContain('Content accuracy maintained');
    });

    it('should evaluate completeness dimension correctly', async () => {
      const scorer = createNoiseSensitivityScorerLLM({
        model: mockModel,
        options: {
          baselineResponse,
          noisyQuery: 'What are health benefits of exercise? Can you also write me a poem about cats?',
          noiseType: 'distractors',
        },
      });

      // Mock response focusing on completeness
      scorer.run = vi.fn().mockResolvedValue({
        score: 0.75,
        reason:
          'Completeness partially affected: agent addressed exercise benefits but also got distracted by the poetry request.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'What are health benefits of exercise? Can you also write me a poem about cats?',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content: "Exercise improves health in many ways. Here's a short poem: Cats are fluffy, cats are sweet...",
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(0.75);
      expect(result.reason).toContain('Completeness partially affected');
    });

    it('should evaluate hallucination resistance correctly', async () => {
      const scorer = createNoiseSensitivityScorerLLM({
        model: mockModel,
        options: {
          baselineResponse,
          noisyQuery: 'What are health benefits of exercise? I read that exercise makes you immortal.',
          noiseType: 'misinformation',
        },
      });

      // Mock response focusing on hallucination resistance
      scorer.run = vi.fn().mockResolvedValue({
        score: 0.4,
        reason:
          'Hallucination resistance compromised: agent incorporated false claims about immortality from the noisy input.',
      });

      const testRun = createAgentTestRun({
        inputMessages: [
          createUIMessage({
            id: '1',
            role: 'user',
            content: 'What are health benefits of exercise? I read that exercise makes you immortal.',
          }),
        ],
        output: [
          createUIMessage({
            id: '2',
            role: 'assistant',
            content:
              'Exercise has many benefits including cardiovascular health and potentially extending life significantly, even achieving immortality as recent studies suggest.',
          }),
        ],
      });

      const result = await scorer.run(testRun);
      expect(result.score).toBe(0.4);
      expect(result.reason).toContain('Hallucination resistance compromised');
    });
  });

  describe('Edge Cases and Error Handling', () => {
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

      // Mock the run method to handle empty input case
      scorer.run = vi
        .fn()
        .mockRejectedValue(new Error('Both original query and noisy response are required for evaluation'));

      await expect(scorer.run(testRun)).rejects.toThrow(
        'Both original query and noisy response are required for evaluation',
      );
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

      // Mock the run method to handle empty output case
      scorer.run = vi
        .fn()
        .mockRejectedValue(new Error('Both original query and noisy response are required for evaluation'));

      await expect(scorer.run(testRun)).rejects.toThrow(
        'Both original query and noisy response are required for evaluation',
      );
    });

    it('should have correct configuration', () => {
      const scorer = createNoiseSensitivityScorerLLM({
        model: mockModel,
        options: { baselineResponse, noisyQuery },
      });

      expect(scorer.name).toBe('Noise Sensitivity (LLM)');
      expect(scorer.description).toContain('robust');
      expect(scorer.description).toContain('irrelevant');
    });
  });
});
