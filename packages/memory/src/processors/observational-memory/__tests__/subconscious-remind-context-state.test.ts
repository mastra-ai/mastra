import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { ComputeStateSignalArgs } from '@mastra/core/processors';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { Memory } from '../../..';
import { createReminderAgent } from '../subconscious/remind-agent';

import { REMIND_CONTEXT_STATE_ID, RemindContextStateProcessor } from '../subconscious/remind-context-state';
import { REMIND_MESSAGE_METADATA_KEY } from '../subconscious/remind-protocol';

const sources = [{ id: 'source-1', text: 'The datastore migration is blocked on the counters rewrite.' }];

function checkMessage(eventId = 'subconscious:remind:abc:event'): MastraDBMessage {
  return {
    id: `${eventId}:message`,
    role: 'signal',
    threadId: 'subconscious:parent:remind',
    resourceId: 'resource-1',
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [
        {
          type: 'text',
          text: `Passive reminder check ${eventId}\n\nScoped source candidates:\n${JSON.stringify(sources)}\n\nRecent conversation messages already visible to the parent agent:\n(none)`,
        },
      ],
      metadata: {
        signal: {
          metadata: { [REMIND_MESSAGE_METADATA_KEY]: { type: 'passive-check', eventId, candidateIds: ['source-1'] } },
        },
      },
    },
  } as unknown as MastraDBMessage;
}

function args(overrides: Partial<ComputeStateSignalArgs> = {}): ComputeStateSignalArgs {
  return {
    messages: [checkMessage()],
    stepNumber: 0,
    steps: [],
    state: {},
    threadId: 'subconscious:parent:remind',
    resourceId: 'resource-1',
    activeStateSignals: [],
    contextWindow: { hasSnapshot: false },
    deltasSinceSnapshot: [],
    ...overrides,
  } as unknown as ComputeStateSignalArgs;
}

describe('Subconscious reminder parent-context state lane', () => {
  it('emits a snapshot of what the parent already says about the candidates', async () => {
    const processor = new RemindContextStateProcessor({
      readParentObservations: async () => 'The datastore migration is blocked on the counters rewrite.',
    });

    const signal = await processor.computeStateSignal(args());

    expect(signal).toMatchObject({ id: REMIND_CONTEXT_STATE_ID, mode: 'snapshot' });
    expect(signal!.contents).toContain('counters rewrite');
    expect(signal!.cacheKey).toEqual(expect.any(String));
  });

  it('spends nothing when the parent context has not moved', async () => {
    const readParentObservations = vi.fn(async () => 'The datastore migration is blocked on the counters rewrite.');
    const processor = new RemindContextStateProcessor({ readParentObservations });

    const first = await processor.computeStateSignal(args());
    const repeat = await processor.computeStateSignal(
      args({
        contextWindow: { hasSnapshot: true },
        tracking: { currentCacheKey: first!.cacheKey, currentMode: 'snapshot', version: 1 },
      } as Partial<ComputeStateSignalArgs>),
    );

    expect(repeat).toBeUndefined();
  });

  it('emits a fresh snapshot once the parent context changes', async () => {
    let observations = 'The datastore migration is blocked on the counters rewrite.';
    const processor = new RemindContextStateProcessor({ readParentObservations: async () => observations });

    const first = await processor.computeStateSignal(args());
    observations = 'The datastore migration shipped; the counters rewrite is done.';
    const second = await processor.computeStateSignal(
      args({
        contextWindow: { hasSnapshot: true },
        tracking: { currentCacheKey: first!.cacheKey, currentMode: 'snapshot', version: 1 },
      } as Partial<ComputeStateSignalArgs>),
    );

    expect(second).toBeDefined();
    expect(second!.cacheKey).not.toEqual(first!.cacheKey);
    expect(second!.contents).toContain('shipped');
  });

  it('stays silent rather than reporting an absence it did not observe', async () => {
    const failing = new RemindContextStateProcessor({
      readParentObservations: async () => {
        throw new Error('storage unavailable');
      },
    });
    const missing = new RemindContextStateProcessor({ readParentObservations: async () => undefined });

    await expect(failing.computeStateSignal(args())).resolves.toBeUndefined();
    await expect(missing.computeStateSignal(args())).resolves.toBeUndefined();
  });

  it('says nothing when no passive check is in play', async () => {
    const readParentObservations = vi.fn(async () => 'Something the parent knows.');
    const processor = new RemindContextStateProcessor({ readParentObservations });

    const signal = await processor.computeStateSignal(args({ messages: [] }));

    expect(signal).toBeUndefined();
    expect(readParentObservations).not.toHaveBeenCalled();
  });

  it('reaches the model when the reminder agent is actually prompted', async () => {
    const prompts: string[] = [];
    const model = new MockLanguageModelV2({
      doGenerate: async options => {
        prompts.push(JSON.stringify(options.prompt));
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          warnings: [],
          content: [{ type: 'text', text: '<no-reminder />' }],
        };
      },
    });
    const memory = new Memory({ storage: new InMemoryStore() });
    const parentMemory = {
      omEngine: Promise.resolve({
        getRecord: async () => ({
          activeObservations: 'The datastore migration is blocked on the counters rewrite.',
        }),
      }),
    } as unknown as Memory;

    const agent = createReminderAgent({
      model,
      memory,
      scope: ['resource:resource-1'],
      threadId: 'subconscious:parent:remind',
      resourceId: 'resource-1',
      parentThreadId: 'parent',
      parentMemory,
      fallbackSendSignal: vi.fn(),
    });

    await agent.generate([checkMessage()], {
      memory: { thread: 'subconscious:parent:remind', resource: 'resource-1' },
      maxSteps: 1,
    });

    expect(prompts[0]).toContain('currently say about the candidates');
    expect(prompts[0]).toContain('counters rewrite');
  });

  it('reads the parent record once per turn, not once per step', async () => {
    const readParentObservations = vi.fn(async () => 'The datastore migration is blocked on the counters rewrite.');
    const processor = new RemindContextStateProcessor({ readParentObservations });
    const state: Record<string, unknown> = {};

    await processor.computeStateSignal(args({ state, stepNumber: 0 }));
    await processor.computeStateSignal(args({ state, stepNumber: 1 }));
    await processor.computeStateSignal(args({ state, stepNumber: 2 }));

    expect(readParentObservations).toHaveBeenCalledTimes(1);
  });
});
