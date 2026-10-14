import { randomUUID } from 'node:crypto';
import type { SkillsStorage } from '@mastra/core/storage';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresStore } from '../..';
import { TEST_CONFIG } from '../../test-utils';

describe.each([undefined, 'skill-metadata-filters'])('skill metadata filtering (schema: %s)', schemaName => {
  let store: PostgresStore;
  let skills: SkillsStorage;
  let authorId: string;
  let ids: string[];

  beforeAll(async () => {
    store = new PostgresStore({ ...TEST_CONFIG, schemaName });
    await store.init();
    skills = await store.getStore('skills');
  });

  beforeEach(() => {
    authorId = randomUUID();
    ids = [];
  });

  afterEach(async () => {
    for (const id of ids) await skills.delete(id);
  });

  afterAll(async () => {
    await store?.close();
  });

  async function create(metadata?: Record<string, unknown>) {
    const id = `${authorId}-${ids.length}`;
    ids.push(id);
    await skills.create({ skill: { id, authorId, name: id, description: 'test', instructions: 'test', metadata } });
    return id;
  }

  async function publish(id: string) {
    const version = await skills.getLatestVersion(id);
    await skills.update({ id, status: 'published', activeVersionId: version!.id });
    return version!.id;
  }

  const cases: { label: string; metadata: Record<string, unknown>; expected: number[] }[] = [
    { label: 'one key', metadata: { publishedBy: 'alice' }, expected: [0] },
    { label: 'AND matching', metadata: { publishedBy: 'alice', category: 'copy' }, expected: [0] },
    { label: 'AND mismatch', metadata: { publishedBy: 'alice', category: 'support' }, expected: [] },
    { label: 'no matches', metadata: { publishedBy: 'nobody' }, expected: [] },
    { label: 'JSON types', metadata: { enabled: true, count: 1 }, expected: [0] },
    { label: 'JSON null versus missing', metadata: { review: null }, expected: [0] },
    { label: 'nested containment', metadata: { team: { name: 'editorial' } }, expected: [0] },
    { label: 'array containment', metadata: { agentIds: ['writer'] }, expected: [0] },
    { label: 'literal keys and values', metadata: { "publisher's.id": "alice' OR true --" }, expected: [0] },
    { label: 'empty filter', metadata: {}, expected: [0, 1, 2] },
  ];

  it.each(cases)('filters by $label before counting', async ({ metadata, expected }) => {
    await create({
      publishedBy: 'alice',
      category: 'copy',
      enabled: true,
      count: 1,
      review: null,
      team: { name: 'editorial', region: 'eu' },
      agentIds: ['writer', 'reviewer'],
      "publisher's.id": "alice' OR true --",
    });
    await create({ publishedBy: 'bob', category: 'copy', enabled: 'true', count: '1', agentIds: ['other'] });
    await create();

    const result = await skills.list({ authorId, metadata, perPage: false });
    expect(result.skills.map(skill => skill.id).sort()).toEqual(expected.map(index => ids[index]));
    expect(result.total).toBe(expected.length);
    expect(result.hasMore).toBe(false);
  });

  it('combines metadata with author, status, visibility and entityIds', async () => {
    const published = await create({ publishedBy: 'alice' });
    await publish(published);
    await skills.update({ id: published, visibility: 'public' });
    const draft = await create({ publishedBy: 'alice' });
    const otherPublisher = await create({ publishedBy: 'bob' });
    await publish(otherPublisher);
    await skills.update({ id: otherPublisher, visibility: 'public' });

    const result = await skills.list({
      authorId,
      status: 'published',
      visibility: 'public',
      entityIds: [published, draft, otherPublisher],
      metadata: { publishedBy: 'alice' },
    });
    expect(result.skills.map(skill => skill.id)).toEqual([published]);
    expect(result.total).toBe(1);
    expect((await skills.list({ authorId: 'missing-author', metadata: { publishedBy: 'alice' } })).total).toBe(0);
    expect((await skills.list({ authorId, entityIds: [], metadata: { publishedBy: 'alice' } })).total).toBe(0);
  });

  it('paginates only matching skills and returns filtered totals and hasMore', async () => {
    const first = await create({ category: 'copy' });
    await create({ category: 'support' });
    const second = await create({ category: 'copy' });
    await create({ category: 'support' });
    const third = await create({ category: 'copy' });
    const query = {
      authorId,
      metadata: { category: 'copy' },
      perPage: 2,
      orderBy: { field: 'createdAt' as const, direction: 'ASC' as const },
    };

    const page0 = await skills.listResolved({ ...query, page: 0 });
    expect(page0.skills.map(skill => skill.id)).toEqual([first, second]);
    expect(page0).toMatchObject({ total: 3, page: 0, perPage: 2, hasMore: true });
    const page1 = await skills.listResolved({ ...query, page: 1 });
    expect(page1.skills.map(skill => skill.id)).toEqual([third]);
    expect(page1).toMatchObject({ total: 3, page: 1, perPage: 2, hasMore: false });
    const page2 = await skills.listResolved({ ...query, page: 2 });
    expect(page2.skills).toEqual([]);
    expect(page2).toMatchObject({ total: 3, page: 2, perPage: 2, hasMore: false });
  });

  it('combines metadata filtering with favorites and pagination', async () => {
    const favorites = await store.getStore('favorites');
    const first = await create({ category: 'copy' });
    const favorite = await create({ category: 'copy' });
    const nonmatching = await create({ category: 'support' });
    for (const entityId of [favorite, nonmatching]) {
      await favorites.favorite({ userId: authorId, entityType: 'skill', entityId });
    }
    const query = { authorId, pinFavoritedFor: authorId, metadata: { category: 'copy' }, perPage: 1 };

    const page0 = await skills.list(query);
    expect(page0.skills.map(skill => skill.id)).toEqual([favorite]);
    expect(page0).toMatchObject({ total: 2, hasMore: true });
    const page1 = await skills.list({ ...query, page: 1 });
    expect(page1.skills.map(skill => skill.id)).toEqual([first]);
    expect(page1).toMatchObject({ total: 2, hasMore: false });
    const onlyFavorites = await skills.list({ ...query, favoritedOnly: true });
    expect(onlyFavorites.skills.map(skill => skill.id)).toEqual([favorite]);
    expect(onlyFavorites).toMatchObject({ total: 1, hasMore: false });
  });

  it.each([undefined, 'published', 'archived'] as const)(
    'filters the active version when status is %s, without matching newer drafts',
    async status => {
      const id = await create({ publishedBy: 'alice' });
      const activeVersionId = await publish(id);
      await skills.update({ id, metadata: { publishedBy: 'bob' } });
      if (status === 'archived') await skills.update({ id, status });

      const result = await skills.listResolved({ authorId, status, metadata: { publishedBy: 'alice' } });
      expect(result.total).toBe(1);
      expect(result.skills[0]).toMatchObject({
        id,
        resolvedVersionId: activeVersionId,
        metadata: { publishedBy: 'alice' },
      });
      expect((await skills.listResolved({ authorId, status, metadata: { publishedBy: 'bob' } })).skills).toEqual([]);
    },
  );

  it('uses the latest draft even when an active version is still set', async () => {
    const id = await create({ publishedBy: 'alice' });
    await publish(id);
    await skills.update({ id, status: 'draft', metadata: { publishedBy: 'bob' } });

    const result = await skills.listResolved({ authorId, status: 'draft', metadata: { publishedBy: 'bob' } });
    expect(result.total).toBe(1);
    expect(result.skills[0]).toMatchObject({ id, metadata: { publishedBy: 'bob' } });
    expect((await skills.list({ authorId, status: 'draft', metadata: { publishedBy: 'alice' } })).total).toBe(0);
  });

  it('falls back to the latest version when the active version is missing', async () => {
    const id = await create({ publishedBy: 'alice' });
    const activeVersionId = await publish(id);
    await skills.update({ id, metadata: { publishedBy: 'bob' } });
    await skills.deleteVersion(activeVersionId);

    const result = await skills.listResolved({ authorId, status: 'published', metadata: { publishedBy: 'bob' } });
    expect(result.total).toBe(1);
    expect(result.skills[0]).toMatchObject({ id, metadata: { publishedBy: 'bob' } });
    expect((await skills.list({ authorId, metadata: { publishedBy: 'alice' } })).total).toBe(0);
  });

  it('does not fall back to draft metadata when the active version has no metadata', async () => {
    const id = await create();
    await publish(id);
    await skills.update({ id, metadata: { publishedBy: 'alice' } });

    const result = await skills.listResolved({ authorId, metadata: { publishedBy: 'alice' } });
    expect(result.skills).toEqual([]);
    expect(result.total).toBe(0);
  });
});
