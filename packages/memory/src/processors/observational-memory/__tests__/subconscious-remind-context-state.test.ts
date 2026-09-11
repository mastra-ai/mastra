import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { ComputeStateSignalArgs } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { Memory, Subconscious } from '../../..';
import { createReminderAgent } from '../subconscious/remind-agent';

import {
  REMIND_CONTEXT_STATE_ID,
  RemindContextStateProcessor,
  latestCheck,
} from '../subconscious/remind-context-state';
import { REMIND_MESSAGE_METADATA_KEY } from '../subconscious/remind-protocol';

const sources = [{ id: 'source-1', text: 'The datastore migration is blocked on the counters rewrite.' }];

/**
 * The committed record shape the lane reads. Generation 0 is the pre-reflection
 * default, so a test only names a generation when the reflection split is what
 * it is testing.
 */
function asRecord(observations: string | undefined, generationCount = 0) {
  return observations === undefined ? undefined : { observations, generationCount };
}

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

// Mirrors the observer stub the curation-entry tests use: the real observer pipeline runs,
// only the model's completion is deterministic.
function createObserverModel(observations: string) {
  const text = `<observations>\n${observations}\n</observations>\n<current-task>Continue the migration work.</current-task>`;
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      warnings: [],
      content: [{ type: 'text' as const, text }],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start' as const, warnings: [] },
        { type: 'response-metadata' as const, id: 'observer-1', modelId: 'mock-observer', timestamp: new Date() },
        { type: 'text-start' as const, id: 'text-1' },
        { type: 'text-delta' as const, id: 'text-1', delta: text },
        { type: 'text-end' as const, id: 'text-1' },
        {
          type: 'finish' as const,
          finishReason: 'stop' as const,
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  } as never);
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
      readParentRecord: async () => asRecord('The datastore migration is blocked on the counters rewrite.'),
    });

    const signal = await processor.computeStateSignal(args());

    expect(signal).toMatchObject({ id: REMIND_CONTEXT_STATE_ID, mode: 'snapshot' });
    expect(signal!.contents).toContain('counters rewrite');
    expect(signal!.cacheKey).toEqual(expect.any(String));
  });

  it('spends nothing when the parent context has not moved', async () => {
    const readParentRecord = vi.fn(async () => asRecord('The datastore migration is blocked on the counters rewrite.'));
    const processor = new RemindContextStateProcessor({ readParentRecord });

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
    const processor = new RemindContextStateProcessor({ readParentRecord: async () => asRecord(observations) });

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
      readParentRecord: async () => {
        throw new Error('storage unavailable');
      },
    });
    const missing = new RemindContextStateProcessor({ readParentRecord: async () => undefined });

    await expect(failing.computeStateSignal(args())).resolves.toBeUndefined();
    await expect(missing.computeStateSignal(args())).resolves.toBeUndefined();
  });

  it('says nothing when no passive check is in play', async () => {
    const readParentRecord = vi.fn(async () => asRecord('Something the parent knows.'));
    const processor = new RemindContextStateProcessor({ readParentRecord });

    const signal = await processor.computeStateSignal(args({ messages: [] }));

    expect(signal).toBeUndefined();
    expect(readParentRecord).not.toHaveBeenCalled();
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

    expect(prompts[0]).toContain('said about the candidates in play, as of check');
    expect(prompts[0]).toContain('counters rewrite');
  });

  it('hands the resolved scope to the store rather than filtering the feed itself', async () => {
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
    const listActivity = vi.fn(async () => [
      {
        id: 'evt-live',
        action: 'node-updated',
        recordType: 'node',
        recordId: 'source-1',
        scope: ['resource:resource-1'],
      },
    ]);
    const realGetStore = memory.storage.getStore.bind(memory.storage);
    vi.spyOn(memory.storage, 'getStore').mockImplementation((async (domain: string) =>
      domain === 'knowledge' ? ({ listActivity } as never) : await realGetStore(domain as never)) as never);
    // Markers only exist in the filtered regime, which starts above 4 KiB: the
    // passthrough block has no per-candidate slot to hang a marker on.
    const bulk = Array.from({ length: 200 }, (_, index) => `Unrelated bookkeeping note number ${index}.`).join('\n');
    const parentMemory = {
      omEngine: Promise.resolve({
        getRecord: async () => ({
          activeObservations: `The datastore migration is blocked on the counters rewrite.\n${bulk}`,
        }),
      }),
    } as unknown as Memory;

    const agent = createReminderAgent({
      model,
      memory,
      scope: ['org:acme', 'resource:resource-1'],
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

    // Scope filtering belongs to the store, so the assertion is that the scope
    // arrives intact — not that the lane drops out-of-scope events itself.
    expect(listActivity).toHaveBeenCalledWith({ scope: ['org:acme', 'resource:resource-1'], limit: 10 });
    expect(prompts[0]).toContain('activity event evt-live');
  });

  it('reads the parent record once per turn, not once per step', async () => {
    const readParentRecord = vi.fn(async () => asRecord('The datastore migration is blocked on the counters rewrite.'));
    const processor = new RemindContextStateProcessor({ readParentRecord });
    const state: Record<string, unknown> = {};

    await processor.computeStateSignal(args({ state, stepNumber: 0 }));
    await processor.computeStateSignal(args({ state, stepNumber: 1 }));
    await processor.computeStateSignal(args({ state, stepNumber: 2 }));

    expect(readParentRecord).toHaveBeenCalledTimes(1);
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
      const processor = new RemindContextStateProcessor({ readParentRecord: async () => asRecord(committedFact) });

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
      const laneHeaderIndex = prompts[0]!.indexOf('said about the candidates in play, as of check');
      expect(laneHeaderIndex).toBeGreaterThan(-1);
      const laneSection = prompts[0]!.slice(laneHeaderIndex);
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
      const processor = new RemindContextStateProcessor({ readParentRecord: async () => asRecord(observations) });
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
        readParentRecord: async () =>
          asRecord(
            bigObservations({
              first: 'The datastore migration counters rewrite is finished and the blocked flag is cleared.',
              second: secondFact,
            }),
          ),
      });

      const delta = await processor.computeStateSignal(secondArgs(snapshot));

      expect(delta!.mode).toBe('delta');
      expect((delta as { delta: { ops: { op: string; entry?: { id: string } }[] } }).delta.ops).toHaveLength(1);
      expect(delta!.contents).toContain('source-1');
      expect(delta!.contents).not.toContain('archived ledgers');
      expect(delta!.contents!.length).toBeLessThan(snapshot.contents!.length);
    });

    // The lane's whole reason to exist is cost, and until this test nothing
    // asserted it across a sequence: the only size assertion compared one delta
    // to one snapshot, which cannot see the per-check folding instruction the
    // lane charges on every request, nor an op that re-sends what it just
    // called unchanged.
    it('costs less than re-snapshotting once the fixed instruction is paid off', async () => {
      const drifts = [
        'The datastore migration counters rewrite is finished and the blocked flag is cleared.',
        'The datastore migration counters rewrite shipped and the release notes are drafted.',
      ];
      const states = [
        bigObservations({ first: firstFact, second: secondFact }),
        bigObservations({ first: drifts[0], second: secondFact }),
        bigObservations({ first: drifts[1], second: secondFact }),
      ];

      // What the lane sends today: a snapshot, then deltas folded onto it.
      const snapshot = await firstSnapshot(states[0]!);
      const laneEmissions = [snapshot];
      for (let check = 1; check < states.length; check++) {
        const processor = new RemindContextStateProcessor({
          readParentRecord: async () => asRecord(states[check]!),
        });
        const emission = await processor.computeStateSignal(
          args({
            messages: [checkWith(`check-${check + 1}`, candidates)],
            contextWindow: { hasSnapshot: true },
            lastSnapshot: base(snapshot),
            deltasSinceSnapshot: laneEmissions.slice(1).map(prior => ({ metadata: prior.metadata }) as never),
          } as Partial<ComputeStateSignalArgs>),
        );
        expect(emission!.mode).toBe('delta');
        laneEmissions.push(emission!);
      }

      // What it replaced: a full snapshot every check.
      const snapshotOnly = await Promise.all(states.map(state => firstSnapshot(state)));

      // The instruction is a system message that replaces the untagged system
      // bucket on every request rather than accumulating, so it is a flat
      // fixed cost, not a per-check one. Emissions are the opposite: state
      // signals are exempt from transient dedupe and pile up in the transcript.
      const folded = new RemindContextStateProcessor({
        readParentRecord: async () => asRecord(states[0]!),
      }).processInput({ messages: [], systemMessages: [] } as never) as {
        systemMessages: { content: string }[];
      };
      const instruction = String(folded.systemMessages.at(-1)!.content);
      expect(instruction.length).toBeGreaterThan(0);

      const laneCost = (checks: number) =>
        laneEmissions.slice(0, checks).reduce((sum, e) => sum + e.contents!.length, 0) + instruction.length;
      const snapshotCost = (checks: number) =>
        snapshotOnly.slice(0, checks).reduce((sum, e) => sum + e.contents!.length, 0);

      // Honest about the shape: the lane starts behind by the instruction it
      // has to pay before a single delta exists to save anything.
      expect(laneCost(1)).toBeGreaterThan(snapshotCost(1));

      // Every check after the first is cheaper at the margin. This is the
      // assertion an op that re-sends an excerpt it just called unchanged
      // would have to answer to.
      for (let check = 2; check <= states.length; check++) {
        const laneMarginal = laneCost(check) - laneCost(check - 1);
        const snapshotMarginal = snapshotCost(check) - snapshotCost(check - 1);
        expect(laneMarginal).toBeLessThan(snapshotMarginal);
      }

      // A marker-only check is the exception, and pinning it here is the
      // point: `node-activity` re-sends the excerpt it just declared
      // unchanged, so the one op that should be nearly free is the most
      // expensive delta the lane emits. It cannot simply be trimmed — the
      // folding instruction says this op *replaces* the candidate's entry, so
      // dropping the excerpt would silently erase the candidate's evidence
      // from the folded state. Fixing it is a folding-contract change. Until
      // then this assertion holds the cost where it is, so a fix reads as an
      // improvement and a regression reads as a failure.
      const markerCheck = await new RemindContextStateProcessor({
        readParentRecord: async () => asRecord(states.at(-1)!),
        readRecentNodeActivity: async () => [
          { id: 'evt-cost', action: 'node-updated', recordType: 'node', recordId: 'source-1' },
        ],
      } as never).computeStateSignal(
        args({
          messages: [checkWith('check-marker', candidates)],
          contextWindow: { hasSnapshot: true },
          lastSnapshot: base(snapshot),
          deltasSinceSnapshot: laneEmissions.slice(1).map(prior => ({ metadata: prior.metadata }) as never),
        } as Partial<ComputeStateSignalArgs>),
      );

      expect((markerCheck as { delta: { ops: { op: string }[] } }).delta.ops).toEqual([
        expect.objectContaining({ op: 'node-activity' }),
      ]);
      expect(markerCheck!.contents!.length).toBeGreaterThan(laneEmissions.at(-1)!.contents!.length);
    });

    it('emits nothing at all when a check changes nothing', async () => {
      const observations = bigObservations({ first: firstFact, second: secondFact });
      const snapshot = await firstSnapshot(observations);
      const processor = new RemindContextStateProcessor({ readParentRecord: async () => asRecord(observations) });

      // The runtime's dedupe cannot cover this: it keys on cache key *and*
      // mode, and the previous emission was a snapshot.
      await expect(processor.computeStateSignal(secondArgs(snapshot))).resolves.toBeUndefined();
    });

    it('re-sends a full snapshot when the base has been evicted from the window', async () => {
      const observations = bigObservations({ first: firstFact, second: secondFact });
      const snapshot = await firstSnapshot(observations);
      const processor = new RemindContextStateProcessor({ readParentRecord: async () => asRecord(observations) });

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
        readParentRecord: async () => asRecord('The datastore migration counters rewrite is finished.'),
      });

      const second = await processor.computeStateSignal(secondArgs(snapshot));

      expect(snapshot.mode).toBe('snapshot');
      expect((snapshot.value as { regime: string }).regime).toBe('passthrough');
      expect(second!.mode).toBe('snapshot');
    });

    it('treats a passthrough base as no base at all rather than an empty one', async () => {
      const passthrough = await firstSnapshot('The datastore migration is blocked on the counters rewrite.');
      const processor = new RemindContextStateProcessor({
        readParentRecord: async () => asRecord(bigObservations({ first: firstFact, second: secondFact })),
      });

      const second = await processor.computeStateSignal(secondArgs(passthrough));

      // A delta here would announce both candidates as newly entered, which is
      // an artefact of the regime change rather than anything that happened.
      expect(second!.mode).toBe('snapshot');
      expect(second!.contents).not.toContain('is among this check');
    });

    it('stamps the snapshot header too, because superseded snapshots are never retracted', async () => {
      const snapshot = await firstSnapshot(bigObservations({ first: firstFact, second: secondFact }));

      // `resolveStateSignalHistory` folds from the last snapshot and leaves the
      // earlier ones in the transcript, so a present-tense header on a superseded
      // block reads as a current claim about state it no longer describes.
      expect(snapshot.contents).toContain('as of check');
      expect(snapshot.contents).not.toContain('currently say');
    });

    it('emits nothing when the newest check is unreadable, rather than answering with an older one', async () => {
      const readable = checkMessage('check-1');
      const unreadable = {
        ...checkMessage('check-2'),
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Passive reminder check check-2\n\nScoped source candidates:' }],
        },
      } as unknown as MastraDBMessage;

      const found = latestCheck([readable, unreadable]);

      // Falling through to `check-1` would let the lane report `source-2` as having
      // left a candidate set the newer check never actually published — stamped with
      // the wrong check id, in a line nothing retracts.
      expect(found).toBeUndefined();
    });

    it('falls back to a snapshot when a filtered base shrinks into the passthrough regime', async () => {
      const filtered = await firstSnapshot(bigObservations({ first: firstFact, second: secondFact }));
      const processor = new RemindContextStateProcessor({
        readParentRecord: async () => asRecord('The datastore migration is blocked on the counters rewrite.'),
      });

      const second = await processor.computeStateSignal(secondArgs(filtered));

      // The other direction of the regime boundary: a passthrough projection has
      // no per-candidate ops to express, so a delta here could only be an orphan.
      expect((filtered.value as { regime: string }).regime).toBe('filtered');
      expect(second!.mode).toBe('snapshot');
      expect((second!.value as { regime: string }).regime).toBe('passthrough');
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
        readParentRecord: async () => asRecord(bigObservations({ second: secondFact })),
      });
      const returned = new RemindContextStateProcessor({
        readParentRecord: async () => asRecord(bigObservations({ first: firstFact, second: secondFact })),
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

      // Stamps existing is weaker than every claim carrying one. Any line that
      // names a candidate must be tied to the check it describes, otherwise a
      // later check can contradict it and leave a present-tense claim standing.
      // Stamps existing is weaker than every verdict carrying one. Any line that
      // renders one of the op clauses must be tied to the check it describes,
      // otherwise a later check can contradict it and leave a present-tense
      // claim standing in the transcript with nothing to retract it.
      const verdictClauses = [
        'had no lexical overlap',
        'is among this check',
        'was not among this check',
        'accumulated observations matching it changed',
        'read the same as before',
      ];
      for (const contents of [dropOut!.contents, comeBack!.contents]) {
        const verdictLines = String(contents)
          .split('\n')
          .map(entry => entry.trim())
          .filter(entry => verdictClauses.some(clause => entry.includes(clause)));
        expect(verdictLines.length).toBeGreaterThan(0);
        for (const verdict of verdictLines) {
          expect(verdict.startsWith('as of check ')).toBe(true);
        }
      }
    });

    it('reports a candidate that stopped matching as a wording fact, never as a loss', async () => {
      const snapshot = await firstSnapshot(bigObservations({ first: firstFact, second: secondFact }));
      const processor = new RemindContextStateProcessor({
        readParentRecord: async () => asRecord(bigObservations({ second: secondFact })),
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
      const processor = new RemindContextStateProcessor({ readParentRecord: async () => asRecord(observations) });

      const delta = await processor.computeStateSignal(secondArgs(snapshot, 'check-two', [candidates[0]!]));
      const ops = (delta as { delta: { ops: { op: string; id?: string }[] } }).delta.ops;

      expect(ops).toEqual([{ op: 'left-candidate-set', id: 'source-2' }]);
      expect(delta!.contents).toContain("was not among this check's candidates");
      expect(delta!.contents).not.toContain('had no lexical overlap');
    });

    /**
     * A candidate that stops matching looks identical whether the parent's
     * wording drifted or the parent's memory was rewritten underneath it. The
     * reflection generation is the only structural evidence separating the two,
     * and it decides which of the two claims the lane is allowed to make.
     */
    describe('reflection and the out-of-context op', () => {
      /** The observations a reflection rewrote: the first candidate did not survive it. */
      const afterReflection = bigObservations({ second: secondFact });

      function laneAt(observations: string, generationCount: number) {
        return new RemindContextStateProcessor({
          readParentRecord: async () => asRecord(observations, generationCount),
        });
      }

      it('reports a candidate that did not survive a reflection as out of context', async () => {
        const snapshot = await firstSnapshot(bigObservations({ first: firstFact, second: secondFact }));

        const delta = await laneAt(afterReflection, 1).computeStateSignal(secondArgs(snapshot));
        const ops = (delta as { delta: { ops: { op: string }[] } }).delta.ops;

        expect(ops).toEqual([expect.objectContaining({ op: 'out-of-context' })]);
        expect(delta!.contents).toContain('rewritten by a reflection between checks');
        expect(delta!.contents).toContain('did not survive the rewrite');
        expect(delta!.contents).toContain("out of the parent's context");
        // The sanctioned claim is the reflection one, in those words. None of the
        // vocabulary the lexical join cannot support may ride in with it.
        for (const forbidden of [
          'evicted',
          'removed from context',
          'dropped',
          'left the parent',
          'forgot',
          'removed',
        ]) {
          expect(delta!.contents).not.toContain(forbidden);
        }
      });

      it('keeps calling it a wording fact when no reflection ran', async () => {
        const snapshot = await firstSnapshot(bigObservations({ first: firstFact, second: secondFact }));

        const delta = await laneAt(afterReflection, 0).computeStateSignal(secondArgs(snapshot));
        const ops = (delta as { delta: { ops: { op: string }[] } }).delta.ops;

        expect(ops).toEqual([expect.objectContaining({ op: 'no-longer-matched' })]);
        expect(delta!.contents).toContain('had no lexical overlap with the parent');
        expect(delta!.contents).not.toContain('reflection');
      });

      it('says nothing about any candidate that survived the reflection', async () => {
        const observations = bigObservations({ first: firstFact, second: secondFact });
        const snapshot = await firstSnapshot(observations);

        // Reflection ran and every candidate still matches. A generation bump is
        // not news about any candidate that survived it, so the line records the
        // reflection and names nobody — but it has to be emitted, or the
        // generation never reaches the next check.
        const delta = await laneAt(observations, 1).computeStateSignal(secondArgs(snapshot, 'check-two'));
        const ops = (delta as { delta: { ops: { op: string }[] } }).delta.ops;

        expect(ops).toEqual([{ op: 'reflection-survived' }]);
        expect(delta!.contents).toContain('no candidate in play changed state');
        for (const id of candidates.map(candidate => candidate.id)) {
          expect(delta!.contents).not.toContain(id);
        }
        expect((delta!.value as { generationCount: number }).generationCount).toBe(1);
      });

      it('does not say an already-unmatched candidate matches when a reflection runs', async () => {
        // The op fires on "no candidate moved", which includes candidates that
        // were already unmatched. The line may not claim they match.
        const snapshot = await firstSnapshot(afterReflection);

        const delta = await laneAt(afterReflection, 1).computeStateSignal(secondArgs(snapshot, 'check-two'));

        expect((delta as { delta: { ops: { op: string }[] } }).delta.ops).toEqual([{ op: 'reflection-survived' }]);
        expect(delta!.contents).not.toContain('still matches');
        expect(delta!.contents).toContain('no candidate in play changed state');
      });

      it('gives the watermark its own cache key so the runtime cannot dedupe it away', async () => {
        // The runtime skips an emission whose cache key and mode both repeat, so
        // a watermark that reused the previous key would never be delivered.
        const observations = bigObservations({ first: firstFact, second: secondFact });
        const snapshot = await firstSnapshot(observations);

        const watermark = await laneAt(observations, 1).computeStateSignal(secondArgs(snapshot, 'check-two'));

        expect(watermark!.cacheKey).not.toBe(snapshot.cacheKey);
      });

      /**
       * A reflection that leaves every candidate matching emits nothing, so the
       * generation it produced is not written into any signal the next check can
       * read. If the lane simply compares against the last generation it managed
       * to record, a later wording change gets blamed on a reflection the
       * candidate demonstrably survived.
       */
      it('does not blame a reflection a candidate was already seen to survive', async () => {
        const observations = bigObservations({ first: firstFact, second: secondFact });
        const snapshot = await firstSnapshot(observations);

        // Check two: reflection ran and every candidate survived it. That is the
        // emission carrying generation 1 forward.
        const survived = await laneAt(observations, 1).computeStateSignal(secondArgs(snapshot, 'check-two'));
        expect(survived).toBeDefined();

        // Check three: no new reflection, but the first candidate's wording drifted.
        const delta = await laneAt(afterReflection, 1).computeStateSignal(
          args({
            messages: [checkWith('check-three', candidates)],
            contextWindow: { hasSnapshot: true },
            lastSnapshot: base(snapshot),
            deltasSinceSnapshot: [{ metadata: survived!.metadata } as never],
          } as Partial<ComputeStateSignalArgs>),
        );
        const ops = (delta as { delta: { ops: { op: string }[] } }).delta.ops;

        expect(ops).toEqual([expect.objectContaining({ op: 'no-longer-matched' })]);
        expect(delta!.contents).not.toContain('reflection');
      });

      it('takes the prior generation from the newest emission, not just the snapshot', async () => {
        const snapshot = await firstSnapshot(bigObservations({ first: firstFact, second: secondFact }));
        // The snapshot is generation 0, but a delta since then already reported
        // generation 1. A check at generation 1 has seen no new reflection.
        const sinceReflection = {
          metadata: {
            value: {
              regime: 'filtered',
              eventId: 'check-two',
              entries: (snapshot.value as { entries: unknown[] }).entries,
              generationCount: 1,
            },
            delta: { ops: [] },
          },
        } as never;

        const delta = await laneAt(afterReflection, 1).computeStateSignal(
          args({
            messages: [checkWith('check-three', candidates)],
            contextWindow: { hasSnapshot: true },
            lastSnapshot: base(snapshot),
            deltasSinceSnapshot: [sinceReflection],
          } as Partial<ComputeStateSignalArgs>),
        );
        const ops = (delta as { delta: { ops: { op: string }[] } }).delta.ops;

        expect(ops).toEqual([expect.objectContaining({ op: 'no-longer-matched' })]);
      });

      it('stamps the out-of-context line so it stays true once superseded', async () => {
        const snapshot = await firstSnapshot(bigObservations({ first: firstFact, second: secondFact }));

        const delta = await laneAt(afterReflection, 1).computeStateSignal(secondArgs(snapshot, 'check-two'));
        const verdict = String(delta!.contents)
          .split('\n')
          .map(line => line.trim())
          .find(line => line.includes("out of the parent's context"));

        expect(verdict).toBeDefined();
        expect(verdict!.startsWith('as of check check-two')).toBe(true);
      });

      it('carries the generation it read in the emitted value', async () => {
        const snapshot = await firstSnapshot(bigObservations({ first: firstFact, second: secondFact }));

        const delta = await laneAt(afterReflection, 4).computeStateSignal(secondArgs(snapshot));

        expect((snapshot.value as { generationCount: number }).generationCount).toBe(0);
        expect((delta!.value as { generationCount: number }).generationCount).toBe(4);
      });
    });

    it('stays silent on a failed read in the filtered regime too', async () => {
      const snapshot = await firstSnapshot(bigObservations({ first: firstFact, second: secondFact }));
      const failing = new RemindContextStateProcessor({
        readParentRecord: async () => {
          throw new Error('storage unavailable');
        },
      });

      await expect(failing.computeStateSignal(secondArgs(snapshot))).resolves.toBeUndefined();
    });

    it('never stores a snapshot entry the rendered block did not carry', async () => {
      // An over-budget filtered snapshot has to drop whole entries. If the stored
      // value kept them anyway, the next check would diff against text the model
      // was never shown and suppress a real update.
      const many = Array.from({ length: 40 }, (_, index) => ({
        id: `source-${index}`,
        text: `candidate ${index} datastore migration counters rewrite`,
      }));
      const observationLines = many
        .map((_, index) => `${'padding '.repeat(30)}candidate ${index} datastore migration counters rewrite details`)
        .join('\n');

      const snapshot = await new RemindContextStateProcessor({
        readParentRecord: async () => asRecord(observationLines),
      }).computeStateSignal(args({ messages: [checkWith('check-one', many)] }));

      const stored = (snapshot as { value: { entries: { id: string; excerpt: string }[] } }).value.entries;
      expect(stored.length).toBeGreaterThan(0);
      expect(stored.length).toBeLessThan(many.length);
      for (const entry of stored) expect(snapshot!.contents).toContain(entry.excerpt);
    });

    it('tells the model how to fold deltas onto the snapshot', async () => {
      const processor = new RemindContextStateProcessor({ readParentRecord: async () => asRecord('anything') });

      const result = processor.processInput({ messages: [], systemMessages: [] } as never);

      const instructions = (result as { systemMessages: { content: string }[] }).systemMessages.at(-1)!.content;
      expect(instructions).toContain('parent-context-update');
      expect(instructions).toContain('Fold each delta onto the latest snapshot');
    });

    /**
     * The marker reuses the store's existing activity feed. It is advisory in
     * both directions: the page is bounded and applied before candidate
     * filtering, and some record writes are never recorded as events at all.
     */
    describe('node-update markers', () => {
      const observations = () => bigObservations({ first: firstFact, second: secondFact });

      function event(overrides: Partial<{ id: string; action: string; recordType: string; recordId: string }> = {}) {
        return { id: 'evt-1', action: 'node-updated', recordType: 'node', recordId: 'source-1', ...overrides };
      }

      function laneWith(events: ReturnType<typeof event>[], obs = observations()) {
        return new RemindContextStateProcessor({
          readParentRecord: async () => asRecord(obs),
          readRecentNodeActivity: async () => events,
        });
      }

      it('marks a candidate whose node appears in the newest activity page, and only that one', async () => {
        const snapshot = await laneWith([event()]).computeStateSignal(
          args({ messages: [checkWith('check-one', candidates)] }),
        );

        expect(snapshot!.contents).toContain('[knowledge activity] candidate source-1');
        expect(snapshot!.contents).toContain('activity event evt-1');
        expect(snapshot!.contents).not.toContain('[knowledge activity] candidate source-2');
      });

      it('reports a new marker as activity, not as an observation change that did not happen', async () => {
        const snapshot = await laneWith([]).computeStateSignal(
          args({ messages: [checkWith('check-one', candidates)] }),
        );

        const delta = await laneWith([event()]).computeStateSignal(secondArgs(snapshot!));
        const ops = (delta as { delta: { ops: { op: string; entry?: { id: string } }[] } }).delta.ops;

        expect(ops).toEqual([
          expect.objectContaining({ op: 'node-activity', entry: expect.objectContaining({ id: 'source-1' }) }),
        ]);
        expect(delta!.contents).toContain('activity event evt-1');
        expect(delta!.contents).toContain('read the same as before');
        expect(delta!.contents).not.toContain('the accumulated observations matching it changed');
        expect(delta!.contents).not.toContain('had no lexical overlap');
      });

      it('says nothing when a marker falls off the bounded page', async () => {
        const snapshot = await laneWith([event()]).computeStateSignal(
          args({ messages: [checkWith('check-one', candidates)] }),
        );

        // The page moved; the node did not. A line claiming otherwise would sit
        // in the transcript uncontradicted.
        const delta = await laneWith([]).computeStateSignal(secondArgs(snapshot!));

        expect(delta).toBeUndefined();
      });

      it('still shows the marker on a candidate that stopped matching in the same check', async () => {
        const snapshot = await laneWith([]).computeStateSignal(
          args({ messages: [checkWith('check-one', candidates)] }),
        );

        const drifted = `${'filler observation line about unrelated topics\n'.repeat(120)}nothing here shares wording with the first candidate`;
        const delta = await laneWith([event()], drifted).computeStateSignal(secondArgs(snapshot!));

        expect(delta!.contents).toContain('had no lexical overlap');
        expect(delta!.contents).toContain('activity event evt-1');
      });

      it('does not re-fire while the same event sits in the page', async () => {
        const snapshot = await laneWith([]).computeStateSignal(
          args({ messages: [checkWith('check-one', candidates)] }),
        );
        const marked = await laneWith([event()]).computeStateSignal(secondArgs(snapshot!));

        const repeat = await laneWith([event()]).computeStateSignal(
          args({
            messages: [checkWith('check-three', candidates)],
            contextWindow: { hasSnapshot: true },
            lastSnapshot: base(snapshot!),
            deltasSinceSnapshot: [base(marked!)],
          } as Partial<ComputeStateSignalArgs>),
        );

        expect(repeat).toBeUndefined();
      });

      it('reports the newest event when several name the same node', async () => {
        // Deliberately not in the store's descending order: an older event left
        // in the page must not shadow a newer one and suppress the re-report.
        const snapshot = await laneWith([event({ id: 'evt-2' }), event({ id: 'evt-9' })]).computeStateSignal(
          args({ messages: [checkWith('check-one', candidates)] }),
        );

        expect(snapshot!.contents).toContain('activity event evt-9');
        expect(snapshot!.contents).not.toContain('activity event evt-2');
      });

      it('marks a candidate matched through its parent record id', async () => {
        const viaRecord = [{ ...candidates[0]!, id: 'record-7', recordId: 'node-7' }, candidates[1]!];
        const snapshot = await laneWith([event({ recordId: 'node-7' })]).computeStateSignal(
          args({ messages: [checkWith('check-one', viaRecord)] }),
        );

        expect(snapshot!.contents).toContain('[knowledge activity] candidate record-7');
      });

      it('reports a merge without naming a target node', async () => {
        const snapshot = await laneWith([event({ action: 'node-merged' })]).computeStateSignal(
          args({ messages: [checkWith('check-one', candidates)] }),
        );

        expect(snapshot!.contents).toContain('node-merged');
        expect(snapshot!.contents).not.toContain('source-2 (activity');
        expect(snapshot!.contents).not.toContain('merged into');
      });

      it('ignores record events and actions that are not node updates or merges', async () => {
        const snapshot = await laneWith([
          event({ action: 'record-created' }),
          event({ id: 'evt-3', recordType: 'record' }),
        ]).computeStateSignal(args({ messages: [checkWith('check-one', candidates)] }));

        expect(snapshot!.contents).not.toContain('[knowledge activity]');
      });

      it('never turns a missing marker into a claim about the node', async () => {
        const snapshot = await laneWith([event()]).computeStateSignal(
          args({ messages: [checkWith('check-one', candidates)] }),
        );

        expect(snapshot!.contents).toContain('That page is bounded');
        expect(snapshot!.contents).toContain('never recorded as events');
        for (const forbidden of ['unchanged', 'up to date', 'has not changed']) {
          expect(snapshot!.contents).not.toContain(forbidden);
        }
      });

      it('reads the activity feed once per turn, not once per step', async () => {
        const readRecentNodeActivity = vi.fn(async () => [event()]);
        const processor = new RemindContextStateProcessor({
          readParentRecord: async () => asRecord(observations()),
          readRecentNodeActivity,
        });
        const state: Record<string, unknown> = {};

        await processor.computeStateSignal(
          args({
            messages: [checkWith('check-one', candidates)],
            state,
            stepNumber: 0,
          } as Partial<ComputeStateSignalArgs>),
        );
        await processor.computeStateSignal(
          args({
            messages: [checkWith('check-one', candidates)],
            state,
            stepNumber: 1,
          } as Partial<ComputeStateSignalArgs>),
        );

        expect(readRecentNodeActivity).toHaveBeenCalledTimes(1);
      });

      it('still ships the projection when the activity read fails', async () => {
        const processor = new RemindContextStateProcessor({
          readParentRecord: async () => asRecord(observations()),
          readRecentNodeActivity: async () => {
            throw new Error('knowledge store unavailable');
          },
        });

        const snapshot = await processor.computeStateSignal(args({ messages: [checkWith('check-one', candidates)] }));

        expect(snapshot!.mode).toBe('snapshot');
        expect(snapshot!.contents).not.toContain('[knowledge activity]');
      });
    });
  });

  // Every other test in this file injects `readParentRecord`, and so does the
  // proof demo. That leaves the six lines of wiring in `buildInputProcessors` — resolve
  // the parent's OM engine, read the record by parent thread and resource, hand over
  // `activeObservations` and its `generationCount` — exercised by nothing. A wrong thread id or a changed record
  // shape would keep every one of those tests green while the lane silently carried
  // nothing in production. This test closes that seam with a real parent Memory whose
  // observations were committed by the real observer, and no injected reader anywhere.
  describe('the real parent-record read', () => {
    it('carries observations a real parent Memory actually committed', async () => {
      const observation = 'The datastore migration is blocked on the counters rewrite.';
      const parentMemory = new Memory({
        storage: new InMemoryStore(),
        vector: {} as never,
        embedder: {} as never,
        options: {
          observationalMemory: {
            model: createObserverModel(observation),
            observation: { messageTokens: 1, bufferTokens: false },
            experimental_subconscious: new Subconscious({ defaultScope: 'resource', maxScope: 'resource' }),
          },
        },
      });

      const messageStore = (await parentMemory.storage.getStore('memory'))!;
      const now = new Date();
      await messageStore.saveMessages({
        messages: [
          {
            id: 'alpha-user',
            threadId: 'alpha',
            resourceId: 'resource-1',
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: 'Migration status? '.repeat(20) }] },
            createdAt: now,
          },
          {
            id: 'alpha-assistant',
            threadId: 'alpha',
            resourceId: 'resource-1',
            role: 'assistant',
            content: { format: 2, parts: [{ type: 'text', text: 'Understood. '.repeat(20) }] },
            createdAt: new Date(now.getTime() + 1),
          },
        ] as never,
      });

      const requestContext = new RequestContext();
      requestContext.set('organizationId', 'acme');
      const engine = (await parentMemory.omEngine)!;
      await engine.observe({ threadId: 'alpha', resourceId: 'resource-1', requestContext });

      // Fixture sanity: the record is real and holds the text, so a failure below is the
      // wiring's fault rather than an observation that never got committed.
      const record = await engine.getRecord('alpha', 'resource-1');
      expect(record?.activeObservations).toContain('counters rewrite');

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

      const agent = createReminderAgent({
        model,
        memory: new Memory({ storage: new InMemoryStore() }),
        scope: ['resource:user-42'],
        threadId: 'subconscious:parent:remind',
        resourceId: 'resource-1',
        parentThreadId: 'alpha',
        parentMemory,
        fallbackSendSignal: vi.fn(),
      });

      await agent.generate([checkMessage()], {
        memory: { thread: 'subconscious:parent:remind', resource: 'resource-1' },
        maxSteps: 1,
      });

      expect(prompts[0]).toContain('said about the candidates in play, as of check');
      expect(prompts[0]).toContain('counters rewrite');
    });

    /**
     * Risk D: the generation the lane compares against is produced by the real
     * reflection cycle, which in production runs on a background/buffered path
     * and can therefore commit between two checks. The unit tests above inject
     * generations; this one takes them from `engine.reflect()` — the real
     * reflector agent writing a real new generation — so the discriminator is
     * validated against the mechanism rather than against a fixture number.
     */
    it('reads a generation bump produced by a real reflection cycle', async () => {
      const observation = 'The datastore migration is blocked on the counters rewrite.';
      const parentMemory = new Memory({
        storage: new InMemoryStore(),
        vector: {} as never,
        embedder: {} as never,
        options: {
          observationalMemory: {
            observation: { model: createObserverModel(observation), messageTokens: 1, bufferTokens: false },
            // The reflector rewrites the parent's memory without the candidate's
            // wording — lossy reflection, which is the case Tyler's rule is about.
            reflection: { model: createObserverModel('The team is planning next quarter.') },
            experimental_subconscious: new Subconscious({ defaultScope: 'resource', maxScope: 'resource' }),
          },
        },
      });

      const messageStore = (await parentMemory.storage.getStore('memory'))!;
      const now = new Date();
      await messageStore.saveMessages({
        messages: [
          {
            id: 'beta-user',
            threadId: 'beta',
            resourceId: 'resource-1',
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: 'Migration status? '.repeat(20) }] },
            createdAt: now,
          },
          {
            id: 'beta-assistant',
            threadId: 'beta',
            resourceId: 'resource-1',
            role: 'assistant',
            content: { format: 2, parts: [{ type: 'text', text: 'Understood. '.repeat(20) }] },
            createdAt: new Date(now.getTime() + 1),
          },
        ] as never,
      });

      const requestContext = new RequestContext();
      requestContext.set('organizationId', 'acme');
      const engine = (await parentMemory.omEngine)!;
      await engine.observe({ threadId: 'beta', resourceId: 'resource-1', requestContext });

      const before = await engine.getRecord('beta', 'resource-1');
      expect(before?.activeObservations).toContain('counters rewrite');

      const reflection = await engine.reflect('beta', 'resource-1');
      expect(reflection.reflected).toBe(true);

      const after = await engine.getRecord('beta', 'resource-1');
      // The two halves the lane depends on, from the real cycle: the generation
      // advanced, and the observations were rewritten without the candidate.
      expect(after!.generationCount).toBe(before!.generationCount + 1);
      expect(after!.activeObservations).not.toContain('counters rewrite');

      // And the lane reads both off one record, through the real wiring.
      const seen: { observations: string; generationCount: number }[] = [];
      const lane = new RemindContextStateProcessor({
        readParentRecord: async () => {
          const record = await engine.getRecord('beta', 'resource-1');
          if (record?.activeObservations === undefined) return undefined;
          const value = { observations: record.activeObservations, generationCount: record.generationCount };
          seen.push(value);
          return value;
        },
      });
      await lane.computeStateSignal(args());

      expect(seen).toHaveLength(1);
      expect(seen[0]!.generationCount).toBe(after!.generationCount);
      expect(seen[0]!.observations).toBe(after!.activeObservations);
    });
  });
});
