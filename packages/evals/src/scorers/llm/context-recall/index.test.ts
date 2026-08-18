import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { createAgentTestRun, createTestMessage } from '../../utils';
import { createContextRecallScorer } from './index';

/**
 * Build a mock model that returns predetermined JSON for each pipeline step.
 * The scorer pipeline calls the model three times (preprocess, analyze, reason).
 * Internally, each call first attempts streaming, then falls back to doGenerate
 * when structured output parsing fails on the stream. We provide enough responses
 * in both doStream and doGenerate arrays to handle this retry pattern.
 */
function mockJudge(responses: {
  claims?: string[];
  verdicts?: { verdict: string; reason: string }[];
  reason?: string;
}) {
  const preprocessJson = JSON.stringify({ claims: responses.claims ?? [] });
  const analyzeJson = JSON.stringify({ verdicts: responses.verdicts ?? [] });
  const reasonText = responses.reason ?? 'No reason provided.';
  const jsons = [preprocessJson, analyzeJson, reasonText];

  function makeGenerateResult(text: string) {
    return {
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [{ type: 'text' as const, text }],
      warnings: [] as never[],
    };
  }

  function makeStreamResult(text: string) {
    return {
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [] as never[],
      stream: convertArrayToReadableStream([
        { type: 'stream-start' as const, warnings: [] as never[] },
        {
          type: 'response-metadata' as const,
          id: 'id-0',
          modelId: 'mock-model-id',
          timestamp: new Date(0),
        },
        { type: 'text-start' as const, id: 'text-1' },
        { type: 'text-delta' as const, id: 'text-1', delta: text },
        { type: 'text-end' as const, id: 'text-1' },
        {
          type: 'finish' as const,
          finishReason: 'stop' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
    };
  }

  // Provide plenty of responses for both paths — the pipeline may try
  // stream then fall back to generate for each step, consuming entries
  // from both arrays in unpredictable order. Over-provision to be safe.
  const allGenerate = jsons.flatMap(j => [makeGenerateResult(j), makeGenerateResult(j), makeGenerateResult(j)]);
  const allStream = jsons.flatMap(j => [makeStreamResult(j), makeStreamResult(j), makeStreamResult(j)]);

  return new MockLanguageModelV2({
    doGenerate: allGenerate,
    doStream: allStream,
  });
}

function run(content: string) {
  return createAgentTestRun({
    inputMessages: [createTestMessage({ id: 'u1', role: 'user', content: 'Test query' })],
    output: [createTestMessage({ id: 'a1', role: 'assistant', content })],
  });
}

describe('createContextRecallScorer', () => {
  describe('configuration', () => {
    it('should throw error when no context is provided', () => {
      expect(() =>
        createContextRecallScorer({
          model: mockJudge({}),
          options: {},
        }),
      ).toThrow('Either context or contextExtractor is required for Context Recall scoring');
    });

    it('should throw error when context array is empty', () => {
      expect(() =>
        createContextRecallScorer({
          model: mockJudge({}),
          options: { context: [] },
        }),
      ).toThrow('Context array cannot be empty if provided');
    });

    it('should create a scorer with proper configuration', () => {
      const scorer = createContextRecallScorer({
        model: mockJudge({}),
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
        model: mockJudge({}),
        options: {
          contextExtractor,
          scale: 1,
        },
      });

      expect(scorer).toBeDefined();
      expect(scorer.id).toBe('context-recall-scorer');
    });
  });

  describe('scoring pipeline', () => {
    it('scores 1 when all ground-truth claims are attributed', async () => {
      const scorer = createContextRecallScorer({
        model: mockJudge({
          claims: ['Einstein was born in 1879', 'Einstein developed relativity'],
          verdicts: [
            { verdict: 'yes', reason: 'Context mentions birthdate' },
            { verdict: 'yes', reason: 'Context covers relativity' },
          ],
          reason: 'The score is 1 because all claims are covered.',
        }),
        options: {
          context: ['Einstein was born on 14 March 1879.', 'Einstein developed relativity.'],
        },
      });

      const result = await scorer.run({
        ...run('Einstein was a physicist.'),
        groundTruth: 'Einstein was born in 1879. He developed relativity.',
      });

      expect(result.score).toBe(1);
    });

    it('scores the correct ratio for partial recall', async () => {
      const scorer = createContextRecallScorer({
        model: mockJudge({
          claims: ['Einstein was born in 1879', 'Einstein developed relativity', 'Einstein won the Nobel Prize'],
          verdicts: [
            { verdict: 'yes', reason: 'Birthdate found' },
            { verdict: 'yes', reason: 'Relativity found' },
            { verdict: 'no', reason: 'Nobel Prize not mentioned' },
          ],
          reason: '2 of 3 claims covered.',
        }),
        options: {
          context: ['Einstein was born in 1879.', 'Einstein developed relativity.'],
        },
      });

      const result = await scorer.run({
        ...run('Einstein was a physicist.'),
        groundTruth: 'Einstein was born in 1879. He developed relativity. He won the Nobel Prize.',
      });

      expect(result.score).toBeCloseTo(0.67, 2);
    });

    it('scores 0 when no claims are attributed', async () => {
      const scorer = createContextRecallScorer({
        model: mockJudge({
          claims: ['Einstein was born in 1879', 'Einstein developed relativity'],
          verdicts: [
            { verdict: 'no', reason: 'Not in context' },
            { verdict: 'no', reason: 'Not in context' },
          ],
          reason: 'No claims covered.',
        }),
        options: {
          context: ['The weather is sunny today.'],
        },
      });

      const result = await scorer.run({
        ...run('No relevant info.'),
        groundTruth: 'Einstein was born in 1879. He developed relativity.',
      });

      expect(result.score).toBe(0);
    });

    it('applies custom scale to the score', async () => {
      const scorer = createContextRecallScorer({
        model: mockJudge({
          claims: ['Paris is the capital', 'Eiffel Tower is in Paris'],
          verdicts: [
            { verdict: 'yes', reason: 'Found' },
            { verdict: 'yes', reason: 'Found' },
          ],
          reason: 'Perfect recall.',
        }),
        options: {
          context: ['Paris is the capital of France.', 'The Eiffel Tower is in Paris.'],
          scale: 10,
        },
      });

      const result = await scorer.run({
        ...run('Paris is great.'),
        groundTruth: 'Paris is the capital. The Eiffel Tower is in Paris.',
      });

      expect(result.score).toBe(10);
    });

    it('clamps score when judge returns extra verdicts', async () => {
      const scorer = createContextRecallScorer({
        model: mockJudge({
          claims: ['Claim A', 'Claim B'],
          verdicts: [
            { verdict: 'yes', reason: 'Found' },
            { verdict: 'yes', reason: 'Found' },
            { verdict: 'yes', reason: 'Extra verdict' },
          ],
          reason: 'All covered.',
        }),
        options: { context: ['Some context.'] },
      });

      const result = await scorer.run({
        ...run('Response.'),
        groundTruth: 'Claim A. Claim B.',
      });

      expect(result.score).toBe(1);
    });

    it('returns 0 when ground truth is missing', async () => {
      const scorer = createContextRecallScorer({
        model: mockJudge({ claims: [], verdicts: [], reason: 'No ground truth.' }),
        options: { context: ['Some context.'] },
      });

      const result = await scorer.run(run('Response.'));

      expect(result.score).toBe(0);
    });

    it('returns 0 when no claims are extracted', async () => {
      const scorer = createContextRecallScorer({
        model: mockJudge({ claims: [], verdicts: [], reason: 'No claims extracted.' }),
        options: { context: ['Some context.'] },
      });

      const result = await scorer.run({
        ...run('Response.'),
        groundTruth: 'Some ground truth text.',
      });

      expect(result.score).toBe(0);
    });

    it('handles fewer verdicts than claims conservatively', async () => {
      const scorer = createContextRecallScorer({
        model: mockJudge({
          claims: ['Claim A', 'Claim B', 'Claim C'],
          verdicts: [{ verdict: 'yes', reason: 'Found' }],
          reason: 'Partial evaluation.',
        }),
        options: { context: ['Context.'] },
      });

      const result = await scorer.run({
        ...run('Response.'),
        groundTruth: 'Claim A. Claim B. Claim C.',
      });

      // 1 yes out of 3 claims = 0.33
      expect(result.score).toBeCloseTo(0.33, 2);
    });
  });
});
