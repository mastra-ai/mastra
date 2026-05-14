import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryAgentsStorage } from '../agents/inmemory';
import { InMemoryDB } from '../inmemory-db';
import { InMemorySkillsStorage } from '../skills/inmemory';
import { InMemoryStarsStorage } from './inmemory';

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

describe('InMemoryStarsStorage', () => {
  let db: InMemoryDB;
  let agents: InMemoryAgentsStorage;
  let skills: InMemorySkillsStorage;
  let stars: InMemoryStarsStorage;

  beforeEach(() => {
    db = new InMemoryDB();
    agents = new InMemoryAgentsStorage({ db });
    skills = new InMemorySkillsStorage({ db });
    stars = new InMemoryStarsStorage({ db });
  });

  describe('star / unstar', () => {
    it('starring an agent increments starCount and is idempotent', async () => {
      await seedAgent(agents, 'a1');

      const first = await stars.star({ userId: 'u1', entityType: 'agent', entityId: 'a1' });
      expect(first).toEqual({ starred: true, starCount: 1 });

      const second = await stars.star({ userId: 'u1', entityType: 'agent', entityId: 'a1' });
      expect(second).toEqual({ starred: true, starCount: 1 });

      const agent = await agents.getById('a1');
      expect(agent?.starCount).toBe(1);
    });

    it('starring the same entity from two users increments to 2', async () => {
      await seedAgent(agents, 'a1');

      await stars.star({ userId: 'u1', entityType: 'agent', entityId: 'a1' });
      const result = await stars.star({ userId: 'u2', entityType: 'agent', entityId: 'a1' });

      expect(result).toEqual({ starred: true, starCount: 2 });
    });

    it('unstar decrements counter and is idempotent', async () => {
      await seedAgent(agents, 'a1');
      await stars.star({ userId: 'u1', entityType: 'agent', entityId: 'a1' });

      const first = await stars.unstar({ userId: 'u1', entityType: 'agent', entityId: 'a1' });
      expect(first).toEqual({ starred: false, starCount: 0 });

      const second = await stars.unstar({ userId: 'u1', entityType: 'agent', entityId: 'a1' });
      expect(second).toEqual({ starred: false, starCount: 0 });
    });

    it('unstar clamps starCount at 0', async () => {
      await seedAgent(agents, 'a1');

      // No-op unstar without a prior star should not produce a negative count.
      const result = await stars.unstar({ userId: 'u1', entityType: 'agent', entityId: 'a1' });
      expect(result.starCount).toBe(0);
    });

    it('throws when starring an entity that does not exist', async () => {
      await expect(stars.star({ userId: 'u1', entityType: 'agent', entityId: 'missing' })).rejects.toThrow(
        /agent with id missing does not exist/,
      );
    });

    it('separates agent and skill counters', async () => {
      await seedAgent(agents, 'shared');
      await seedSkill(skills, 'shared');

      await stars.star({ userId: 'u1', entityType: 'agent', entityId: 'shared' });
      const skillResult = await stars.star({ userId: 'u1', entityType: 'skill', entityId: 'shared' });
      expect(skillResult.starCount).toBe(1);

      const agent = await agents.getById('shared');
      const skill = await skills.getById('shared');
      expect(agent?.starCount).toBe(1);
      expect(skill?.starCount).toBe(1);
    });
  });

  describe('isStarred / isStarredBatch', () => {
    it('reports starred state per user', async () => {
      await seedAgent(agents, 'a1');
      await stars.star({ userId: 'u1', entityType: 'agent', entityId: 'a1' });

      expect(await stars.isStarred({ userId: 'u1', entityType: 'agent', entityId: 'a1' })).toBe(true);
      expect(await stars.isStarred({ userId: 'u2', entityType: 'agent', entityId: 'a1' })).toBe(false);
    });

    it('isStarredBatch returns only the starred subset', async () => {
      await seedAgent(agents, 'a1');
      await seedAgent(agents, 'a2');
      await seedAgent(agents, 'a3');
      await stars.star({ userId: 'u1', entityType: 'agent', entityId: 'a1' });
      await stars.star({ userId: 'u1', entityType: 'agent', entityId: 'a3' });

      const result = await stars.isStarredBatch({
        userId: 'u1',
        entityType: 'agent',
        entityIds: ['a1', 'a2', 'a3', 'missing'],
      });

      expect(result).toEqual(new Set(['a1', 'a3']));
    });
  });

  describe('listStarredIds', () => {
    it('returns only the caller’s entity IDs scoped by entity type', async () => {
      await seedAgent(agents, 'a1');
      await seedAgent(agents, 'a2');
      await seedSkill(skills, 's1');

      await stars.star({ userId: 'u1', entityType: 'agent', entityId: 'a1' });
      await stars.star({ userId: 'u1', entityType: 'skill', entityId: 's1' });
      await stars.star({ userId: 'u2', entityType: 'agent', entityId: 'a2' });

      const u1Agents = await stars.listStarredIds({ userId: 'u1', entityType: 'agent' });
      const u1Skills = await stars.listStarredIds({ userId: 'u1', entityType: 'skill' });
      const u2Agents = await stars.listStarredIds({ userId: 'u2', entityType: 'agent' });

      expect(u1Agents.sort()).toEqual(['a1']);
      expect(u1Skills.sort()).toEqual(['s1']);
      expect(u2Agents.sort()).toEqual(['a2']);
    });
  });

  describe('deleteStarsForEntity (cascade)', () => {
    it('removes all star rows for the entity and reports the count', async () => {
      await seedAgent(agents, 'a1');
      await stars.star({ userId: 'u1', entityType: 'agent', entityId: 'a1' });
      await stars.star({ userId: 'u2', entityType: 'agent', entityId: 'a1' });

      const removed = await stars.deleteStarsForEntity({ entityType: 'agent', entityId: 'a1' });
      expect(removed).toBe(2);

      expect(await stars.isStarred({ userId: 'u1', entityType: 'agent', entityId: 'a1' })).toBe(false);
      expect(await stars.isStarred({ userId: 'u2', entityType: 'agent', entityId: 'a1' })).toBe(false);
    });

    it('does not touch stars for other entities', async () => {
      await seedAgent(agents, 'a1');
      await seedAgent(agents, 'a2');
      await stars.star({ userId: 'u1', entityType: 'agent', entityId: 'a1' });
      await stars.star({ userId: 'u1', entityType: 'agent', entityId: 'a2' });

      const removed = await stars.deleteStarsForEntity({ entityType: 'agent', entityId: 'a1' });
      expect(removed).toBe(1);

      expect(await stars.isStarred({ userId: 'u1', entityType: 'agent', entityId: 'a2' })).toBe(true);
    });
  });

  describe('list integration: pinStarredFor + entityIds', () => {
    it('pinStarredFor pushes starred agents to the front and is stable', async () => {
      const t = new Date('2026-01-01T00:00:00Z');
      await seedAgent(agents, 'a1', 'owner', { createdAt: t });
      await seedAgent(agents, 'a2', 'owner', { createdAt: t });
      await seedAgent(agents, 'a3', 'owner', { createdAt: t });
      await seedAgent(agents, 'a4', 'owner', { createdAt: t });

      await stars.star({ userId: 'u1', entityType: 'agent', entityId: 'a3' });
      await stars.star({ userId: 'u1', entityType: 'agent', entityId: 'a1' });

      const result = await agents.list({ pinStarredFor: 'u1', orderBy: { field: 'createdAt', direction: 'DESC' } });

      // Starred (a1, a3) come first, ordered by id ASC due to identical timestamps.
      expect(result.agents.map(a => a.id)).toEqual(['a1', 'a3', 'a2', 'a4']);
    });

    it('entityIds restricts list output (used by ?starredOnly=true)', async () => {
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

    it('paginates stably with same-createdAt + tie-break id ASC', async () => {
      const t = new Date('2026-01-01T00:00:00Z');
      const ids = ['a01', 'a02', 'a03', 'a04', 'a05', 'a06', 'a07', 'a08', 'a09', 'a10'];
      for (const id of ids) {
        await seedAgent(agents, id, 'owner', { createdAt: t });
      }
      // Star a few; pagination must still be deterministic.
      await stars.star({ userId: 'u1', entityType: 'agent', entityId: 'a05' });
      await stars.star({ userId: 'u1', entityType: 'agent', entityId: 'a02' });

      const collected: string[] = [];
      for (const page of [0, 1, 2, 3]) {
        const result = await agents.list({ pinStarredFor: 'u1', perPage: 3, page });
        collected.push(...result.agents.map(a => a.id));
      }

      expect(collected).toHaveLength(ids.length);
      expect(new Set(collected).size).toBe(ids.length);
      // Starred ids appear first, in id ASC order.
      expect(collected.slice(0, 2)).toEqual(['a02', 'a05']);
    });
  });

  describe('dangerouslyClearAll', () => {
    it('clears all stars and resets parent counters', async () => {
      await seedAgent(agents, 'a1');
      await stars.star({ userId: 'u1', entityType: 'agent', entityId: 'a1' });

      await stars.dangerouslyClearAll();
      expect(await stars.isStarred({ userId: 'u1', entityType: 'agent', entityId: 'a1' })).toBe(false);
      const agent = await agents.getById('a1');
      expect(agent?.starCount).toBe(0);
    });
  });

  describe('deleteStarsForEntity', () => {
    it('deletes all stars for the entity and resets its starCount when it still exists', async () => {
      await seedAgent(agents, 'a1');
      await stars.star({ userId: 'u1', entityType: 'agent', entityId: 'a1' });
      await stars.star({ userId: 'u2', entityType: 'agent', entityId: 'a1' });

      const removed = await stars.deleteStarsForEntity({ entityType: 'agent', entityId: 'a1' });
      expect(removed).toBe(2);
      expect(await stars.isStarred({ userId: 'u1', entityType: 'agent', entityId: 'a1' })).toBe(false);
      const agent = await agents.getById('a1');
      expect(agent?.starCount).toBe(0);
    });
  });
});
