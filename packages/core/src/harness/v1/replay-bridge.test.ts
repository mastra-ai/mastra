/**
 * Harness v1 — replay bridge tests.
 *
 * Covers `bridgeReplayAndLive`:
 *   - cursor 'beginning' replays every stored event from sequence 0
 *   - resume from a {epoch, afterSequence} cursor
 *   - epoch mismatch / stale cursor / future cursor produce typed errors
 *   - no replay (omitted cursor) starts directly from live
 *   - dedupe across replay→live boundary (no duplicates, no gap)
 *   - abort via AbortSignal mid-iteration
 *   - buffer overflow during slow replay catch-up
 *   - cross-session events do not pollute the stream
 */

import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { buildFakeOutput } from './__test-utils__/fake-output';

import type { HarnessEvent } from './events';
import { parseHarnessEventId } from './events';
import { Harness } from './harness';
import { HARNESS_PUBLIC_VIEW_REDACTED } from './public-view';
import {
  bridgeReplayAndLive,
  HarnessEventReplayAbortedError,
  HarnessEventReplayBufferOverflowError,
  HarnessEventReplayEpochMismatchError,
  HarnessEventReplayFutureCursorError,
  HarnessEventReplayStaleCursorError,
} from './replay-bridge';

class FakeAgent extends Agent<any, any, any> {
  chunks: any[] = [];
  fullOutput: any = {
    text: 'ok',
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    finishReason: 'stop',
    object: undefined,
    steps: [],
    warnings: [],
    providerMetadata: undefined,
    request: {},
    reasoning: [],
    reasoningText: undefined,
    toolCalls: [],
    toolResults: [],
    sources: [],
    files: [],
    response: { id: 'r', timestamp: new Date(), modelId: 'fake', messages: [], uiMessages: [] },
    totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    error: undefined,
    tripwire: undefined,
    traceId: undefined,
    spanId: undefined,
    runId: 'fake-run',
    suspendPayload: undefined,
    messages: [],
    rememberedMessages: [],
  };

  constructor(name: string) {
    super({ id: name, name, instructions: 'fake', model: 'openai/gpt-4o-mini' as any });
  }

  async stream(_messages: any, options?: any): Promise<any> {
    const out = buildFakeOutput({
      runId: options?.runId ?? this.fullOutput.runId,
      fullOutput: this.fullOutput,
      chunks: this.chunks,
    });
    this._internalRegisterStreamRun(out, (options ?? {}) as any);
    return out;
  }
  async generate(_messages: any, _options?: any): Promise<any> {
    return this.fullOutput;
  }
  async resumeStream(_resumeData: any, options?: any): Promise<any> {
    return this.stream(undefined, options);
  }
}

function setup() {
  const agent = new FakeAgent('default');
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: { default: agent } as any,
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    sessions: { storage },
  });
  return { harness, agent, storage };
}

/** Collect up to `count` events from the bridge, then break out. */
async function take(iter: AsyncGenerator<HarnessEvent, void, unknown>, count: number): Promise<HarnessEvent[]> {
  const events: HarnessEvent[] = [];
  for await (const event of iter) {
    events.push(event);
    if (events.length >= count) break;
  }
  return events;
}

