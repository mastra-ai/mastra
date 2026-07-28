import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { createAgentTestRun, createTestMessage } from '../../utils';
import { createSummarizationScorer } from './index';

/**
 * Build a mock model that returns predetermined JSON for each pipeline step.
 * The step is picked from the prompt rather than the call order, because a step
 * that fails structured-output parsing on the stream retries through doGenerate
 * and would otherwise consume the next step's response.
 */
function mockJudge(responses: {
  alignment?: { claim: string; supported: boolean; reason: string }[];
  questions?: string[];
  coverage?: { question: string; answered: boolean; reason: string }[];
  reason?: string;
}) {
  const sourceJudgementJson = JSON.stringify({
    alignment: responses.alignment ?? [],
    questions: responses.questions ?? [],
  });
  const coverageJson = JSON.stringify({ coverage: responses.coverage ?? [] });
  const reasonText = responses.reason ?? 'No reason provided.';

  /** Picks the response belonging to the step that produced this prompt. */
  function responseFor(options: { prompt: unknown }) {
    const prompt = JSON.stringify(options.prompt);
    if (prompt.includes('Part 1 (alignment)')) return sourceJudgementJson;
    if (prompt.includes('Decide whether each question can be answered')) return coverageJson;
    return reasonText;
  }

  /** Wraps text in a non-streaming model response. */
  function makeGenerateResult(text: string) {
    return {
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [{ type: 'text' as const, text }],
      warnings: [] as never[],
    };
  }

  /** Wraps text in a streaming model response with a single text delta. */
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

  return new MockLanguageModelV2({
    doGenerate: async options => makeGenerateResult(responseFor(options)),
    doStream: async options => makeStreamResult(responseFor(options)),
  });
}

const SOURCE_TEXT =
  'The company was founded in 1995 by John Smith. It started with 10 employees and grew to 500 by 2020. The company is based in Seattle.';

/** Builds an agent run carrying the source text as input and the summary as output. */
function run(summary: string, sourceText: string = SOURCE_TEXT) {
  return createAgentTestRun({
    inputMessages: [createTestMessage({ id: 'u1', role: 'user', content: sourceText })],
    output: [createTestMessage({ id: 'a1', role: 'assistant', content: summary })],
  });
}

/** Pairs each claim with a support flag to build alignment verdicts. */
function supported(claims: string[], flags: boolean[]) {
  return claims.map((claim, index) => ({
    claim,
    supported: flags[index] ?? true,
    reason: 'test verdict',
  }));
}

/** Pairs each question with an answered flag to build coverage verdicts. */
function answered(questions: string[], flags: boolean[]) {
  return questions.map((question, index) => ({
    question,
    answered: flags[index] ?? true,
    reason: 'test verdict',
  }));
}

/** Collects every prompt the scorer sent to the judge. */
function promptsSentTo(model: MockLanguageModelV2) {
  return JSON.stringify([...model.doStreamCalls, ...model.doGenerateCalls]);
}

/** Builds a run where the agent calls a tool before producing the summary. */
function runWithToolCall(summary: string, sourceText: string = SOURCE_TEXT) {
  return createAgentTestRun({
    inputMessages: [createTestMessage({ id: 'u1', role: 'user', content: 'Summarize the document' })],
    output: [
      createTestMessage({
        id: 'a1',
        role: 'assistant',
        content: '',
        toolInvocations: [
          {
            toolCallId: 'call-1',
            toolName: 'fetchDocument',
            args: {},
            result: { text: sourceText },
            state: 'result',
          },
        ],
      }),
      createTestMessage({ id: 'a2', role: 'assistant', content: summary }),
    ],
  });
}

