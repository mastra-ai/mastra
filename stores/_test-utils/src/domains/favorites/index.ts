import type { AgentsStorage, MastraStorage, SkillsStorage, FavoritesStorage } from '@mastra/core/storage';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSampleAgent, createSampleSkill } from './data';

export function createFavoritesTests({ storage }: { storage: MastraStorage }) {
  const describeFavorites = storage.stores?.favorites ? describe : describe.skip;

  let favoritesStorage: FavoritesStorage;
  let agentsStorage: AgentsStorage;
  let skillsStorage: SkillsStorage;

  describeFavorites('Favorites Storage', () => {
    beforeAll(async () => {
      const favorites = await storage.getStore('favorites');
      const agents = await storage.getStore('agents');
      const skills = await storage.getStore('skills');
      if (!favorites) throw new Error('Favorites storage not found');
      if (!agents) throw new Error('Agents storage not found');
      if (!skills) throw new Error('Skills storage not found');
      favoritesStorage = favorites;
      agentsStorage = agents;
      skillsStorage = skills;
    });

    beforeEach(async () => {
      await favoritesStorage.dangerouslyClearAll();
      await agentsStorage.dangerouslyClearAll();
      await skillsStorage.dangerouslyClearAll();
    });

    describe('favorite / unfavorite', () => {
      it('favoriting an agent increments favoriteCount and is idempotent', async () => {
        const agent = createSampleAgent();
        await agentsStorage.create({ agent });

        const first = await favoritesStorage.favorite({
          userId: 'u1',
          entityType: 'agent',
          entityId: agent.id,
        });
        expect(first).toEqual({ favorited: true, favoriteCount: 1 });

        const second = await favoritesStorage.favorite({
          userId: 'u1',
          entityType: 'agent',
          entityId: agent.id,
        });
        expect(second).toEqual({ favorited: true, favoriteCount: 1 });

        const stored = await agentsStorage.getById(agent.id);
        expect(stored?.favoriteCount).toBe(1);
      });

      it('favoriting the same entity from two users reaches favoriteCount=2', async () => {
        const agent = createSampleAgent();
        await agentsStorage.create({ agent });

        await favoritesStorage.favorite({ userId: 'u1', entityType: 'agent', entityId: agent.id });
        const result = await favoritesStorage.favorite({
          userId: 'u2',
          entityType: 'agent',
          entityId: agent.id,
        });

        expect(result).toEqual({ favorited: true, favoriteCount: 2 });
      });

      it('unfavorite decrements counter and is idempotent', async () => {
        const agent = createSampleAgent();
        await agentsStorage.create({ agent });
        await favoritesStorage.favorite({ userId: 'u1', entityType: 'agent', entityId: agent.id });

        const first = await favoritesStorage.unfavorite({
          userId: 'u1',
          entityType: 'agent',
          entityId: agent.id,
        });
        expect(first).toEqual({ favorited: false, favoriteCount: 0 });

        const second = await favoritesStorage.unfavorite({
          userId: 'u1',
          entityType: 'agent',
          entityId: agent.id,
        });
        expect(second).toEqual({ favorited: false, favoriteCount: 0 });
      });

      it('unfavorite clamps favoriteCount at 0 when never favorited', async () => {
        const agent = createSampleAgent();
        await agentsStorage.create({ agent });

        const result = await favoritesStorage.unfavorite({
          userId: 'u1',
          entityType: 'agent',
          entityId: agent.id,
        });
        expect(result.favoriteCount).toBe(0);
      });

      it('throws when favoriting a non-existent entity', async () => {
        await expect(
          favoritesStorage.favorite({ userId: 'u1', entityType: 'agent', entityId: 'missing' }),
        ).rejects.toThrow();
      });

      it('separates agent and skill counters even when ids collide', async () => {
        const sharedId = `shared-${Date.now()}`;
        await agentsStorage.create({ agent: createSampleAgent({ id: sharedId }) });
        await skillsStorage.create({ skill: createSampleSkill({ id: sharedId }) });

        await favoritesStorage.favorite({ userId: 'u1', entityType: 'agent', entityId: sharedId });
        const skillResult = await favoritesStorage.favorite({
          userId: 'u1',
          entityType: 'skill',
          entityId: sharedId,
        });
        expect(skillResult.favoriteCount).toBe(1);

        const storedAgent = await agentsStorage.getById(sharedId);
        const storedSkill = await skillsStorage.getById(sharedId);
        expect(storedAgent?.favoriteCount).toBe(1);
        expect(storedSkill?.favoriteCount).toBe(1);
      });
    });

    describe('isFavorited / isFavoritedBatch', () => {
      it('reports favorited state per user', async () => {
        const agent = createSampleAgent();
        await agentsStorage.create({ agent });
        await favoritesStorage.favorite({ userId: 'u1', entityType: 'agent', entityId: agent.id });

        expect(await favoritesStorage.isFavorited({ userId: 'u1', entityType: 'agent', entityId: agent.id })).toBe(
          true,
        );
        expect(await favoritesStorage.isFavorited({ userId: 'u2', entityType: 'agent', entityId: agent.id })).toBe(
          false,
        );
      });

      it('isFavoritedBatch returns only the favorited subset', async () => {
        const a1 = createSampleAgent();
        const a2 = createSampleAgent();
        const a3 = createSampleAgent();
        await agentsStorage.create({ agent: a1 });
        await agentsStorage.create({ agent: a2 });
        await agentsStorage.create({ agent: a3 });

        await favoritesStorage.favorite({ userId: 'u1', entityType: 'agent', entityId: a1.id });
        await favoritesStorage.favorite({ userId: 'u1', entityType: 'agent', entityId: a3.id });

        const result = await favoritesStorage.isFavoritedBatch({
          userId: 'u1',
          entityType: 'agent',
          entityIds: [a1.id, a2.id, a3.id, 'missing'],
        });

        expect(result).toEqual(new Set([a1.id, a3.id]));
      });

      it('isFavoritedBatch returns empty set for empty input', async () => {
        const result = await favoritesStorage.isFavoritedBatch({
          userId: 'u1',
          entityType: 'agent',
          entityIds: [],
        });
        expect(result.size).toBe(0);
      });
    });

    describe('listFavoritedIds', () => {
      it('returns only the caller’s entity IDs scoped by entity type', async () => {
        const a1 = createSampleAgent();
        const a2 = createSampleAgent();
        const s1 = createSampleSkill();
        await agentsStorage.create({ agent: a1 });
        await agentsStorage.create({ agent: a2 });
        await skillsStorage.create({ skill: s1 });

        await favoritesStorage.favorite({ userId: 'u1', entityType: 'agent', entityId: a1.id });
        await favoritesStorage.favorite({ userId: 'u1', entityType: 'skill', entityId: s1.id });
        await favoritesStorage.favorite({ userId: 'u2', entityType: 'agent', entityId: a2.id });

        const u1Agents = await favoritesStorage.listFavoritedIds({ userId: 'u1', entityType: 'agent' });
        const u1Skills = await favoritesStorage.listFavoritedIds({ userId: 'u1', entityType: 'skill' });
        const u2Agents = await favoritesStorage.listFavoritedIds({ userId: 'u2', entityType: 'agent' });

        expect(u1Agents.sort()).toEqual([a1.id]);
        expect(u1Skills.sort()).toEqual([s1.id]);
        expect(u2Agents.sort()).toEqual([a2.id]);
      });
    });

    describe('deleteFavoritesForEntity (cascade)', () => {
      it('removes all favorite rows for the entity', async () => {
        const agent = createSampleAgent();
        await agentsStorage.create({ agent });
        await favoritesStorage.favorite({ userId: 'u1', entityType: 'agent', entityId: agent.id });
        await favoritesStorage.favorite({ userId: 'u2', entityType: 'agent', entityId: agent.id });

        const removed = await favoritesStorage.deleteFavoritesForEntity({
          entityType: 'agent',
          entityId: agent.id,
        });
        expect(removed).toBe(2);

        expect(await favoritesStorage.isFavorited({ userId: 'u1', entityType: 'agent', entityId: agent.id })).toBe(
          false,
        );
        expect(await favoritesStorage.isFavorited({ userId: 'u2', entityType: 'agent', entityId: agent.id })).toBe(
          false,
        );
      });

      it('does not touch favorites for other entities', async () => {
        const a1 = createSampleAgent();
        const a2 = createSampleAgent();
        await agentsStorage.create({ agent: a1 });
        await agentsStorage.create({ agent: a2 });
        await favoritesStorage.favorite({ userId: 'u1', entityType: 'agent', entityId: a1.id });
        await favoritesStorage.favorite({ userId: 'u1', entityType: 'agent', entityId: a2.id });

        await favoritesStorage.deleteFavoritesForEntity({ entityType: 'agent', entityId: a1.id });

        expect(await favoritesStorage.isFavorited({ userId: 'u1', entityType: 'agent', entityId: a2.id })).toBe(true);
      });

      it('resets favoriteCount on the parent agent when it still exists', async () => {
        const agent = createSampleAgent();
        await agentsStorage.create({ agent });
        await favoritesStorage.favorite({ userId: 'u1', entityType: 'agent', entityId: agent.id });
        await favoritesStorage.favorite({ userId: 'u2', entityType: 'agent', entityId: agent.id });

        await favoritesStorage.deleteFavoritesForEntity({ entityType: 'agent', entityId: agent.id });

        const refreshed = await agentsStorage.getById(agent.id);
        expect(refreshed?.favoriteCount).toBe(0);
      });

      it('resets favoriteCount on the parent skill when it still exists', async () => {
        const skill = createSampleSkill();
        await skillsStorage.create({ skill });
        await favoritesStorage.favorite({ userId: 'u1', entityType: 'skill', entityId: skill.id });
        await favoritesStorage.favorite({ userId: 'u2', entityType: 'skill', entityId: skill.id });

        await favoritesStorage.deleteFavoritesForEntity({ entityType: 'skill', entityId: skill.id });

        const refreshed = await skillsStorage.getById(skill.id);
        expect(refreshed?.favoriteCount).toBe(0);
      });
    });

    describe('dangerouslyClearAll (cleanup)', () => {
      it('resets favoriteCount on agents and skills after wiping favorites', async () => {
        const agent = createSampleAgent();
        const skill = createSampleSkill();
        await agentsStorage.create({ agent });
        await skillsStorage.create({ skill });
        await favoritesStorage.favorite({ userId: 'u1', entityType: 'agent', entityId: agent.id });
        await favoritesStorage.favorite({ userId: 'u1', entityType: 'skill', entityId: skill.id });

        await favoritesStorage.dangerouslyClearAll();

        const refreshedAgent = await agentsStorage.getById(agent.id);
        const refreshedSkill = await skillsStorage.getById(skill.id);
        expect(refreshedAgent?.favoriteCount).toBe(0);
        expect(refreshedSkill?.favoriteCount).toBe(0);
      });
    });

    describe('agents.list integration', () => {
      it('favoritedOnly without pinFavoritedFor returns empty page', async () => {
        const a1 = createSampleAgent();
        await agentsStorage.create({ agent: a1 });
        await favoritesStorage.favorite({ userId: 'u1', entityType: 'agent', entityId: a1.id });

        const result = await agentsStorage.list({
          favoritedOnly: true,
          page: 0,
          perPage: 50,
        });
        expect(result.agents).toEqual([]);
        expect(result.total).toBe(0);
      });

      it('favoritedOnly + pinFavoritedFor returns only the user’s favorites', async () => {
        const a1 = createSampleAgent();
        const a2 = createSampleAgent();
        const a3 = createSampleAgent();
        await agentsStorage.create({ agent: a1 });
        await agentsStorage.create({ agent: a2 });
        await agentsStorage.create({ agent: a3 });

        await favoritesStorage.favorite({ userId: 'u1', entityType: 'agent', entityId: a1.id });
        await favoritesStorage.favorite({ userId: 'u1', entityType: 'agent', entityId: a3.id });

        const result = await agentsStorage.list({
          favoritedOnly: true,
          pinFavoritedFor: 'u1',
          page: 0,
          perPage: 50,
        });
        const ids = result.agents.map(a => a.id).sort();
        expect(ids).toEqual([a1.id, a3.id].sort());
        expect(result.total).toBe(2);
      });

      it('pinFavoritedFor places favorited agents first', async () => {
        const a1 = createSampleAgent();
        const a2 = createSampleAgent();
        const a3 = createSampleAgent();
        await agentsStorage.create({ agent: a1 });
        await agentsStorage.create({ agent: a2 });
        await agentsStorage.create({ agent: a3 });

        await favoritesStorage.favorite({ userId: 'u1', entityType: 'agent', entityId: a2.id });

        const result = await agentsStorage.list({
          pinFavoritedFor: 'u1',
          page: 0,
          perPage: 50,
        });
        expect(result.agents[0]?.id).toBe(a2.id);
      });

      it('entityIds filter is honored', async () => {
        const a1 = createSampleAgent();
        const a2 = createSampleAgent();
        await agentsStorage.create({ agent: a1 });
        await agentsStorage.create({ agent: a2 });

        const result = await agentsStorage.list({
          entityIds: [a1.id],
          page: 0,
          perPage: 50,
        });
        expect(result.agents.map(a => a.id)).toEqual([a1.id]);
        expect(result.total).toBe(1);
      });

      it('entityIds: [] returns empty page without scanning', async () => {
        await agentsStorage.create({ agent: createSampleAgent() });

        const result = await agentsStorage.list({
          entityIds: [],
          page: 0,
          perPage: 50,
        });
        expect(result.agents).toEqual([]);
        expect(result.total).toBe(0);
      });
    });

    describe('skills.list integration', () => {
      it('favoritedOnly without pinFavoritedFor returns empty page', async () => {
        const s1 = createSampleSkill();
        await skillsStorage.create({ skill: s1 });
        await favoritesStorage.favorite({ userId: 'u1', entityType: 'skill', entityId: s1.id });

        const result = await skillsStorage.list({
          favoritedOnly: true,
          page: 0,
          perPage: 50,
        });
        expect(result.skills).toEqual([]);
        expect(result.total).toBe(0);
      });

      it('favoritedOnly + pinFavoritedFor returns only the user’s favorites', async () => {
        const s1 = createSampleSkill();
        const s2 = createSampleSkill();
        await skillsStorage.create({ skill: s1 });
        await skillsStorage.create({ skill: s2 });

        await favoritesStorage.favorite({ userId: 'u1', entityType: 'skill', entityId: s1.id });

        const result = await skillsStorage.list({
          favoritedOnly: true,
          pinFavoritedFor: 'u1',
          page: 0,
          perPage: 50,
        });
        const ids = result.skills.map(s => s.id);
        expect(ids).toEqual([s1.id]);
        expect(result.total).toBe(1);
      });

      it('pinFavoritedFor places favorited skills first', async () => {
        const s1 = createSampleSkill();
        const s2 = createSampleSkill();
        await skillsStorage.create({ skill: s1 });
        await skillsStorage.create({ skill: s2 });

        await favoritesStorage.favorite({ userId: 'u1', entityType: 'skill', entityId: s2.id });

        const result = await skillsStorage.list({
          pinFavoritedFor: 'u1',
          page: 0,
          perPage: 50,
        });
        expect(result.skills[0]?.id).toBe(s2.id);
      });
    });
  });
}