describe('bridgeReplayAndLive — replay phase', () => {
  it('replays every stored event from the beginning of the current epoch', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.message({ content: 'hi' });
    await session._flushEventPersistence();

    const iter = bridgeReplayAndLive(harness, {
      sessionId: session.id,
      resourceId: session.resourceId,
      sinceCursor: 'beginning',
    });

    // Replay should hand us sequences 0..N where N is newestSequence; then
    // the live phase blocks awaiting more. Consume one less than the full
    // page to verify replay produced AT LEAST sequence 0.
    const state = await harness.getSessionEventReplayState({
      sessionId: session.id,
      resourceId: session.resourceId,
    });
    const expectedCount = state!.newestSequence - state!.oldestSequence + 1;
    const events = await take(iter, expectedCount);

    expect(events.length).toBe(expectedCount);
    expect(parseHarnessEventId(events[0]!.id).sequence).toBe(0);
    // All events belong to this session.
    expect(events.every(e => e.sessionId === session.id)).toBe(true);
  });

  it('resumes from a known cursor and yields only events strictly after it', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.message({ content: 'hi' });
    await session._flushEventPersistence();

    const state = await harness.getSessionEventReplayState({
      sessionId: session.id,
      resourceId: session.resourceId,
    });
    const midSequence = Math.floor((state!.oldestSequence + state!.newestSequence) / 2);

    const iter = bridgeReplayAndLive(harness, {
      sessionId: session.id,
      resourceId: session.resourceId,
      sinceCursor: { epoch: state!.epoch, afterSequence: midSequence },
    });

    const expectedCount = state!.newestSequence - midSequence;
    const events = await take(iter, expectedCount);
    expect(events.length).toBe(expectedCount);
    expect(parseHarnessEventId(events[0]!.id).sequence).toBe(midSequence + 1);
  });

  it('throws HarnessEventReplayEpochMismatchError on a stale epoch cursor', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.message({ content: 'hi' });
    await session._flushEventPersistence();

    const iter = bridgeReplayAndLive(harness, {
      sessionId: session.id,
      resourceId: session.resourceId,
      sinceCursor: { epoch: 'previous-emitter-epoch', afterSequence: 0 },
    });
    await expect(iter.next()).rejects.toBeInstanceOf(HarnessEventReplayEpochMismatchError);
  });

  it('throws HarnessEventReplayFutureCursorError when afterSequence > newest stored', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.message({ content: 'hi' });
    await session._flushEventPersistence();
    const state = await harness.getSessionEventReplayState({
      sessionId: session.id,
      resourceId: session.resourceId,
    });

    const iter = bridgeReplayAndLive(harness, {
      sessionId: session.id,
      resourceId: session.resourceId,
      sinceCursor: { epoch: state!.epoch, afterSequence: state!.newestSequence + 100 },
    });
    await expect(iter.next()).rejects.toBeInstanceOf(HarnessEventReplayFutureCursorError);
  });

  it('throws HarnessEventReplayStaleCursorError when afterSequence is older than oldest stored', async () => {
    // In-memory storage keeps every event forever, so to trigger stale we
    // bypass via a stub storage that reports oldestSequence > -1 (e.g. a
    // backend that has retention/compaction).
    const { harness, storage } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.message({ content: 'hi' });
    await session._flushEventPersistence();
    const realState = await harness.getSessionEventReplayState({
      sessionId: session.id,
      resourceId: session.resourceId,
    });

    // Stub getSessionEventReplayState to report a compacted oldest=5.
    storage.getSessionEventReplayState = async () => ({
      epoch: realState!.epoch,
      oldestSequence: 5,
      newestSequence: realState!.newestSequence + 10,
    });

    const iter = bridgeReplayAndLive(harness, {
      sessionId: session.id,
      resourceId: session.resourceId,
      sinceCursor: { epoch: realState!.epoch, afterSequence: 2 },
    });
    await expect(iter.next()).rejects.toBeInstanceOf(HarnessEventReplayStaleCursorError);
  });
});

