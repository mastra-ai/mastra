import { Knowledge } from '@mastra/core/knowledge';
import type { ProcessorContext } from '@mastra/core/processors';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import {
  buildSubconsciousActivitySnapshot,
  publishSubconsciousActivity,
  renderSubconsciousActivity,
  SUBCONSCIOUS_ACTIVITY_STATE_ID,
} from '../subconscious';

const resourceScope = ['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'];
const alphaScope = [...resourceScope, '10000000-0000-4000-8000-000000000003'];
const betaScope = [...resourceScope, '10000000-0000-4000-8000-000000000004'];

async function createStore() {
  const storage = new InMemoryStore();
  const store = (await storage.getStore('knowledge'))!;
  await store.createNode({ id: resourceScope[0], name: 'Acme', isScope: true, scopeIds: [] });
  await store.createNode({ id: resourceScope[1], name: 'User 42', isScope: true, scopeIds: [resourceScope[0]!] });
  await store.createNode({ id: alphaScope[2], name: 'Thread alpha', isScope: true, scopeIds: [resourceScope[1]!] });
  await store.createNode({ id: betaScope[2], name: 'Thread beta', isScope: true, scopeIds: [resourceScope[1]!] });
  // Sessions read with ordinary authority: resource and thread rungs own themselves; the org rung is never vouched.
  for (const scopeId of [resourceScope[1]!, alphaScope[2]!, betaScope[2]!])
    await store.upsertScopeGrant({ scopeNodeId: scopeId, scopeRefId: scopeId, role: 'owner' });
  return Object.assign(store, { knowledge: new Knowledge({ id: 'default', storage }) });
}

