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

  /**
   * The lane reads the parent's *committed* record, while the batch that just
   * triggered this check has not been committed yet and travels in the check
   * message instead. Neither half is complete on its own, so the division of
   * labour is load-bearing: the message covers the newest batch, the lane
   * covers accumulated memory. Both sentinel facts below share distinctive
   * terms with the candidate, so a lane that read the batch would visibly
   * project it — the exclusion is a real constraint rather than a lexical miss.
   */
  describe('the committed/pre-commit split', () => {
    const committedFact = 'The datastore migration has been blocked on the counters rewrite since Tuesday.';
    const batchFact = 'The datastore migration counters rewrite just landed in staging.';

    function checkMessageWithBatch(): MastraDBMessage {
      const eventId = 'subconscious:remind:split:event';
      const message = checkMessage(eventId);
      (message.content as { parts: { type: string; text: string }[] }).parts = [
        {
          type: 'text',
          text: `Passive reminder check ${eventId}\n\nScoped source candidates:\n${JSON.stringify(sources)}\n\nNewly extracted observations:\n${batchFact}\n\nRecent conversation messages already visible to the parent agent:\n(none)`,
        },
      ];
      return message;
    }

    it('keeps the newest batch out of the lane and the accumulated memory in it', async () => {
      const processor = new RemindContextStateProcessor({ readParentObservations: async () => committedFact });

      const signal = await processor.computeStateSignal(args({ messages: [checkMessageWithBatch()] }));

      expect(signal!.contents).toContain('since Tuesday');
      // Would be projected if the lane read the check message's batch: it shares
      // 'datastore', 'migration', 'counters' and 'rewrite' with the candidate.
      expect(signal!.contents).not.toContain('landed in staging');
    });

    it('delivers the batch through the check message, so the two halves reach the model together', async () => {
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
      const parentMemory = {
        omEngine: Promise.resolve({ getRecord: async () => ({ activeObservations: committedFact }) }),
      } as unknown as Memory;

      const agent = createReminderAgent({
        model,
        memory: new Memory({ storage: new InMemoryStore() }),
        scope: ['resource:resource-1'],
        threadId: 'subconscious:parent:remind',
        resourceId: 'resource-1',
        parentThreadId: 'parent',
        parentMemory,
        fallbackSendSignal: vi.fn(),
      });

      await agent.generate([checkMessageWithBatch()], {
        memory: { thread: 'subconscious:parent:remind', resource: 'resource-1' },
        maxSteps: 1,
      });

      // Both halves present, and the batch arrives ahead of the lane section
      // rather than inside it.
      expect(prompts[0]).toContain('landed in staging');
      expect(prompts[0]).toContain('since Tuesday');
      const laneSection = prompts[0]!.slice(prompts[0]!.indexOf('currently say about the candidates'));
      expect(laneSection).not.toContain('landed in staging');
    });
  });

  /**
   * Deltas only exist in the filtered regime, which starts above
   * CANDIDATE_CONTEXT_MAX_CHARACTERS. Below it the projection forwards the
   * parent's accumulated memory as one undifferentiated block, so there is no
   * candidate key to diff and the lane deliberately stays snapshot-only.
   */
  describe('snapshot and delta', () => {
    const candidates = [
      { id: 'source-1', text: 'The datastore migration is blocked on the counters rewrite.' },
      { id: 'source-2', text: 'The invoice exporter needs pagination for archived ledgers.' },
    ];

    /** Filler wide enough to push the projection past the 4 KiB regime boundary. */
    function filler(): string {
      return Array.from({ length: 90 }, (_, index) => `Unrelated bookkeeping note number ${index} about nothing.`).join(
        '\n',
      );
    }

    function bigObservations({ first, second }: { first?: string; second?: string }): string {
      return [first, second, filler()].filter(Boolean).join('\n');
    }

    const firstFact = 'The datastore migration is blocked on the counters rewrite until Tuesday.';
    const secondFact = 'The invoice exporter still needs pagination over archived ledgers.';

    function checkWith(eventId: string, srcs: typeof candidates): MastraDBMessage {
      const message = checkMessage(eventId);
      (message.content as { parts: { type: string; text: string }[] }).parts = [
        {
          type: 'text',
          text: `Passive reminder check ${eventId}\n\nScoped source candidates:\n${JSON.stringify(srcs)}\n\nRecent conversation messages already visible to the parent agent:\n(none)`,
        },
      ];
      return message;
    }

    function base(signal: { value?: unknown; metadata?: unknown }) {
      return { metadata: signal.metadata } as never;
    }

    async function firstSnapshot(observations: string, srcs = candidates) {
      const processor = new RemindContextStateProcessor({ readParentObservations: async () => observations });
      const signal = await processor.computeStateSignal(args({ messages: [checkWith('check-one', srcs)] }));
      return signal!;
    }

    function secondArgs(snapshot: { metadata?: unknown }, eventId = 'check-two', srcs = candidates) {
      return args({
        messages: [checkWith(eventId, srcs)],
        contextWindow: { hasSnapshot: true },
        lastSnapshot: base(snapshot),
        deltasSinceSnapshot: [],
      } as Partial<ComputeStateSignalArgs>);
    }

    it('starts with a snapshot when nothing is in the window', async () => {
      const snapshot = await firstSnapshot(bigObservations({ first: firstFact, second: secondFact }));

      expect(snapshot.mode).toBe('snapshot');
      expect((snapshot.value as { regime: string }).regime).toBe('filtered');
      expect((snapshot.value as { entries: unknown[] }).entries).toHaveLength(2);
    });

    it('sends only the candidate that moved once a base is visible', async () => {
      const snapshot = await firstSnapshot(bigObservations({ first: firstFact, second: secondFact }));
      const processor = new RemindContextStateProcessor({
        readParentObservations: async () =>
          bigObservations({
            first: 'The datastore migration counters rewrite is finished and the blocked flag is cleared.',
            second: secondFact,
          }),
      });

      const delta = await processor.computeStateSignal(secondArgs(snapshot));

      expect(delta!.mode).toBe('delta');
      expect((delta as { delta: { ops: { op: string; entry?: { id: string } }[] } }).delta.ops).toHaveLength(1);
      expect(delta!.contents).toContain('source-1');
      expect(delta!.contents).not.toContain('archived ledgers');
      expect(delta!.contents!.length).toBeLessThan(snapshot.contents!.length);
    });

    it('emits nothing at all when a check changes nothing', async () => {
      const observations = bigObservations({ first: firstFact, second: secondFact });
      const snapshot = await firstSnapshot(observations);
      const processor = new RemindContextStateProcessor({ readParentObservations: async () => observations });

      // The runtime's dedupe cannot cover this: it keys on cache key *and*
      // mode, and the previous emission was a snapshot.
      await expect(processor.computeStateSignal(secondArgs(snapshot))).resolves.toBeUndefined();
    });

    it('re-sends a full snapshot when the base has been evicted from the window', async () => {
      const observations = bigObservations({ first: firstFact, second: secondFact });
      const snapshot = await firstSnapshot(observations);
      const processor = new RemindContextStateProcessor({ readParentObservations: async () => observations });

      const second = await processor.computeStateSignal(
        args({
          messages: [checkWith('check-two', candidates)],
          contextWindow: { hasSnapshot: false },
          lastSnapshot: base(snapshot),
        } as Partial<ComputeStateSignalArgs>),
      );

      expect(second!.mode).toBe('snapshot');
    });

    it('never emits a delta in the passthrough regime, even with a base present', async () => {
      const snapshot = await firstSnapshot('The datastore migration is blocked on the counters rewrite.');
      const processor = new RemindContextStateProcessor({
        readParentObservations: async () => 'The datastore migration counters rewrite is finished.',
      });

      const second = await processor.computeStateSignal(secondArgs(snapshot));

      expect(snapshot.mode).toBe('snapshot');
      expect((snapshot.value as { regime: string }).regime).toBe('passthrough');
      expect(second!.mode).toBe('snapshot');
    });

    it('treats a passthrough base as no base at all rather than an empty one', async () => {
      const passthrough = await firstSnapshot('The datastore migration is blocked on the counters rewrite.');
      const processor = new RemindContextStateProcessor({
        readParentObservations: async () => bigObservations({ first: firstFact, second: secondFact }),
      });

      const second = await processor.computeStateSignal(secondArgs(passthrough));

      // A delta here would announce both candidates as newly entered, which is
      // an artefact of the regime change rather than anything that happened.
      expect(second!.mode).toBe('snapshot');
      expect(second!.contents).not.toContain('is among this check');
    });

    it('splits the regimes at the byte the constant names, not near it', async () => {
      const line = (index: number) => `Bookkeeping note ${String(index).padStart(4, '0')} about nothing at all.`;
      const build = (length: number) => {
        const lines: string[] = [];
        let total = 0;
        for (let index = 0; total < length; index++) {
          const next = line(index);
          lines.push(next);
          total += next.length + (lines.length > 1 ? 1 : 0);
        }
        const joined = lines.join('\n');
        return joined.slice(0, length);
      };

      const atBoundary = await firstSnapshot(build(4096));
      const overBoundary = await firstSnapshot(build(4097));

      expect((atBoundary.value as { regime: string }).regime).toBe('passthrough');
      expect((overBoundary.value as { regime: string }).regime).toBe('filtered');
    });

    it('stamps every line with the check it describes, so superseded lines stay true', async () => {
      const snapshot = await firstSnapshot(bigObservations({ first: firstFact, second: secondFact }));
      const stopped = new RemindContextStateProcessor({
        readParentObservations: async () => bigObservations({ second: secondFact }),
      });
      const returned = new RemindContextStateProcessor({
        readParentObservations: async () => bigObservations({ first: firstFact, second: secondFact }),
      });

      const dropOut = await stopped.computeStateSignal(secondArgs(snapshot, 'check-two'));
      const comeBack = await returned.computeStateSignal(
        args({
          messages: [checkWith('check-three', candidates)],
          contextWindow: { hasSnapshot: true },
          lastSnapshot: base(snapshot),
          deltasSinceSnapshot: [{ metadata: (dropOut as { metadata: unknown }).metadata }],
        } as unknown as Partial<ComputeStateSignalArgs>),
      );

      expect(dropOut!.contents).toContain('as of check check-two: source-1');
      expect(comeBack!.contents).toContain('as of check check-three: source-1');
      // Both lines describe their own check, so the earlier one is still true
      // sitting next to the later one.
      expect(dropOut!.contents).not.toContain('check-three');
    });

    it('reports a candidate that stopped matching as a wording fact, never as a loss', async () => {
      const snapshot = await firstSnapshot(bigObservations({ first: firstFact, second: secondFact }));
      const processor = new RemindContextStateProcessor({
        readParentObservations: async () => bigObservations({ second: secondFact }),
      });

      const delta = await processor.computeStateSignal(secondArgs(snapshot));
      const ops = (delta as { delta: { ops: { op: string }[] } }).delta.ops;

      expect(ops).toEqual([expect.objectContaining({ op: 'no-longer-matched' })]);
      expect(delta!.contents).toContain('had no lexical overlap with the parent');
      expect(delta!.contents).toContain('not about what the parent still holds');
      for (const forbidden of ['evicted', 'removed from context', 'dropped', 'left the parent', 'forgot', 'removed']) {
        expect(delta!.contents).not.toContain(forbidden);
      }
    });

    it('separates leaving the candidate set from losing a wording match', async () => {
      const observations = bigObservations({ first: firstFact, second: secondFact });
      const snapshot = await firstSnapshot(observations);
      const processor = new RemindContextStateProcessor({ readParentObservations: async () => observations });

      const delta = await processor.computeStateSignal(secondArgs(snapshot, 'check-two', [candidates[0]!]));
      const ops = (delta as { delta: { ops: { op: string; id?: string }[] } }).delta.ops;

      expect(ops).toEqual([{ op: 'left-candidate-set', id: 'source-2' }]);
      expect(delta!.contents).toContain("was not among this check's candidates");
      expect(delta!.contents).not.toContain('had no lexical overlap');
    });

    it('stays silent on a failed read in the filtered regime too', async () => {
      const snapshot = await firstSnapshot(bigObservations({ first: firstFact, second: secondFact }));
      const failing = new RemindContextStateProcessor({
        readParentObservations: async () => {
          throw new Error('storage unavailable');
        },
      });

      await expect(failing.computeStateSignal(secondArgs(snapshot))).resolves.toBeUndefined();
    });

    it('tells the model how to fold deltas onto the snapshot', async () => {
      const processor = new RemindContextStateProcessor({ readParentObservations: async () => 'anything' });

      const result = processor.processInput({ messages: [], systemMessages: [] } as never);

      const instructions = (result as { systemMessages: { content: string }[] }).systemMessages.at(-1)!.content;
      expect(instructions).toContain('parent-context-update');
      expect(instructions).toContain('Fold each delta onto the latest snapshot');
    });
  });
});