describe('bridgeReplayAndLive — live phase', () => {
  it('with no cursor starts from live and yields events emitted after iteration begins', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const iter = bridgeReplayAndLive(harness, {
      sessionId: session.id,
      resourceId: session.resourceId,
    });
    // Start consuming, then emit.
    const pending = take(iter, 1);
    // Give the generator a microtask to attach the live listener.
    await Promise.resolve();
    await session.message({ content: 'hi' });
    const events = await pending;
    expect(events.length).toBe(1);
    expect(events[0]!.sessionId).toBe(session.id);
  });

  it('dedupes the replay→live overlap so no event is delivered twice', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.message({ content: 'first' });
    await session._flushEventPersistence();
    const state = await harness.getSessionEventReplayState({
      sessionId: session.id,
      resourceId: session.resourceId,
    });
    const storedCount = state!.newestSequence - state!.oldestSequence + 1;

    // Use abort as a hard deadline so a missing event cannot hang the
    // test. After we consume the expected count, abort.
    const ctrl = new AbortController();
    const iter = bridgeReplayAndLive(harness, {
      sessionId: session.id,
      resourceId: session.resourceId,
      sinceCursor: 'beginning',
      signal: ctrl.signal,
    });

    // Trigger a second message after replay starts so live events arrive.
    void (async () => {
      await new Promise(r => setTimeout(r, 10));
      await session.message({ content: 'second' });
    })();

    // Target: replay's storedCount + at least one extra live event. We
    // stop once we have one more event than the original storedCount
    // (proves the live phase took over) and abort to clean up.
    const consumed: HarnessEvent[] = [];
    const target = storedCount + 1;
    try {
      for await (const event of iter) {
        consumed.push(event);
        if (consumed.length >= target) {
          ctrl.abort();
        }
      }
    } catch (err) {
      // Expected: AbortError after we hit target.
      if (!(err instanceof HarnessEventReplayAbortedError)) throw err;
    }

    expect(consumed.length).toBeGreaterThanOrEqual(target);
    const sequences = consumed.map(e => parseHarnessEventId(e.id).sequence);
    const dedupedSequences = Array.from(new Set(sequences));
    expect(sequences.length).toBe(dedupedSequences.length);
    for (let i = 1; i < sequences.length; i++) {
      expect(sequences[i]).toBeGreaterThan(sequences[i - 1]!);
    }
  });

  it('ignores events from other sessions', async () => {
    const { harness } = setup();
    const a = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const b = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const iter = bridgeReplayAndLive(harness, {
      sessionId: a.id,
      resourceId: a.resourceId,
    });
    const pending = take(iter, 1);
    await Promise.resolve();
    await b.message({ content: 'noise' });
    await a.message({ content: 'signal' });
    const events = await pending;
    expect(events.every(e => e.sessionId === a.id)).toBe(true);
  });
});

describe('bridgeReplayAndLive — abort + backpressure', () => {
  it('throws HarnessEventReplayAbortedError when the signal aborts', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const ctrl = new AbortController();
    const iter = bridgeReplayAndLive(harness, {
      sessionId: session.id,
      resourceId: session.resourceId,
      signal: ctrl.signal,
    });
    const pending = iter.next();
    // Let the live listener attach + the first wait-promise queue.
    await Promise.resolve();
    ctrl.abort();
    await expect(pending).rejects.toBeInstanceOf(HarnessEventReplayAbortedError);
  });

  it('finalizer runs and unsubscribes when consumer breaks out of the for-await loop after a yield', async () => {
    // AsyncGenerator semantics: `iter.return()` (which is what
    // `for await ... break` invokes) only takes effect at the next
    // yield point — a permanently parked generator with no yields
    // cannot be canceled by return() alone. The canonical cancellation
    // mechanism is `opts.signal`; for callers that prefer break, this
    // test pins the post-yield cleanup contract.
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const beforeListenerCount = harness._internalListenerCount();

    const iter = bridgeReplayAndLive(harness, {
      sessionId: session.id,
      resourceId: session.resourceId,
    });
    const pending = (async () => {
      for await (const _ of iter) {
        break;
      }
    })();

    // Emit one event so the generator yields, then the consumer's break
    // immediately calls return(), the generator unwinds to its finally,
    // and the harness listener is unregistered.
    await Promise.resolve();
    await session.message({ content: 'hi' });
    await pending;

    const afterListenerCount = harness._internalListenerCount();
    expect(afterListenerCount).toBe(beforeListenerCount);
  });

  it('throws HarnessEventReplayAbortedError immediately when the signal is already aborted', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const ctrl = new AbortController();
    ctrl.abort();
    const iter = bridgeReplayAndLive(harness, {
      sessionId: session.id,
      resourceId: session.resourceId,
      signal: ctrl.signal,
    });
    await expect(iter.next()).rejects.toBeInstanceOf(HarnessEventReplayAbortedError);
  });

  it('throws HarnessEventReplayBufferOverflowError when live events exceed maxBufferedLive during replay', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.message({ content: 'first' });
    await session._flushEventPersistence();

    // Tight buffer so a single additional live message overflows. We start
    // the bridge with `sinceCursor: 'beginning'` so it enters the replay
    // page-by-page path. We pump live events BEFORE consuming anything to
    // overflow the buffer.
    const iter = bridgeReplayAndLive(harness, {
      sessionId: session.id,
      resourceId: session.resourceId,
      sinceCursor: 'beginning',
      maxBufferedLive: 1,
      replayPageSize: 1,
    });

    // Begin iteration so the live listener attaches.
    const pending = (async () => {
      // Run a turn that emits many events while we are paging slowly.
      await Promise.resolve();
      await session.message({ content: 'flood' });
      await session.message({ content: 'flood again' });
    })();
    await expect(
      (async () => {
        for await (const _ of iter) {
          // Don't break — let the bridge keep producing so overflow can fire.
          await new Promise(r => setTimeout(r, 1));
        }
      })(),
    ).rejects.toBeInstanceOf(HarnessEventReplayBufferOverflowError);
    await pending;
  });
});

