import { openai } from '@ai-sdk/openai';
import { getLLMTestMode } from '@internal/llm-recorder';
import { setupDummyApiKeys } from '@internal/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { createAgentTestRun, createTestMessage } from '../../utils';
import { createContextRecallScorer } from './index';

setupDummyApiKeys(getLLMTestMode(), ['openai']);

const mockModel = openai('gpt-4o-mini');

describe('createContextRecallScorer', () => {
  it('should throw error when no context is provided', () => {
    expect(() =>
      createContextRecallScorer({
        model: mockModel,
        options: {},
      }),
    ).toThrow('Either context or contextExtractor is required for Context Recall scoring');
  });

  it('should throw error when context array is empty', () => {
    expect(() =>
      createContextRecallScorer({
        model: mockModel,
        options: { context: [] },
      }),
    ).toThrow('Context array cannot be empty if provided');
  });

  it('should create a scorer with proper configuration', () => {
    const scorer = createContextRecallScorer({
      model: mockModel,
      options: {
        context: ['Test context 1', 'Test context 2'],
        scale: 1,
      },
    });

    expect(scorer).toBeDefined();
    expect(scorer.id).toBe('context-recall-scorer');
    expect(scorer.name).toBe('Context Recall Scorer');
    expect(scorer.description).toBe(
      'A scorer that evaluates how well retrieved context covers the claims in a ground-truth reference answer',
    );
  });

  it('should create scorer with context extractor', () => {
    const contextExtractor = () => ['Dynamic context 1', 'Dynamic context 2'];

    const scorer = createContextRecallScorer({
      model: mockModel,
      options: {
        contextExtractor,
        scale: 1,
      },
    });

    expect(scorer).toBeDefined();
    expect(scorer.id).toBe('context-recall-scorer');
    expect(scorer.name).toBe('Context Recall Scorer');
  });

  it('should handle perfect recall', async () => {
    const scorer = createContextRecallScorer({
      model: mockModel,
      options: {
        context: [
          'Albert Einstein was born on 14 March 1879 in Ulm, Germany.',
          'Einstein developed the theory of relativity.',
        ],
        scale: 1,
      },
    });

    scorer.run = vi.fn().mockResolvedValue({
      score: 1.0,
      reason:
        'The score is 1.0 because all claims in the ground-truth answer are fully supported by the retrieval context.',
    });

    const testRun = createAgentTestRun({
      inputMessages: [createTestMessage({ id: '1', role: 'user', content: 'Tell me about Einstein.' })],
      output: [
        createTestMessage({
          id: '2',
          role: 'assistant',
          content: 'Albert Einstein was born in 1879 in Ulm and developed the theory of relativity.',
        }),
      ],
    });

    const runWithGroundTruth = {
      ...testRun,
      groundTruth: 'Albert Einstein was born on 14 March 1879 in Ulm, Germany. He developed the theory of relativity.',
    };

    const result = await scorer.run(runWithGroundTruth);

    expect(result.score).toBe(1.0);
    expect(result.reason).toContain('The score is 1.0');
  });

  it('should handle partial recall', async () => {
    const scorer = createContextRecallScorer({
      model: mockModel,
      options: {
        context: [
          'Albert Einstein was born on 14 March 1879 in Ulm, Germany.',
          'Einstein published his theory of special relativity in 1905.',
        ],
        scale: 1,
      },
    });

    scorer.run = vi.fn().mockResolvedValue({
      score: 0.67,
      reason:
        'The score is 0.67 because 2 out of 3 ground-truth claims are supported. The claim about the Nobel Prize is not in the context.',
    });

    const testRun = createAgentTestRun({
      inputMessages: [createTestMessage({ id: '1', role: 'user', content: 'Tell me about Einstein.' })],
      output: [
        createTestMessage({
          id: '2',
          role: 'assistant',
          content: 'Einstein was born in 1879 and developed special relativity.',
        }),
      ],
    });

    const runWithGroundTruth = {
      ...testRun,
      groundTruth:
        'Albert Einstein was born on 14 March 1879 in Ulm. He developed the theory of relativity. He won the Nobel Prize in 1921.',
    };

    const result = await scorer.run(runWithGroundTruth);

    expect(result.score).toBeCloseTo(0.67, 2);
    expect(result.reason).toContain('The score is');
  });

  it('should handle no recall', async () => {
    const scorer = createContextRecallScorer({
      model: mockModel,
      options: {
        context: ['The weather is sunny today.', 'Cats are popular pets.'],
        scale: 1,
      },
    });

    scorer.run = vi.fn().mockResolvedValue({
      score: 0,
      reason: 'The score is 0 because none of the ground-truth claims could be attributed to the retrieval context.',
    });

    const testRun = createAgentTestRun({
      inputMessages: [createTestMessage({ id: '1', role: 'user', content: 'Tell me about Einstein.' })],
      output: [
        createTestMessage({
          id: '2',
          role: 'assistant',
          content: 'I could not find relevant information about Einstein.',
        }),
      ],
    });

    const runWithGroundTruth = {
      ...testRun,
      groundTruth: 'Albert Einstein was born in 1879 and developed the theory of relativity.',
    };

    const result = await scorer.run(runWithGroundTruth);

    expect(result.score).toBe(0);
    expect(result.reason).toContain('The score is 0');
  });

  it('should respect custom scale', async () => {
    const scorer = createContextRecallScorer({
      model: mockModel,
      options: {
        context: ['Einstein was born in 1879.', 'Einstein developed relativity.'],
        scale: 10,
      },
    });

    scorer.run = vi.fn().mockResolvedValue({
      score: 10.0,
      reason: 'The score is 10.0 because all ground-truth claims are fully covered (perfect recall with scale 10).',
    });

    const testRun = createAgentTestRun({
      inputMessages: [createTestMessage({ id: '1', role: 'user', content: 'Tell me about Einstein.' })],
      output: [createTestMessage({ id: '2', role: 'assistant', content: 'Einstein was born in 1879.' })],
    });

    const runWithGroundTruth = {
      ...testRun,
      groundTruth: 'Albert Einstein was born in 1879. He developed the theory of relativity.',
    };

    const result = await scorer.run(runWithGroundTruth);

    expect(result.score).toBe(10.0);
  });

  it('should handle missing ground truth', async () => {
    const scorer = createContextRecallScorer({
      model: mockModel,
      options: {
        context: ['Some context here.'],
        scale: 1,
      },
    });

    scorer.run = vi.fn().mockResolvedValue({
      score: 0,
      reason: 'No ground truth was provided for evaluation.',
    });

    const testRun = createAgentTestRun({
      inputMessages: [createTestMessage({ id: '1', role: 'user', content: 'Test query' })],
      output: [createTestMessage({ id: '2', role: 'assistant', content: 'Test response' })],
    });

    const result = await scorer.run(testRun);

    expect(result.score).toBe(0);
  });

  it('should handle empty analyze results', async () => {
    const scorer = createContextRecallScorer({
      model: mockModel,
      options: {
        context: ['Test context'],
        scale: 1,
      },
    });

    scorer.run = vi.fn().mockResolvedValue({
      score: 0,
      reason: 'No claims could be extracted from the ground truth.',
    });

    const testRun = createAgentTestRun({
      inputMessages: [createTestMessage({ id: '1', role: 'user', content: 'Test query' })],
      output: [createTestMessage({ id: '2', role: 'assistant', content: 'Test response' })],
    });

    const runWithGroundTruth = { ...testRun, groundTruth: '' };

    const result = await scorer.run(runWithGroundTruth);

    expect(result.score).toBe(0);
  });
});
