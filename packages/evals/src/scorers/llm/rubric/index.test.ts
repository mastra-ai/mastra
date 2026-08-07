import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect } from 'vitest';
import { createAgentTestRun, createTestMessage } from '../../utils';
import type { RubricAnalysisResult } from './prompts';
import { createRubricScorer } from '.';

/**
 * Build a mock model whose structured-output / text response is the given rubric analysis.
 * The judge agent parses this JSON against the analyze schema.
 */
function mockJudge(analysis: RubricAnalysisResult) {
  const text = JSON.stringify(analysis);
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [{ type: 'text', text }],
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
      ]),
    }),
  });
}

function run(output: string, task = 'Do the task') {
  return createAgentTestRun({
    inputMessages: [createTestMessage({ id: 'u1', role: 'user', content: task })],
    output: [createTestMessage({ id: 'a1', role: 'assistant', content: output })],
  });
}

describe('Rubric Scorer (LLM)', () => {
  describe('configuration', () => {
    it('creates a scorer with the expected identity and judge', () => {
      const scorer = createRubricScorer({
        model: mockJudge({ criteria: [], overallAssessment: '' }),
        criteria: [{ description: 'Has an analysis section' }],
      });

      expect(scorer.name).toBe('Rubric (LLM)');
      expect(scorer.config.judge).toBeDefined();
      expect(scorer.config.judge?.instructions).toContain('rubric');
    });
  });

  describe('scoring', () => {
    it('scores 1 when every required criterion is satisfied', async () => {
      const scorer = createRubricScorer({
        model: mockJudge({
          criteria: [
            { criterion: 'Has analysis', satisfied: true, required: true, reasoning: 'present' },
            { criterion: 'Has recommendations', satisfied: true, required: true, reasoning: 'present' },
          ],
          overallAssessment: 'All good',
        }),
        criteria: [{ description: 'Has analysis' }, { description: 'Has recommendations' }],
      });

      const result = await scorer.run(run('analysis ... recommendations ...'));

      expect(result.score).toBe(1);
      expect(result.reason).toContain('Rubric satisfied');
    });

    it('scores 0 when a required criterion is unmet and lists it in the reason', async () => {
      const scorer = createRubricScorer({
        model: mockJudge({
          criteria: [
            { criterion: 'Has analysis', satisfied: true, required: true, reasoning: 'present' },
            {
              criterion: 'Has recommendations',
              satisfied: false,
              required: true,
              reasoning: 'missing a recommendations section',
            },
          ],
          overallAssessment: 'Missing recommendations',
        }),
        criteria: [{ description: 'Has analysis' }, { description: 'Has recommendations' }],
      });

      const result = await scorer.run(run('analysis only'));

      expect(result.score).toBe(0);
      expect(result.reason).toContain('not yet satisfied');
      expect(result.reason).toContain('missing a recommendations section');
    });

    it('still scores 1 when only an optional criterion is unmet', async () => {
      const scorer = createRubricScorer({
        model: mockJudge({
          criteria: [
            { criterion: 'Has analysis', satisfied: true, required: true, reasoning: 'present' },
            { criterion: 'Has citations', satisfied: false, required: false, reasoning: 'no citations' },
          ],
          overallAssessment: 'Required met, optional missing',
        }),
        criteria: [
          { description: 'Has analysis', required: true },
          { description: 'Has citations', required: false },
        ],
      });

      const result = await scorer.run(run('analysis without citations'));

      expect(result.score).toBe(1);
    });

    it('applies a custom scale to the passing score', async () => {
      const scorer = createRubricScorer({
        model: mockJudge({
          criteria: [{ criterion: 'Has analysis', satisfied: true, required: true, reasoning: 'present' }],
          overallAssessment: 'ok',
        }),
        criteria: [{ description: 'Has analysis' }],
        options: { scale: 10 },
      });

      const result = await scorer.run(run('analysis'));
      expect(result.score).toBe(10);
    });
  });

  describe('dynamic rubric from context', () => {
    it('reads a newline-delimited rubric string from requestContext', async () => {
      const scorer = createRubricScorer({
        model: mockJudge({
          criteria: [
            { criterion: 'All tests pass', satisfied: true, required: true, reasoning: 'green' },
            {
              criterion: 'Function is named find_duplicates',
              satisfied: true,
              required: true,
              reasoning: 'named correctly',
            },
          ],
          overallAssessment: 'Complete',
        }),
        // No static criteria — supplied dynamically.
      });

      const testRun = createAgentTestRun({
        inputMessages: [createTestMessage({ id: 'u1', role: 'user', content: 'Write find_duplicates' })],
        output: [createTestMessage({ id: 'a1', role: 'assistant', content: 'def find_duplicates(lst): ...' })],
      });

      const result = await scorer.run({
        ...testRun,
        requestContext: { rubric: '- All tests pass\n- Function is named find_duplicates' },
      } as any);

      expect(result.score).toBe(1);
    });
  });

  describe('no-op when rubric absent', () => {
    it('returns 1 and does not gate when no rubric resolves', async () => {
      const scorer = createRubricScorer({
        model: mockJudge({ criteria: [], overallAssessment: 'No rubric provided; nothing to grade.' }),
        // No static criteria and no dynamic rubric.
      });

      const result = await scorer.run(run('anything'));

      expect(result.score).toBe(1);
      expect(result.reason).toContain('passed by default');
    });

    it('returns exactly 1 even with a custom scale so it never gates isTaskComplete', async () => {
      const scorer = createRubricScorer({
        model: mockJudge({ criteria: [], overallAssessment: 'No rubric provided; nothing to grade.' }),
        // No static criteria and no dynamic rubric.
        options: { scale: 10 },
      });

      const result = await scorer.run(run('anything'));

      expect(result.score).toBe(1);
    });
  });
});
