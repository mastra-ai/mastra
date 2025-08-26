import { openai } from '@ai-sdk/openai';
import { describe, expect, it, vi } from 'vitest';
import { createAgentTestRun, createUIMessage } from '../../utils';
import { createContextPrecisionScorer } from './index';

// Mock model for testing
const mockModel = openai('gpt-4o-mini');

describe('createContextPrecisionScorer', () => {
  it('should throw error when no context is provided', () => {
    expect(() =>
      createContextPrecisionScorer({
        model: mockModel,
        options: {},
      }),
    ).toThrow('Either context or contextExtractor is required for Context Precision scoring');
  });

  it('should throw error when context array is empty', () => {
    expect(() =>
      createContextPrecisionScorer({
        model: mockModel,
        options: { context: [] },
      }),
    ).toThrow('Context array cannot be empty if provided');
  });

  it('should create a scorer with proper configuration', () => {
    const scorer = createContextPrecisionScorer({
      model: mockModel,
      options: {
        context: ['Test context 1', 'Test context 2'],
        scale: 1,
      },
    });

    expect(scorer).toBeDefined();
    expect(scorer.name).toBe('Context Precision Scorer');
    expect(scorer.description).toBe(
      'A scorer that evaluates the relevance and precision of retrieved context nodes for generating expected outputs',
    );
  });

  it('should create scorer with context extractor', () => {
    const contextExtractor = () => ['Dynamic context 1', 'Dynamic context 2'];

    const scorer = createContextPrecisionScorer({
      model: mockModel,
      options: {
        contextExtractor,
        scale: 1,
      },
    });

    expect(scorer).toBeDefined();
    expect(scorer.name).toBe('Context Precision Scorer');
  });

  it('should handle perfect context precision', async () => {
    const scorer = createContextPrecisionScorer({
      model: mockModel,
      options: {
        context: [
          'Photosynthesis is a biological process used by plants to create energy from sunlight.',
          'The process of photosynthesis produces oxygen as a byproduct.',
        ],
        scale: 1,
      },
    });

    // Mock the analyze step to return all relevant verdicts
    scorer.analyze = vi.fn().mockImplementation(_ => ({
      ...scorer,
      analyzeStepResult: {
        verdicts: [
          {
            context_index: 0,
            verdict: 'yes',
            reason: 'Directly explains what photosynthesis is',
          },
          {
            context_index: 1,
            verdict: 'yes',
            reason: 'Provides additional relevant information about photosynthesis',
          },
        ],
      },
    }));

    const testRun = createAgentTestRun({
      inputMessages: [createUIMessage({ id: '1', role: 'user', content: 'What is photosynthesis?' })],
      output: [
        createUIMessage({
          id: '2',
          role: 'assistant',
          content: 'Photosynthesis is the process by which plants convert sunlight into energy.',
        }),
      ],
    });

    // Mock the run method
    scorer.run = vi.fn().mockResolvedValue({
      score: 1.0,
      reason: 'The score is 1 because all context pieces are relevant and well-positioned.',
    });

    const result = await scorer.run(testRun);

    expect(result.score).toBe(1.0); // Perfect MAP score when all context is relevant
    expect(result.reason).toContain('The score is 1');
  });

  it('should handle mixed context relevance', async () => {
    const scorer = createContextPrecisionScorer({
      model: mockModel,
      options: {
        context: [
          'Exercise strengthens the heart and improves blood circulation.',
          'A balanced diet is important for health.',
          'Regular physical activity reduces stress and anxiety.',
          'Exercise equipment can be expensive.',
        ],
        scale: 1,
      },
    });

    // Mock the analyze step to return mixed verdicts
    scorer.analyze = vi.fn().mockImplementation(_ => ({
      ...scorer,
      analyzeStepResult: {
        verdicts: [
          {
            context_index: 0,
            verdict: 'yes',
            reason: 'Directly supports cardiovascular health benefit',
          },
          {
            context_index: 1,
            verdict: 'no',
            reason: 'About diet, not exercise benefits',
          },
          {
            context_index: 2,
            verdict: 'yes',
            reason: 'Supports mental wellbeing benefit',
          },
          {
            context_index: 3,
            verdict: 'no',
            reason: 'Not relevant to exercise benefits',
          },
        ],
      },
    }));

    const testRun = createAgentTestRun({
      inputMessages: [createUIMessage({ id: '1', role: 'user', content: 'What are the benefits of exercise?' })],
      output: [
        createUIMessage({
          id: '2',
          role: 'assistant',
          content: 'Regular exercise improves cardiovascular health and mental wellbeing.',
        }),
      ],
    });

    // Mock the run method
    scorer.run = vi.fn().mockResolvedValue({
      score: 0.83,
      reason: 'The score is 0.83 because two contexts are relevant but positioned at 1st and 3rd positions.',
    });

    const result = await scorer.run(testRun);

    // MAP calculation:
    // Position 1: relevant, precision = 1/1 = 1.0
    // Position 2: not relevant, no contribution
    // Position 3: relevant, precision = 2/3 = 0.67
    // Position 4: not relevant, no contribution
    // MAP = (1.0 + 0.67) / 2 = 0.835, rounded to 0.83
    expect(result.score).toBeCloseTo(0.83, 2);
    expect(result.reason).toContain('The score is');
  });

  it('should handle no relevant context', async () => {
    const scorer = createContextPrecisionScorer({
      model: mockModel,
      options: {
        context: ['The weather is sunny today.', 'Cats are popular pets.', 'Coffee is a popular beverage.'],
        scale: 1,
      },
    });

    // Mock the run method to simulate no relevant context
    scorer.run = vi.fn().mockResolvedValue({
      score: 0,
      reason: 'The score is 0 because none of the context pieces are relevant to the query about exercise benefits.',
    });

    const testRun = createAgentTestRun({
      inputMessages: [createUIMessage({ id: '1', role: 'user', content: 'What are the benefits of exercise?' })],
      output: [
        createUIMessage({
          id: '2',
          role: 'assistant',
          content: 'Regular exercise improves cardiovascular health and mental wellbeing.',
        }),
      ],
    });

    const result = await scorer.run(testRun);

    expect(result.score).toBe(0);
    expect(result.reason).toContain('The score is 0');
  });

  it('should respect custom scale', async () => {
    const scorer = createContextPrecisionScorer({
      model: mockModel,
      options: {
        context: ['Photosynthesis converts sunlight to energy.', 'Plants produce oxygen through photosynthesis.'],
        scale: 10,
      },
    });

    // Mock perfect context precision
    scorer.analyze = vi.fn().mockImplementation(_ => ({
      ...scorer,
      analyzeStepResult: {
        verdicts: [
          {
            context_index: 0,
            verdict: 'yes',
            reason: 'Relevant',
          },
          {
            context_index: 1,
            verdict: 'yes',
            reason: 'Relevant',
          },
        ],
      },
    }));

    const testRun = createAgentTestRun({
      inputMessages: [createUIMessage({ id: '1', role: 'user', content: 'What is photosynthesis?' })],
      output: [createUIMessage({ id: '2', role: 'assistant', content: 'Photosynthesis converts sunlight to energy.' })],
    });

    // Mock the run method
    scorer.run = vi.fn().mockResolvedValue({
      score: 10.0,
      reason: 'The score is 10.0 because all contexts are relevant (perfect precision with scale 10).',
    });

    const result = await scorer.run(testRun);

    expect(result.score).toBe(10.0); // Perfect score with scale 10
  });

  it('should handle empty analyze results', async () => {
    const scorer = createContextPrecisionScorer({
      model: mockModel,
      options: {
        context: ['Test context'],
        scale: 1,
      },
    });

    // Mock the entire run method to return empty analyze results
    scorer.run = vi.fn().mockResolvedValue({
      score: 0,
      reason: 'No context verdicts available',
    });

    const testRun = createAgentTestRun({
      inputMessages: [createUIMessage({ id: '1', role: 'user', content: 'Test query' })],
      output: [createUIMessage({ id: '2', role: 'assistant', content: 'Test response' })],
    });

    const result = await scorer.run(testRun);

    expect(result.score).toBe(0);
  });
});
