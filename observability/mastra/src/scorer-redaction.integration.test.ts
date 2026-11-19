/**
 * Live scorers on an agent traced with `tracingOptions.hideInput`/`hideOutput`.
 *
 * The hide flags redact the agent's own trace, but a live scorer re-reads the same
 * conversation: it stores a score row (input, output, judge prompts, reason) and runs in a
 * separate scorer trace whose spans, including the judge's model calls, carry that data
 * again. Both must inherit the agent's flags, or hiding data from traces does not keep it
 * out of storage.
 *
 * Runs against a real Observability instance, a real in-memory store, and the real scorer
 * pipeline with an LLM judge; only the models are mocked.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { createScorer } from '@mastra/core/evals';
import { Mastra } from '@mastra/core/mastra';
import { SpanType } from '@mastra/core/observability';
import { MockStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Observability } from './default';
import { TestExporter } from './exporters';

const USER_SECRET = 'jane.doe@example.com';
const REPLY_SECRET = 'DE89370400440532013000';

function streamModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

/** An LLM-judged scorer whose prompt and reason quote the conversation, as real judges do. */
function createQuotingJudgeScorer(transform?: 'input-to-output' | 'output-to-input') {
  return createScorer({
    id: 'helpfulness',
    description: 'Judges whether the reply helped the user',
    judge: { model: streamModel(JSON.stringify({ helpful: true })), instructions: 'You judge helpfulness.' },
    prepareRun: run => {
      if (transform === 'input-to-output') {
        return { ...run, output: { originalOutput: run.output, copiedInput: run.input } };
      }
      if (transform === 'output-to-input') {
        return { ...run, input: { originalInput: run.input, copiedOutput: run.output } };
      }
      return run;
    },
  })
    .analyze({
      description: 'Judge the reply',
      outputSchema: z.object({ helpful: z.boolean() }),
      createPrompt: ({ run }) =>
        `User said: ${JSON.stringify(run.input)}\nAgent replied: ${JSON.stringify(run.output)}\nWas it helpful?`,
    })
    .generateScore(({ results }) => (results.analyzeStepResult.helpful ? 1 : 0))
    .generateReason(({ run }) => `Helpful reply to ${JSON.stringify(run.input)}: ${JSON.stringify(run.output)}`);
}

type Variant = 'agent defaultOptions' | 'per-call tracingOptions' | 'durable agent, per-call tracingOptions';

type Hide = { hideInput?: boolean; hideOutput?: boolean };

function setup(variant: Variant, tracingOptions: Hide, transform?: 'input-to-output' | 'output-to-input') {
  const exporter = new TestExporter();
  const storage = new MockStore();

  const agent = new Agent({
    id: 'support',
    name: 'Support',
    instructions: 'Help the customer.',
    model: streamModel(`Your account IBAN is ${REPLY_SECRET}.`),
    scorers: { helpfulness: { scorer: createQuotingJudgeScorer(transform) } },
    ...(variant === 'agent defaultOptions' ? { defaultOptions: { tracingOptions } } : {}),
  });

  const registered = variant === 'durable agent, per-call tracingOptions' ? createDurableAgent({ agent }) : agent;
  const mastra = new Mastra({
    agents: { support: registered } as any,
    storage,
    observability: new Observability({
      configs: { test: { serviceName: 'scorer-redaction-it', exporters: [exporter] } },
    }),
  });

  const callOptions = variant === 'agent defaultOptions' ? {} : { tracingOptions };
  return { exporter, storage, agent: mastra.getAgent('support') as any, callOptions };
}

/** Scoring is fire-and-forget; wait for the score row, then for span delivery to go quiet. */
async function waitForScore(storage: MockStore, exporter: TestExporter, runId: string) {
  const scores = await storage.getStore('scores');
  for (let waited = 0; waited < 5000; waited += 20) {
    const { scores: rows } = await scores!.listScoresByRunId({ runId, pagination: { page: 0, perPage: 10 } });
    if (rows.length > 0) {
      let prev = -1;
      for (let i = 0; i < 50 && exporter.getAllSpans().length !== prev; i++) {
        prev = exporter.getAllSpans().length;
        await new Promise(r => setTimeout(r, 20));
      }
      return rows;
    }
    await new Promise(r => setTimeout(r, 20));
  }
  throw new Error(`no score stored for ${runId}`);
}

const HIDE_BOTH: Hide = { hideInput: true, hideOutput: true };

async function runAndScore(variant: Variant, hide: Hide, transform?: 'input-to-output' | 'output-to-input') {
  const { exporter, storage, agent, callOptions } = setup(variant, hide, transform);
  const runId = `run-${variant.replace(/\W+/g, '-')}-${JSON.stringify(hide).replace(/\W+/g, '-')}`;

  const res = await agent.stream(`Hi, my email is ${USER_SECRET}. What is my IBAN?`, { runId, ...callOptions });
  // Durable agents return `{ output, cleanup }`; the plain agent returns the output itself.
  await (res.output ?? res).consumeStream();

  const rows = await waitForScore(storage, exporter, runId);
  res.cleanup?.();
  return { rows, exporter };
}

const VARIANTS: Variant[] = [
  'agent defaultOptions',
  'per-call tracingOptions',
  'durable agent, per-call tracingOptions',
];

