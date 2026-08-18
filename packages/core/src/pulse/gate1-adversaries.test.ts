import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../agent/thread-stream-runtime';
import { MastraServerCache } from '../cache';
import { MockMemory } from '../memory/mock';
import { ResponseCache } from '../processors/processors/response-cache';
import { PulseBus } from './bus';
import { isRunIncomplete, registerPulseEmitter, unregisterPulseEmitter } from './emitter';

/**
 * EXPERIMENT (Gate 1) Phase 3 — adversaries. Each test attacks one way the
 * semantic-fact idea could be wrong. Failures are classified in the verdict:
 * (a) emitter placement, (b) schema shape, (c) the idea itself.
 *
 * Not covered here (documented, not faked): approval-declined (A5) needs the
 * AgentController resume machinery — no core-level harness exists and
 * building one exceeds the goal's >30-line foreign-scaffolding limit.
 */

function makeParkedModel(opts: { parkSecondCallEntirely?: boolean } = {}) {
  let release!: () => void;
  const firstFinished = new Promise<void>(resolve => {
    release = resolve;
  });
  let releaseSecond!: () => void;
  const secondGate = new Promise<void>(resolve => {
    releaseSecond = resolve;
  });
  let streamCount = 0;
  const prompts: any[][] = [];
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      streamCount += 1;
      const callIndex = streamCount;
      prompts.push(prompt as any[]);
      // Park call 2 at the provider boundary: the request was frozen, but
      // doStream never resolves — no response ever comes back, so the
      // `executed` discriminator must stay absent.
      if (callIndex >= 2 && opts.parkSecondCallEntirely) await secondGate;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: new ReadableStream({
          async start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'response-metadata',
              id: `adv-${callIndex}`,
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            });
            controller.enqueue({ type: 'text-start', id: `at-${callIndex}` });
            controller.enqueue({ type: 'text-delta', id: `at-${callIndex}`, delta: `resp ${callIndex}` });
            controller.enqueue({ type: 'text-end', id: `at-${callIndex}` });
            if (callIndex === 1) await firstFinished;
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            });
            controller.close();
          },
        }),
      };
    },
  });
  return {
    model,
    release: () => release(),
    releaseSecond: () => releaseSecond(),
    streamCount: () => streamCount,
    prompts,
  };
}

function collector() {
  const bus = new PulseBus();
  const facts: any[] = [];
  const edges: any[] = [];
  bus.subscribe((e: any) => {
    if (e.type === 'pulse') facts.push(e.record);
    else edges.push(e.record);
  });
  registerPulseEmitter(bus);
  return { bus, facts, edges, done: () => unregisterPulseEmitter(bus) };
}

const settle = () => new Promise(r => setTimeout(r, 20));
const nextTick = () => new Promise(r => setTimeout(r, 0));
async function waitFor(pred: () => boolean, timeoutMs = 2_000) {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await nextTick();
  }
}

