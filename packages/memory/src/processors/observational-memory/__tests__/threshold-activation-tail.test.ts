/**
 * Threshold observation after partial buffered activation (#19767).
 *
 * A large tool-result batch can leave an uncovered tail after buffered activation.
 * These tests drive real OM + in-memory storage through `turn.step(n).prepare()`:
 * tails in the async band stay non-blocking; tails at/above blockAfter sync-observe
 * only uncovered messages. A chunk write that outlasts activation's wait is skipped by
 * storage once the sync pass has covered it.
 */

import type { MastraDBMessage } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, it, expect, vi } from 'vitest';

import { BufferingCoordinator } from '../buffering-coordinator';
import { OmModelExecutionError } from '../error';
import { ObservationalMemory } from '../observational-memory';
import type { ObservationConfig } from '../types';

const resourceId = 'resource-19767';

function msg(id: string, role: 'user' | 'assistant', text: string, createdAt: Date, threadId: string): MastraDBMessage {
  return {
    id,
    role,
    content: { format: 2, parts: [{ type: 'text', text }] },
    type: 'text',
    createdAt,
    threadId,
    resourceId,
  } as MastraDBMessage;
}

async function setup(
  threadId: string,
  failurePolicy?: 'abort' | 'continue',
  observation: Partial<ObservationConfig> = {},
) {
  const storage = new InMemoryMemory({ db: new InMemoryDB() });
  await storage.saveThread({
    thread: { id: threadId, resourceId, title: 'thread', createdAt: new Date(), updatedAt: new Date() },
  });

  const om = new ObservationalMemory({
    storage,
    scope: 'thread',
    observation: {
      model: 'openai/gpt-4o-mini' as any,
      messageTokens: 10_000,
      bufferTokens: 2_000,
      bufferActivation: 0.8,
      blockAfter: 1.2,
      ...(failurePolicy ? { failurePolicy, maxRetries: 0 } : {}),
      ...observation,
    },
    reflection: { model: 'openai/gpt-4o-mini' as any, observationTokens: 50_000 },
  });

  const observerCall = vi.spyOn(om.observer, 'call').mockResolvedValue({
    observations: '* observed tail',
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
  } as any);
  const swapSpy = vi.spyOn(storage, 'swapBufferedToActive');

  return { storage, om, observerCall, swapSpy };
}

async function addChunk(
  storage: InMemoryMemory,
  recordId: string,
  cycleId: string,
  messageIds: string[],
  messageTokens: number,
  lastObservedAt: Date,
) {
  await storage.updateBufferedObservations({
    id: recordId,
    chunk: {
      observations: `- ${cycleId} observation`,
      tokenCount: 20,
      messageIds,
      cycleId,
      messageTokens,
      lastObservedAt,
    },
  });
}

