/**
 * Scenario tests for multi-turn runEvals support.
 *
 * These tests exercise the `inputs: string[]` data item form, which drives
 * multiple sequential turns against an agent on the same thread and
 * accumulates all output messages for scoring.
 *
 * Full pipeline: AIMock scripted responses → OpenAI v6 provider → Agent → runEvals → scorers.
 */
import { createOpenAI } from '@ai-sdk/openai-v6';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Agent } from '../../agent';
import { createScorer } from '../base';
import { runEvals } from '.';

// ─── AIMock lifecycle ───────────────────────────────────────────────────────────

let mock: LLMock;

beforeAll(async () => {
  mock = new LLMock({ port: 0 });
  await mock.start();
});

afterEach(() => {
  mock.clearFixtures();
  mock.clearRequests();
  mock.resetMatchCounts();
});

afterAll(async () => {
  await mock.stop();
});

// ─── Helpers ────────────────────────────────────────────────────────────────────

const MODEL_ID = 'gpt-4o-mini';
let agentCounter = 0;

function textAgent(response: string) {
  mock.on({ endpoint: 'chat' }, { content: response });

  const openai = createOpenAI({
    apiKey: 'aimock-test-key',
    baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
  });

  return new Agent({
    id: `multi-turn-agent-${++agentCounter}`,
    name: 'Multi-turn Agent',
    instructions: 'Respond with the scripted text.',
    model: openai(MODEL_ID),
  });
}

/** Scorer that counts the number of output messages it receives. */
function outputCountScorer(expectedCount: number) {
  return createScorer({
    id: `output-count-${expectedCount}`,
    description: `Expects ${expectedCount} output messages`,
    name: `Output Count (${expectedCount})`,
  }).generateScore(({ run }) => {
    const output = run.output;
    const count = Array.isArray(output) ? output.length : 1;
    return count >= expectedCount ? 1 : 0;
  });
}

/** Scorer that checks if accumulated output text contains a specific substring. */
function outputContains(substring: string) {
  return createScorer({
    id: `output-contains-${substring}`,
    description: `Output contains "${substring}"`,
    name: `Output Contains (${substring})`,
  }).generateScore(({ run }) => {
    const output = run.output;
    // Output may be array of message objects or a single string
    const text = Array.isArray(output)
      ? output
          .map((msg: any) => {
            if (typeof msg === 'string') return msg;
            const c = msg?.content;
            if (typeof c === 'string') return c;
            // Handle parts-based content (v6 format)
            if (Array.isArray(c)) return c.map((p: any) => p?.text ?? '').join('');
            return JSON.stringify(msg);
          })
          .join(' ')
      : String(output);
    return text.includes(substring) ? 1 : 0;
  });
}

// ─── Scenarios ──────────────────────────────────────────────────────────────────