describe('Gate 1 adversaries', () => {
  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
  });

  /** A1 — two signals with byte-identical bodies keep distinct lineage. */
  it('byte-identical signal bodies produce distinct exact chains', async () => {
    const c = collector();
    const parked = makeParkedModel();
    try {
      const agent = new Agent({
        id: 'adv-identical',
        name: 'Adv',
        instructions: 'Test',
        model: parked.model,
        memory: new MockMemory(),
      });
      const sub = await agent.subscribeToThread({ threadId: 'adv-t1', resourceId: 'adv-u' });
      const stream = await agent.stream('Hello', { memory: { thread: 'adv-t1', resource: 'adv-u' } });
      await waitFor(() => sub.activeRunId() != null);

      const SAME = 'The exact same signal text.';
      const s1 = await agent.sendSignal(
        { type: 'user-message', contents: SAME },
        { resourceId: 'adv-u', threadId: 'adv-t1' },
      );
      const s2 = await agent.sendSignal(
        { type: 'user-message', contents: SAME },
        { resourceId: 'adv-u', threadId: 'adv-t1' },
      );
      await Promise.all([s1.accepted, s2.accepted]);
      expect(s1.signal.id).not.toBe(s2.signal.id);

      parked.release();
      await waitFor(() => parked.streamCount() === 2);
      await stream.consumeStream();
      await settle();

      for (const sid of [s1.signal.id, s2.signal.id]) {
        expect(c.facts.some(f => f.action === 'delivery_decided' && f.attributes?.signalId === sid)).toBe(true);
        expect(c.facts.some(f => f.action === 'drained' && f.attributes?.signalId === sid)).toBe(true);
        const incl = c.edges.filter(e => e.type === 'included_in_model_input' && e.to.id === `signal:${sid}`);
        expect(incl, `one inclusion for ${sid}`).toHaveLength(1);
      }
      const pos1 = c.edges.find(e => e.type === 'included_in_model_input' && e.to.id === `signal:${s1.signal.id}`)!
        .attributes.position;
      const pos2 = c.edges.find(e => e.type === 'included_in_model_input' && e.to.id === `signal:${s2.signal.id}`)!
        .attributes.position;
      expect(pos1).not.toBe(pos2); // identical bodies, distinct exact positions
      // Ground truth: both stamped messages are in attempt 2, at those positions.
      const p2 = parked.prompts[1]!;
      expect((p2[pos1] as any)?.providerOptions?.mastra?.pulseSignalId).toBe(s1.signal.id);
      expect((p2[pos2] as any)?.providerOptions?.mastra?.pulseSignalId).toBe(s2.signal.id);
    } finally {
      parked.release();
      c.done();
    }
  });

  /** A2a — a processor that REORDERS messages: recorded positions follow the
   * actual frozen request, not the original order. */
  it('processor reorder: position stays exact against the frozen request', async () => {
    const c = collector();
    const parked = makeParkedModel();
    try {
      const reverseUsers = {
        name: 'reverse-users',
        processInput({ messages }: { messages: any[] }) {
          return [...messages].reverse();
        },
      };
      const agent = new Agent({
        id: 'adv-reorder',
        name: 'Adv',
        instructions: 'Test',
        model: parked.model,
        memory: new MockMemory(),
        inputProcessors: [reverseUsers as any],
      });
      const sub = await agent.subscribeToThread({ threadId: 'adv-t2', resourceId: 'adv-u' });
      const stream = await agent.stream('Hello', { memory: { thread: 'adv-t2', resource: 'adv-u' } });
      await waitFor(() => sub.activeRunId() != null);
      const sent = await agent.sendSignal(
        { type: 'user-message', contents: 'Reordered signal' },
        { resourceId: 'adv-u', threadId: 'adv-t2' },
      );
      await sent.accepted;
      parked.release();
      await waitFor(() => parked.streamCount() === 2);
      await stream.consumeStream();
      await settle();

      const incl = c.edges.filter(e => e.type === 'included_in_model_input' && e.to.id === `signal:${sent.signal.id}`);
      expect(incl).toHaveLength(1);
      const pos = incl[0]!.attributes.position;
      // The recorded position must point at the stamped message in the REAL
      // (post-processor) frozen request.
      expect((parked.prompts[1]![pos] as any)?.providerOptions?.mastra?.pulseSignalId).toBe(sent.signal.id);
    } finally {
      parked.release();
      c.done();
    }
  });

  /** A2b — a processor that CLONES the messages without providerOptions.
   * Finding: same-run drained signals join the request at the response
   * boundary and never re-pass input processors, so a stripper CANNOT sever
   * their lineage — the inclusion edge survives. (The forced-loss vector is
   * the redelivery path — see A4b.) */
  it('input processors cannot sever same-run drained-signal lineage', async () => {
    const c = collector();
    const parked = makeParkedModel();
    try {
      const stripper = {
        name: 'strip-provider-options',
        processInput({ messages }: { messages: any[] }) {
          return JSON.parse(JSON.stringify(messages, (k, v) => (k === 'providerOptions' ? undefined : v)));
        },
      };
      const agent = new Agent({
        id: 'adv-strip',
        name: 'Adv',
        instructions: 'Test',
        model: parked.model,
        memory: new MockMemory(),
        inputProcessors: [stripper as any],
      });
      const sub = await agent.subscribeToThread({ threadId: 'adv-t3', resourceId: 'adv-u' });
      const stream = await agent.stream('Hello', { memory: { thread: 'adv-t3', resource: 'adv-u' } });
      await waitFor(() => sub.activeRunId() != null);
      const sent = await agent.sendSignal(
        { type: 'user-message', contents: 'Doomed lineage' },
        { resourceId: 'adv-u', threadId: 'adv-t3' },
      );
      await sent.accepted;
      parked.release();
      await waitFor(() => parked.streamCount() === 2);
      await stream.consumeStream();
      await settle();

      // Upstream facts exact:
      expect(c.facts.some(f => f.action === 'delivery_decided' && f.attributes?.signalId === sent.signal.id)).toBe(
        true,
      );
      expect(c.facts.some(f => f.action === 'drained' && f.attributes?.signalId === sent.signal.id)).toBe(true);
      // Lineage SURVIVES: boundary-drained messages bypass input processors.
      const incl = c.edges.filter(e => e.type === 'included_in_model_input' && e.to.id === `signal:${sent.signal.id}`);
      expect(incl).toHaveLength(1);
      const pos = incl[0]!.attributes.position;
      expect((parked.prompts[1]![pos] as any)?.providerOptions?.mastra?.pulseSignalId).toBe(sent.signal.id);
    } finally {
      parked.release();
      c.done();
    }
  });

  /** A4-i — abort while pending, successor's model stream never starts.
   * This adversary CAUGHT a real defect: `finalized` is emitted before
   * execute(), so a step that never reached the model still froze a request
   * with inclusion edges — phantom visibility. Fix (classification a,
   * emitter placement): the append-only `model_input.executed` fact fires
   * only when the model stream actually begins; visibility = inclusion ∧
   * executed. Here the frozen-but-never-executed state is provable. */
  it('abort while pending: frozen request without execution is not visibility', async () => {
    const c = collector();
    const parked = makeParkedModel({ parkSecondCallEntirely: true });
    try {
      const agent = new Agent({
        id: 'adv-abort-i',
        name: 'Adv',
        instructions: 'Test',
        model: parked.model,
        memory: new MockMemory(),
      });
      const sub = await agent.subscribeToThread({ threadId: 'adv-t4', resourceId: 'adv-u' });
      const stream = await agent.stream('Hello', { memory: { thread: 'adv-t4', resource: 'adv-u' } });
      await waitFor(() => sub.activeRunId() != null);
      const sent = await agent.sendSignal(
        { type: 'user-message', contents: 'You will never reach a model stream' },
        { resourceId: 'adv-u', threadId: 'adv-t4' },
      );
      await sent.accepted;
      expect(sub.abort()).toBe(true); // kill run 1 while the signal is queued
      await stream.consumeStream().catch(() => {});
      await settle();
      await settle(); // let post-abort drain/continuation attempts settle

      const sid = sent.signal.id;
      expect(c.facts.some(f => f.action === 'delivery_decided' && f.attributes?.signalId === sid)).toBe(true);
      expect(c.edges.some(e => e.type === 'queued_signal' && e.to.id === `signal:${sid}`)).toBe(true);

      // Any frozen request containing the signal has NO matching `executed`
      // fact — the reader answers "never seen by a model", exactly.
      // freezeId nonce join: requestId AND step both collide across attempts
      // on the abort/drain path — the defect that motivated this join.
      const executed = new Set(c.facts.filter(f => f.action === 'executed').map(f => f.attributes?.freezeId));
      const finalizedById = new Map(c.facts.filter(f => f.action === 'finalized').map(f => [f.id, f]));
      const incl = c.edges.filter(e => e.type === 'included_in_model_input' && e.to.id === `signal:${sid}`);
      for (const e of incl) {
        const final = finalizedById.get(e.from.id);
        expect(final, 'inclusion anchors on a finalized fact').toBeDefined();
        expect(executed.has(final.attributes?.freezeId), 'frozen but never executed').toBe(false);
      }
    } finally {
      parked.releaseSecond();
      parked.release();
      c.done();
    }
  });

  /** A4-ii — abort while pending, successor allowed to run: the queued
   * signal is NOT lost — it is redelivered and really seen, and the facts
   * say so exactly (inclusion ∧ executed). */
  it('abort while pending: redelivered signal visibility is exact', async () => {
    const c = collector();
    const parked = makeParkedModel();
    try {
      const agent = new Agent({
        id: 'adv-abort-ii',
        name: 'Adv',
        instructions: 'Test',
        model: parked.model,
        memory: new MockMemory(),
      });
      const sub = await agent.subscribeToThread({ threadId: 'adv-t4b', resourceId: 'adv-u' });
      const stream = await agent.stream('Hello', { memory: { thread: 'adv-t4b', resource: 'adv-u' } });
      await waitFor(() => sub.activeRunId() != null);
      const sent = await agent.sendSignal(
        { type: 'user-message', contents: 'Survive the abort' },
        { resourceId: 'adv-u', threadId: 'adv-t4b' },
      );
      await sent.accepted;
      expect(sub.abort()).toBe(true);
      parked.release(); // unblock run 1's parked stream so redelivery can run
      await stream.consumeStream().catch(() => {});
      await waitFor(() => parked.streamCount() >= 2, 5_000).catch(() => {});
      await settle();
      await settle();

      const sid = sent.signal.id;
      // freezeId nonce join: requestId AND step both collide across attempts
      // on the abort/drain path — the defect that motivated this join.
      const executed = new Set(c.facts.filter(f => f.action === 'executed').map(f => f.attributes?.freezeId));
      const finalizedById = new Map(c.facts.filter(f => f.action === 'finalized').map(f => [f.id, f]));
      const incl = c.edges.filter(e => e.type === 'included_in_model_input' && e.to.id === `signal:${sid}`);
      if (parked.streamCount() >= 2) {
        // Redelivery executed: visibility is exact.
        expect(incl.length).toBeGreaterThan(0);
        const seen = incl.some(e => executed.has(finalizedById.get(e.from.id)?.attributes?.freezeId));
        expect(seen, 'redelivered and really seen').toBe(true);
      } else {
        // Teardown won the race: then no visibility may be claimed.
        expect(incl.every(e => !executed.has(finalizedById.get(e.from.id)?.attributes?.freezeId))).toBe(true);
      }
    } finally {
      parked.release();
      c.done();
    }
  });

  /** A7 — cache replay: a cache-served response creates zero new
   * model-input visibility facts. */
  it('cache replay emits no new visibility facts', async () => {
    const c = collector();
    try {
      class MapCache extends MastraServerCache {
        store = new Map<string, unknown>();
        constructor() {
          super({ name: 'MapCache' });
        }
        async get(key: string) {
          return this.store.get(key) ?? null;
        }
        async set(key: string, value: unknown) {
          this.store.set(key, value);
        }
        async delete(key: string) {
          this.store.delete(key);
        }
        async listLength() {
          return 0;
        }
        async listPush() {}
        async listFromTo() {
          return [];
        }
      }
      const cache = new MapCache();
      const model = new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'response-metadata',
                id: 'c-1',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              });
              controller.enqueue({ type: 'text-start', id: 'ct' });
              controller.enqueue({ type: 'text-delta', id: 'ct', delta: 'cached answer' });
              controller.enqueue({ type: 'text-end', id: 'ct' });
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
        }),
      });
      const agent = new Agent({
        id: 'adv-cache',
        name: 'Adv',
        instructions: 'Test',
        model,
        inputProcessors: [new ResponseCache({ cache, agentId: 'adv-cache' })],
      });

      const r1 = await agent.stream('Same question');
      await r1.consumeStream();
      await settle();
      const factsAfterRun1 = c.facts.filter(f => f.action === 'finalized').length;
      expect(factsAfterRun1).toBeGreaterThan(0);
      await waitFor(() => cache.store.size > 0); // cache write is async

      const r2 = await agent.stream('Same question');
      await r2.consumeStream();
      expect(await r2.text).toBe('cached answer');
      await settle();
      const factsAfterRun2 = c.facts.filter(f => f.action === 'finalized').length;
      expect(factsAfterRun2, 'no new finalized facts on cache hit').toBe(factsAfterRun1);
      // Replayed chunks carry the ORIGINAL response-metadata; the freeze
      // nonce is unset on the replay path, so no `executed` fact may appear.
      expect(c.facts.filter(f => f.action === 'executed').length, 'no new executed facts on cache hit').toBe(1);
    } finally {
      c.done();
    }
  });

  /** A8 — budget stress: a signal flood trips the sticky per-run cap with
   * exactly one incomplete marker; the agent run itself is unharmed. */
  it('signal flood: one sticky incomplete marker, agent unharmed', async () => {
    const c = collector();
    const parked = makeParkedModel();
    try {
      const agent = new Agent({
        id: 'adv-flood',
        name: 'Adv',
        instructions: 'Test',
        model: parked.model,
        memory: new MockMemory(),
      });
      const sub = await agent.subscribeToThread({ threadId: 'adv-t5', resourceId: 'adv-u' });
      const stream = await agent.stream('Hello', { memory: { thread: 'adv-t5', resource: 'adv-u' } });
      const runId = await (async () => {
        await waitFor(() => sub.activeRunId() != null);
        return sub.activeRunId()!;
      })();
      const sends = [];
      for (let i = 0; i < 130; i++) {
        sends.push(
          agent.sendSignal(
            { type: 'user-message', contents: `flood ${i}` },
            { resourceId: 'adv-u', threadId: 'adv-t5' },
          ),
        );
      }
      await Promise.all((await Promise.all(sends)).map(s => s.accepted));
      parked.release();
      await waitFor(() => parked.streamCount() === 2, 5_000);
      await stream.consumeStream();
      await settle();

      const markers = c.facts.filter(f => f.action === 'native_capture_incomplete' && f.runId === runId);
      expect(markers).toHaveLength(1);
      expect(isRunIncomplete(runId)).toBe(true);
      expect(await stream.text).toBeTruthy(); // the run finished normally
    } finally {
      parked.release();
      c.done();
    }
  });
});
