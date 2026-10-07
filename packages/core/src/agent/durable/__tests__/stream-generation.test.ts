/**
 * Claim generations on a durable run's stream topic (#23734).
 *
 * When recover() takes a run over from an execution that is still alive, the
 * superseded execution can publish for a moment before it notices it lost the
 * run. Every event an execution publishes for the run carries its claim
 * generation, and the run's stream consumers drop events older than the
 * newest generation they have seen. recover() announces its generation with
 * an `ownership-claimed` marker so consumers raise the bar before the new
 * execution publishes anything.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { ExecutionFence } from '../execution-fence';
import { runInRunFenceScope } from '../run-fence-scope';
import {
  createDurableAgentStream,
  emitChunkEvent,
  emitErrorEvent,
  emitFinishEvent,
  emitOwnershipClaimedEvent,
} from '../stream-adapter';
import type { DurableAgentStreamResult } from '../stream-adapter';

const IDLE = 60;

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const textChunk = (text: string) => ({ type: 'text-delta', payload: { id: 'text-1', text } }) as any;

const finishData = {
  output: { text: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, steps: [] },
  stepResult: { reason: 'stop' as const, warnings: [], isContinued: false },
};

function readFullStream(stream: ReadableStream<any>) {
  const chunks: any[] = [];
  let closed = false;
  const done = (async () => {
    try {
      for await (const chunk of stream) chunks.push(chunk);
    } catch {
      // surfaced through the chunks
    } finally {
      closed = true;
    }
  })();
  return { chunks, done, isClosed: () => closed };
}

const texts = (chunks: any[]) => chunks.filter(c => c.type === 'text-delta').map(c => c.payload.text);

/** A run fence scope that covers `runId` at `generation`. */
const scopeAt = (runId: string, generation: number) => ({
  fenceFor: () => undefined,
  generationFor: (id: string) => (id === runId ? generation : undefined),
});

describe('durable run stream claim generations', () => {
  const makeStream = (
    pubsub: EventEmitterPubSub,
    runId: string,
    extra: Partial<Parameters<typeof createDurableAgentStream>[0]> = {},
  ) =>
    createDurableAgentStream({
      pubsub,
      runId,
      messageId: `msg-${runId}`,
      model: { modelId: 'test', provider: 'test', version: 'v3' },
      ...extra,
    }) as DurableAgentStreamResult<any>;

  it('tags the events an execution publishes with the generation its fence scope holds for the run', async () => {
    const pubsub = new EventEmitterPubSub();
    const runId = 'tagged-run';
    const events: any[] = [];
    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
      events.push(event);
    });

    await runInRunFenceScope(scopeAt(runId, 3), async () => {
      await emitChunkEvent(pubsub, runId, textChunk('mine'));
      // A nested run's topic the scope does not cover stays untagged.
      await emitChunkEvent(pubsub, 'other-run', textChunk('not mine'));
    });
    // Error events are published outside the scope and carry the generation explicitly.
    await emitErrorEvent(pubsub, runId, new Error('boom'), 3);
    await emitChunkEvent(pubsub, runId, textChunk('unscoped'));

    expect(events.map(event => [event.type, event.generation])).toEqual([
      [AgentStreamEventTypes.CHUNK, 3],
      [AgentStreamEventTypes.ERROR, 3],
      [AgentStreamEventTypes.CHUNK, undefined],
    ]);
    await pubsub.close();
  });

  it('drops events from an older generation than the one it follows, and keeps untagged ones', async () => {
    const pubsub = new EventEmitterPubSub();
    const runId = 'min-generation';
    const { output, cleanup, ready } = makeStream(pubsub, runId, { minGeneration: 2 });
    await ready;
    const reader = readFullStream(output.fullStream as ReadableStream<any>);

    await runInRunFenceScope(scopeAt(runId, 1), () => emitChunkEvent(pubsub, runId, textChunk('superseded')));
    await runInRunFenceScope(scopeAt(runId, 2), () => emitChunkEvent(pubsub, runId, textChunk('current')));
    await emitChunkEvent(pubsub, runId, textChunk('untagged'));
    // The superseded execution's terminal event must not close the stream.
    await runInRunFenceScope(scopeAt(runId, 1), () => emitFinishEvent(pubsub, runId, finishData));
    await delay(10);
    expect(reader.isClosed()).toBe(false);

    await runInRunFenceScope(scopeAt(runId, 2), () => emitFinishEvent(pubsub, runId, finishData));
    await reader.done;

    expect(texts(reader.chunks)).toEqual(['current', 'untagged']);
    expect(reader.chunks.filter(c => c.type === 'finish')).toHaveLength(1);
    cleanup();
    await pubsub.close();
  });

  it('raises the bar when another execution announces its claim, without surfacing the marker', async () => {
    const pubsub = new EventEmitterPubSub();
    const runId = 'takeover';
    // An observer that started before any takeover: it follows whatever the topic shows.
    const { output, cleanup, ready } = makeStream(pubsub, runId);
    await ready;
    const reader = readFullStream(output.fullStream as ReadableStream<any>);

    await runInRunFenceScope(scopeAt(runId, 1), () => emitChunkEvent(pubsub, runId, textChunk('before takeover')));
    await emitOwnershipClaimedEvent(pubsub, runId, 2);
    // The original execution has not noticed yet and keeps publishing.
    await runInRunFenceScope(scopeAt(runId, 1), () => emitChunkEvent(pubsub, runId, textChunk('late')));
    await runInRunFenceScope(scopeAt(runId, 2), async () => {
      await emitChunkEvent(pubsub, runId, textChunk('recovered'));
      await emitFinishEvent(pubsub, runId, finishData);
    });
    await reader.done;

    expect(texts(reader.chunks)).toEqual(['before takeover', 'recovered']);
    expect(reader.chunks.some(c => c.type === AgentStreamEventTypes.OWNERSHIP_CLAIMED)).toBe(false);
    cleanup();
    await pubsub.close();
  });

  it('does not count stale events as signs of life', async () => {
    const pubsub = new EventEmitterPubSub();
    const runId = 'stale-idle';
    const { output, cleanup, ready } = makeStream(pubsub, runId, {
      minGeneration: 2,
      idleTimeoutMs: IDLE,
      isAlive: () => false,
    });
    await ready;
    const reader = readFullStream(output.fullStream as ReadableStream<any>);

    // The superseded execution keeps publishing faster than the idle window;
    // the current one has gone silent, so the stream must still time out.
    for (let i = 0; i < 6 && !reader.isClosed(); i++) {
      await runInRunFenceScope(scopeAt(runId, 1), () => emitChunkEvent(pubsub, runId, textChunk(`stale-${i}`)));
      await delay(IDLE / 2);
    }
    await reader.done;

    expect(texts(reader.chunks)).toEqual([]);
    const errors = reader.chunks.filter(c => c.type === 'error');
    expect(errors).toHaveLength(1);
    expect(String(errors[0].payload.error.message)).toContain(`idle for ${IDLE}ms`);
    cleanup();
    await pubsub.close();
  });
});

