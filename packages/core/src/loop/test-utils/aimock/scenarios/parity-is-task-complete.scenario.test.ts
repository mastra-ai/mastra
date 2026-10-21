/**
 * Ported from validation harness case T3 (is-task-complete), source 23f640a.
 * Compare the source's done(contract), which excludes exact prose and scorer
 * durations, rather than declaring unrelated whole-stream differences.
 * Restart: COR-1449. The source excludes evented scorer throws.
 */
import { expect, it } from 'vitest';
import { Agent } from '../../../../agent';
import { createDurableAgent, createEventedAgent } from '../../../../agent/durable';
import { createScorer } from '../../../../evals';
import { EventEmitterPubSub } from '../../../../events';
import { Mastra } from '../../../../mastra';
import { MockMemory } from '../../../../memory/mock';
import { InMemoryStore } from '../../../../storage';
import { createRecordingModel, describeParity, textOnlyTape } from '../parity';
import type { ParityEngine } from '../parity';

const FEEDBACK = 'The reply is missing the required word OMEGA.';
type Variant = 'pass' | 'failonce' | 'throws';

async function drive(engine: ParityEngine, variant: Variant) {
  const scores: number[] = [];
  const completes: boolean[] = [];
  const scorer = createScorer({ id: 't3-scorer', description: 'Require OMEGA after one failure.' })
    .generateScore(async () => {
      if (variant === 'throws') throw new Error('T3b scorer failure');
      const score = variant === 'pass' || scores.length > 0 ? 1 : 0;
      scores.push(score);
      return score;
    })
    .generateReason(async ({ score }) => (score ? 'complete' : FEEDBACK));
  const { model, requests } = createRecordingModel({
    respond: request => textOnlyTape(JSON.stringify(request.prompt).includes(FEEDBACK) ? 'ALPHA and OMEGA.' : 'ALPHA.'),
  });
  const memory = new MockMemory();
  const agent = new Agent({
    id: 'completion-agent',
    name: 't3',
    instructions: 'Answer briefly. If you receive completion feedback, follow it exactly.',
    model,
    memory,
    defaultOptions: {
      isTaskComplete: {
        scorers: [scorer],
        onComplete: result => {
          completes.push(result.complete);
        },
      },
    },
  });
  const pubsub = new EventEmitterPubSub();
  const wrapper =
    engine === 'plain'
      ? undefined
      : engine === 'durable'
        ? createDurableAgent({ agent, pubsub })
        : createEventedAgent({ agent, pubsub });
  const host = new Mastra({ agents: { agent: wrapper ?? agent }, storage: new InMemoryStore(), logger: false });
  let cleanup: (() => void) | undefined;
  try {
    let onFinish = 0;
    let onError = 0;
    const options = {
      maxSteps: 5,
      memory: { thread: 't3-thread', resource: 't3-resource' },
      onFinish: () => {
        onFinish++;
      },
      onError: () => {
        onError++;
      },
    };
    const wrapped = wrapper
      ? await wrapper.stream('Reply with one short sentence that contains the word ALPHA.', options)
      : undefined;
    cleanup = wrapped?.cleanup;
    const output =
      wrapped?.output ?? (await agent.stream('Reply with one short sentence that contains the word ALPHA.', options));
    const types: string[] = [];
    for await (const chunk of output.fullStream) types.push(chunk.type);
    const outcome = {
      finish: types.filter(type => type === 'finish').length,
      errors: types.filter(type => ['error', 'abort', 'tripwire'].includes(type)),
      onError,
      onFinish,
    };
    if (variant === 'throws') {
      expect(outcome.finish + outcome.errors.length + outcome.onError).toBeGreaterThan(0);
      return { variant, outcome };
    }
    expect(outcome).toEqual({ finish: 1, errors: [], onError: 0, onFinish: 1 });
    expect(scores).toEqual(variant === 'pass' ? [1] : [0, 1]);
    expect(completes).toEqual(scores.map(score => score === 1));
    expect(completes.at(-1)).toBe(true);
    expect(requests).toHaveLength(variant === 'pass' ? 1 : 2);
    if (variant === 'failonce') expect(JSON.stringify(requests[1])).toContain(FEEDBACK);
    const { messages } = await memory.recall({ threadId: 't3-thread', resourceId: 't3-resource' });
    expect(messages.filter(message => message.role === 'user')).toHaveLength(1);
    const feedbackMsgs = messages.filter(message => JSON.stringify(message.content).includes(FEEDBACK)).length;
    expect(feedbackMsgs).toBe(variant === 'failonce' ? 1 : 0);
    const final =
      messages
        .filter(message => message.role === 'assistant')
        .at(-1)
        ?.content.parts?.filter(part => part.type === 'text')
        .map(part => part.text)
        .join('') ?? '';
    const contract = {
      variant,
      scorerScores: scores,
      onComplete: completes.length,
      feedbackPersisted: feedbackMsgs,
      finalMentionsOmega: variant === 'failonce' ? /omega/i.test(final) : null,
    };
    expect(contract).toEqual({
      variant,
      scorerScores: variant === 'pass' ? [1] : [0, 1],
      onComplete: variant === 'pass' ? 1 : 2,
      feedbackPersisted: variant === 'pass' ? 0 : 1,
      finalMentionsOmega: variant === 'pass' ? null : true,
    });
    return contract;
  } finally {
    cleanup?.();
    await host.shutdown({ drainTimeout: 1000 });
  }
}

describeParity('is-task-complete parity', target => {
  const variants = target === 'evented' ? (['pass', 'failonce'] as const) : (['pass', 'failonce', 'throws'] as const);
  it.each(variants)(
    '%s: completion feedback and callbacks survive the grading boundary',
    async variant => {
      expect(await drive(target, variant)).toEqual(await drive('plain', variant));
    },
    30_000,
  );
});
