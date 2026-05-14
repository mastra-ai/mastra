import type { AgentsStorage, MastraStorage, SkillsStorage, StarsStorage } from '@mastra/core/storage';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSampleAgent, createSampleSkill } from './data';

export function createStarsTests({ storage }: { storage: MastraStorage }) {
  const describeStars = storage.stores?.stars ? describe : describe.skip;

  let starsStorage: StarsStorage;
  let agentsStorage: AgentsStorage;
  let skillsStorage: SkillsStorage;

  describeStars('Stars Storage', () => {
    beforeAll(async () => {
      const stars = await storage.getStore('stars');
      const agents = await storage.getStore('agents');
      const skills = await storage.getStore('skills');
      if (!stars) throw new Error('Stars storage not found');
      if (!agents) throw new Error('Agents storage not found');
      if (!skills) throw new Error('Skills storage not found');
      starsStorage = stars;
      agentsStorage = agents;
      skillsStorage = skills;
    });

    beforeEach(async () => {
      await starsStorage.dangerouslyClearAll();
      await agentsStorage.dangerouslyClearAll();
      await skillsStorage.dangerouslyClearAll();
    });

    describe('star / unstar', () => {
      it('starring an agent increments starCount and is idempotent', async () => {
        const agent = createSampleAgent();
        await agentsStorage.create({ agent });

        const first = await starsStorage.star({
          userId: 'u1',
          entityType: 'agent',
          entityId: agent.id,
        });
        expect(first).toEqual({ starred: true, starCount: 1 });

        const second = await starsStorage.star({
          userId: 'u1',
          entityType: 'agent',
          entityId: agent.id,
        });
        expect(second).toEqual({ starred: true, starCount: 1 });

        const stored = await agentsStorage.getById(agent.id);
        expect(stored?.starCount).toBe(1);
      });

      it('starring the same entity from two users reaches starCount=2', async () => {
        const agent = createSampleAgent();
        await agentsStorage.create({ agent });

        await starsStorage.star({ userId: 'u1', entityType: 'agent', entityId: agent.id });
        const result = await starsStorage.star({
          userId: 'u2',
          entityType: 'agent',
          entityId: agent.id,
        });

        expect(result).toEqual({ starred: true, starCount: 2 });
      });

      it('unstar decrements counter and is idempotent', async () => {
        const agent = createSampleAgent();
        await agentsStorage.create({ agent });
        await starsStorage.star({ userId: 'u1', entityType: 'agent', entityId: agent.id });

        const first = await starsStorage.unstar({
          userId: 'u1',
          entityType: 'agent',
          entityId: agent.id,
        });
        expect(first).toEqual({ starred: false, starCount: 0 });

        const second = await starsStorage.unstar({
          userId: 'u1',
          entityType: 'agent',
          entityId: agent.id,
        });
        expect(second).toEqual({ starred: false, starCount: 0 });
      });

      it('unstar clamps starCount at 0 when never starred', async () => {
        const agent = createSampleAgent();
        await agentsStorage.create({ agent });

        const result = await starsStorage.unstar({
          userId: 'u1',
          entityType: 'agent',
          entityId: agent.id,
        });
        expect(result.starCount).toBe(0);
      });

      it('throws when starring a non-existent entity', async () => {
        await expect(starsStorage.star({ userId: 'u1', entityType: 'agent', entityId: 'missing' })).rejects.toThrow();
      });

      it('separates agent and skill counters even when ids collide', async () => {
        const sharedId = `shared-${Date.now()}`;
        await agentsStorage.create({ agent: createSampleAgent({ id: sharedId }) });
        await skillsStorage.create({ skill: createSampleSkill({ id: sharedId }) });

        await starsStorage.star({ userId: 'u1', entityType: 'agent', entityId: sharedId });
        const skillResult = await starsStorage.star({
          userId: 'u1',
          entityType: 'skill',
          entityId: sharedId,
        });
        expect(skillResult.starCount).toBe(1);

        const storedAgent = await agentsStorage.getById(sharedId);
        const storedSkill = await skillsStorage.getById(sharedId);
        expect(storedAgent?.starCount).toBe(1);
        expect(storedSkill?.starCount).toBe(1);
      });
    });

    describe('isStarred / isStarredBatch', () => {
      it('reports starred state per user', async () => {
        const agent = createSampleAgent();
        await agentsStorage.create({ agent });
        await starsStorage.star({ userId: 'u1', entityType: 'agent', entityId: agent.id });

        expect(await starsStorage.isStarred({ userId: 'u1', entityType: 'agent', entityId: agent.id })).toBe(true);
        expect(await starsStorage.isStarred({ userId: 'u2', entityType: 'agent', entityId: agent.id })).toBe(false);
      });

      it('isStarredBatch returns only the starred subset', async () => {
        const a1 = createSampleAgent();
        const a2 = createSampleAgent();
        const a3 = createSampleAgent();
        await agentsStorage.create({ agent: a1 });
        await agentsStorage.create({ agent: a2 });
        await agentsStorage.create({ agent: a3 });

        await starsStorage.star({ userId: 'u1', entityType: 'agent', entityId: a1.id });
        await starsStorage.star({ userId: 'u1', entityType: 'agent', entityId: a3.id });

        const result = await starsStorage.isStarredBatch({
          userId: 'u1',
          entityType: 'agent',
          entityIds: [a1.id, a2.id, a3.id, 'missing'],
        });

        expect(result).toEqual(new Set([a1.id, a3.id]));
      });

      it('isStarredBatch returns empty set for empty input', async () => {
        const result = await starsStorage.isStarredBatch({
          userId: 'u1',
          entityType: 'agent',
          entityIds: [],
        });
        expect(result.size).toBe(0);
      });
    });

    describe('listStarredIds', () => {
      it('returns only the caller’s entity IDs scoped by entity type', async () => {
        const a1 = createSampleAgent();
        const a2 = createSampleAgent();
        const s1 = createSampleSkill();
        await agentsStorage.create({ agent: a1 });
        await agentsStorage.create({ agent: a2 });
        await skillsStorage.create({ skill: s1 });

        await starsStorage.star({ userId: 'u1', entityType: 'agent', entityId: a1.id });
        await starsStorage.star({ userId: 'u1', entityType: 'skill', entityId: s1.id });
        await starsStorage.star({ userId: 'u2', entityType: 'agent', entityId: a2.id });

        const u1Agents = await starsStorage.listStarredIds({ userId: 'u1', entityType: 'agent' });
        const u1Skills = await starsStorage.listStarredIds({ userId: 'u1', entityType: 'skill' });
        const u2Agents = await starsStorage.listStarredIds({ userId: 'u2', entityType: 'agent' });

        expect(u1Agents.sort()).toEqual([a1.id]);
        expect(u1Skills.sort()).toEqual([s1.id]);
        expect(u2Agents.sort()).toEqual([a2.id]);
      });
    });

    describe('deleteStarsForEntity (cascade)', () => {
      it('removes all star rows for the entity', async () => {
        const agent = createSampleAgent();
        await agentsStorage.create({ agent });
        await starsStorage.star({ userId: 'u1', entityType: 'agent', entityId: agent.id });
        await starsStorage.star({ userId: 'u2', entityType: 'agent', entityId: agent.id });

        const removed = await starsStorage.deleteStarsForEntity({
          entityType: 'agent',
          entityId: agent.id,
        });
        expect(removed).toBe(2);

        expect(await starsStorage.isStarred({ userId: 'u1', entityType: 'agent', entityId: agent.id })).toBe(false);
        expect(await starsStorage.isStarred({ userId: 'u2', entityType: 'agent', entityId: agent.id })).toBe(false);
      });

      it('does not touch stars for other entities', async () => {
        const a1 = createSampleAgent();
        const a2 = createSampleAgent();
        await agentsStorage.create({ agent: a1 });
        await agentsStorage.create({ agent: a2 });
        await starsStorage.star({ userId: 'u1', entityType: 'agent', entityId: a1.id });
        await starsStorage.star({ userId: 'u1', entityType: 'agent', entityId: a2.id });

        await starsStorage.deleteStarsForEntity({ entityType: 'agent', entityId: a1.id });

        expect(await starsStorage.isStarred({ userId: 'u1', entityType: 'agent', entityId: a2.id })).toBe(true);
      });
    });

    describe('agents.list integration', () => {
      it('starredOnly + pinStarredFor returns only the user’s stars', async () => {
        const a1 = createSampleAgent();
        const a2 = createSampleAgent();
        const a3 = createSampleAgent();
        await agentsStorage.create({ agent: a1 });
        await agentsStorage.create({ agent: a2 });
        await agentsStorage.create({ agent: a3 });

        await starsStorage.star({ userId: 'u1', entityType: 'agent', entityId: a1.id });
        await starsStorage.star({ userId: 'u1', entityType: 'agent', entityId: a3.id });

        const result = await agentsStorage.list({
          starredOnly: true,
          pinStarredFor: 'u1',
          page: 0,
          perPage: 50,
        });
        const ids = result.agents.map(a => a.id).sort();
        expect(ids).toEqual([a1.id, a3.id].sort());
        expect(result.total).toBe(2);
      });

      it('pinStarredFor places starred agents first', async () => {
        const a1 = createSampleAgent();
        const a2 = createSampleAgent();
        const a3 = createSampleAgent();
        await agentsStorage.create({ agent: a1 });
        await agentsStorage.create({ agent: a2 });
        await agentsStorage.create({ agent: a3 });

        await starsStorage.star({ userId: 'u1', entityType: 'agent', entityId: a2.id });

        const result = await agentsStorage.list({
          pinStarredFor: 'u1',
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
      it('starredOnly + pinStarredFor returns only the user’s stars', async () => {
        const s1 = createSampleSkill();
        const s2 = createSampleSkill();
        await skillsStorage.create({ skill: s1 });
        await skillsStorage.create({ skill: s2 });

        await starsStorage.star({ userId: 'u1', entityType: 'skill', entityId: s1.id });

        const result = await skillsStorage.list({
          starredOnly: true,
          pinStarredFor: 'u1',
          page: 0,
          perPage: 50,
        });
        const ids = result.skills.map(s => s.id);
        expect(ids).toEqual([s1.id]);
        expect(result.total).toBe(1);
      });

      it('pinStarredFor places starred skills first', async () => {
        const s1 = createSampleSkill();
        const s2 = createSampleSkill();
        await skillsStorage.create({ skill: s1 });
        await skillsStorage.create({ skill: s2 });

        await starsStorage.star({ userId: 'u1', entityType: 'skill', entityId: s2.id });

        const result = await skillsStorage.list({
          pinStarredFor: 'u1',
          page: 0,
          perPage: 50,
        });
        expect(result.skills[0]?.id).toBe(s2.id);
      });
    });
  });
}
