/**
 * Threshold observation after partial buffered activation (#19767).
 *
 * Buffering stops once pending tokens reach the observation threshold, so the
 * content that pushes a step over the threshold (typically a large tool-result
 * batch) is never part of a buffered chunk. Activating chunks can therefore
 * leave the context above the threshold. These tests drive a real
 * ObservationalMemory + in-memory storage through `turn.step(n).prepare()` and
 * assert the step does not hand an over-threshold context to the model.
 */

import type { MastraDBMessage } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, it, expect, vi } from 'vitest';

import { ObservationalMemory } from '../observational-memory';

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

async function setup(threadId: string) {
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
