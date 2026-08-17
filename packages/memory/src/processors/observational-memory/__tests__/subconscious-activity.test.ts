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
    const atlas = await store.createNode({ name: 'Project Atlas', kind: 'project', scope: resourceScope });
    await store.appendItem({
      parentNodeId: atlas.id,
      text: '[[Project Atlas]] launches in January.',
      scope: resourceScope,
      sourceThreadId: 'alpha',
      resolutionScope: alphaScope,
      defaultScope: resourceScope,
    });
    await store.appendItem({
      parentNodeId: atlas.id,
      text: 'The private alpha code is cobalt.',
      scope: alphaScope,
      sourceThreadId: 'alpha',
      resolutionScope: alphaScope,
      defaultScope: resourceScope,
    });
    const secret = await store.createNode({ name: 'Alpha Secret', kind: 'note', scope: alphaScope });
    const sharedSecretItem = await store.appendItem({
      parentNodeId: secret.id,
      text: 'A shared policy exists.',
      scope: resourceScope,
      sourceThreadId: 'alpha',
      resolutionScope: alphaScope,
      defaultScope: alphaScope,
    });

    const snapshot = await buildSubconsciousActivitySnapshot({ store, scope: betaScope, recentUpdates: 10 });

    expect(snapshot.updates.map(update => update.name)).toContain('Project Atlas');
    expect(snapshot.updates.map(update => update.name)).not.toContain('Alpha Secret');
    expect(snapshot.updates.some(update => update.type === 'item' && !('name' in update))).toBe(true);
    expect(snapshot.updates).toHaveLength(3);
    expect(snapshot.updates.every(update => !('recordId' in update) && !('targetId' in update))).toBe(true);
    expect(snapshot.updates.every(update => !('sourceThreadId' in update))).toBe(true);
    expect(snapshot.hot.every(record => !('id' in record))).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain(sharedSecretItem.id);
    expect(JSON.stringify(snapshot)).not.toContain(secret.id);
  });

  it('does not expose names after an activity target moves outside the visible scope', async () => {
    const store = await createStore();
    const secret = await store.createNode({ name: 'Moved secret', kind: 'note', scope: resourceScope });
    await store.updateNode({ id: secret.id, version: secret.version, scope: alphaScope });
    const document = await store.createNode({
      name: 'Moved document',
      kind: 'document',
      content: 'Private notes',
      scope: resourceScope,
    });
    await store.updateNode({ id: document.id, version: document.version, scope: alphaScope });

    const snapshot = await buildSubconsciousActivitySnapshot({ store, scope: betaScope, recentUpdates: 10 });

    expect(snapshot.updates).toHaveLength(2);
    expect(snapshot.updates.every(update => update.type === 'node' && !('name' in update))).toBe(true);
    expect(snapshot.hot.map(record => record.name)).not.toContain('Moved secret');
    expect(snapshot.hot.map(record => record.name)).not.toContain('Moved document');
    expect(JSON.stringify(snapshot)).not.toContain(secret.id);
    expect(JSON.stringify(snapshot)).not.toContain(document.id);
    expect(renderSubconsciousActivity(snapshot)).not.toContain(secret.id);
    expect(renderSubconsciousActivity(snapshot)).not.toContain(document.id);
  });

  it('bounds updates and hot records, renders errors, and generates stable cache keys', async () => {
    const store = await createStore();
    for (let index = 0; index < 5; index++) {
      await store.createNode({ name: `Node ${index}`, kind: 'note', scope: resourceScope });
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