describe('createSummarizationScorer', () => {
  describe('configuration', () => {
    it('should create a scorer with proper configuration', () => {
      const scorer = createSummarizationScorer({ model: mockJudge({}) });

      expect(scorer).toBeDefined();
      expect(scorer.id).toBe('summarization-scorer');
      expect(scorer.name).toBe('Summarization Scorer');
      expect(scorer.description).toBe(
        'A scorer that evaluates whether a summary stays faithful to its source text and preserves the information the source states',
      );
    });

    it('should throw error when maxQuestions is below one', () => {
      expect(() => createSummarizationScorer({ model: mockJudge({}), options: { maxQuestions: 0 } })).toThrow(
        'maxQuestions must be at least 1 for Summarization scoring',
      );
    });
  });

  describe('scoring pipeline', () => {
    it('scores 1 when every claim is supported and every question is answered', async () => {
      const claims = ['The company was founded in 1995', 'The company is based in Seattle'];
      const questions = ['Was the company founded in 1995?', 'Is the company based in Seattle?'];

      const scorer = createSummarizationScorer({
        model: mockJudge({
          alignment: supported(claims, [true, true]),
          questions,
          coverage: answered(questions, [true, true]),
          reason: 'The score is 1 because the summary is faithful and complete.',
        }),
      });

      const result = await scorer.run(run('The company was founded in Seattle in 1995.'));

      expect(result.score).toBe(1);
    });

    it('takes the alignment score when alignment is the weaker axis', async () => {
      const claims = ['The company was founded in 1995', 'The company has thousands of employees'];
      const questions = ['Was the company founded in 1995?', 'Is the company based in Seattle?'];

      const scorer = createSummarizationScorer({
        model: mockJudge({
          alignment: supported(claims, [true, false]),
          questions,
          coverage: answered(questions, [true, true]),
        }),
      });

      const result = await scorer.run(run('Founded in 1995 in Seattle, the company has thousands of employees.'));

      expect(result.score).toBe(0.5);
    });

    it('takes the coverage score when coverage is the weaker axis', async () => {
      const claims = ['The company is based in Seattle'];
      const questions = [
        'Was the company founded in 1995?',
        'Is the company based in Seattle?',
        'Did it grow to 500 employees?',
        'Was John Smith the founder?',
      ];

      const scorer = createSummarizationScorer({
        model: mockJudge({
          alignment: supported(claims, [true]),
          questions,
          coverage: answered(questions, [false, true, false, false]),
        }),
      });

      const result = await scorer.run(run('The company is based in Seattle.'));

      expect(result.score).toBe(0.25);
    });

    it('scores 0 when no claim is supported', async () => {
      const claims = ['The company was founded in 2015'];
      const questions = ['Was the company founded in 1995?'];

      const scorer = createSummarizationScorer({
        model: mockJudge({
          alignment: supported(claims, [false]),
          questions,
          coverage: answered(questions, [true]),
        }),
      });

      const result = await scorer.run(run('The company was founded in 2015.'));

      expect(result.score).toBe(0);
    });

    it('rounds the score to two decimals', async () => {
      const claims = ['Claim A', 'Claim B', 'Claim C'];
      const questions = ['Question A', 'Question B'];

      const scorer = createSummarizationScorer({
        model: mockJudge({
          alignment: supported(claims, [true, true, false]),
          questions,
          coverage: answered(questions, [true, true]),
        }),
      });

      const result = await scorer.run(run('A partially faithful summary.'));

      expect(result.score).toBe(0.67);
    });

    it('returns the reason produced by the judge', async () => {
      const claims = ['Claim A'];
      const questions = ['Question A'];

      const scorer = createSummarizationScorer({
        model: mockJudge({
          alignment: supported(claims, [true]),
          questions,
          coverage: answered(questions, [false]),
          reason: 'The score is 0 because coverage was the weaker axis.',
        }),
      });

      const result = await scorer.run(run('A summary.'));

      expect(result.reason).toBe('The score is 0 because coverage was the weaker axis.');
    });

    it('applies a custom scale to the score', async () => {
      const claims = ['Claim A', 'Claim B'];
      const questions = ['Question A', 'Question B'];

      const scorer = createSummarizationScorer({
        model: mockJudge({
          alignment: supported(claims, [true, false]),
          questions,
          coverage: answered(questions, [true, true]),
        }),
        options: { scale: 10 },
      });

      const result = await scorer.run(run('A partially faithful summary.'));

      expect(result.score).toBe(5);
    });
  });

  describe('coverage isolation', () => {
    it('never shows the source text to the coverage judge', async () => {
      const claims = ['Claim A'];
      const questions = ['Question A'];
      const model = mockJudge({
        alignment: supported(claims, [true]),
        questions,
        coverage: answered(questions, [true]),
      });

      const scorer = createSummarizationScorer({ model });

      await scorer.run(run('A summary.', 'The source document mentions volcanoes.'));

      const coveragePrompts = [...model.doStreamCalls, ...model.doGenerateCalls].filter(call =>
        JSON.stringify(call.prompt).includes('Decide whether each question can be answered'),
      );

      expect(coveragePrompts.length).toBeGreaterThan(0);
      for (const call of coveragePrompts) {
        expect(JSON.stringify(call.prompt)).not.toContain('volcanoes');
      }
    });
  });

  describe('summary resolution', () => {
    it('judges the final message when the agent called a tool first', async () => {
      const claims = ['Claim A'];
      const questions = ['Question A'];
      const model = mockJudge({
        alignment: supported(claims, [true]),
        questions,
        coverage: answered(questions, [true]),
      });

      const scorer = createSummarizationScorer({ model });

      const result = await scorer.run(runWithToolCall('The company is based in Seattle.'));

      expect(result.score).toBe(1);
      expect(promptsSentTo(model)).toContain('The company is based in Seattle.');
    });
  });

  describe('source resolution', () => {
    it('uses the source option instead of the run input', async () => {
      const claims = ['Claim A'];
      const questions = ['Question A'];
      const model = mockJudge({
        alignment: supported(claims, [true]),
        questions,
        coverage: answered(questions, [true]),
      });

      const scorer = createSummarizationScorer({
        model,
        options: { source: 'An entirely different source document about penguins.' },
      });

      await scorer.run(run('A summary.', 'A run input document about volcanoes.'));

      expect(promptsSentTo(model)).toContain('penguins');
      expect(promptsSentTo(model)).not.toContain('volcanoes');
    });

    it('uses the source extractor when provided', async () => {
      const claims = ['Claim A'];
      const questions = ['Question A'];
      const model = mockJudge({
        alignment: supported(claims, [true]),
        questions,
        coverage: answered(questions, [true]),
      });

      const scorer = createSummarizationScorer({
        model,
        options: {
          source: 'Ignored because the extractor takes precedence.',
          sourceExtractor: () => 'Extracted source document about penguins.',
        },
      });

      const result = await scorer.run(run('A summary.'));

      expect(result.score).toBe(1);
      expect(promptsSentTo(model)).toContain('Extracted source document about penguins.');
    });
  });

  describe('edge cases', () => {
    it('scores 0 when the summary yields no claims', async () => {
      const questions = ['Was the company founded in 1995?'];

      const scorer = createSummarizationScorer({
        model: mockJudge({
          alignment: [],
          questions,
          coverage: answered(questions, [true]),
        }),
      });

      const result = await scorer.run(run(''));

      expect(result.score).toBe(0);
    });

    it('scores 0 when the source yields no questions', async () => {
      const claims = ['Claim A'];

      const scorer = createSummarizationScorer({
        model: mockJudge({
          alignment: supported(claims, [true]),
          questions: [],
          coverage: [],
        }),
      });

      const result = await scorer.run(run('A summary.', ''));

      expect(result.score).toBe(0);
    });

    it('counts unanswered questions as missing when the judge returns too few verdicts', async () => {
      const claims = ['Claim A'];
      const questions = ['Question A', 'Question B', 'Question C', 'Question D'];
      const model = mockJudge({
        alignment: supported(claims, [true]),
        questions,
        coverage: answered(['Question A'], [true]),
      });

      const scorer = createSummarizationScorer({ model });

      const result = await scorer.run(run('A summary.'));

      expect(result.score).toBe(0.25);

      const reasonPrompt = [...model.doStreamCalls, ...model.doGenerateCalls]
        .map(call => JSON.stringify(call.prompt))
        .find(prompt => prompt.includes('Explain the summarization score'));

      expect(reasonPrompt).toContain('Question B');
      expect(reasonPrompt).toContain('Question C');
      expect(reasonPrompt).toContain('Question D');
    });

    it('ignores coverage verdicts beyond the questions that were asked', async () => {
      const claims = ['Claim A'];
      const questions = ['Question A'];

      const scorer = createSummarizationScorer({
        model: mockJudge({
          alignment: supported(claims, [true]),
          questions,
          coverage: answered(['Question A', 'Question B', 'Question C'], [true, false, false]),
        }),
      });

      const result = await scorer.run(run('A summary.'));

      expect(result.score).toBe(1);
    });

    it('ignores questions beyond the default cap of ten', async () => {
      const claims = ['Claim A'];
      const questions = Array.from({ length: 14 }, (_, index) => `Question ${index}`);

      const scorer = createSummarizationScorer({
        model: mockJudge({
          alignment: supported(claims, [true]),
          questions,
          coverage: answered(
            questions,
            questions.map((_, index) => index < 10),
          ),
        }),
      });

      const result = await scorer.run(run('A summary.'));

      expect(result.score).toBe(1);
    });

    it('ignores questions beyond maxQuestions', async () => {
      const claims = ['Claim A'];
      const questions = ['Question A', 'Question B', 'Question C'];

      const scorer = createSummarizationScorer({
        model: mockJudge({
          alignment: supported(claims, [true]),
          questions,
          coverage: answered(questions, [true, false, false]),
        }),
        options: { maxQuestions: 1 },
      });

      const result = await scorer.run(run('A summary.'));

      expect(result.score).toBe(1);
    });
  });
});