describe('threshold observation after partial buffered activation', () => {
  it.each([
    { name: 'starts in the async band', oldRepeat: 300, tailRepeat: 11_000, sync: false, startsInBand: true },
    {
      name: 'drops into the async band after activation',
      oldRepeat: 1500,
      tailRepeat: 11_000,
      sync: false,
      startsInBand: false,
    },
    {
      name: 'stays above blockAfter after activation',
      oldRepeat: 300,
      tailRepeat: 12_500,
      sync: true,
      startsInBand: false,
    },
  ])('$name', async ({ oldRepeat, tailRepeat, sync, startsInBand }) => {
    const threadId = `thread-band-${oldRepeat}-${tailRepeat}`;
    const { storage, om, observerCall, swapSpy } = await setup(threadId);
    const waitSpy = vi.spyOn(om, 'waitForBuffering');
    const t0 = Date.now() - 60_000;
    const oldUser = msg('old-user', 'user', 'hello '.repeat(oldRepeat), new Date(t0), threadId);
    const oldAssistant = msg('old-assistant', 'assistant', 'answer '.repeat(oldRepeat), new Date(t0 + 1000), threadId);
    const newUser = msg('new-user', 'user', 'please run the tool', new Date(Date.now() - 1000), threadId);
    const tail = msg('unbuffered-tail', 'assistant', 'data '.repeat(tailRepeat), new Date(), threadId);
    await storage.saveMessages({ messages: [oldUser, oldAssistant] });
    const record = await om.getOrCreateRecord(threadId, resourceId);
    await addChunk(storage, record.id, 'cycle-a', ['old-user', 'old-assistant'], oldRepeat * 2, new Date(t0 + 1000));
    await storage.setPendingMessageTokens(record.id, oldRepeat * 2);
    const messageList = new MessageList({ threadId, resourceId });
    messageList.add([oldUser, oldAssistant], 'memory');
    messageList.add(newUser, 'input');
    messageList.add(tail, 'response');
    const before = await om.getStatus({ threadId, resourceId, messages: messageList.get.all.db() });
    expect(before.inAsyncObservationBand).toBe(startsInBand);
    expect(before.shouldObserve).toBe(true);
    const turn = om.beginTurn({ threadId, resourceId, messageList });
    await turn.start();
    const ctx = await turn.step(1).prepare();
    expect(swapSpy).toHaveBeenCalledTimes(1);
    expect(swapSpy.mock.calls[0]![0].currentPendingTokens).toBe(before.pendingTokens);
    expect(ctx.observed).toBe(true);
    expect(waitSpy).toHaveBeenCalledTimes(startsInBand ? 0 : 1);
    expect(observerCall).toHaveBeenCalledTimes(sync ? 1 : 0);
    expect(ctx.status.shouldObserve).toBe(!sync);
    expect(messageList.get.all.db().map(m => m.id)).not.toContain('old-user');
    expect(messageList.get.all.db().map(m => m.id)).not.toContain('old-assistant');
    const afterActivation = await storage.getObservationalMemory(threadId, resourceId);
    expect(afterActivation?.lastObservedAt).toEqual(sync ? tail.createdAt : new Date(t0 + 1000));
    if (!sync) {
      expect(afterActivation?.observedMessageIds ?? []).not.toContain('unbuffered-tail');
      expect(ctx.status.pendingTokens).toBeGreaterThanOrEqual(ctx.status.threshold);
      expect(ctx.status.pendingTokens).toBeLessThan(12_000);
      expect(messageList.get.all.db().map(m => m.id)).toEqual(['new-user', 'unbuffered-tail']);
      const next = await turn.step(2).prepare();
      expect(next.buffered).toBe(true);
      await om.waitForBuffering(threadId, resourceId);
      const afterBuffer = await storage.getObservationalMemory(threadId, resourceId);
      expect(afterBuffer?.bufferedObservationChunks?.flatMap(chunk => chunk.messageIds).sort()).toEqual([
        'new-user',
        'unbuffered-tail',
      ]);
    }
    expect(observerCall).toHaveBeenCalledTimes(1);
    expect(observerCall.mock.calls[0]![1].map(m => m.id).sort()).toEqual(['new-user', 'unbuffered-tail']);
  });

  it.each([
    {
      name: 'async disabled',
      observation: { bufferTokens: false as const },
      override: undefined,
      tailTokens: 11_000,
      sync: true,
    },
    {
      name: 'default blockAfter',
      observation: { blockAfter: undefined },
      override: undefined,
      tailTokens: 11_000,
      sync: false,
    },
    { name: 'record multiplier band', observation: {}, override: 13_000, tailTokens: 14_000, sync: false },
    { name: 'record multiplier limit', observation: {}, override: 13_000, tailTokens: 16_000, sync: true },
    {
      name: 'record absolute band',
      observation: { blockAfter: 15_000 },
      override: 13_000,
      tailTokens: 14_000,
      sync: false,
    },
    {
      name: 'record absolute limit',
      observation: { blockAfter: 15_000 },
      override: 13_000,
      tailTokens: 16_000,
      sync: true,
    },
  ])('uses the effective post-activation gate: $name', async ({ name, observation, override, tailTokens, sync }) => {
    const threadId = `thread-effective-${name}`;
    const { storage, om, observerCall } = await setup(threadId, undefined, observation);
    const t0 = Date.now() - 60_000;
    const oldUser = msg('old-user', 'user', 'hello '.repeat(300), new Date(t0), threadId);
    const oldAssistant = msg('old-assistant', 'assistant', 'answer '.repeat(300), new Date(t0 + 1000), threadId);
    const newUser = msg('new-user', 'user', 'please run the tool', new Date(Date.now() - 1000), threadId);
    const tail = msg('unbuffered-tail', 'assistant', 'data '.repeat(tailTokens), new Date(), threadId);
    await storage.saveMessages({ messages: [oldUser, oldAssistant] });
    const record = await om.getOrCreateRecord(threadId, resourceId);
    if (override) await om.updateRecordConfig(threadId, resourceId, { observation: { messageTokens: override } });
    await addChunk(storage, record.id, 'cycle-a', ['old-user', 'old-assistant'], 600, oldAssistant.createdAt);
    const messageList = new MessageList({ threadId, resourceId });
    messageList.add([oldUser, oldAssistant], 'memory');
    messageList.add(newUser, 'input');
    messageList.add(tail, 'response');
    const turn = om.beginTurn({ threadId, resourceId, messageList });
    await turn.start();
    const ctx = await turn.step(1).prepare();
    expect(ctx.observed).toBe(true);
    expect(ctx.status.threshold).toBe(override ?? 10_000);
    expect(observerCall).toHaveBeenCalledTimes(sync ? 1 : 0);
    if (sync) expect(observerCall.mock.calls[0]![1].map(m => m.id).sort()).toEqual(['new-user', 'unbuffered-tail']);
    else expect(messageList.get.all.db().map(m => m.id)).toEqual(['new-user', 'unbuffered-tail']);
    const after = await storage.getObservationalMemory(threadId, resourceId);
    expect(after?.lastObservedAt).toEqual(sync ? tail.createdAt : oldAssistant.createdAt);
  });

  it('uses the reflected generation when deferring an activated tail into the async band', async () => {
    const threadId = 'thread-band-reflection';
    const { storage, om, observerCall } = await setup(threadId);
    const resetSpy = vi.spyOn(om, 'resetBufferingState');
    const reflectionCall = vi.spyOn(om.reflector, 'call').mockRejectedValue(new Error('unexpected reflection call'));
    const t0 = Date.now() - 60_000;
    const oldUser = msg('old-user', 'user', 'hello '.repeat(300), new Date(t0), threadId);
    const oldAssistant = msg('old-assistant', 'assistant', 'answer '.repeat(300), new Date(t0 + 1000), threadId);
    const newUser = msg('new-user', 'user', 'please run the tool', new Date(Date.now() - 1000), threadId);
    const tail = msg('unbuffered-tail', 'assistant', 'data '.repeat(11_000), new Date(), threadId);
    await storage.saveMessages({ messages: [oldUser, oldAssistant] });
    const record = await om.getOrCreateRecord(threadId, resourceId);
    await storage.updateActiveObservations({
      id: record.id,
      observations: '- existing observations',
      tokenCount: 49_990,
      lastObservedAt: new Date(t0 - 1000),
    });
    await storage.updateBufferedReflection({
      id: record.id,
      reflection: '- reflected observations',
      tokenCount: 10,
      inputTokenCount: 49_990,
      reflectedObservationLineCount: 1,
    });
    await addChunk(storage, record.id, 'cycle-a', ['old-user', 'old-assistant'], 600, new Date(t0 + 1000));
    const messageList = new MessageList({ threadId, resourceId });
    messageList.add([oldUser, oldAssistant], 'memory');
    messageList.add(newUser, 'input');
    messageList.add(tail, 'response');
    const turn = om.beginTurn({ threadId, resourceId, messageList });
    await turn.start();
    const ctx = await turn.step(1).prepare();
    const finalRecord = await storage.getObservationalMemory(threadId, resourceId);
    expect(finalRecord?.generationCount).toBe(record.generationCount + 1);
    expect(turn.record.id).toBe(finalRecord?.id);
    expect(resetSpy).toHaveBeenCalledWith(expect.objectContaining({ recordId: finalRecord?.id }));
    expect(ctx.reflected).toBe(true);
    expect(ctx.status.pendingTokens).toBeGreaterThan(10_000);
    expect(ctx.status.pendingTokens).toBeLessThan(12_000);
    expect(messageList.get.all.db().map(m => m.id)).toEqual(['new-user', 'unbuffered-tail']);
    expect(finalRecord?.lastObservedAt).toEqual(new Date(t0 + 1000));
    expect(observerCall).not.toHaveBeenCalled();
    expect(reflectionCall).not.toHaveBeenCalled();
    await turn.step(2).prepare();
    await om.waitForBuffering(threadId, resourceId);
    const afterBuffer = await storage.getObservationalMemory(threadId, resourceId);
    expect(afterBuffer?.id).toBe(finalRecord?.id);
    expect(afterBuffer?.bufferedObservationChunks?.flatMap(chunk => chunk.messageIds).sort()).toEqual([
      'new-user',
      'unbuffered-tail',
    ]);
  });

  it('observes past a stalled first buffer write at blockAfter, and storage skips the late chunk it covered', async () => {
    const threadId = 'thread-first-write-timeout';
    const { storage, om, observerCall, swapSpy } = await setup(threadId);
    const t0 = Date.now() - 60_000;
    const oldUser = msg('old-user', 'user', 'hello '.repeat(300), new Date(t0), threadId);
    const oldAssistant = msg('old-assistant', 'assistant', 'answer '.repeat(300), new Date(t0 + 1000), threadId);
    const newUser = msg('new-user', 'user', 'please run the tool', new Date(Date.now() - 1000), threadId);
    const tail = msg('unbuffered-tail', 'assistant', 'data '.repeat(30_000), new Date(), threadId);
    await storage.saveMessages({ messages: [oldUser, oldAssistant] });
    const record = await om.getOrCreateRecord(threadId, resourceId);
    const messageList = new MessageList({ threadId, resourceId });
    messageList.add([oldUser, oldAssistant], 'memory');
    messageList.add(newUser, 'input');
    messageList.add(tail, 'response');
    const turn = om.beginTurn({ threadId, resourceId, messageList });
    await turn.start();
    let releaseObserver!: () => void;
    let observerEntered!: () => void;
    const heldObserver = new Promise<void>(resolve => {
      releaseObserver = resolve;
    });
    const entered = new Promise<void>(resolve => {
      observerEntered = resolve;
    });
    observerCall.mockImplementationOnce(async () => {
      observerEntered();
      await heldObserver;
      return { observations: '* buffered prefix', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } as any;
    });
    const buffering = om.buffer({
      threadId,
      resourceId,
      messages: [oldUser, oldAssistant],
      skipMinimumTokenCheck: true,
    });
    await entered;
    const key = `obs:thread:${threadId}`;
    expect(BufferingCoordinator.pendingChunkWrites.has(key)).toBe(true);
    expect((await storage.getObservationalMemory(threadId, resourceId))?.bufferedObservationChunks ?? []).toHaveLength(
      0,
    );
    vi.useFakeTimers();
    try {
      // At/above blockAfter the step can't wait out a stalled Observer: it sync-observes
      // everything unobserved, including the messages the stalled op is buffering.
      const preparing = turn.step(1).prepare();
      await vi.advanceTimersByTimeAsync(30_001);
      const ctx = await preparing;
      expect(ctx.observed).toBe(true);
      expect(swapSpy).not.toHaveBeenCalled();
      expect(observerCall).toHaveBeenCalledTimes(2);
      expect(observerCall.mock.calls[1]![1].map(m => m.id).sort()).toEqual([
        'new-user',
        'old-assistant',
        'old-user',
        'unbuffered-tail',
      ]);
      const observed = await storage.getObservationalMemory(threadId, resourceId);
      expect(observed?.lastObservedAt).toEqual(tail.createdAt);
      expect(observed?.activeObservations).toContain('* observed tail');

      // The stalled op's chunk then lands wholly behind the cursor: storage skips it,
      // so nothing is buffered twice and the record stays on the same generation.
      releaseObserver();
      await buffering;
      vi.useRealTimers();
      expect(BufferingCoordinator.pendingChunkWrites.has(key)).toBe(false);
      const afterWrite = await storage.getObservationalMemory(threadId, resourceId);
      expect(afterWrite?.id).toBe(record.id);
      expect(afterWrite?.bufferedObservationChunks ?? []).toHaveLength(0);
      expect(afterWrite?.activeObservations).not.toContain('* buffered prefix');
      expect(afterWrite?.lastObservedAt).toEqual(tail.createdAt);

      await turn.step(2).prepare();
      expect(swapSpy).not.toHaveBeenCalled();
      expect(observerCall).toHaveBeenCalledTimes(2);
    } finally {
      releaseObserver();
      await buffering;
      vi.useRealTimers();
    }
  });

  it('does not wait when a chunk write starts after the in-band step precheck', async () => {
    const threadId = 'thread-band-precheck-race';
    const { storage, om, observerCall, swapSpy } = await setup(threadId);
    const t0 = Date.now() - 60_000;
    const oldUser = msg('old-user', 'user', 'hello '.repeat(300), new Date(t0), threadId);
    const oldAssistant = msg('old-assistant', 'assistant', 'answer '.repeat(300), new Date(t0 + 1000), threadId);
    const newUser = msg('new-user', 'user', 'please run the tool', new Date(Date.now() - 1000), threadId);
    const tail = msg('unbuffered-tail', 'assistant', 'data '.repeat(11_000), new Date(), threadId);
    await storage.saveMessages({ messages: [oldUser, oldAssistant] });
    const record = await om.getOrCreateRecord(threadId, resourceId);
    await addChunk(storage, record.id, 'cycle-a', ['old-user', 'old-assistant'], 600, oldAssistant.createdAt);
    const messageList = new MessageList({ threadId, resourceId });
    messageList.add([oldUser, oldAssistant], 'memory');
    messageList.add(newUser, 'input');
    messageList.add(tail, 'response');
    const turn = om.beginTurn({ threadId, resourceId, messageList });
    await turn.start();
    let releaseWrite: (() => void) | undefined;
    const persistMessages = om.persistMessages.bind(om);
    vi.spyOn(om, 'persistMessages').mockImplementationOnce(async (...args) => {
      const result = await persistMessages(...args);
      releaseWrite = BufferingCoordinator.trackChunkWrite(`obs:thread:${threadId}`);
      return result;
    });
    vi.useFakeTimers();
    let prepared: Promise<unknown> | undefined;
    try {
      let completed = false;
      prepared = turn
        .step(1)
        .prepare()
        .then(ctx => {
          completed = true;
          return ctx;
        });
      await vi.advanceTimersByTimeAsync(1);
      expect(releaseWrite).toBeDefined();
      // In the band, activation takes the stored chunk without waiting on the write.
      expect(completed).toBe(true);
      expect(observerCall).not.toHaveBeenCalled();
      expect(swapSpy).toHaveBeenCalledTimes(1);
      expect(messageList.get.all.db().map(m => m.id)).toEqual(['new-user', 'unbuffered-tail']);
      const activated = await storage.getObservationalMemory(threadId, resourceId);
      expect(activated?.activeObservations).toContain('cycle-a observation');
      expect(activated?.lastObservedAt).toEqual(oldAssistant.createdAt);
    } finally {
      releaseWrite?.();
      await vi.advanceTimersByTimeAsync(60_000);
      await prepared;
      vi.useRealTimers();
    }
  });

  it.each([false, true])(
    'proceeds past a stalled chunk write at blockAfter without losing or duplicating coverage (prior activation: %s)',
    async priorActivation => {
      const threadId = `thread-timeout-recovery-${priorActivation}`;
      const { storage, om, observerCall, swapSpy } = await setup(threadId, 'continue');
      const swapCursors: number[] = [];
      const swapBufferedToActive = InMemoryMemory.prototype.swapBufferedToActive.bind(storage);
      swapSpy.mockImplementation(async input => {
        const result = await swapBufferedToActive(input);
        const updated = await storage.getObservationalMemory(threadId, resourceId);
        swapCursors.push(updated!.lastObservedAt!.getTime());
        return result;
      });
      const t0 = Date.now() - 60_000;
      const oldUser = msg('old-user', 'user', 'hello '.repeat(300), new Date(t0), threadId);
      const oldAssistant = msg('old-assistant', 'assistant', 'answer '.repeat(300), new Date(t0 + 1000), threadId);
      const middle = msg('middle-buffered', 'assistant', 'middle '.repeat(300), new Date(t0 + 2000), threadId);
      const late = msg('late-buffered', 'assistant', 'late '.repeat(300), new Date(t0 + 3000), threadId);
      const newUser = msg('new-user', 'user', 'please run the tool', new Date(Date.now() - 1000), threadId);
      const tail = msg('unbuffered-tail', 'assistant', 'data '.repeat(30_000), new Date(), threadId);
      await storage.saveMessages({ messages: [oldUser, oldAssistant, middle, late] });
      const record = await om.getOrCreateRecord(threadId, resourceId);
      await addChunk(storage, record.id, 'cycle-a', ['old-user', 'old-assistant'], 600, oldAssistant.createdAt);
      await storage.setPendingMessageTokens(record.id, 1200);
      const messageList = new MessageList({ threadId, resourceId });
      messageList.add([oldUser, oldAssistant, middle, late], 'memory');
      messageList.add(newUser, 'input');
      messageList.add(tail, 'response');
      const turn = om.beginTurn({ threadId, resourceId, messageList });
      await turn.start();

      const key = `obs:thread:${threadId}`;
      let finishWrite!: () => void;
      let pendingWrite: Promise<void> | undefined;
      const startWrite = () => {
        const releaseWrite = BufferingCoordinator.trackChunkWrite(key);
        const gate = new Promise<void>(resolve => {
          finishWrite = resolve;
        });
        pendingWrite = gate.then(async () => {
          try {
            await addChunk(storage, record.id, 'cycle-late', ['late-buffered'], 300, late.createdAt);
          } finally {
            releaseWrite();
          }
        });
        BufferingCoordinator.asyncBufferingOps.set(key, pendingWrite);
      };
      if (priorActivation) {
        const activate = om.activate.bind(om);
        vi.spyOn(om, 'activate').mockImplementationOnce(async opts => {
          const result = await activate(opts);
          expect(result.activated).toBe(true);
          await addChunk(storage, record.id, 'cycle-middle', ['middle-buffered'], 300, middle.createdAt);
          startWrite();
          result.record = await om.getOrCreateRecord(threadId, resourceId);
          return result;
        });
      } else {
        await addChunk(storage, record.id, 'cycle-middle', ['middle-buffered'], 300, middle.createdAt);
        startWrite();
      }

      vi.useFakeTimers();
      try {
        // At/above blockAfter, activation waits (bounded) for the in-process write, then
        // activates the stored chunks and the step sync-observes everything still unobserved,
        // including the message the stalled write was buffering.
        const prepared = turn.step(1).prepare();
        await vi.advanceTimersByTimeAsync(90_001);
        const ctx = await prepared;
        expect(ctx.observed).toBe(true);
        expect(swapSpy).toHaveBeenCalledTimes(priorActivation ? 2 : 1);
        expect(observerCall).toHaveBeenCalledTimes(1);
        expect(observerCall.mock.calls[0]![1].map(m => m.id).sort()).toEqual([
          'late-buffered',
          'new-user',
          'unbuffered-tail',
        ]);
        const observed = await storage.getObservationalMemory(threadId, resourceId);
        expect(observed?.lastObservedAt).toEqual(tail.createdAt);
        expect(observed?.bufferedObservationChunks ?? []).toHaveLength(0);
        expect(observed?.activeObservations).toContain('cycle-a observation');
        expect(observed?.activeObservations).toContain('cycle-middle observation');
        expect(observed?.activeObservations).toContain('* observed tail');

        // The stalled chunk lands behind the cursor: storage skips it instead of buffering
        // late-buffered a second time.
        finishWrite();
        await pendingWrite;
        BufferingCoordinator.asyncBufferingOps.delete(key);
        vi.useRealTimers();
        const afterWrite = await storage.getObservationalMemory(threadId, resourceId);
        expect(afterWrite?.bufferedObservationChunks ?? []).toHaveLength(0);
        expect(afterWrite?.lastObservedAt).toEqual(tail.createdAt);

        const next = await turn.step(2).prepare();
        expect(next.observed).toBe(false);
        expect(observerCall).toHaveBeenCalledTimes(1);
        const finalRecord = await storage.getObservationalMemory(threadId, resourceId);
        expect(finalRecord?.activeObservations).not.toContain('cycle-late observation');
        expect(swapCursors).toEqual([...swapCursors].sort((a, b) => a - b));
        expect(swapCursors.at(-1)).toBe(middle.createdAt.getTime());
        expect(finalRecord!.lastObservedAt!.getTime()).toBeGreaterThan(swapCursors.at(-1)!);
      } finally {
        finishWrite();
        await pendingWrite;
        BufferingCoordinator.asyncBufferingOps.delete(key);
        vi.useRealTimers();
      }
    },
  );

  it('observes the unbuffered tail when activation leaves pending tokens above the threshold', async () => {
    const threadId = 'thread-tail';
    const { storage, om, observerCall, swapSpy } = await setup(threadId);

    const t0 = Date.now() - 60_000;
    const oldUser = msg('old-user', 'user', 'hello '.repeat(300), new Date(t0), threadId);
    const oldAssistant = msg('old-assistant', 'assistant', 'answer '.repeat(300), new Date(t0 + 1000), threadId);
    const newUser = msg('new-user', 'user', 'please run the tool', new Date(Date.now() - 1000), threadId);
    const bigToolResult = msg('big-tool-result', 'assistant', 'data '.repeat(30_000), new Date(), threadId);
    await storage.saveMessages({ messages: [oldUser, oldAssistant] });

    const record = await om.getOrCreateRecord(threadId, resourceId);
    await addChunk(storage, record.id, 'cycle-a', ['old-user', 'old-assistant'], 600, new Date(t0 + 1000));
    // Persisted by the previous step — does not include this step's tool result.
    await storage.setPendingMessageTokens(record.id, 600);

    const messageList = new MessageList({ threadId, resourceId });
    messageList.add([oldUser, oldAssistant], 'memory');
    messageList.add(newUser, 'input');
    messageList.add(bigToolResult, 'response');

    const turn = om.beginTurn({ threadId, resourceId, messageList });
    await turn.start();
    const ctx = await turn.step(1).prepare();

    // Activation is sized from the live pending count, not the previous step's.
    expect(swapSpy).toHaveBeenCalledTimes(1);
    expect(swapSpy.mock.calls[0]![0].currentPendingTokens).toBeGreaterThan(30_000);

    // The buffered chunk activated, then the unbuffered tail was observed synchronously.
    expect(observerCall).toHaveBeenCalledTimes(1);
    const observedIds = observerCall.mock.calls[0]![1].map(m => m.id);
    expect(observedIds.sort()).toEqual(['big-tool-result', 'new-user']);

    expect(ctx.observed).toBe(true);
    expect(ctx.status.shouldObserve).toBe(false);
    expect(ctx.status.pendingTokens).toBeLessThan(ctx.status.threshold);
    // Older history is compacted; the newest observed message stays as the retention floor.
    expect(messageList.get.all.db().map(m => m.id)).toEqual(['big-tool-result']);

    const finalRecord = await storage.getObservationalMemory(threadId, resourceId);
    expect(finalRecord?.activeObservations).toContain('cycle-a observation');
    expect(finalRecord?.activeObservations).toContain('* observed tail');
    expect(finalRecord?.bufferedObservationChunks ?? []).toHaveLength(0);
  });

  it('keeps the unobserved tail pending when continue policy absorbs its observer failure', async () => {
    const threadId = 'thread-tail-failure-continue';
    const { storage, om, observerCall, swapSpy } = await setup(threadId, 'continue');
    observerCall.mockRejectedValue(
      new OmModelExecutionError('observer-model', new Error('observer unavailable after activation')),
    );

    const t0 = Date.now() - 60_000;
    const oldUser = msg('old-user', 'user', 'hello '.repeat(300), new Date(t0), threadId);
    const oldAssistant = msg('old-assistant', 'assistant', 'answer '.repeat(300), new Date(t0 + 1000), threadId);
    const newUser = msg('new-user', 'user', 'please run the tool', new Date(Date.now() - 1000), threadId);
    const bigToolResult = msg('big-tool-result', 'assistant', 'data '.repeat(30_000), new Date(), threadId);
    await storage.saveMessages({ messages: [oldUser, oldAssistant] });

    const record = await om.getOrCreateRecord(threadId, resourceId);
    await addChunk(storage, record.id, 'cycle-a', ['old-user', 'old-assistant'], 600, new Date(t0 + 1000));
    await storage.setPendingMessageTokens(record.id, 600);

    const messageList = new MessageList({ threadId, resourceId });
    messageList.add([oldUser, oldAssistant], 'memory');
    messageList.add(newUser, 'input');
    messageList.add(bigToolResult, 'response');

    const turn = om.beginTurn({ threadId, resourceId, messageList });
    await turn.start();
    const ctx = await turn.step(1).prepare();

    expect(swapSpy).toHaveBeenCalledTimes(1);
    expect(swapSpy.mock.calls[0]![0].currentPendingTokens).toBeGreaterThan(30_000);
    expect(observerCall).toHaveBeenCalledTimes(1);
    expect(ctx.observed).toBe(true);
    expect(ctx.status.shouldObserve).toBe(true);
    expect(messageList.get.all.db().map(message => message.id)).toEqual(['new-user', 'big-tool-result']);

    const finalRecord = await storage.getObservationalMemory(threadId, resourceId);
    expect(finalRecord?.activeObservations).toContain('cycle-a observation');
    expect(finalRecord?.activeObservations).not.toContain('* observed tail');
    expect(finalRecord?.bufferedObservationChunks ?? []).toHaveLength(0);
    expect(finalRecord?.observedMessageIds ?? []).not.toContain('new-user');
    expect(finalRecord?.observedMessageIds ?? []).not.toContain('big-tool-result');
    expect(finalRecord?.pendingMessageTokens).toBeGreaterThan(10_000);
  });

  it('activates every remaining chunk before observing so no message is observed twice', async () => {
    const threadId = 'thread-remaining-chunks';
    const { storage, om, observerCall, swapSpy } = await setup(threadId);

    const t0 = Date.now() - 60_000;
    const aUser = msg('a-user', 'user', 'hello '.repeat(1500), new Date(t0), threadId);
    const aAssistant = msg('a-assistant', 'assistant', 'answer '.repeat(1500), new Date(t0 + 1000), threadId);
    const bUser = msg('b-user', 'user', 'again '.repeat(1500), new Date(t0 + 2000), threadId);
    const bAssistant = msg('b-assistant', 'assistant', 'reply '.repeat(1500), new Date(t0 + 3000), threadId);
    const newUser = msg('new-user', 'user', 'please run the tool', new Date(Date.now() - 1000), threadId);
    const bigToolResult = msg('big-tool-result', 'assistant', 'data '.repeat(30_000), new Date(), threadId);
    await storage.saveMessages({ messages: [aUser, aAssistant, bUser, bAssistant] });

    const record = await om.getOrCreateRecord(threadId, resourceId);
    // Chunk weights recorded at buffer time overstate the live messages, so the
    // swap's overshoot safeguard activates only the first chunk on the first pass.
    await addChunk(storage, record.id, 'cycle-a', ['a-user', 'a-assistant'], 20_000, new Date(t0 + 1000));
    await addChunk(storage, record.id, 'cycle-b', ['b-user', 'b-assistant'], 20_000, new Date(t0 + 3000));
    await storage.setPendingMessageTokens(record.id, 6_000);

    const messageList = new MessageList({ threadId, resourceId });
    messageList.add([aUser, aAssistant, bUser, bAssistant], 'memory');
    messageList.add(newUser, 'input');
    messageList.add(bigToolResult, 'response');

    const turn = om.beginTurn({ threadId, resourceId, messageList });
    await turn.start();
    const ctx = await turn.step(1).prepare();

    expect(swapSpy).toHaveBeenCalledTimes(2);

    // The observer must only see messages no buffered chunk owns.
    expect(observerCall).toHaveBeenCalledTimes(1);
    const observedIds = observerCall.mock.calls[0]![1].map(m => m.id);
    expect(observedIds.sort()).toEqual(['big-tool-result', 'new-user']);

    const finalRecord = await storage.getObservationalMemory(threadId, resourceId);
    expect(finalRecord?.bufferedObservationChunks ?? []).toHaveLength(0);
    const active = finalRecord?.activeObservations ?? '';
    expect(active.indexOf('cycle-a observation')).toBeGreaterThanOrEqual(0);
    expect(active.indexOf('cycle-b observation')).toBeGreaterThan(active.indexOf('cycle-a observation'));
    expect(active.indexOf('* observed tail')).toBeGreaterThan(active.indexOf('cycle-b observation'));

    expect(ctx.status.shouldObserve).toBe(false);
    expect(ctx.status.pendingTokens).toBeLessThan(ctx.status.threshold);
    expect(messageList.get.all.db().map(m => m.id)).toEqual(['big-tool-result']);
  });

  it('does not run a synchronous observation when activation brings pending tokens under the threshold', async () => {
    const threadId = 'thread-activation-enough';
    const { storage, om, observerCall } = await setup(threadId);

    const t0 = Date.now() - 60_000;
    const aUser = msg('a-user', 'user', 'hello '.repeat(1500), new Date(t0), threadId);
    const aAssistant = msg('a-assistant', 'assistant', 'answer '.repeat(1500), new Date(t0 + 1000), threadId);
    const bUser = msg('b-user', 'user', 'again '.repeat(1500), new Date(t0 + 2000), threadId);
    const bAssistant = msg('b-assistant', 'assistant', 'reply '.repeat(1500), new Date(t0 + 3000), threadId);
    const newUser = msg('new-user', 'user', 'please '.repeat(1500), new Date(Date.now() - 1000), threadId);
    const toolResult = msg('tool-result', 'assistant', 'result '.repeat(3000), new Date(), threadId);
    await storage.saveMessages({ messages: [aUser, aAssistant, bUser, bAssistant] });

    const record = await om.getOrCreateRecord(threadId, resourceId);
    await addChunk(storage, record.id, 'cycle-a', ['a-user', 'a-assistant'], 3_000, new Date(t0 + 1000));
    await addChunk(storage, record.id, 'cycle-b', ['b-user', 'b-assistant'], 3_000, new Date(t0 + 3000));
    await storage.setPendingMessageTokens(record.id, 6_000);

    const messageList = new MessageList({ threadId, resourceId });
    messageList.add([aUser, aAssistant, bUser, bAssistant], 'memory');
    messageList.add(newUser, 'input');
    messageList.add(toolResult, 'response');

    const turn = om.beginTurn({ threadId, resourceId, messageList });
    await turn.start();
    const ctx = await turn.step(1).prepare();

    expect(ctx.observed).toBe(true);
    expect(observerCall).not.toHaveBeenCalled();
    expect(ctx.status.shouldObserve).toBe(false);
    expect(messageList.get.all.db().map(m => m.id)).toContain('tool-result');
  });
});