describe('bridgeReplayAndLive — public view integration', () => {
  it('projects replay events when publicView is true', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.message({ content: 'hi' });
    await session._flushEventPersistence();
    const state = await harness.getSessionEventReplayState({
      sessionId: session.id,
      resourceId: session.resourceId,
    });
    const expectedCount = state!.newestSequence - state!.oldestSequence + 1;

    const iter = bridgeReplayAndLive(harness, {
      sessionId: session.id,
      resourceId: session.resourceId,
      sinceCursor: 'beginning',
      publicView: true,
    });

    const events = await take(iter, expectedCount);
    // tool_start / tool_end in the replay should have redacted args/result.
    const toolStart = events.find(e => e.type === 'tool_start') as any;
    const toolEnd = events.find(e => e.type === 'tool_end') as any;
    if (toolStart !== undefined) expect(toolStart.args).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
    if (toolEnd !== undefined) expect(toolEnd.result).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
  });

  it('projects live events when publicView is true', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const iter = bridgeReplayAndLive(harness, {
      sessionId: session.id,
      resourceId: session.resourceId,
      publicView: true,
    });
    // Take 2: agent_start + agent_end at minimum from session.message.
    const pending = take(iter, 2);
    await Promise.resolve();
    await session.message({ content: 'hi' });
    const events = await pending;
    expect(events.length).toBe(2);
    // No event in the live stream should leak a redactable raw field —
    // walking via the redaction-sentinel marker is the simplest check
    // (preserved events serialize without the marker; redacted ones
    // contain it).
    for (const event of events) {
      if (event.type === 'tool_start') expect((event as any).args).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
      if (event.type === 'tool_end') expect((event as any).result).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
    }
  });

  it('publicView=false yields raw events (default)', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const iter = bridgeReplayAndLive(harness, {
      sessionId: session.id,
      resourceId: session.resourceId,
    });
    const pending = take(iter, 1);
    await Promise.resolve();
    await session.message({ content: 'hi' });
    const events = await pending;
    const start = events.find(e => e.type === 'agent_start');
    expect(start).toBeDefined();
    // Raw events should not carry the redaction sentinel anywhere on
    // their visible fields.
    expect(JSON.stringify(start)).not.toContain(HARNESS_PUBLIC_VIEW_REDACTED);
  });

  it('publicView with a custom redactor that drops om events skips them in the stream', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const iter = bridgeReplayAndLive(harness, {
      sessionId: session.id,
      resourceId: session.resourceId,
      publicView: true,
      publicViewOptions: {
        redactor: e => (e.type.startsWith('om_') ? null : e),
      },
    });
    const pending = take(iter, 1);
    await Promise.resolve();
    await session.message({ content: 'hi' });
    const events = await pending;
    expect(events.length).toBe(1);
    expect(events[0]!.type.startsWith('om_')).toBe(false);
  });
});
