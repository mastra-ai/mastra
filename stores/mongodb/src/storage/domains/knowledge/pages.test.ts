import {
  KnowledgeConflictError,
  KnowledgePageKeyConflictError,
  KnowledgeMoveTooLargeError,
  KnowledgePageDepthError,
  KnowledgePageHasChildrenError,
  MAX_KNOWLEDGE_MOVE_PAGES,
} from '@mastra/core/storage';
import type { KnowledgeReadScope } from '@mastra/core/storage';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { resolveMongoDBConfig } from '../../db';
import { MongoKnowledgePages, MongoKnowledgeResetRequiredError } from './pages';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const connector = resolveMongoDBConfig({
  uri: process.env.MONGODB_URL || 'mongodb://localhost:27055/?directConnection=true',
  dbName: 'knowledge_pages_test',
});
const provenance = { author: 'agent:test' };
const store = new MongoKnowledgePages({
  connector,
  bounds: async () => ({
    assertKnowledgePageDescriptionWithinBound: () => {},
    assertKnowledgeNoteTextWithinBound: () => {},
  }),
});

const readOf = (...addresses: string[]): KnowledgeReadScope => ({ addresses, prefixes: [], children: [] });

describe('MongoKnowledgePages (schema 4)', () => {
  beforeAll(async () => {
    await store.reset();
  });
  afterAll(async () => {
    await connector.close();
  });

  it('materializes scopes idempotently and reports parent conflicts', async () => {
    const org = await store.materializeScope({
      address: 'org:acme',
      declaration: 'org:$orgId',
      name: 'Acme',
      provenance,
      children: [{ address: 'org:acme/internal', declaration: 'org:$orgId/internal', name: 'Internal' }],
      pages: [{ key: 'org:acme#policy', name: 'Policy' }],
    });
    expect(org.created).toBe(true);
    expect(org.scope.scopeId).toBe(org.scope.id);
    const again = await store.materializeScope({
      address: 'org:acme',
      declaration: 'org:$orgId',
      name: 'Acme',
      provenance,
    });
    expect(again.created).toBe(false);
    expect(again.parentConflict).toBeUndefined();
    const children = await store.listChildScopes({ parentId: org.scope.id });
    expect(children.pages.map(page => page.address)).toEqual(['org:acme/internal']);
    expect(await store.getPageByKey({ scopeId: org.scope.id, key: 'org:acme#policy', read: 'all' })).not.toBeNull();
  });

  it('filters reads by scope before ordering and cursors', async () => {
    const a = (await store.materializeScope({ address: 'team:a', declaration: 'team:$t', name: 'A', provenance }))
      .scope;
    const b = (await store.materializeScope({ address: 'team:b', declaration: 'team:$t', name: 'B', provenance }))
      .scope;
    for (const [scope, names] of [
      [a, ['p1', 'p3', 'p5']],
      [b, ['p2', 'p4', 'p6']],
    ] as const) {
      for (const name of names) await store.createPage({ parentId: scope.id, name, provenance });
    }
    const first = await store.listPages({ read: readOf('team:a'), scopeId: undefined, limit: 2, namePrefix: 'p' });
    expect(first.pages.map(page => page.name)).toEqual(['p1', 'p3']);
    const second = await store.listPages({ read: readOf('team:a'), limit: 2, cursor: first.nextCursor });
    expect(second.pages.map(page => page.name)).toEqual(['p5']);
    expect(second.nextCursor).toBeUndefined();

    const hidden = await store.getPage({
      id: (await store.listPages({ read: readOf('team:b') })).pages[0]!.id,
      read: readOf('team:a'),
    });
    expect(hidden).toBeNull();

    const prefixed = await store.listPages({
      read: { addresses: [], prefixes: [{ declaration: 'team:$t', prefix: 'team:' }], children: [] },
      namePrefix: 'p',
    });
    expect(prefixed.pages.length).toBe(6);
    const wrongCase = await store.listPages({
      read: { addresses: [], prefixes: [{ declaration: 'team:$t', prefix: 'TEAM:' }], children: [] },
    });
    expect(wrongCase.pages).toEqual([]);
  });

  it('handles a 20k-address frontier without per-address parameters', async () => {
    const many = Array.from({ length: 20000 }, (_, index) => `bulk:${index}`);
    const read = { addresses: [...many, 'team:a'], prefixes: [], children: [] };
    const result = await store.listPages({ read, namePrefix: 'p' });
    expect(result.pages.map(page => page.name)).toEqual(['p1', 'p3', 'p5']);
  });

  it('hides notes unless a stamp and every mentioned page scope are readable', async () => {
    const a = (await store.getScopesByAddress(['team:a']))[0]!;
    const b = (await store.getScopesByAddress(['team:b']))[0]!;
    const pageA = (await store.listPages({ read: readOf('team:a') })).pages[0]!;
    const pageB = (await store.listPages({ read: readOf('team:b') })).pages[0]!;
    const note = await store.addNote({
      pageId: pageA.id,
      text: 'mentions b',
      stampScopeIds: [a.id],
      mentions: [pageB.id],
      provenance,
    });
    expect((await store.listNotes({ pageId: pageA.id, read: readOf('team:a') })).notes).toEqual([]);
    expect(
      (await store.listNotes({ pageId: pageA.id, read: readOf('team:a', 'team:b') })).notes.map(n => n.id),
    ).toEqual([note.id]);
    expect((await store.listNotesMentioning({ pageId: pageB.id, read: readOf('team:a', 'team:b') })).notes.length).toBe(
      1,
    );

    const plain = await store.addNote({
      pageId: pageA.id,
      text: 'plain',
      stampScopeIds: [a.id, b.id],
      mentions: [],
      provenance,
    });
    expect((await store.listNotes({ pageId: pageA.id, read: readOf('team:a') })).notes.map(n => n.id)).toEqual([
      plain.id,
    ]);
    const restamped = await store.restampNote({ id: plain.id, expectedVersion: 1, stampScopeIds: [b.id], provenance });
    expect(restamped.stampScopeIds).toEqual([b.id]);
    expect((await store.listNotes({ pageId: pageA.id, read: readOf('team:a') })).notes).toEqual([]);
    await expect(
      store.restampNote({ id: plain.id, expectedVersion: 1, stampScopeIds: [a.id], provenance }),
    ).rejects.toBeInstanceOf(KnowledgeConflictError);
  });

  it('moves a subtree across scopes, taking visibility with it', async () => {
    const a = (await store.getScopesByAddress(['team:a']))[0]!;
    const b = (await store.getScopesByAddress(['team:b']))[0]!;
    const parent = await store.createPage({ parentId: a.id, name: 'tree', provenance });
    const child = await store.createPage({ parentId: parent.id, name: 'leaf', provenance });
    const moved = await store.movePage({ id: parent.id, expectedVersion: 1, parentId: b.id, provenance });
    expect(moved.scopeId).toBe(b.id);
    expect(await store.getPage({ id: child.id, read: readOf('team:a') })).toBeNull();
    expect((await store.getPage({ id: child.id, read: readOf('team:b') }))?.scopeId).toBe(b.id);
    await expect(
      store.movePage({ id: parent.id, expectedVersion: moved.version, parentId: child.id, provenance }),
    ).rejects.toThrow();
    const activity = await store.listPageActivity({ read: readOf('team:a'), pageId: parent.id });
    expect(activity.events).toEqual([]);
    expect(
      (await store.listPageActivity({ read: readOf('team:b'), pageId: parent.id })).events.map(e => e.action),
    ).toEqual(['page-moved', 'page-created']);
  });

  it('refuses depth overflow, oversize moves and deleting a page with children', async () => {
    const c = (await store.materializeScope({ address: 'team:c', declaration: 'team:$t', name: 'C', provenance }))
      .scope;
    let parent = c.id;
    for (let level = 1; level <= 10; level++)
      parent = (await store.createPage({ parentId: parent, name: `d${level}`, provenance })).id;
    await expect(store.createPage({ parentId: parent, name: 'd11', provenance })).rejects.toBeInstanceOf(
      KnowledgePageDepthError,
    );

    const big = await store.createPage({ parentId: c.id, name: 'big', provenance });
    await (
      await connector.getCollection('mastra_knowledge_pages')
    ).insertMany(
      Array.from({ length: MAX_KNOWLEDGE_MOVE_PAGES }, (_, i) => ({
        id: `bulk-${i}`,
        scopeId: c.id,
        parentId: big.id,
        isScope: false,
        position: 'm',
        name: `bulk${i}`,
        canonicalName: `bulk${i}`,
        depth: 2,
        version: 1,
        createdBy: { author: 'x' },
        updatedBy: { author: 'x' },
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );
    const other = (await store.materializeScope({ address: 'team:d', declaration: 'team:$t', name: 'D', provenance }))
      .scope;
    await expect(
      store.movePage({ id: big.id, expectedVersion: 1, parentId: other.id, provenance }),
    ).rejects.toBeInstanceOf(KnowledgeMoveTooLargeError);
    await expect(store.deletePage({ id: big.id, expectedVersion: 1, deletedBy: 'agent:test' })).rejects.toBeInstanceOf(
      KnowledgePageHasChildrenError,
    );
  });

  it('merges pages: notes, mentions, children and pins move to the target', async () => {
    const e = (await store.materializeScope({ address: 'team:e', declaration: 'team:$t', name: 'E', provenance }))
      .scope;
    const source = await store.createPage({ parentId: e.id, name: 'src', provenance });
    const target = await store.createPage({ parentId: e.id, name: 'tgt', provenance });
    const kid = await store.createPage({ parentId: source.id, name: 'kid', provenance });
    const note = await store.addNote({
      pageId: source.id,
      text: 'hello',
      stampScopeIds: [e.id],
      mentions: [],
      provenance,
    });
    const mentioner = await store.addNote({
      pageId: target.id,
      text: 'see src',
      stampScopeIds: [e.id],
      mentions: [source.id],
      provenance,
    });
    await store.addPinAudience({ pageId: source.id, audience: ['team:e'], createdBy: 'agent:test' });
    const merged = await store.mergePages({ sourceId: source.id, sourceVersion: 1, targetId: target.id, provenance });
    expect(merged.id).toBe(target.id);
    const read = readOf('team:e');
    expect((await store.getPage({ id: source.id, read }))?.mergedInto).toBe(target.id);
    expect((await store.getPage({ id: kid.id, read }))?.parentId).toBe(target.id);
    expect((await store.getNote({ id: note.id, read }))?.pageId).toBe(target.id);
    expect((await store.getNote({ id: mentioner.id, read }))?.mentions).toEqual([target.id]);
    const pins = await store.listPins({ audience: ['team:e'], read });
    expect(pins.pins.map(pin => pin.pageId)).toEqual([target.id]);
    const removed = await store.removePinAudience({ pageId: target.id, audience: ['team:e'], removedBy: 'agent:test' });
    expect(removed).toBeNull();
  });

  it('searches lexically after filtering', async () => {
    const e = (await store.getScopesByAddress(['team:e']))[0]!;
    const page = await store.createPage({ parentId: e.id, name: 'Zebra crossing', provenance });
    await store.addNote({ pageId: page.id, text: 'zebra stripes', stampScopeIds: [e.id], mentions: [], provenance });
    const hits = await store.searchPages({ query: 'ZEBRA', read: readOf('team:e') });
    expect(hits.map(hit => hit.type)).toEqual(['page', 'note']);
    expect(await store.searchPages({ query: 'zebra', read: readOf('team:a') })).toEqual([]);
  });

  it('links an unlinked scope on a later run with a parent; a different parent is a conflict', async () => {
    const p1 = (await store.materializeScope({ address: 'org:p1', declaration: 'org:$o', name: 'P1', provenance }))
      .scope;
    const p2 = (await store.materializeScope({ address: 'org:p2', declaration: 'org:$o', name: 'P2', provenance }))
      .scope;
    const orphan = (
      await store.materializeScope({ address: 'team:late', declaration: 'team:$t', name: 'Late', provenance })
    ).scope;
    expect(orphan.parentId).toBeNull();
    const linked = await store.materializeScope({
      address: 'team:late',
      declaration: 'team:$t',
      name: 'Late',
      parentId: p1.id,
      provenance,
    });
    expect(linked.scope.parentId).toBe(p1.id);
    expect(linked.parentConflict).toBeUndefined();
    const again = await store.materializeScope({
      address: 'team:late',
      declaration: 'team:$t',
      name: 'Late',
      parentId: p2.id,
      provenance,
    });
    expect(again.scope.parentId).toBe(p1.id);
    expect(again.parentConflict).toEqual({ existingParentId: p1.id, requestedParentId: p2.id });
  });

  it('refuses moving or merging into a scope that already has the page key; deleted descendants do not count toward the cap', async () => {
    const x = (await store.materializeScope({ address: 'team:x', declaration: 'team:$t', name: 'X', provenance }))
      .scope;
    const y = (await store.materializeScope({ address: 'team:y', declaration: 'team:$t', name: 'Y', provenance }))
      .scope;
    const a = await store.createPage({ parentId: x.id, name: 'a', key: 'dup', provenance });
    await store.createPage({ parentId: y.id, name: 'b', key: 'dup', provenance });
    await expect(store.movePage({ id: a.id, expectedVersion: 1, parentId: y.id, provenance })).rejects.toBeInstanceOf(
      KnowledgePageKeyConflictError,
    );
    const src = await store.createPage({ parentId: x.id, name: 'src2', provenance });
    await store.createPage({ parentId: src.id, name: 'kid', key: 'dup2', provenance });
    const tgt = await store.createPage({ parentId: y.id, name: 'tgt2', provenance });
    await store.createPage({ parentId: tgt.id, name: 'kid2', key: 'dup2', provenance });
    await expect(
      store.mergePages({ sourceId: src.id, sourceVersion: 1, targetId: tgt.id, provenance }),
    ).rejects.toBeInstanceOf(KnowledgePageKeyConflictError);
    const holder = await store.createPage({ parentId: x.id, name: 'holder', provenance });
    await (
      await connector.getCollection('mastra_knowledge_pages')
    ).insertMany(
      Array.from({ length: MAX_KNOWLEDGE_MOVE_PAGES + 5 }, (_, i) => ({
        id: `gone-${i}`,
        scopeId: x.id,
        parentId: holder.id,
        isScope: false,
        position: 'm',
        name: `gone${i}`,
        canonicalName: `gone${i}`,
        depth: 2,
        version: 1,
        createdBy: { author: 'x' },
        updatedBy: { author: 'x' },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
      })),
    );
    await expect(
      store.movePage({ id: holder.id, expectedVersion: 1, parentId: y.id, provenance }),
    ).resolves.toMatchObject({ scopeId: y.id });
  });

  it('requires a reset over legacy collections', async () => {
    await (await connector.getCollection('mastra_knowledge_nodes')).insertOne({ id: 'legacy' });
    await expect(store.init()).rejects.toBeInstanceOf(MongoKnowledgeResetRequiredError);
    await store.reset();
    expect(await connector.collectionExists('mastra_knowledge_nodes')).toBe(false);
    expect(await connector.collectionExists('mastra_knowledge_pages')).toBe(true);
  });
});
