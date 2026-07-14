import type { ProcessorContext } from '@mastra/core/processors';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import {
  buildSubconsciousActivitySnapshot,
  publishSubconsciousActivity,
  renderSubconsciousActivity,
  SUBCONSCIOUS_ACTIVITY_STATE_ID,
} from '../subconscious';

const resourceScope = ['org:acme', 'resource:user-42'];
const alphaScope = [...resourceScope, 'thread:alpha'];
const betaScope = [...resourceScope, 'thread:beta'];

async function createStore() {
  const storage = new InMemoryStore();
  return (await storage.getStore('knowledge'))!;
}

describe('Subconscious activity', () => {
  it('returns bounded ancestor-visible activity without sibling thread-private updates', async () => {
    const store = await createStore();
    const atlas = await store.createEntity({ name: 'Project Atlas', kind: 'project', scope: resourceScope });
    await store.appendFact({
      parentEntityId: atlas.id,
      text: '[[Project Atlas]] launches in January.',
      scope: resourceScope,
      sourceThreadId: 'alpha',
      resolutionScope: alphaScope,
      defaultScope: resourceScope,
    });
    await store.appendFact({
      parentEntityId: atlas.id,
      text: 'The private alpha code is cobalt.',
      scope: alphaScope,
      sourceThreadId: 'alpha',
      resolutionScope: alphaScope,
      defaultScope: resourceScope,
    });
    const secret = await store.createEntity({ name: 'Alpha Secret', kind: 'note', scope: alphaScope });
    const sharedSecretFact = await store.appendFact({
      parentEntityId: secret.id,
      text: 'A shared policy exists.',
      scope: resourceScope,
      sourceThreadId: 'alpha',
      resolutionScope: alphaScope,
      defaultScope: alphaScope,
    });

    const snapshot = await buildSubconsciousActivitySnapshot({ store, scope: betaScope, recentUpdates: 10 });

    expect(snapshot.updates.map(update => update.name)).toContain('Project Atlas');
    expect(snapshot.updates.map(update => update.name)).not.toContain('Alpha Secret');
    expect(snapshot.updates.some(update => update.sourceThreadId === 'alpha')).toBe(true);
    expect(snapshot.updates.some(update => update.recordId !== atlas.id && update.type === 'fact')).toBe(true);
    expect(snapshot.updates).toContainEqual(
      expect.objectContaining({ recordId: sharedSecretFact.id, type: 'fact', name: undefined }),
    );
    expect(snapshot.updates).toHaveLength(3);
  });

  it('bounds updates and hot records, renders errors, and generates stable cache keys', async () => {
    const store = await createStore();
    for (let index = 0; index < 5; index++) {
      await store.createEntity({ name: `Entity ${index}`, kind: 'note', scope: resourceScope });
    }
    const cache = new Map<string, string>();
    let emissions = 0;
    const sendStateSignal = vi.fn<NonNullable<ProcessorContext['sendStateSignal']>>(async signal => {
      if (cache.get(signal.id!) === signal.cacheKey) return { skipped: true, reason: 'unchanged' };
      cache.set(signal.id!, signal.cacheKey);
      emissions += 1;
      return { skipped: false } as any;
    });

    const first = await publishSubconsciousActivity({
      store,
      scope: alphaScope,
      recentUpdates: 3,
      sendStateSignal,
      errors: ['capture failed'],
    });
    const second = await publishSubconsciousActivity({
      store,
      scope: alphaScope,
      recentUpdates: 3,
      sendStateSignal,
      errors: ['capture failed'],
    });

    expect(first?.updates).toHaveLength(3);
    expect(first?.hot).toHaveLength(3);
    expect(first?.errors).toEqual(['capture failed']);
    expect(renderSubconsciousActivity(first!)).toContain('Errors:\n- capture failed');
    expect(sendStateSignal).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: SUBCONSCIOUS_ACTIVITY_STATE_ID,
        mode: 'snapshot',
        tagName: 'state',
        attributes: { id: SUBCONSCIOUS_ACTIVITY_STATE_ID },
      }),
    );
    expect(sendStateSignal.mock.calls[0]?.[0].cacheKey).toBe(sendStateSignal.mock.calls[1]?.[0].cacheKey);
    expect(emissions).toBe(1);
    expect(second).toEqual(first);
  });
});
