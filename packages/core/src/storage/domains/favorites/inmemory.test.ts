import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryAgentsStorage } from '../agents/inmemory';
import { InMemoryDB } from '../inmemory-db';
import { InMemorySkillsStorage } from '../skills/inmemory';
import { InMemoryFavoritesStorage } from './inmemory';

async function seedAgent(
  agents: InMemoryAgentsStorage,
  id: string,
  authorId = 'owner',
  overrides: { createdAt?: Date } = {},
): Promise<void> {
  await agents.create({
    agent: {
      id,
      authorId,
      visibility: 'public',
      name: id,
      instructions: 'x',
      model: { provider: 'openai', name: 'gpt-4' },
    },
  });
  if (overrides.createdAt) {
    const row = (agents as unknown as { db: InMemoryDB }).db.agents.get(id)!;
    row.createdAt = overrides.createdAt;
    row.updatedAt = overrides.createdAt;
  }
}

async function seedSkill(skills: InMemorySkillsStorage, id: string, authorId = 'owner'): Promise<void> {
  await skills.create({
    skill: {
      id,
      authorId,
      visibility: 'public',
      name: id,
      description: 'd',
      instructions: 'i',
    },
  });
}

describe('InMemoryFavoritesStorage', () => {
  let db: InMemoryDB;
  let agents: InMemoryAgentsStorage;
  let skills: InMemorySkillsStorage;
  let favorites: InMemoryFavoritesStorage;

  beforeEach(() => {
    db = new InMemoryDB();
    agents = new InMemoryAgentsStorage({ db });
    skills = new InMemorySkillsStorage({ db });
    favorites = new InMemoryFavoritesStorage({ db });
  });

  describe('favorite / unfavorite', () => {
    it('favoriting an agent increments favoriteCount and is idempotent', async () => {
      await seedAgent(agents, 'a1');

      const first = await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: 'a1' });
      expect(first).toEqual({ favorited: true, favoriteCount: 1 });

      const second = await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: 'a1' });
      expect(second).toEqual({ favorited: true, favoriteCount: 1 });

      const agent = await agents.getById('a1');
      expect(agent?.favoriteCount).toBe(1);
    });

    it('favoriting the same entity from two users increments to 2', async () => {
      await seedAgent(agents, 'a1');

      await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: 'a1' });
      const result = await favorites.favorite({ userId: 'u2', entityType: 'agent', entityId: 'a1' });

      expect(result).toEqual({ favorited: true, favoriteCount: 2 });
    });

    it('unfavorite decrements counter and is idempotent', async () => {
      await seedAgent(agents, 'a1');
      await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: 'a1' });

      const first = await favorites.unfavorite({ userId: 'u1', entityType: 'agent', entityId: 'a1' });
      expect(first).toEqual({ favorited: false, favoriteCount: 0 });

      const second = await favorites.unfavorite({ userId: 'u1', entityType: 'agent', entityId: 'a1' });
      expect(second).toEqual({ favorited: false, favoriteCount: 0 });
    });

    it('unfavorite clamps favoriteCount at 0', async () => {
      await seedAgent(agents, 'a1');

      // No-op unfavorite without a prior favorite should not produce a negative count.
      const result = await favorites.unfavorite({ userId: 'u1', entityType: 'agent', entityId: 'a1' });
      expect(result.favoriteCount).toBe(0);
    });

    it('throws when favoriting an entity that does not exist', async () => {
      await expect(favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: 'missing' })).rejects.toThrow(
        /agent with id missing does not exist/,
      );
    });

    it('separates agent and skill counters', async () => {
      await seedAgent(agents, 'shared');
      await seedSkill(skills, 'shared');

      await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: 'shared' });
      const skillResult = await favorites.favorite({ userId: 'u1', entityType: 'skill', entityId: 'shared' });
      expect(skillResult.favoriteCount).toBe(1);

      const agent = await agents.getById('shared');
      const skill = await skills.getById('shared');
      expect(agent?.favoriteCount).toBe(1);
      expect(skill?.favoriteCount).toBe(1);
    });
  });

  describe('isFavorited / isFavoritedBatch', () => {
    it('reports favorited state per user', async () => {
      await seedAgent(agents, 'a1');
      await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: 'a1' });

      expect(await favorites.isFavorited({ userId: 'u1', entityType: 'agent', entityId: 'a1' })).toBe(true);
      expect(await favorites.isFavorited({ userId: 'u2', entityType: 'agent', entityId: 'a1' })).toBe(false);
    });

    it('isFavoritedBatch returns only the favorited subset', async () => {
      await seedAgent(agents, 'a1');
      await seedAgent(agents, 'a2');
      await seedAgent(agents, 'a3');
      await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: 'a1' });
      await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: 'a3' });

      const result = await favorites.isFavoritedBatch({
        userId: 'u1',
        entityType: 'agent',
        entityIds: ['a1', 'a2', 'a3', 'missing'],
      });

      expect(result).toEqual(new Set(['a1', 'a3']));
    });
  });

  describe('listFavoritedIds', () => {
    it('returns only the caller’s entity IDs scoped by entity type', async () => {
      await seedAgent(agents, 'a1');
      await seedAgent(agents, 'a2');
      await seedSkill(skills, 's1');

      await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: 'a1' });
      await favorites.favorite({ userId: 'u1', entityType: 'skill', entityId: 's1' });
      await favorites.favorite({ userId: 'u2', entityType: 'agent', entityId: 'a2' });

      const u1Agents = await favorites.listFavoritedIds({ userId: 'u1', entityType: 'agent' });
      const u1Skills = await favorites.listFavoritedIds({ userId: 'u1', entityType: 'skill' });
      const u2Agents = await favorites.listFavoritedIds({ userId: 'u2', entityType: 'agent' });

      expect(u1Agents.sort()).toEqual(['a1']);
      expect(u1Skills.sort()).toEqual(['s1']);
      expect(u2Agents.sort()).toEqual(['a2']);
    });
  });

  describe('deleteFavoritesForEntity (cascade)', () => {
    it('removes all favorite rows for the entity and reports the count', async () => {
      await seedAgent(agents, 'a1');
      await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: 'a1' });
      await favorites.favorite({ userId: 'u2', entityType: 'agent', entityId: 'a1' });

      const removed = await favorites.deleteFavoritesForEntity({ entityType: 'agent', entityId: 'a1' });
      expect(removed).toBe(2);

      expect(await favorites.isFavorited({ userId: 'u1', entityType: 'agent', entityId: 'a1' })).toBe(false);
      expect(await favorites.isFavorited({ userId: 'u2', entityType: 'agent', entityId: 'a1' })).toBe(false);
    });

    it('does not touch favorites for other entities', async () => {
      await seedAgent(agents, 'a1');
      await seedAgent(agents, 'a2');
      await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: 'a1' });
      await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: 'a2' });

      const removed = await favorites.deleteFavoritesForEntity({ entityType: 'agent', entityId: 'a1' });
      expect(removed).toBe(1);

      expect(await favorites.isFavorited({ userId: 'u1', entityType: 'agent', entityId: 'a2' })).toBe(true);
    });
  });

  describe('list integration: pinFavoritedFor + entityIds', () => {
    it('pinFavoritedFor pushes favorited agents to the front and is stable', async () => {
      const t = new Date('2026-01-01T00:00:00Z');
      await seedAgent(agents, 'a1', 'owner', { createdAt: t });
      await seedAgent(agents, 'a2', 'owner', { createdAt: t });
      await seedAgent(agents, 'a3', 'owner', { createdAt: t });
      await seedAgent(agents, 'a4', 'owner', { createdAt: t });

      await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: 'a3' });
      await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: 'a1' });

      const result = await agents.list({ pinFavoritedFor: 'u1', orderBy: { field: 'createdAt', direction: 'DESC' } });

      // Favorited (a1, a3) come first, ordered by id ASC due to identical timestamps.
      expect(result.agents.map(a => a.id)).toEqual(['a1', 'a3', 'a2', 'a4']);
    });

    it('entityIds restricts list output (used by ?favoritedOnly=true)', async () => {
      await seedAgent(agents, 'a1');
      await seedAgent(agents, 'a2');
      await seedAgent(agents, 'a3');

      const result = await agents.list({ entityIds: ['a1', 'a3'] });
      expect(result.agents.map(a => a.id).sort()).toEqual(['a1', 'a3']);
      expect(result.total).toBe(2);
    });

    it('entityIds=[] short-circuits to an empty page', async () => {
      await seedAgent(agents, 'a1');

      const result = await agents.list({ entityIds: [] });
      expect(result.agents).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('favoritedOnly + pinFavoritedFor narrows agents.list to the user’s favorites', async () => {
      await seedAgent(agents, 'a1');
      await seedAgent(agents, 'a2');
      await seedAgent(agents, 'a3');
      await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: 'a1' });
      await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: 'a3' });

      const result = await agents.list({ pinFavoritedFor: 'u1', favoritedOnly: true });
      expect(result.agents.map(a => a.id).sort()).toEqual(['a1', 'a3']);
      expect(result.total).toBe(2);
    });

    it('favoritedOnly + pinFavoritedFor narrows skills.list to the user’s favorites', async () => {
      await seedSkill(skills, 's1');
      await seedSkill(skills, 's2');
      await seedSkill(skills, 's3');
      await favorites.favorite({ userId: 'u1', entityType: 'skill', entityId: 's2' });

      const result = await skills.list({ pinFavoritedFor: 'u1', favoritedOnly: true });
      expect(result.skills.map(s => s.id)).toEqual(['s2']);
      expect(result.total).toBe(1);
    });

    it('favoritedOnly without pinFavoritedFor returns empty (defensive)', async () => {
      await seedAgent(agents, 'a1');
      await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: 'a1' });

      const agentResult = await agents.list({ favoritedOnly: true });
      expect(agentResult.agents).toEqual([]);
      expect(agentResult.total).toBe(0);

      await seedSkill(skills, 's1');
      await favorites.favorite({ userId: 'u1', entityType: 'skill', entityId: 's1' });
      const skillResult = await skills.list({ favoritedOnly: true });
      expect(skillResult.skills).toEqual([]);
      expect(skillResult.total).toBe(0);
    });

    it('paginates stably with same-createdAt + tie-break id ASC', async () => {
      const t = new Date('2026-01-01T00:00:00Z');
      const ids = ['a01', 'a02', 'a03', 'a04', 'a05', 'a06', 'a07', 'a08', 'a09', 'a10'];
      for (const id of ids) {
        await seedAgent(agents, id, 'owner', { createdAt: t });
      }
      // Favorite a few; pagination must still be deterministic.
      await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: 'a05' });
      await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: 'a02' });

      const collected: string[] = [];
      for (const page of [0, 1, 2, 3]) {
        const result = await agents.list({ pinFavoritedFor: 'u1', perPage: 3, page });
        collected.push(...result.agents.map(a => a.id));
      }

      expect(collected).toHaveLength(ids.length);
      expect(new Set(collected).size).toBe(ids.length);
      // Favorited ids appear first, in id ASC order.
      expect(collected.slice(0, 2)).toEqual(['a02', 'a05']);
    });
  });

  describe('dangerouslyClearAll', () => {
    it('clears all favorites and resets parent counters', async () => {
      await seedAgent(agents, 'a1');
      await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: 'a1' });

      await favorites.dangerouslyClearAll();
      expect(await favorites.isFavorited({ userId: 'u1', entityType: 'agent', entityId: 'a1' })).toBe(false);
      const agent = await agents.getById('a1');
      expect(agent?.favoriteCount).toBe(0);
    });

    it('resets skill counters in addition to agent counters', async () => {
      await seedAgent(agents, 'a1');
      await seedSkill(skills, 's1');
      await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: 'a1' });
      await favorites.favorite({ userId: 'u1', entityType: 'skill', entityId: 's1' });

      await favorites.dangerouslyClearAll();
      expect(await favorites.isFavorited({ userId: 'u1', entityType: 'skill', entityId: 's1' })).toBe(false);
      const skill = await skills.getById('s1');
      expect(skill?.favoriteCount).toBe(0);
    });
  });

  describe('deleteFavoritesForEntity', () => {
    it('deletes all favorites for the entity and resets its favoriteCount when it still exists', async () => {
      await seedAgent(agents, 'a1');
      await favorites.favorite({ userId: 'u1', entityType: 'agent', entityId: 'a1' });
      await favorites.favorite({ userId: 'u2', entityType: 'agent', entityId: 'a1' });

      const removed = await favorites.deleteFavoritesForEntity({ entityType: 'agent', entityId: 'a1' });
      expect(removed).toBe(2);
      expect(await favorites.isFavorited({ userId: 'u1', entityType: 'agent', entityId: 'a1' })).toBe(false);
      const agent = await agents.getById('a1');
      expect(agent?.favoriteCount).toBe(0);
    });

    it('deletes all favorites for a skill and resets its favoriteCount when it still exists', async () => {
      await seedSkill(skills, 's1');
      await favorites.favorite({ userId: 'u1', entityType: 'skill', entityId: 's1' });
      await favorites.favorite({ userId: 'u2', entityType: 'skill', entityId: 's1' });

      const removed = await favorites.deleteFavoritesForEntity({ entityType: 'skill', entityId: 's1' });
      expect(removed).toBe(2);
      expect(await favorites.isFavorited({ userId: 'u1', entityType: 'skill', entityId: 's1' })).toBe(false);
      const skill = await skills.getById('s1');
      expect(skill?.favoriteCount).toBe(0);
    });
  });
});
