/**
 * Harness v1 — `session.om.*` namespace (§4.2e).
 *
 * Covers:
 *   - resolution chain: SessionRecord override → HarnessConfig.omConfig
 *     default → built-in fallback (thresholds only) or `null` (model ids).
 *   - `switchObserverModel` / `switchReflectorModel` persist under the
 *     session lease and emit `om_model_changed`.
 *   - `getRecord` reads the underlying memory-storage row and returns the
 *     redacted public projection. Raw config / metadata / buffered fields
 *     never cross the boundary.
 *   - `getRecord` returns `null` when no record exists or when memory
 *     storage is not configured.
 *   - `loadProgress` is an advisory no-op.
 *   - every method throws `HarnessSessionClosedError` once the session is
 *     closed.
 *   - the namespace is frozen.
 */

import { describe, expect, it } from 'vitest';

import type { ObservationalMemoryRecord } from '../../storage/types';

import { setupHarness } from './__test-utils__';
import { HarnessSessionClosedError, HarnessValidationError } from './errors';
import type { OmModelChangedEvent } from './events';

async function seedRecord(
  harness: ReturnType<typeof setupHarness>['harness'],
  record: Partial<ObservationalMemoryRecord> & {
    id: string;
    threadId: string | null;
    resourceId: string;
  },
) {
  const memory = await harness._internalTryGetMemoryStorage();
  if (!memory) throw new Error('test setup expected memory storage');
  const full: ObservationalMemoryRecord = {
    id: record.id,
    scope: record.scope ?? 'thread',
    threadId: record.threadId,
    resourceId: record.resourceId,
    createdAt: record.createdAt ?? new Date('2026-05-01T00:00:00Z'),
    updatedAt: record.updatedAt ?? new Date('2026-05-01T00:00:00Z'),
    lastObservedAt: record.lastObservedAt,
    originType: record.originType ?? 'initial',
    generationCount: record.generationCount ?? 0,
    activeObservations: record.activeObservations ?? '',
    bufferedObservationChunks: record.bufferedObservationChunks,
    bufferedReflection: record.bufferedReflection,
    bufferedReflectionTokens: record.bufferedReflectionTokens,
    bufferedReflectionInputTokens: record.bufferedReflectionInputTokens,
    reflectedObservationLineCount: record.reflectedObservationLineCount,
    observedMessageIds: record.observedMessageIds,
    observedTimezone: record.observedTimezone,
    totalTokensObserved: record.totalTokensObserved ?? 0,
    observationTokenCount: record.observationTokenCount ?? 0,
    pendingMessageTokens: record.pendingMessageTokens ?? 0,
    isObserving: record.isObserving ?? false,
    isReflecting: record.isReflecting ?? false,
    isBufferingObservation: record.isBufferingObservation ?? false,
    isBufferingReflection: record.isBufferingReflection ?? false,
    lastBufferedAtTokens: record.lastBufferedAtTokens ?? 0,
    lastBufferedAtTime: record.lastBufferedAtTime ?? null,
    config: record.config ?? {},
    metadata: record.metadata,
  };
  await memory.insertObservationalMemoryRecord(full);
}

