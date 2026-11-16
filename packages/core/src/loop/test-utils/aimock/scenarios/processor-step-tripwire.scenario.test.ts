import { it, expect } from 'vitest';
import type { Processor } from '../../../../processors';
import type { ChunkType } from '../../../../stream/types';
import type { PrepareStepFunction } from '../../../types';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Per-step guardrails: a support agent can block a turn from processInputStep (before each
 * model call), from processOutputStep (after each model step), or from the prepareStep
 * call option. Each abort must reach the caller with its reason, retry flag, typed metadata
 * and the id of what fired it, so the app can tell the customer why and decide what to do.
 *
 * If this breaks, a blocked step either still calls the model, still ships the reply, or the
 * app cannot tell which guardrail fired.
 */

type TripwirePayload = { reason?: string; retry?: boolean; metadata?: unknown; processorId?: string };

const tripwireOf = (chunks: ChunkType[] | undefined) =>
  (chunks ?? []).find(c => c.type === 'tripwire') as { payload: TripwirePayload } | undefined;

describeForAllEngines('Support agent per-step guardrails', engine => {
  const getMock = useLoopScenarioAimock();

  // Technical: abort(reason, { metadata }) in processInputStep emits a tripwire chunk carrying
  // reason, metadata and processorId, and the step's model call is never made.
  it('a processInputStep block carries its reason, metadata and processor id and skips the model', async () => {
    const stepGuard: Processor = {
      id: 'input-step-toxicity-guard',
      processInputStep: async ({ abort }) => {
        abort('Blocked by processInputStep', { metadata: { toxicityScore: 0.9, category: 'harmful' } });
      },
    };

    const { output, requests, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello',
      inputProcessors: [stepGuard],
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'The model should never run.' });
      },
    });

    expect(tripwireOf(chunks)?.payload).toMatchObject({
      reason: 'Blocked by processInputStep',
      metadata: { toxicityScore: 0.9, category: 'harmful' },
      processorId: 'input-step-toxicity-guard',
    });
    expect(await output.text).toBe('');
    expect(requests).toHaveLength(0);
  });

  // Technical: abort(reason, { retry: true }) in processInputStep surfaces retry: true on the
  // tripwire chunk (no retry budget configured, so the model is still never called).
  it('a processInputStep block asking for a retry tells the caller it can be retried', async () => {
    const stepGuard: Processor = {
      id: 'input-step-retry-guard',
      processInputStep: async ({ abort }) => {
        abort('Please try again', { retry: true });
      },
    };

    const { requests, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello',
      inputProcessors: [stepGuard],
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'The model should never run.' });
      },
    });

    expect(tripwireOf(chunks)?.payload).toMatchObject({ reason: 'Please try again', retry: true });
    expect(requests).toHaveLength(0);
  });

  // Technical: abort(reason, { metadata }) in processOutputStep ends the step with
  // stepResult.reason 'tripwire', sets output.tripwire { reason, metadata, processorId },
  // and the rejected model text is not returned.
  it('a processOutputStep block carries its metadata and processor id and drops the reply', async () => {
    const replyGuard: Processor = {
      id: 'output-step-policy-guard',
      processOutputStep: async ({ text, abort }) => {
        if (text?.includes('harmful')) {
          abort('Content policy violation', { metadata: { category: 'harmful_content', confidence: 0.95 } });
        }
        return [];
      },
    };

    const { output, requests, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello',
      outputProcessors: [replyGuard],
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'harmful content' });
      },
    });

    expect(requests).toHaveLength(1);
    const stepFinish = chunks!.find(c => c.type === 'step-finish') as
      | { payload: { stepResult: { reason: string } } }
      | undefined;
    expect(stepFinish?.payload.stepResult.reason).toBe('tripwire');
    expect(await output.finishReason).toBe('tripwire');
    expect(await output.text).toBe('');
    expect(output.tripwire).toMatchObject({
      reason: 'Content policy violation',
      metadata: { category: 'harmful_content', confidence: 0.95 },
      processorId: 'output-step-policy-guard',
    });
  });

  // Technical: abort(reason, { metadata }) from the prepareStep call option emits a tripwire
  // chunk with processorId 'prepare-step' and the metadata, before any model call.
  it('a prepareStep block carries its metadata and is attributed to prepare-step', async () => {
    const { output, requests, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello',
      collectChunks: true,
      prepareStep: (({ abort }) => {
        abort('Blocked by prepareStep', { metadata: { reason: 'content_moderation', score: 0.85 } });
      }) satisfies PrepareStepFunction,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'The model should never run.' });
      },
    });

    expect(tripwireOf(chunks)?.payload).toMatchObject({
      reason: 'Blocked by prepareStep',
      metadata: { reason: 'content_moderation', score: 0.85 },
      processorId: 'prepare-step',
    });
    expect(await output.text).toBe('');
    expect(requests).toHaveLength(0);
  });

  // Technical: abort(reason, { retry: true }) from prepareStep surfaces retry: true on the
  // tripwire chunk.
  it('a prepareStep block asking for a retry tells the caller it can be retried', async () => {
    const { requests, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello',
      collectChunks: true,
      prepareStep: (({ abort }) => {
        abort('Please rephrase your question', { retry: true });
      }) satisfies PrepareStepFunction,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'The model should never run.' });
      },
    });

    expect(tripwireOf(chunks)?.payload).toMatchObject({ reason: 'Please rephrase your question', retry: true });
    expect(requests).toHaveLength(0);
  });
});
