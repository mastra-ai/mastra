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
import { describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes, DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { ExecutionFence, executionLeaseKey } from '../execution-fence';
import { runInRunFenceScope } from '../run-fence-scope';
import { getRunRegistryEntry } from '../run-registry';
import {
  createDurableAgentStream,
  emitChunkEvent,
  emitErrorEvent,
  emitFinishEvent,
  emitOwnershipClaimedEvent,
  emitSuspendedEvent,
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

/** A registered durable agent, so it can read run claims from `storage`. */
async function observedAgent() {
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
  const workflows = (await storage.getStore('workflows'))!;
  return { durable, pubsub: durable.pubsub, transport, workflows };
}

/** Claims the run for an execution that then loses it to a successor; returns both claim generations. */
async function takeOver(workflows: Awaited<ReturnType<typeof observedAgent>>['workflows'], runId: string) {
  const lost = await workflows.claimRunOwnership({ runId, ownerId: 'lost', leaseMs: 30_000 });
  const successor = await workflows.claimRunOwnership({ runId, ownerId: 'successor', leaseMs: 30_000, force: true });
  return { stale: lost.record!.generation, current: successor.record!.generation };
}

describe('observe() from an offset', () => {
  it("follows the run's current claim when the takeover marker lies before the offset", async () => {
    const { durable, pubsub, transport, workflows } = await observedAgent();
    const runId = 'observed-run';

    const { stale, current } = await takeOver(workflows, runId);

    await runInRunFenceScope(scopeAt(runId, stale), () => emitChunkEvent(pubsub, runId, textChunk('before takeover')));
    await emitOwnershipClaimedEvent(pubsub, runId, current);
    await runInRunFenceScope(scopeAt(runId, current), () => emitChunkEvent(pubsub, runId, textChunk('seen ')));

    // The observer reconnects after everything above, so it never sees the marker.
    const observed = await durable.observe(runId, { offset: 3 });
    const reader = readFullStream(observed.fullStream as ReadableStream<any>);

    await runInRunFenceScope(scopeAt(runId, stale), () => emitFinishEvent(pubsub, runId, finishData));
    await delay(10);
    expect(reader.isClosed()).toBe(false);

    await runInRunFenceScope(scopeAt(runId, current), async () => {
      await emitChunkEvent(pubsub, runId, textChunk('recovered'));
      await emitFinishEvent(pubsub, runId, finishData);
    });
    await reader.done;

    expect(texts(reader.chunks)).toEqual(['recovered']);
    expect(reader.chunks.filter(c => c.type === 'finish')).toHaveLength(1);
    observed.cleanup();
    await transport.close();
  });

  it('replays the segment before a resume when the offset lies inside it', async () => {
    const { durable, pubsub, transport, workflows } = await observedAgent();
    const runId = 'observed-run';

    // First segment runs, then suspends and releases its claim.
    const first = await workflows.claimRunOwnership({ runId, ownerId: 'first', leaseMs: 30_000 });
    const firstGeneration = first.record!.generation;
    await runInRunFenceScope(scopeAt(runId, firstGeneration), async () => {
      await emitChunkEvent(pubsub, runId, textChunk('a '));
      await emitChunkEvent(pubsub, runId, textChunk('b '));
    });
    await workflows.releaseRunOwnership({ runId, ownerId: 'first', generation: firstGeneration });

    // resume() takes a new claim. It is not a takeover, so there is no marker.
    const resumed = await workflows.claimRunOwnership({ runId, ownerId: 'resumed', leaseMs: 30_000 });
    const resumedGeneration = resumed.record!.generation;
    expect(resumedGeneration).toBeGreaterThan(firstGeneration);
    await runInRunFenceScope(scopeAt(runId, resumedGeneration), () => emitChunkEvent(pubsub, runId, textChunk('c ')));

    // The observer reconnects inside the first segment.
    const observed = await durable.observe(runId, { offset: 1 });
    const reader = readFullStream(observed.fullStream as ReadableStream<any>);
    await runInRunFenceScope(scopeAt(runId, resumedGeneration), async () => {
      await emitChunkEvent(pubsub, runId, textChunk('d'));
      await emitFinishEvent(pubsub, runId, finishData);
    });
    await reader.done;

    expect(texts(reader.chunks)).toEqual(['b ', 'c ', 'd']);
    observed.cleanup();
    await transport.close();
  });

  it("still reconnects when the run's claim can't be read", async () => {
    const { durable, pubsub, transport, workflows } = await observedAgent();
    const runId = 'observed-run';

    const { record } = await workflows.claimRunOwnership({ runId, ownerId: 'owner', leaseMs: 30_000 });
    await runInRunFenceScope(scopeAt(runId, record!.generation), () =>
      emitChunkEvent(pubsub, runId, textChunk('before ')),
    );
    vi.spyOn(workflows, 'getRunOwnership').mockRejectedValue(new Error('storage unavailable'));

    const observed = await durable.observe(runId, { offset: 1 });
    const reader = readFullStream(observed.fullStream as ReadableStream<any>);
    await runInRunFenceScope(scopeAt(runId, record!.generation), async () => {
      await emitChunkEvent(pubsub, runId, textChunk('after'));
      await emitFinishEvent(pubsub, runId, finishData);
    });
    await reader.done;

    expect(texts(reader.chunks)).toEqual(['after']);
    observed.cleanup();
    await transport.close();
  });

  it("reads the run's claim again before a finish when the first read failed", async () => {
    const { durable, pubsub, transport, workflows } = await observedAgent();
    const runId = 'observed-run';

    const { stale, current } = await takeOver(workflows, runId);

    await runInRunFenceScope(scopeAt(runId, stale), () => emitChunkEvent(pubsub, runId, textChunk('before takeover')));
    await emitOwnershipClaimedEvent(pubsub, runId, current);
    await runInRunFenceScope(scopeAt(runId, current), () => emitChunkEvent(pubsub, runId, textChunk('seen ')));
    vi.spyOn(workflows, 'getRunOwnership').mockRejectedValueOnce(new Error('storage unavailable'));

    // The offset skips the marker and the first claim read fails.
    const observed = await durable.observe(runId, { offset: 3 });
    const reader = readFullStream(observed.fullStream as ReadableStream<any>);

    await runInRunFenceScope(scopeAt(runId, stale), () => emitFinishEvent(pubsub, runId, finishData));
    await delay(10);
    expect(reader.isClosed()).toBe(false);

    await runInRunFenceScope(scopeAt(runId, current), async () => {
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

describe('__subscribeToRunStream() lifecycle', () => {
  it('completes an unknown run without inserting a registry entry or clearing shared history', async () => {
    const { durable, transport } = await observedAgent();
    const runId = crypto.randomUUID();
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    const clearTopic = vi.spyOn(durable.pubsub, 'clearTopic');
    const started = performance.now();
    const unsubscribe = await durable.__subscribeToRunStream(runId, { onComplete }, onEvent);
    try {
      expect(performance.now() - started).toBeLessThan(1000);
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onEvent).not.toHaveBeenCalled();
      expect(getRunRegistryEntry(runId, undefined)).toBeUndefined();
      expect(clearTopic).not.toHaveBeenCalled();
    } finally {
      await unsubscribe();
      await transport.close();
    }
  });

  it('replays and completes a finished run whose last event is an error', async () => {
    const { durable, pubsub, transport } = await observedAgent();
    const runId = crypto.randomUUID();
    await emitChunkEvent(pubsub, runId, textChunk('partial'));
    await emitErrorEvent(pubsub, runId, new Error('model failed'));
    const onComplete = vi.fn();
    const events: any[] = [];
    const unsubscribe = await durable.__subscribeToRunStream(runId, { onComplete }, event => {
      events.push(event);
    });
    try {
      expect(events.map(event => event.type)).toEqual([AgentStreamEventTypes.CHUNK, AgentStreamEventTypes.ERROR]);
      expect(onComplete).toHaveBeenCalledTimes(1);
    } finally {
      await unsubscribe();
      await transport.close();
    }
  });

  it('keeps a run suspended for approval observed until its resumed segment finishes', async () => {
    const { durable, pubsub, transport } = await observedAgent();
    const runId = crypto.randomUUID();
    await emitChunkEvent(pubsub, runId, textChunk('before approval'));
    await emitSuspendedEvent(pubsub, runId, { type: 'approval', toolCallId: 'call-1', toolName: 'deploy' });
    const onComplete = vi.fn();
    const events: any[] = [];
    const unsubscribe = await durable.__subscribeToRunStream(runId, { onComplete }, event => {
      events.push(event);
    });
    try {
      await delay(50);
      expect(onComplete).not.toHaveBeenCalled();
      await emitChunkEvent(pubsub, runId, textChunk('after approval'));
      await emitFinishEvent(pubsub, runId, finishData);
      await vi.waitFor(() => expect(events.at(-1)?.type).toBe(AgentStreamEventTypes.FINISH));
      expect(
        texts(events.filter(event => event.type === AgentStreamEventTypes.CHUNK).map(event => event.data)),
      ).toEqual(['before approval', 'after approval']);
    } finally {
      await unsubscribe();
      await transport.close();
    }
  });

  it('keeps observing when the only terminal event belongs to a superseded execution', async () => {
    const { durable, pubsub, transport, workflows } = await observedAgent();
    const runId = 'untagged-progress-stale-finish';
    const { stale, current } = await takeOver(workflows, runId);
    // The successor is between leases: its claim is the newest one but not live.
    await workflows.releaseRunOwnership({ runId, generation: current, ownerId: 'successor' });
    await emitChunkEvent(pubsub, runId, textChunk('still running'));
    await runInRunFenceScope(scopeAt(runId, stale), () => emitFinishEvent(pubsub, runId, finishData));
    const onComplete = vi.fn();
    const unsubscribe = await durable.__subscribeToRunStream(runId, { offset: 100, onComplete }, vi.fn());
    try {
      expect(onComplete).not.toHaveBeenCalled();
    } finally {
      await unsubscribe();
      await transport.close();
    }
  });

  it('keeps an empty topic observable while a remote storage claim is live', async () => {
    const { durable, transport, workflows } = await observedAgent();
    const runId = 'quiet-remote-claim';
    await workflows.claimRunOwnership({ runId, ownerId: 'remote', leaseMs: 30_000 });
    const onComplete = vi.fn();
    const unsubscribe = await durable.__subscribeToRunStream(runId, { onComplete }, vi.fn());
    try {
      expect(onComplete).not.toHaveBeenCalled();
    } finally {
      await unsubscribe();
      await transport.close();
    }
  });

  it('checks the agent transport for a quiet remote lease, not the separate Mastra bus', async () => {
    const { durable, transport } = await observedAgent();
    const runId = 'quiet-remote-lease';
    await transport.acquireLease(executionLeaseKey(durable.id, runId), 'remote', 30_000);
    const onComplete = vi.fn();
    const unsubscribe = await durable.__subscribeToRunStream(runId, { onComplete }, vi.fn());
    try {
      expect(onComplete).not.toHaveBeenCalled();
    } finally {
      await unsubscribe();
      await transport.close();
    }
  });

  it('does not complete from a stale terminal event when a newer remote execution is active', async () => {
    const { durable, pubsub, transport, workflows } = await observedAgent();
    const runId = 'old-terminal-new-owner';
    const { stale } = await takeOver(workflows, runId);
    await runInRunFenceScope(scopeAt(runId, stale), () => emitFinishEvent(pubsub, runId, finishData));
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    const unsubscribe = await durable.__subscribeToRunStream(runId, { offset: 100, onComplete }, onEvent);
    try {
      expect(onComplete).not.toHaveBeenCalled();
      expect(onEvent).not.toHaveBeenCalled();
    } finally {
      await unsubscribe();
      await transport.close();
    }
  });

  it('keeps a newer nonterminal segment observable during an ownership outage', async () => {
    const { durable, pubsub, transport, workflows } = await observedAgent();
    const runId = 'mixed-history-outage';
    await runInRunFenceScope(scopeAt(runId, 1), () => emitFinishEvent(pubsub, runId, finishData));
    await runInRunFenceScope(scopeAt(runId, 2), () => emitChunkEvent(pubsub, runId, textChunk('current')));
    vi.spyOn(workflows, 'getRunOwnership').mockRejectedValue(new Error('storage unavailable'));
    const onComplete = vi.fn();
    const unsubscribe = await durable.__subscribeToRunStream(runId, { offset: 100, onComplete }, vi.fn());
    try {
      expect(onComplete).not.toHaveBeenCalled();
    } finally {
      await unsubscribe();
      await transport.close();
    }
  });

  it('does not close over a live event arriving during the final absence check', async () => {
    const { durable, pubsub, transport, workflows } = await observedAgent();
    const runId = 'activity-during-reconciliation';
    const original = workflows.getWorkflowRunById.bind(workflows);
    let reads = 0;
    vi.spyOn(workflows, 'getWorkflowRunById').mockImplementation(async params => {
      const record = await original(params);
      if (++reads === 4) await emitChunkEvent(pubsub, runId, textChunk('just started'));
      return record;
    });
    const onComplete = vi.fn();
    const onEvent = vi.fn();
    const unsubscribe = await durable.__subscribeToRunStream(runId, { onComplete }, onEvent);
    try {
      expect(onEvent).toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();
    } finally {
      await unsubscribe();
      await transport.close();
    }
  });

  it('keeps public observation attached when a hidden takeover marker races the final absence check', async () => {
    const { durable, pubsub, transport, workflows } = await observedAgent();
    const runId = 'public-takeover-during-reconciliation';
    const original = workflows.getWorkflowRunById.bind(workflows);
    let reads = 0;
    vi.spyOn(workflows, 'getWorkflowRunById').mockImplementation(async params => {
      const record = await original(params);
      if (++reads === 6) await emitOwnershipClaimedEvent(pubsub, runId, 2);
      return record;
    });
    const observation = await durable.observe(runId);
    const reader = readFullStream(observation.fullStream as ReadableStream<any>);
    try {
      expect(reads).toBe(6);
      await runInRunFenceScope(scopeAt(runId, 2), async () => {
        await emitChunkEvent(pubsub, runId, textChunk('after takeover'));
        await emitFinishEvent(pubsub, runId, finishData);
      });
      await reader.done;
      expect(texts(reader.chunks)).toEqual(['after takeover']);
      expect(reader.chunks.filter(chunk => chunk.type === 'finish')).toHaveLength(1);
    } finally {
      observation.detach();
      await transport.close();
    }
  });

  describe.each([DurableStepIds.AGENTIC_LOOP, DurableStepIds.AGENTIC_EXECUTION])(
    'retained %s snapshots',
    workflowName => {
      it.each([
        'success',
        'failed',
        'tripwire',
        'canceled',
        'bailed',
        'skipped',
        'running',
        'pending',
        'waiting',
        'suspended',
        'paused',
      ] as const)('classifies a retained %s snapshot without replay history', async status => {
        const { durable, transport, workflows } = await observedAgent();
        const runId = `retained-${workflowName}-${status}`;
        const onComplete = vi.fn();
        const terminal = ['success', 'failed', 'tripwire', 'canceled', 'bailed', 'skipped'].includes(status);
        await workflows.persistWorkflowSnapshot({
          workflowName,
          runId,
          snapshot: {
            runId,
            status,
            value: {},
            context: {},
            serializedStepGraph: [],
            activePaths: [],
            activeStepsPath: {},
            suspendedPaths: {},
            resumeLabels: {},
            waitingPaths: {},
            timestamp: Date.now(),
          },
        });
        try {
          const unsubscribe = await durable.__subscribeToRunStream(runId, { onComplete }, vi.fn());
          expect(onComplete).toHaveBeenCalledTimes(terminal ? 1 : 0);
          const observation = await durable.observe(runId);
          const reader = readFullStream(observation.fullStream);
          await delay(20);
          expect(reader.isClosed()).toBe(terminal);
          observation.detach();
          await reader.done;
          await unsubscribe();
        } finally {
          await transport.close();
        }
      });
    },
  );

  it.each(['ownership', 'fencing', 'snapshot'] as const)(
    'keeps observing through an unavailable %s read',
    async boundary => {
      const { durable, pubsub, transport, workflows } = await observedAgent();
      const runId = `unknown-with-${boundary}-outage`;
      const unavailable = new Error('storage unavailable');
      if (boundary === 'ownership') vi.spyOn(workflows, 'getRunOwnership').mockRejectedValue(unavailable);
      if (boundary === 'fencing') vi.spyOn(workflows, 'supportsRunFencing').mockRejectedValue(unavailable);
      const snapshotRead =
        boundary === 'snapshot' ? vi.spyOn(workflows, 'getWorkflowRunById').mockRejectedValue(unavailable) : undefined;
      const onComplete = vi.fn();
      const onEvent = vi.fn();
      try {
        const unsubscribe = await durable.__subscribeToRunStream(runId, { onComplete }, onEvent);
        // Hydration succeeds; only the subsequent completion probe is unavailable.
        snapshotRead?.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
        const observation = await durable.observe(runId);
        const reader = readFullStream(observation.fullStream);
        expect(onComplete).not.toHaveBeenCalled();
        expect(reader.isClosed()).toBe(false);
        await emitChunkEvent(pubsub, runId, textChunk('after outage'));
        await emitFinishEvent(pubsub, runId, finishData);
        await reader.done;
        expect(texts(reader.chunks)).toEqual(['after outage']);
        expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: AgentStreamEventTypes.FINISH }));
        observation.detach();
        await unsubscribe();
      } finally {
        await transport.close();
      }
    },
  );
});

describe('__subscribeToRunStream()', () => {
  const summarize = (events: any[]) => events.map(event => [event.type, event.data?.payload?.text, event.generation]);

  it('drops what a superseded execution publishes after the takeover, and does not deliver the marker', async () => {
    const { durable, pubsub, transport } = await observedAgent();
    const runId = 'subscribed-run';

    await runInRunFenceScope(scopeAt(runId, 1), () => emitChunkEvent(pubsub, runId, textChunk('before takeover')));
    await emitOwnershipClaimedEvent(pubsub, runId, 2);
    await runInRunFenceScope(scopeAt(runId, 1), async () => {
      await emitChunkEvent(pubsub, runId, textChunk('stale'));
      await emitFinishEvent(pubsub, runId, finishData);
    });
    await runInRunFenceScope(scopeAt(runId, 2), async () => {
      await emitChunkEvent(pubsub, runId, textChunk('recovered'));
      await emitFinishEvent(pubsub, runId, finishData);
    });

    const events: any[] = [];
    const unsubscribe = await durable.__subscribeToRunStream(runId, {}, event => events.push(event));

    expect(summarize(events)).toEqual([
      [AgentStreamEventTypes.CHUNK, 'before takeover', 1],
      [AgentStreamEventTypes.CHUNK, 'recovered', 2],
      [AgentStreamEventTypes.FINISH, undefined, 2],
    ]);
    await unsubscribe();
    await transport.close();
  });

  it("follows the run's current claim when the takeover marker lies before the offset", async () => {
    const { durable, pubsub, transport, workflows } = await observedAgent();
    const runId = 'subscribed-run';

    const { stale, current } = await takeOver(workflows, runId);
    await runInRunFenceScope(scopeAt(runId, stale), () => emitChunkEvent(pubsub, runId, textChunk('before takeover')));
    await emitOwnershipClaimedEvent(pubsub, runId, current);
    await runInRunFenceScope(scopeAt(runId, current), () => emitChunkEvent(pubsub, runId, textChunk('seen ')));

    const events: any[] = [];
    const unsubscribe = await durable.__subscribeToRunStream(runId, { offset: 3 }, event => events.push(event));
    await runInRunFenceScope(scopeAt(runId, stale), () => emitFinishEvent(pubsub, runId, finishData));
    await runInRunFenceScope(scopeAt(runId, current), async () => {
      await emitChunkEvent(pubsub, runId, textChunk('recovered'));
      await emitFinishEvent(pubsub, runId, finishData);
    });

    expect(summarize(events)).toEqual([
      [AgentStreamEventTypes.CHUNK, 'recovered', current],
      [AgentStreamEventTypes.FINISH, undefined, current],
    ]);
    await unsubscribe();
    await transport.close();
  });

  it("subscribes when the run's claim can't be read, and reads it again before a finish", async () => {
    const { durable, pubsub, transport, workflows } = await observedAgent();
    const runId = 'subscribed-run';

    const { stale, current } = await takeOver(workflows, runId);
    await runInRunFenceScope(scopeAt(runId, stale), () => emitChunkEvent(pubsub, runId, textChunk('before takeover')));
    await emitOwnershipClaimedEvent(pubsub, runId, current);
    await runInRunFenceScope(scopeAt(runId, current), () => emitChunkEvent(pubsub, runId, textChunk('seen ')));
    vi.spyOn(workflows, 'getRunOwnership').mockRejectedValueOnce(new Error('storage unavailable'));

    const events: any[] = [];
    const unsubscribe = await durable.__subscribeToRunStream(runId, { offset: 3 }, event => events.push(event));
    await runInRunFenceScope(scopeAt(runId, stale), () => emitFinishEvent(pubsub, runId, finishData));
    await runInRunFenceScope(scopeAt(runId, current), async () => {
      await emitChunkEvent(pubsub, runId, textChunk('recovered'));
      await emitFinishEvent(pubsub, runId, finishData);
    });
    await delay(10);

    expect(summarize(events)).toEqual([
      [AgentStreamEventTypes.CHUNK, 'recovered', current],
      [AgentStreamEventTypes.FINISH, undefined, current],
    ]);
    await unsubscribe();
    await transport.close();
  });

  it('stops delivering once unsubscribed', async () => {
    const { durable, pubsub, transport } = await observedAgent();
    const runId = 'subscribed-run';

    const events: any[] = [];
    const unsubscribe = await durable.__subscribeToRunStream(runId, {}, event => events.push(event));
    await emitChunkEvent(pubsub, runId, textChunk('delivered'));
    await unsubscribe();
    await emitChunkEvent(pubsub, runId, textChunk('after unsubscribe'));

    expect(summarize(events)).toEqual([[AgentStreamEventTypes.CHUNK, 'delivered', undefined]]);
    await transport.close();
  });

  it('forwards frames without the cache-assigned sequencing fields', async () => {
    const { durable, pubsub, transport } = await observedAgent();
    const runId = 'subscribed-run';

    // Published before the observer attaches, so this frame reaches it out of the
    // topic history — the path that hands an event its `index`.
    await emitChunkEvent(pubsub, runId, textChunk('replayed'));

    const events: any[] = [];
    const unsubscribe = await durable.__subscribeToRunStream(runId, {}, event => events.push(event));
    await emitChunkEvent(pubsub, runId, textChunk('live'));

    expect(summarize(events)).toEqual([
      [AgentStreamEventTypes.CHUNK, 'replayed', undefined],
      [AgentStreamEventTypes.CHUNK, 'live', undefined],
    ]);
    // They exist for subscribers of the topic, not for the payload observe forwards.
    for (const event of events) {
      expect(event).not.toHaveProperty('index');
    }
    await unsubscribe();
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
