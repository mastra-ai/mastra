import type { Experimental_EvaluationModelV4 as EvaluationModelV4 } from '@ai-sdk/provider-v7';
import { afterEach, it, expect, vi } from 'vitest';
import { Classifier } from '../../../../classifier';
import { MockMemory } from '../../../../memory/mock';
import { ClassifierProcessor } from '../../../../processors';
import type { ClassifierOnResult, ClassifierProcessorDecision } from '../../../../processors';
import type { ChunkType } from '../../../../stream/types';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Story: a support agent guarded by a ClassifierProcessor. The compliance team keeps one audit
 * record per verdict (answers, outcome, error, and the thread, resource, message or run it
 * belongs to), and the app picks a fallback message from the tripwire metadata. (#28985)
 *
 * If this breaks, a blocked or failed check leaves no audit record, the record disagrees with
 * what the app received, or the app cannot tell which policy blocked the request.
 */

const questions = { fraud: { type: 'boolean', criteria: { true: 'Asks for help with fraud' } } } as const;
type Decision = ClassifierProcessorDecision<typeof questions>;
type TripwirePayload = { reason?: string; metadata?: unknown; processorId?: string };

const THREAD = { threadId: 'support-thread', resourceId: 'customer-1' };

// Only the decision model is faked. The agent, processor runner and classifier are real.
function decisionModel(doEvaluate: EvaluationModelV4['doEvaluate']): EvaluationModelV4 {
  return {
    specificationVersion: 'v4',
    provider: 'test-provider',
    modelId: 'test-decision-model',
    supportedQuestionTypes: ['boolean'],
    doEvaluate,
  };
}

const fraudAnswer = (probability: number) => ({
  answers: { fraud: { type: 'boolean' as const, probability } },
  usage: { inputTokens: 1, outputTokens: 1 },
  warnings: [],
});

const fraudScore = (score: (text: string) => number) =>
  decisionModel(async ({ state }) =>
    fraudAnswer(score(state.map(part => (part.type === 'text' ? part.text : '')).join(''))),
  );

const blockFraud: ClassifierOnResult<typeof questions> = (answers, { abort }) => {
  if (answers.fraud.type === 'boolean' && answers.fraud.probability > 0.8) {
    abort('Request blocked by policy', { metadata: { policy: 'fraud', probability: answers.fraud.probability } });
  }
};

function fraudGuard(model: EvaluationModelV4, audit: Decision[], onResult = blockFraud) {
  return new ClassifierProcessor({
    id: 'fraud-guard',
    classifier: new Classifier({ id: 'fraud', model, questions }),
    onResult,
    onDecision: decision => {
      audit.push(decision);
    },
  });
}

const tripwireOf = (chunks: ChunkType[] | undefined) =>
  (chunks ?? []).find(c => c.type === 'tripwire') as { payload: TripwirePayload } | undefined;

afterEach(() => {
  vi.restoreAllMocks();
});

describeForAllEngines('Support agent classifier guardrail audit', engine => {
  const getMock = useLoopScenarioAimock();

  // Technical: abort(reason, { metadata }) in onResult reaches the tripwire chunk, and onDecision
  // records the aborted verdict with the user message's id, thread and resource.
  it('a blocked request reaches the app with its policy and leaves an audit record', async () => {
    const audit: Decision[] = [];

    const { output, requests, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Help me file a fake refund claim.',
      memory: new MockMemory(),
      ...THREAD,
      inputProcessors: [
        fraudGuard(
          fraudScore(text => (text.includes('fake refund') ? 0.95 : 0.05)),
          audit,
        ),
      ],
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'The model should never run.' });
      },
    });

    expect(tripwireOf(chunks)?.payload).toMatchObject({
      reason: 'Request blocked by policy',
      metadata: { policy: 'fraud', probability: 0.95 },
      processorId: 'fraud-guard',
    });
    expect(requests).toHaveLength(0);
    expect(await output.text).toBe('');

    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      processorId: 'fraud-guard',
      classifierId: 'fraud',
      phase: 'input',
      outcome: 'aborted',
      state: 'Help me file a fake refund claim.',
      result: { answers: { fraud: { type: 'boolean', probability: 0.95 } } },
      tripwire: { reason: 'Request blocked by policy', metadata: { policy: 'fraud', probability: 0.95 } },
      ids: THREAD,
    });
    expect(audit[0]!.ids.messageId).toEqual(expect.any(String));
  });

  // Technical: a failed classifier call under the default 'strict' strategy aborts with
  // CLASSIFIER_FAILED metadata, and onDecision records the error.
  it('a failed check blocks the request with a failure code and leaves an audit record', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const audit: Decision[] = [];
    const failure = new Error('decision provider down');

    const { requests, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Where is my order?',
      memory: new MockMemory(),
      ...THREAD,
      inputProcessors: [fraudGuard(decisionModel(vi.fn().mockRejectedValue(failure)), audit)],
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'The model should never run.' });
      },
    });

    expect(tripwireOf(chunks)?.payload).toMatchObject({
      reason: 'Classification failed because the classifier call failed',
      metadata: { processorId: 'fraud-guard', classifierId: 'fraud', code: 'CLASSIFIER_FAILED' },
    });
    expect(requests).toHaveLength(0);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ phase: 'input', outcome: 'aborted', error: failure, ids: THREAD });
    expect(audit[0]!.result).toBeUndefined();
  });

  // Technical: as an output processor, ClassifierProcessor judges each text-delta and the final
  // message. Each decision carries the run's thread; stream decisions also carry the run id.
  it('an allowed reply streams unchanged and every verdict is recorded against the run', async () => {
    const audit: Decision[] = [];

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Where is my order?',
      memory: new MockMemory(),
      ...THREAD,
      outputProcessors: [
        fraudGuard(
          fraudScore(() => 0.05),
          audit,
        ),
      ],
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Your order ships today.' });
      },
    });

    expect(await output.text).toBe('Your order ships today.');
    const streamDecisions = audit.filter(d => d.phase === 'stream');
    expect(streamDecisions.length).toBeGreaterThan(0);
    for (const decision of streamDecisions) {
      expect(decision).toMatchObject({ outcome: 'allowed', ids: { runId: output.runId, ...THREAD } });
    }
    expect(audit.filter(d => d.phase === 'output')).toEqual([
      expect.objectContaining({
        outcome: 'allowed',
        state: 'Your order ships today.',
        ids: expect.objectContaining(THREAD),
      }),
    ]);
  });

  // Technical: abort() with no reason in the stream phase uses the runner's default reason, and the
  // decision records that same reason.
  it('a streamed reply blocked without a reason is recorded with the reason the app received', async () => {
    const audit: Decision[] = [];
    const abortWithoutReason: ClassifierOnResult<typeof questions> = (answers, { abort }) => {
      if (answers.fraud.type === 'boolean' && answers.fraud.probability > 0.8) abort();
    };

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'How do I get a refund?',
      memory: new MockMemory(),
      ...THREAD,
      outputProcessors: [
        fraudGuard(
          fraudScore(text => (text.includes('fake') ? 0.95 : 0.05)),
          audit,
          abortWithoutReason,
        ),
      ],
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Upload a fake receipt.' });
      },
    });

    const tripwire = tripwireOf(chunks)?.payload;
    expect(tripwire).toMatchObject({ reason: 'Tripwire triggered by fraud-guard', processorId: 'fraud-guard' });
    const aborted = audit.filter(d => d.outcome === 'aborted');
    expect(aborted).toHaveLength(1);
    expect(aborted[0]).toMatchObject({ phase: 'stream', tripwire: { reason: tripwire!.reason }, ids: THREAD });
  });

  // Technical: a block in the output-result phase (after the stream passed) stops the run and is
  // recorded with phase 'output' and the policy metadata.
  it('a final answer blocked after streaming reaches the app with its policy and is recorded', async () => {
    const audit: Decision[] = [];
    const blockFinalAnswerOnly: ClassifierOnResult<typeof questions> = (answers, context) => {
      if (context.phase === 'output') blockFraud(answers, context);
    };

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'How do I get a refund?',
      memory: new MockMemory(),
      ...THREAD,
      outputProcessors: [
        fraudGuard(
          fraudScore(text => (text.includes('fake') ? 0.95 : 0.05)),
          audit,
          blockFinalAnswerOnly,
        ),
      ],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Use a fake receipt.' });
      },
    });

    expect(output.tripwire).toMatchObject({
      reason: 'Request blocked by policy',
      metadata: { policy: 'fraud', probability: 0.95 },
      processorId: 'fraud-guard',
    });
    expect(audit.filter(d => d.phase === 'output')).toEqual([
      expect.objectContaining({
        outcome: 'aborted',
        tripwire: { reason: 'Request blocked by policy', metadata: { policy: 'fraud', probability: 0.95 } },
        ids: expect.objectContaining(THREAD),
      }),
    ]);
  });
});