describe('Subconscious activity', () => {
  it('returns bounded ancestor-visible activity without sibling thread-private updates', async () => {
    const store = await createStore();
    const atlas = await store.createNode({
      name: 'Project Atlas',
      kind: 'project',
      scopeIds: [resourceScope.at(-1)!],
      contextScopeId: resourceScope.at(-1),
    });
    await store.createRecord({
      node: atlas.id,
      text: '[[Project Atlas]] launches in January.',
      scopeIds: [resourceScope.at(-1)!],
      source: 'alpha',
      contextScopeId: resourceScope.at(-1),
    });
    await store.createRecord({
      node: atlas.id,
      text: 'The private alpha code is cobalt.',
      scopeIds: [alphaScope.at(-1)!],
      source: 'alpha',
      contextScopeId: alphaScope.at(-1),
    });
    const secret = await store.createNode({
      name: 'Alpha Secret',
      kind: 'note',
      scopeIds: [alphaScope.at(-1)!],
      contextScopeId: alphaScope.at(-1),
    });
    const sharedSecretRecord = await store.createRecord({
      node: secret.id,
      text: 'A shared policy exists.',
      scopeIds: [resourceScope.at(-1)!],
      source: 'alpha',
      contextScopeId: resourceScope.at(-1),
    });

    const snapshot = await buildSubconsciousActivitySnapshot({
      knowledge: store.knowledge,
      scopeIds: betaScope,
      recentUpdates: 10,
    });

    expect(snapshot.updates.map(update => update.name)).toContain('Project Atlas');
    expect(snapshot.updates.map(update => update.name)).not.toContain('Alpha Secret');
    expect(snapshot.updates.some(update => update.type === 'record' && update.name === 'Project Atlas')).toBe(true);
    expect(snapshot.updates).toHaveLength(2);
    expect(snapshot.updates.every(update => !('recordId' in update) && !('targetId' in update))).toBe(true);
    expect(snapshot.updates.every(update => !('sourceThreadId' in update))).toBe(true);
    expect(snapshot.hot.every(record => !('id' in record))).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain(sharedSecretRecord.id);
    expect(JSON.stringify(snapshot)).not.toContain(secret.id);
  });

  it('does not expose names after an activity target moves outside the visible scope', async () => {
    const store = await createStore();
    const secret = await store.createNode({
      name: 'Moved secret',
      kind: 'note',
      scopeIds: [resourceScope.at(-1)!],
      contextScopeId: resourceScope.at(-1),
    });
    await store.updateNode({
      id: secret.id,
      version: secret.version,
      scopeIds: [alphaScope.at(-1)!],
      contextScopeId: alphaScope.at(-1),
    });
    const document = await store.createNode({
      name: 'Moved document',
      kind: 'document',
      metadata: { description: 'Private notes' },
      scopeIds: [resourceScope.at(-1)!],
    });
    await store.updateNode({
      id: document.id,
      version: document.version,
      scopeIds: [alphaScope.at(-1)!],
      contextScopeId: alphaScope.at(-1),
    });

    const snapshot = await buildSubconsciousActivitySnapshot({
      knowledge: store.knowledge,
      scopeIds: betaScope,
      recentUpdates: 10,
    });

    expect(snapshot.updates).toEqual([]);
    expect(snapshot.hot.map(record => record.name)).not.toContain('Moved secret');
    expect(snapshot.hot.map(record => record.name)).not.toContain('Moved document');
    expect(JSON.stringify(snapshot)).not.toContain(secret.id);
    expect(JSON.stringify(snapshot)).not.toContain(document.id);
    expect(renderSubconsciousActivity(snapshot)).not.toContain(secret.id);
    expect(renderSubconsciousActivity(snapshot)).not.toContain(document.id);
  });

  it('never names organization-rung or ungranted-scope activity the session cannot read', async () => {
    const store = await createStore();
    const orgNode = await store.createNode({
      name: 'Org roadmap',
      kind: 'note',
      scopeIds: [resourceScope[0]!],
      contextScopeId: resourceScope[0],
    });
    await store.createRecord({
      node: orgNode.id,
      text: 'Org-only plan.',
      scopeIds: [resourceScope[0]!],
      source: 'org',
    });
    const threadNode = await store.createNode({
      name: 'Beta notes',
      kind: 'note',
      scopeIds: [betaScope[2]!],
      contextScopeId: betaScope[2],
    });

    const before = await buildSubconsciousActivitySnapshot({
      knowledge: store.knowledge,
      scopeIds: betaScope,
      recentUpdates: 10,
    });
    expect(before.updates.map(update => update.name)).toEqual(['Beta notes']);
    expect(JSON.stringify(before)).not.toContain('Org roadmap');
    expect(JSON.stringify(before)).not.toContain(orgNode.id);

    // A vouched thread rung without a readable grant is not a readable scope (vouching seeds, it does not grant).
    const gammaScope = [...resourceScope, '10000000-0000-4000-8000-000000000005'];
    await store.createNode({ id: gammaScope[2], name: 'Thread gamma', isScope: true, scopeIds: [resourceScope[1]!] });
    const ungranted = await store.createNode({
      name: 'Gamma notes',
      kind: 'note',
      scopeIds: [gammaScope[2]!],
      contextScopeId: gammaScope[2],
    });
    const gamma = await buildSubconsciousActivitySnapshot({
      knowledge: store.knowledge,
      scopeIds: gammaScope,
      recentUpdates: 10,
    });
    expect(JSON.stringify(gamma)).not.toContain('Gamma notes');
    expect(JSON.stringify(gamma)).not.toContain(ungranted.id);
    expect(threadNode.name).toBe('Beta notes');
  });

  it('bounds updates and hot records, renders errors, and generates stable cache keys', async () => {
    const store = await createStore();
    for (let index = 0; index < 5; index++) {
      await store.createNode({
        name: `Node ${index}`,
        kind: 'note',
        scopeIds: [resourceScope.at(-1)!],
        contextScopeId: resourceScope.at(-1),
      });
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
      knowledge: store.knowledge,
      scopeIds: alphaScope,
      recentUpdates: 3,
      sendStateSignal,
      errors: ['capture failed'],
    });
    const second = await publishSubconsciousActivity({
      knowledge: store.knowledge,
      scopeIds: alphaScope,
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