describe('session.om — resolution chain', () => {
  it('falls back to null for model ids and built-in defaults for thresholds when nothing is configured', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'r1', threadId: { fresh: true } });

    expect(session.om.getObserverModelId()).toBeNull();
    expect(session.om.getReflectorModelId()).toBeNull();
    expect(session.om.getObservationThreshold()).toBe(30_000);
    expect(session.om.getReflectionThreshold()).toBe(40_000);
  });

  it('uses HarnessConfig.omConfig defaults when no session override exists', async () => {
    const { harness } = setupHarness({
      omConfig: {
        defaultObserverModelId: 'openai/gpt-4o-mini',
        defaultReflectorModelId: 'anthropic/claude-3-5-haiku',
        defaultObservationThreshold: 12_345,
        defaultReflectionThreshold: 23_456,
      },
    });
    const session = await harness.session({ resourceId: 'r1', threadId: { fresh: true } });

    expect(session.om.getObserverModelId()).toBe('openai/gpt-4o-mini');
    expect(session.om.getReflectorModelId()).toBe('anthropic/claude-3-5-haiku');
    expect(session.om.getObservationThreshold()).toBe(12_345);
    expect(session.om.getReflectionThreshold()).toBe(23_456);
  });

  it('session override wins over harness defaults', async () => {
    const { harness } = setupHarness({
      omConfig: { defaultObserverModelId: 'fallback-obs', defaultReflectorModelId: 'fallback-ref' },
    });
    const session = await harness.session({ resourceId: 'r1', threadId: { fresh: true } });

    await session.om.switchObserverModel({ model: 'session-obs' });
    await session.om.switchReflectorModel({ model: 'session-ref' });

    expect(session.om.getObserverModelId()).toBe('session-obs');
    expect(session.om.getReflectorModelId()).toBe('session-ref');
  });
});

describe('session.om.switchObserverModel / switchReflectorModel', () => {
  it('persists the override on SessionRecord.observationalMemory', async () => {
    const { harness, storage } = setupHarness();
    const session = await harness.session({ resourceId: 'r1', threadId: { fresh: true } });

    await session.om.switchObserverModel({ model: 'obs-v1' });
    await session.om.switchReflectorModel({ model: 'ref-v1' });

    const stored = await storage.loadSession({ sessionId: session.id });
    expect(stored?.observationalMemory?.observerModelId).toBe('obs-v1');
    expect(stored?.observationalMemory?.reflectorModelId).toBe('ref-v1');
  });

  it('emits om_model_changed with the previous id', async () => {
    const { harness } = setupHarness({ omConfig: { defaultObserverModelId: 'old' } });
    const session = await harness.session({ resourceId: 'r1', threadId: { fresh: true } });
    const events: OmModelChangedEvent[] = [];
    session.subscribe(e => {
      if (e.type === 'om_model_changed') events.push(e);
    });

    await session.om.switchObserverModel({ model: 'new' });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'om_model_changed',
      role: 'observer',
      modelId: 'new',
      // previousModelId reflects what was on the record, not the harness
      // default — the record had no override yet.
      previousModelId: null,
    });
  });

  it('is a no-op when set to the same model already on the record', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'r1', threadId: { fresh: true } });
    await session.om.switchObserverModel({ model: 'same' });
    const v = session._internalRecordVersion;
    await session.om.switchObserverModel({ model: 'same' });
    expect(session._internalRecordVersion).toBe(v);
  });

  it('rejects non-string / empty model ids', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'r1', threadId: { fresh: true } });
    await expect(session.om.switchObserverModel({ model: '' })).rejects.toBeInstanceOf(HarnessValidationError);
    await expect(session.om.switchReflectorModel({ model: '' })).rejects.toBeInstanceOf(HarnessValidationError);
  });
});