describe.each(VARIANTS)('live scorer on a hidden agent trace (%s)', variant => {
  it('stores the score without the conversation or judge prompts', async () => {
    const { rows } = await runAndScore(variant, HIDE_BOTH);

    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row.score).toBe(1);
    expect(row.scorerId).toBe('helpfulness');

    const stored = JSON.stringify(row);
    expect(stored).not.toContain(USER_SECRET);
    expect(stored).not.toContain(REPLY_SECRET);
  });

  it('exports no scorer span or score event that carries the conversation', async () => {
    const { exporter } = await runAndScore(variant, HIDE_BOTH);

    const scorerRuns = exporter.getAllSpans().filter(span => span.type === SpanType.SCORER_RUN);
    expect(scorerRuns).toHaveLength(1);

    // The scorer runs in its own trace: the run, its steps, and the judge's model spans.
    const scorerTrace = exporter.getAllSpans().filter(span => span.traceId === scorerRuns[0]!.traceId);
    expect(scorerTrace.some(span => span.type === SpanType.SCORER_STEP)).toBe(true);
    expect(JSON.stringify(scorerTrace)).not.toContain(USER_SECRET);
    expect(JSON.stringify(scorerTrace)).not.toContain(REPLY_SECRET);

    const scoreEvents = exporter.getScoreEvents();
    expect(scoreEvents.map(e => e.score.score)).toEqual([1]);
    expect(JSON.stringify(scoreEvents)).not.toContain(USER_SECRET);
    expect(JSON.stringify(scoreEvents)).not.toContain(REPLY_SECRET);
  });

  it('keeps the conversation out of the agent trace', async () => {
    const { exporter } = await runAndScore(variant, HIDE_BOTH);

    const scorerTraceId = exporter.getAllSpans().find(span => span.type === SpanType.SCORER_RUN)?.traceId;
    const agentTrace = exporter.getAllSpans().filter(span => span.traceId !== scorerTraceId);
    expect(agentTrace.length).toBeGreaterThan(0);
    expect(JSON.stringify(agentTrace)).not.toContain(USER_SECRET);
    expect(JSON.stringify(agentTrace)).not.toContain(REPLY_SECRET);
  });

  // Guards the assertions above: without the flags the same data must be visible, or the
  // hidden-case checks would pass vacuously.
  it('keeps the conversation in scores and scorer spans when the trace is not hidden', async () => {
    const { rows, exporter } = await runAndScore(variant, {});

    const stored = JSON.stringify(rows[0]);
    expect(stored).toContain(USER_SECRET);
    expect(stored).toContain(REPLY_SECRET);
    expect(rows[0].reason).toContain(USER_SECRET);

    const scorerRun = exporter.getAllSpans().find(span => span.type === SpanType.SCORER_RUN);
    expect(JSON.stringify(scorerRun?.input)).toContain(USER_SECRET);
    expect(exporter.getScoreEvents()[0]?.score.reason).toContain(USER_SECRET);
  });
});

// The scorer trace and prepared score row can mix both sides of the scored run, so one flag
// must hide both persisted fields and all scorer observability.
describe('live scorer on an agent trace with a single hide flag', () => {
  const scorerTraceOf = (exporter: TestExporter) => {
    const scorerRun = exporter.getAllSpans().find(span => span.type === SpanType.SCORER_RUN);
    return exporter.getAllSpans().filter(span => span.traceId === scorerRun?.traceId);
  };

  it('hideOutput keeps both sides out of the score and the whole scorer trace', async () => {
    const { rows, exporter } = await runAndScore('agent defaultOptions', { hideOutput: true });

    expect(rows[0]!.score).toBe(1);
    expect(JSON.stringify(rows[0])).not.toContain(REPLY_SECRET);
    expect(JSON.stringify(rows[0])).not.toContain(USER_SECRET);

    const scorerTrace = scorerTraceOf(exporter);
    expect(scorerTrace.length).toBeGreaterThan(0);
    expect(JSON.stringify(scorerTrace)).not.toContain(REPLY_SECRET);
    expect(JSON.stringify(scorerTrace)).not.toContain(USER_SECRET);
    expect(JSON.stringify(exporter.getScoreEvents())).not.toContain(REPLY_SECRET);
    expect(JSON.stringify(exporter.getScoreEvents())).not.toContain(USER_SECRET);
  });

  it('hideInput keeps both sides out of the score and the whole scorer trace', async () => {
    const { rows, exporter } = await runAndScore('agent defaultOptions', { hideInput: true });

    expect(rows[0]!.score).toBe(1);
    expect(JSON.stringify(rows[0])).not.toContain(USER_SECRET);
    expect(JSON.stringify(rows[0])).not.toContain(REPLY_SECRET);

    const scorerTrace = scorerTraceOf(exporter);
    expect(scorerTrace.length).toBeGreaterThan(0);
    expect(JSON.stringify(scorerTrace)).not.toContain(USER_SECRET);
    expect(JSON.stringify(scorerTrace)).not.toContain(REPLY_SECRET);
    expect(JSON.stringify(exporter.getScoreEvents())).not.toContain(USER_SECRET);
    expect(JSON.stringify(exporter.getScoreEvents())).not.toContain(REPLY_SECRET);
  });

  it.each([
    ['hideInput', { hideInput: true }, 'input-to-output'],
    ['hideOutput', { hideOutput: true }, 'output-to-input'],
  ] as const)('%s redacts prepared fields that copy data across sides', async (_name, hide, transform) => {
    const { rows, exporter } = await runAndScore('agent defaultOptions', hide, transform);

    expect(rows[0]!.score).toBe(1);
    expect(JSON.stringify(rows[0])).not.toContain(USER_SECRET);
    expect(JSON.stringify(rows[0])).not.toContain(REPLY_SECRET);
    expect(JSON.stringify(scorerTraceOf(exporter))).not.toContain(USER_SECRET);
    expect(JSON.stringify(scorerTraceOf(exporter))).not.toContain(REPLY_SECRET);
    expect(JSON.stringify(exporter.getScoreEvents())).not.toContain(USER_SECRET);
    expect(JSON.stringify(exporter.getScoreEvents())).not.toContain(REPLY_SECRET);
  });
});
