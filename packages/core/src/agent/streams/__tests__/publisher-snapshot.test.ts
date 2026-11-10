/**
 * The publisher copies each payload when the loop publishes it. The loop
 * keeps mutating objects it has emitted, and events wait in the publish queue
 * and in caches that keep references, so the published history must not
 * change after the fact. These tests pin which values survive the copy, what
 * it normalizes, and what happens when a value can't be copied.
 */
import { describe, expect, it } from 'vitest';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { CachingPubSub } from '../../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { DefaultStepResult } from '../../../stream/aisdk/v5/output-helpers';
import { stampChunkProducedAt } from '../../../stream/base/produced-at';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../constants';
import { createAgentStreamPublisher } from '../publisher';

/** Holds every list append until `release()`, so events sit in the queue while the caller keeps going. */
class HeldAppendCache extends InMemoryServerCache {
  #held: Array<() => void> = [];
  #holding = true;

  release() {
    this.#holding = false;
    for (const resume of this.#held.splice(0)) resume();
  }

  override async listPushIndexed(
    listKey: string,
    counterKey: string,
    value: Record<string, unknown>,
    ttlMs?: number,
  ): Promise<number> {
    if (this.#holding) await new Promise<void>(resolve => this.#held.push(resolve));
    return super.listPushIndexed(listKey, counterKey, value, ttlMs);
  }
}

function setup() {
  const cache = new HeldAppendCache();
  const bus = new CachingPubSub(new EventEmitterPubSub(), cache);
  const runId = `run-${globalThis.crypto.randomUUID()}`;
  const warnings: Array<{ message: string; meta: any }> = [];
  const publisher = createAgentStreamPublisher({
    pubsub: bus,
    runId,
    cleanupTimeoutMs: 0,
    logger: { warn: (message: string, meta: any) => warnings.push({ message, meta }) } as any,
  });
  /** Releases the held appends, ends the run and returns what the topic recorded. */
  const finish = async () => {
    cache.release();
    await publisher.close();
    await bus.flush();
    return (await bus.getHistory(AGENT_STREAM_TOPIC(runId))) as any[];
  };
  const chunkData = (history: any[], type: string) =>
    history.filter(event => event.type === AgentStreamEventTypes.CHUNK && event.data.type === type).map(e => e.data);
  return { publisher, runId, warnings, finish, chunkData };
}

describe('agent stream publisher snapshots', () => {
  it('keeps the published payload when the loop mutates it while the append is queued', async () => {
    const { publisher, runId, finish, chunkData } = setup();
    const steps = [{ text: 'first' }];
    const stepResult = { isContinued: true };
    publisher.publish({ type: 'step-finish', runId, from: 'AGENT', payload: { output: { steps }, stepResult } } as any);

    // What the loop does on resume: the next step lands on the same array.
    steps.push({ text: 'second' });
    stepResult.isContinued = false;

    const [published] = chunkData(await finish(), 'step-finish');
    expect(published.payload.output.steps).toEqual([{ text: 'first' }]);
    expect(published.payload.stepResult.isContinued).toBe(true);
  });

  it('leaves the caller chunk untouched and keeps its producedAt stamp', async () => {
    const { publisher, runId, finish, chunkData } = setup();
    const callback = () => 'kept';
    const at = new Date(1_000);
    const chunk = { type: 'text-delta', runId, from: 'AGENT', payload: { id: 't', text: 'hi', at, callback } } as any;
    stampChunkProducedAt(chunk, 1234);
    publisher.publish(chunk);

    const history = await finish();
    const [published] = chunkData(history, 'text-delta');
    expect(published).not.toBe(chunk);
    expect(published.payload.at).toEqual(at);
    expect(chunk.payload.callback).toBe(callback);
    const event = history.find(e => e.type === AgentStreamEventTypes.CHUNK);
    expect(event.producedAt).toBe(1234);
  });

  it('preserves codec-supported types and normalizes the rest', async () => {
    const { publisher, runId, finish, chunkData } = setup();
    publisher.publish({
      type: 'tool-result',
      runId,
      from: 'AGENT',
      payload: {
        when: new Date(10),
        error: new Error('boom'),
        map: new Map([['a', 1]]),
        set: new Set(['x']),
        big: 10n,
        missing: undefined,
        fn: () => 'dropped',
        bytes: new Uint8Array([1, 2]),
        nan: Number.NaN,
      },
    } as any);
    const stepResult = new DefaultStepResult({
      content: [{ type: 'text', text: 'hi' }],
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      warnings: [],
      request: {},
      response: { id: 'r', timestamp: new Date(5), modelId: 'm', messages: [] },
      providerMetadata: undefined,
    } as any);
    publisher.publish({ type: 'finish', runId, from: 'AGENT', payload: { output: {}, stepResult } } as any);

    const history = await finish();
    const [{ payload }] = chunkData(history, 'tool-result');
    expect(payload.when).toEqual(new Date(10));
    expect(payload.error).toBeInstanceOf(Error);
    expect(payload.error.message).toBe('boom');
    expect(payload.map).toEqual(new Map([['a', 1]]));
    expect(payload.set).toEqual(new Set(['x']));
    expect(payload.big).toBe(10n);
    expect(Object.hasOwn(payload, 'missing')).toBe(true);
    // Normalized, as on any cross-process transport.
    expect(payload.fn).toBeUndefined();
    expect(payload.bytes).not.toBeInstanceOf(Uint8Array);
    expect(payload.nan).toBeNull();

    const finishEvent = history.find(e => e.type === AgentStreamEventTypes.FINISH);
    expect(finishEvent.data.stepResult).toBeInstanceOf(DefaultStepResult);
    expect(finishEvent.data.stepResult).not.toBe(stepResult);
    expect(finishEvent.data.stepResult.text).toBe('hi');
    expect(finishEvent.data.stepResult.response.timestamp).toEqual(new Date(5));
  });

  it('publishes a value the codec cannot encode by reference, with one warning, and keeps going', async () => {
    const { publisher, runId, warnings, finish, chunkData } = setup();
    const unencodable = {
      toJSON() {
        throw new Error('no');
      },
    };
    const chunk = { type: 'tool-result', runId, from: 'AGENT', payload: { value: unencodable } } as any;
    publisher.publish(chunk);
    publisher.publish({ type: 'text-delta', runId, from: 'AGENT', payload: { id: 't', text: 'after' } } as any);

    const history = await finish();
    expect(chunkData(history, 'tool-result')[0]).toBe(chunk);
    expect(chunkData(history, 'text-delta')[0].payload.text).toBe('after');
    expect(
      warnings.filter(w => w.message.includes('failed to snapshot stream event; publishing it by reference')),
    ).toHaveLength(1);
  });
});
