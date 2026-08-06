/**
 * OM marker persistence plumbing tests (#16523 Phase 1)
 *
 * streamMarker should prefer the live MessageList (marker lands on the pending
 * assistant response message) and fall back to the storage scan when no list is
 * provided or the list contains no assistant message. Markers must never land
 * on a user message.
 */

import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { describe, it, expect, vi } from 'vitest';

import { ObservationStrategy } from '../observation-strategies/base';
import type { StrategyDeps } from '../observation-strategies/base';
import type { ObservationRunOpts, ObserverOutput, ProcessedObservation } from '../observation-strategies/types';

const threadId = 'marker-thread';
const resourceId = 'marker-resource';

function makeUserMessage(id: string): MastraDBMessage {
  return {
    id,
    role: 'user',
    content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
    type: 'text',
    createdAt: new Date(),
    threadId,
    resourceId,
  };
}

function makeAssistantMessage(id: string): MastraDBMessage {
  return {
    id,
    role: 'assistant',
    content: { format: 2, parts: [{ type: 'text', text: 'Hi there' }] },
    type: 'text',
    createdAt: new Date(),
    threadId,
    resourceId,
  };
}

/** Minimal concrete strategy exposing the protected marker helpers under test. */
class TestStrategy extends ObservationStrategy {
  get needsLock() {
    return false;
  }
  get needsReflection() {
    return false;
  }
  get rethrowOnFailure() {
    return false;
  }
  async prepare(): Promise<{ messages: MastraDBMessage[]; existingObservations: string }> {
    return { messages: [], existingObservations: '' };
  }
  async observe(): Promise<ObserverOutput> {
    return { observations: '' };
  }
  async process(): Promise<ProcessedObservation> {
    throw new Error('not used');
  }
  async persist(): Promise<void> {}
  async emitStartMarkers(): Promise<void> {}
  async emitEndMarkers(): Promise<void> {}
  async emitFailedMarkers(): Promise<void> {}

  async testStreamMarker(marker: { type: string; data: unknown }) {
    await this.streamMarker(marker);
  }
}

function createHarness(opts: { messageList?: MessageList; storedMessages?: MastraDBMessage[] }) {
  const persistMessages = vi.fn().mockResolvedValue(undefined);
  const listMessages = vi.fn().mockResolvedValue({ messages: opts.storedMessages ?? [] });

  const deps = {
    storage: { listMessages },
    messageHistory: { persistMessages },
    tokenCounter: {},
    observationConfig: { messageTokens: 1000 },
    reflectionConfig: { observationTokens: 1000 },
    scope: 'thread',
    retrieval: false,
  } as unknown as StrategyDeps;

  const runOpts = {
    record: {} as ObservationRunOpts['record'],
    threadId,
    resourceId,
    messages: [],
    messageList: opts.messageList,
  } as ObservationRunOpts;

  return { strategy: new TestStrategy(deps, runOpts), persistMessages, listMessages };
}

const marker = { type: 'data-om-observation-start', data: { cycleId: 'cycle-1', threadId } };

describe('OM marker persistence plumbing', () => {
  it('persists the marker onto the last assistant message in a live MessageList (no storage scan)', async () => {
    const assistantMsg = makeAssistantMessage('assistant-1');
    const messageList = new MessageList({ threadId, resourceId });
    messageList.add([makeUserMessage('user-1'), assistantMsg], 'memory');

    const { strategy, persistMessages, listMessages } = createHarness({ messageList });
    await strategy.testStreamMarker(marker);

    // Marker landed on the live assistant message
    const liveAssistant = messageList.get.all.db().find(m => m.role === 'assistant');
    expect(liveAssistant?.content.parts).toContainEqual(marker);

    // Persisted to DB via messageHistory, not via the storage scan fallback
    expect(persistMessages).toHaveBeenCalledTimes(1);
    const persisted = persistMessages.mock.calls[0]![0].messages[0] as MastraDBMessage;
    expect(persisted.role).toBe('assistant');
    expect(persisted.id).toBe('assistant-1');
    expect(listMessages).not.toHaveBeenCalled();

    // User message untouched
    const liveUser = messageList.get.all.db().find(m => m.role === 'user');
    expect(liveUser?.content.parts.some((p: any) => p?.type === marker.type)).toBe(false);
  });

  it('falls back to the storage scan when no MessageList is provided', async () => {
    const storedAssistant = makeAssistantMessage('stored-assistant-1');
    const { strategy, persistMessages, listMessages } = createHarness({
      storedMessages: [storedAssistant, makeUserMessage('stored-user-1')],
    });

    await strategy.testStreamMarker(marker);

    expect(listMessages).toHaveBeenCalledTimes(1);
    expect(persistMessages).toHaveBeenCalledTimes(1);
    const persisted = persistMessages.mock.calls[0]![0].messages[0] as MastraDBMessage;
    expect(persisted.role).toBe('assistant');
    expect(persisted.id).toBe('stored-assistant-1');
    expect(persisted.content.parts).toContainEqual(marker);
  });

  it('falls back to the storage scan when the MessageList has no assistant message, never marking a user message', async () => {
    const userOnly = makeUserMessage('user-only-1');
    const messageList = new MessageList({ threadId, resourceId });
    messageList.add([userOnly], 'memory');

    const storedAssistant = makeAssistantMessage('stored-assistant-2');
    const { strategy, persistMessages, listMessages } = createHarness({
      messageList,
      storedMessages: [storedAssistant],
    });

    await strategy.testStreamMarker(marker);

    // Fallback used
    expect(listMessages).toHaveBeenCalledTimes(1);
    expect(persistMessages).toHaveBeenCalledTimes(1);
    const persisted = persistMessages.mock.calls[0]![0].messages[0] as MastraDBMessage;
    expect(persisted.role).toBe('assistant');

    // The live user message never received a marker part
    const liveUser = messageList.get.all.db().find(m => m.id === 'user-only-1');
    expect(liveUser?.content.parts.some((p: any) => p?.type === marker.type)).toBe(false);
  });

  it('does not duplicate a marker with the same cycleId on the assistant message', async () => {
    const assistantMsg = makeAssistantMessage('assistant-dedup');
    const messageList = new MessageList({ threadId, resourceId });
    messageList.add([assistantMsg], 'memory');

    const { strategy } = createHarness({ messageList });
    await strategy.testStreamMarker(marker);
    await strategy.testStreamMarker(marker);

    const liveAssistant = messageList.get.all.db().find(m => m.role === 'assistant');
    const markerParts = liveAssistant?.content.parts.filter((p: any) => p?.type === marker.type) ?? [];
    expect(markerParts).toHaveLength(1);
  });

  it('swallows a DB save failure after marking the live message and does NOT fall back to the storage scan', async () => {
    // Pins the deliberate swallow: the marker landed on the live message (the source of
    // truth for the in-flight turn), so a failed DB save must not trigger the storage
    // fallback — that would double-place the marker on a DIFFERENT stored message.
    const assistantMsg = makeAssistantMessage('assistant-db-fail');
    const messageList = new MessageList({ threadId, resourceId });
    messageList.add([assistantMsg], 'memory');

    const { strategy, persistMessages, listMessages } = createHarness({ messageList });
    persistMessages.mockRejectedValueOnce(new Error('db down'));

    await expect(strategy.testStreamMarker(marker)).resolves.toBeUndefined();

    // Marker still on the live message, no storage-scan fallback attempted.
    const liveAssistant = messageList.get.all.db().find(m => m.role === 'assistant');
    expect(liveAssistant?.content.parts).toContainEqual(marker);
    expect(listMessages).not.toHaveBeenCalled();
  });
});