describe('session.om.getRecord', () => {
  it('returns null when no record exists for the (thread, resource) pair', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'r1', threadId: { fresh: true } });
    expect(await session.om.getRecord()).toBeNull();
  });

  it('returns the redacted snapshot when a record exists', async () => {
    const { harness } = setupHarness({ omConfig: { defaultObserverModelId: 'obs', defaultReflectorModelId: 'ref' } });
    const session = await harness.session({ resourceId: 'r1', threadId: { fresh: true } });

    await seedRecord(harness, {
      id: 'om-1',
      threadId: session.threadId,
      resourceId: session.resourceId,
      scope: 'thread',
      activeObservations: 'observed text',
      totalTokensObserved: 100,
      observationTokenCount: 42,
      pendingMessageTokens: 7,
      isObserving: true,
      isReflecting: false,
      isBufferingObservation: false,
      isBufferingReflection: true,
      generationCount: 3,
      originType: 'reflection',
      lastObservedAt: new Date('2026-05-02T00:00:00Z'),
    });

    const snap = await session.om.getRecord();
    expect(snap).not.toBeNull();
    expect(snap).toMatchObject({
      id: 'om-1',
      scope: 'thread',
      threadId: session.threadId,
      resourceId: session.resourceId,
      activeObservations: 'observed text',
      totalTokensObserved: 100,
      observationTokenCount: 42,
      pendingMessageTokens: 7,
      isObserving: true,
      isReflecting: false,
      isBufferingObservation: false,
      isBufferingReflection: true,
      generationCount: 3,
      originType: 'reflection',
      observerModelId: 'obs',
      reflectorModelId: 'ref',
      observationThreshold: 30_000,
      reflectionThreshold: 40_000,
    });
    expect(typeof snap!.createdAt).toBe('number');
    expect(typeof snap!.updatedAt).toBe('number');
    expect(snap!.lastObservedAt).toBe(new Date('2026-05-02T00:00:00Z').getTime());
  });

  it('redacts raw config / metadata / buffered fields out of the snapshot', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'r1', threadId: { fresh: true } });

    await seedRecord(harness, {
      id: 'om-2',
      threadId: session.threadId,
      resourceId: session.resourceId,
      activeObservations: 'safe observation',
      config: { secret: 'do-not-leak', apiKey: 'sk-redact-me' },
      metadata: { internal: true },
      bufferedObservationChunks: [{ tokens: 1, observations: 'private', messageIds: ['m'] } as any],
      bufferedReflection: 'private reflection',
      observedMessageIds: ['m1', 'm2'],
    });

    const snap = (await session.om.getRecord())!;
    const allowed = new Set([
      'id',
      'scope',
      'resourceId',
      'threadId',
      'createdAt',
      'updatedAt',
      'lastObservedAt',
      'originType',
      'generationCount',
      'activeObservations',
      'totalTokensObserved',
      'observationTokenCount',
      'pendingMessageTokens',
      'isObserving',
      'isReflecting',
      'isBufferingObservation',
      'isBufferingReflection',
      'observerModelId',
      'reflectorModelId',
      'observationThreshold',
      'reflectionThreshold',
    ]);
    for (const key of Object.keys(snap)) {
      expect(allowed.has(key)).toBe(true);
    }
    // No leak of raw fields.
    expect((snap as any).config).toBeUndefined();
    expect((snap as any).metadata).toBeUndefined();
    expect((snap as any).bufferedObservationChunks).toBeUndefined();
    expect((snap as any).bufferedReflection).toBeUndefined();
    expect((snap as any).observedMessageIds).toBeUndefined();
  });
});

describe('session.om.loadProgress', () => {
  it('resolves without side effects (advisory no-op)', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'r1', threadId: { fresh: true } });
    await expect(session.om.loadProgress()).resolves.toBeUndefined();
  });
});

describe('session.om — lifecycle + namespace shape', () => {
  it('namespace is frozen', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'r1', threadId: { fresh: true } });
    expect(Object.isFrozen(session.om)).toBe(true);
    expect(() => {
      (session.om as any).newMethod = () => {};
    }).toThrow();
  });

  it('every method throws HarnessSessionClosedError once the session is closed', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'r1', threadId: { fresh: true } });
    await session.close();

    expect(() => session.om.getObserverModelId()).toThrow(HarnessSessionClosedError);
    expect(() => session.om.getReflectorModelId()).toThrow(HarnessSessionClosedError);
    expect(() => session.om.getObservationThreshold()).toThrow(HarnessSessionClosedError);
    expect(() => session.om.getReflectionThreshold()).toThrow(HarnessSessionClosedError);
    await expect(session.om.switchObserverModel({ model: 'x' })).rejects.toBeInstanceOf(HarnessSessionClosedError);
    await expect(session.om.switchReflectorModel({ model: 'x' })).rejects.toBeInstanceOf(HarnessSessionClosedError);
    await expect(session.om.getRecord()).rejects.toBeInstanceOf(HarnessSessionClosedError);
    await expect(session.om.loadProgress()).rejects.toBeInstanceOf(HarnessSessionClosedError);
  });
});