describe('observe() from an offset', () => {
  it("follows the run's current claim when the takeover marker lies before the offset", async () => {
    const storage = new InMemoryStore();
    const agent = new Agent({
      id: 'observed-agent',
      name: 'Observed Agent',
      instructions: 'You are a helpful agent.',
      model: new MockLanguageModelV2({}) as LanguageModelV2,
    });
    const transport = new EventEmitterPubSub();
    const durable = createDurableAgent({ agent, pubsub: transport });
    new Mastra({ agents: { 'observed-agent': durable as any }, logger: false, storage });
    const pubsub = durable.pubsub;
    const runId = 'observed-run';

    // The lost execution claimed generation 1; the successor took the run over at 2.
    const workflows = (await storage.getStore('workflows'))!;
    await workflows.claimRunOwnership({ runId, ownerId: 'lost', leaseMs: 30_000 });
    await workflows.claimRunOwnership({ runId, ownerId: 'successor', leaseMs: 30_000, force: true });

    await runInRunFenceScope(scopeAt(runId, 1), () => emitChunkEvent(pubsub, runId, textChunk('before takeover')));
    await emitOwnershipClaimedEvent(pubsub, runId, 2);
    await runInRunFenceScope(scopeAt(runId, 2), () => emitChunkEvent(pubsub, runId, textChunk('seen ')));

    // The observer reconnects after everything above, so it never sees the marker.
    const observed = await durable.observe(runId, { offset: 3 });
    const reader = readFullStream(observed.fullStream as ReadableStream<any>);

    await runInRunFenceScope(scopeAt(runId, 1), () => emitFinishEvent(pubsub, runId, finishData));
    await delay(10);
    expect(reader.isClosed()).toBe(false);

    await runInRunFenceScope(scopeAt(runId, 2), async () => {
      await emitChunkEvent(pubsub, runId, textChunk('recovered'));
      await emitFinishEvent(pubsub, runId, finishData);
    });
    await reader.done;

    expect(texts(reader.chunks)).toEqual(['recovered']);
    expect(reader.chunks.filter(c => c.type === 'finish')).toHaveLength(1);
    observed.cleanup();
    await transport.close();
  });
});

describe.each(['durable', 'evented'] as const)('%s agent', kind => {
  it("tags everything it publishes for the run with the run's claim generation", async () => {
    const pubsub = new EventEmitterPubSub();
    const storage = new InMemoryStore();
    const model = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'answer' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });
    const agent = new Agent({
      id: 'generation-agent',
      name: 'Generation Agent',
      instructions: 'You are a helpful agent.',
      model: model as LanguageModelV2,
      memory: new MockMemory({ storage }),
    });
    // The evented agent adopts mastra.pubsub; its steps publish from the engine's workers.
    const wrapped = kind === 'durable' ? createDurableAgent({ agent, pubsub }) : createEventedAgent({ agent });
    new Mastra({ agents: { 'generation-agent': wrapped as any }, logger: false, storage, pubsub });

    const result = await wrapped.stream('What is the answer?', { memory: { thread: 'thread', resource: 'resource' } });
    const generation = ExecutionFence.getLocalActive(result.runId)?.generation;
    expect(generation).toEqual(expect.any(Number));
    const events: any[] = [];
    await pubsub.subscribe(AGENT_STREAM_TOPIC(result.runId), event => {
      events.push(event);
    });
    for await (const _chunk of result.fullStream as any) {
      // drain
    }

    expect(events.map(event => event.type)).toContain(AgentStreamEventTypes.FINISH);
    expect(events.filter(event => event.generation !== generation)).toEqual([]);
    result.cleanup();
    await pubsub.close();
  });
});