describe('Multi-turn — scenario tests via runEvals + AIMock', () => {
  describe('basic multi-turn execution', () => {
    it('accumulates output from multiple turns', async () => {
      const agent = textAgent('Brooklyn weather is sunny.');

      const result = await runEvals({
        data: [
          {
            inputs: ['What is the weather?', 'What about tomorrow?', 'Compare them.'],
          },
        ],
        scorers: [outputCountScorer(3)],
        target: agent,
      });

      expect(result.scores[`output-count-3`]).toBe(1.0);
      expect(result.summary.totalItems).toBe(1);
    });

    it('sends each turn sequentially (all turns executed)', async () => {
      const agent = textAgent('Response from agent.');
      let scorerCallCount = 0;

      const countingScorer = createScorer({
        id: 'counting-scorer',
        description: 'Counts calls',
        name: 'Counter',
      }).generateScore(() => {
        scorerCallCount++;
        return 1;
      });

      await runEvals({
        data: [
          {
            inputs: ['Turn 1', 'Turn 2'],
          },
        ],
        scorers: [countingScorer],
        target: agent,
      });

      // Scorer called once per data item, not per turn
      expect(scorerCallCount).toBe(1);

      // Verify both turns were actually sent to the mock server
      const requests = mock.getRequests();
      expect(requests.length).toBe(2);
    });
  });

  describe('scoring accumulated output', () => {
    it('scorer receives all turn outputs for evaluation', async () => {
      const agent = textAgent('sunny');

      const result = await runEvals({
        data: [
          {
            inputs: ['Weather?', 'Tomorrow?'],
          },
        ],
        scorers: [outputContains('sunny')],
        target: agent,
      });

      expect(result.scores['output-contains-sunny']).toBe(1.0);
    });
  });

  describe('multi-turn with gates and thresholds', () => {
    it('gates work with multi-turn data items', async () => {
      const agent = textAgent('Correct answer.');

      const passingGate = createScorer({
        id: 'multi-turn-gate',
        description: 'Always passes',
        name: 'Pass Gate',
      }).generateScore(() => 1);

      const result = await runEvals({
        data: [
          {
            inputs: ['Question 1', 'Follow-up'],
          },
        ],
        scorers: [outputCountScorer(2)],
        gates: [passingGate],
        target: agent,
      });

      expect(result.verdict).toBe('passed');
      expect(result.gateResults).toHaveLength(1);
      expect(result.gateResults![0]!.passed).toBe(true);
    });

    it('failing gate produces verdict: failed in multi-turn mode', async () => {
      const agent = textAgent('Response.');

      const failingGate = createScorer({
        id: 'failing-gate',
        description: 'Always fails',
        name: 'Fail Gate',
      }).generateScore(() => 0);

      const result = await runEvals({
        data: [
          {
            inputs: ['Turn 1', 'Turn 2'],
          },
        ],
        scorers: [outputCountScorer(2)],
        gates: [failingGate],
        target: agent,
      });

      expect(result.verdict).toBe('failed');
      expect(result.gateResults![0]!.passed).toBe(false);
    });

    it('thresholds work with multi-turn accumulated output', async () => {
      const agent = textAgent('Good response.');

      const qualityScorer = createScorer({
        id: 'quality',
        description: 'Fixed quality score',
        name: 'Quality',
      }).generateScore(() => 0.85);

      const result = await runEvals({
        data: [
          {
            inputs: ['Turn 1', 'Turn 2', 'Turn 3'],
          },
        ],
        scorers: [{ scorer: qualityScorer, threshold: 0.7 }],
        target: agent,
      });

      expect(result.verdict).toBe('passed');
      expect(result.thresholdResults![0]!.passed).toBe(true);
      expect(result.thresholdResults![0]!.averageScore).toBe(0.85);
    });
  });

  describe('validation', () => {
    it('rejects empty inputs array', async () => {
      const agent = textAgent('Response.');

      await expect(
        runEvals({
          data: [
            {
              inputs: [],
            },
          ],
          scorers: [outputCountScorer(1)],
          target: agent,
        }),
      ).rejects.toThrow(/non-empty array/);
    });
  });

  describe('mixed single-turn and multi-turn data items', () => {
    it('handles both input and inputs items in the same run', async () => {
      const agent = textAgent('Agent response.');

      const result = await runEvals({
        data: [
          { input: 'Single turn question' },
          {
            inputs: ['Multi turn 1', 'Multi turn 2'],
          },
        ],
        scorers: [
          createScorer({
            id: 'always-pass',
            description: 'Always passes',
            name: 'Pass',
          }).generateScore(() => 1),
        ],
        target: agent,
      });

      expect(result.summary.totalItems).toBe(2);
      expect(result.scores['always-pass']).toBe(1.0);
    });
  });
});

describe('Per-turn assertions (turns) — scenario tests via runEvals + AIMock', () => {
  /** Gate/scorer that reads only the turn's own input. */
  function inputContainsScorer(id: string, substring: string) {
    return createScorer({
      id,
      description: `Turn input contains "${substring}"`,
      name: id,
    }).generateScore(({ run }) => (typeof run.input === 'string' && run.input.includes(substring) ? 1 : 0));
  }

  it('scores each turn against its own input/output and returns per-turn results', async () => {
    const agent = textAgent('scripted answer');

    const result = await runEvals({
      data: [
        {
          turns: [
            { input: 'first turn', scorers: [outputCountScorer(1)] },
            { input: 'second turn', scorers: [outputCountScorer(1)] },
          ],
        },
      ],
      target: agent,
    });

    // Each turn sees exactly one output message (not the accumulated two).
    expect(result.turnResults).toBeDefined();
    expect(result.turnResults!.length).toBe(2);
    expect(result.turnResults![0]!.scores!['output-count-1']).toBe(1.0);
    expect(result.turnResults![1]!.scores!['output-count-1']).toBe(1.0);

    // Both turns actually hit the model.
    expect(mock.getRequests().length).toBe(2);
  });

  it('fails the verdict when a per-turn gate fails on a later turn', async () => {
    const agent = textAgent('scripted answer');

    const result = await runEvals({
      data: [
        {
          turns: [
            { input: 'please call the tool', gates: [inputContainsScorer('turn-gate', 'call')] },
            { input: 'unrelated follow-up', gates: [inputContainsScorer('turn-gate', 'call')] },
          ],
        },
      ],
      target: agent,
    });

    expect(result.verdict).toBe('failed');
    expect(result.turnResults![0]!.gateResults![0]!.passed).toBe(true);
    expect(result.turnResults![1]!.gateResults![0]!.passed).toBe(false);
  });

  it("yields verdict 'scored' when a per-turn threshold is missed", async () => {
    const agent = textAgent('scripted answer');

    const lowScorer = createScorer({
      id: 'turn-quality',
      description: 'Fixed low score',
      name: 'Turn Quality',
    }).generateScore(() => 0.3);

    const result = await runEvals({
      data: [
        {
          turns: [{ input: 'a question', scorers: [{ scorer: lowScorer, threshold: 0.8 }] }],
        },
      ],
      target: agent,
    });

    expect(result.verdict).toBe('scored');
    expect(result.turnResults![0]!.thresholdResults![0]!.passed).toBe(false);
  });
});
