import type { MastraStorage, SkillsStorage, StorageCreateSkillInput } from '@mastra/core/storage';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

const createSkill = (id: string): StorageCreateSkillInput => ({
  id,
  authorId: 'owner',
  visibility: 'public',
  name: 'Stable Snapshot',
  description: 'Original description',
  instructions: 'Original instructions',
  metadata: {
    alpha: { enabled: true, count: 1 },
    beta: ['one', 'two'],
  },
  tree: {
    entries: {
      'SKILL.md': { blobHash: 'hash-1', size: 100, mimeType: 'text/markdown' },
      'scripts/setup.sh': { blobHash: 'hash-2', size: 50 },
    },
  },
});

export function createSkillsTests({ storage }: { storage: MastraStorage }) {
  const describeSkills = storage.stores?.skills ? describe : describe.skip;
  let skillsStorage: SkillsStorage;

  describeSkills('Skills Storage', () => {
    beforeAll(async () => {
      const skills = await storage.getStore('skills');
      if (!skills) throw new Error('Skills storage not found');
      skillsStorage = skills;
    });

    beforeEach(async () => {
      await skillsStorage.dangerouslyClearAll();
    });

    it('persists visibility on create, update, and list', async () => {
      const publicSkill = createSkill(`skill-public-${Date.now()}`);
      const created = await skillsStorage.create({ skill: publicSkill });
      expect(created.visibility).toBe('public');
      expect((await skillsStorage.getById(publicSkill.id))?.visibility).toBe('public');

      const { visibility: _visibility, ...privateInput } = createSkill(`skill-private-${Date.now()}`);
      await skillsStorage.create({ skill: privateInput });
      expect((await skillsStorage.getById(privateInput.id))?.visibility).toBe('private');

      const publicList = await skillsStorage.list({ visibility: 'public' });
      expect(publicList.skills.map(s => s.id)).toEqual([publicSkill.id]);

      await skillsStorage.update({ id: privateInput.id, visibility: 'public' });
      expect((await skillsStorage.getById(privateInput.id))?.visibility).toBe('public');
      expect(await skillsStorage.countVersions(privateInput.id)).toBe(1);

      const updatedList = await skillsStorage.list({ visibility: 'public' });
      expect(updatedList.skills.map(s => s.id).sort()).toEqual([privateInput.id, publicSkill.id].sort());
    });

    it('list filters by status and entityIds, with filtered totals', async () => {
      const draft = createSkill(`skill-draft-${Date.now()}`);
      const published = createSkill(`skill-pub-${Date.now()}`);
      await skillsStorage.create({ skill: draft });
      await skillsStorage.create({ skill: published });
      const latest = await skillsStorage.getLatestVersion(published.id);
      await skillsStorage.update({ id: published.id, activeVersionId: latest!.id, status: 'published' });

      const byStatus = await skillsStorage.list({ status: 'published' });
      expect(byStatus.skills.map(s => s.id)).toEqual([published.id]);
      expect(byStatus.total).toBe(1);

      const empty = await skillsStorage.list({ entityIds: [] });
      expect(empty.skills).toEqual([]);
      expect(empty.total).toBe(0);

      const byIds = await skillsStorage.list({ entityIds: [draft.id] });
      expect(byIds.skills.map(s => s.id)).toEqual([draft.id]);
      expect(byIds.total).toBe(1);

      const combined = await skillsStorage.list({ entityIds: [draft.id], status: 'published' });
      expect(combined.skills).toEqual([]);
      expect(combined.total).toBe(0);
    });

    it('does not create duplicate versions for semantically unchanged snapshots', async () => {
      const skill = createSkill(`skill-${Date.now()}`);
      await skillsStorage.create({ skill });

      await skillsStorage.update({
        id: skill.id,
        license: undefined,
        metadata: {
          beta: ['one', 'two'],
          alpha: { count: 1, enabled: true },
        },
        tree: {
          entries: {
            'scripts/setup.sh': { size: 50, blobHash: 'hash-2' },
            'SKILL.md': { mimeType: 'text/markdown', size: 100, blobHash: 'hash-1' },
          },
        },
      });

      expect(await skillsStorage.countVersions(skill.id)).toBe(1);
    });

    it('getVersions returns all requested versions and omits missing ids', async () => {
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        const skill = createSkill(`skill-batch-${i}-${Date.now()}`);
        await skillsStorage.create({ skill });
        const latest = await skillsStorage.getLatestVersion(skill.id);
        ids.push(latest!.id);
      }

      const versions = await skillsStorage.getVersions([...ids, 'missing-version-id']);
      expect(versions.map(v => v.id).sort()).toEqual([...ids].sort());
      expect(await skillsStorage.getVersions([])).toEqual([]);
    });

    it('listResolved resolves published skills with their active version in one batch', async () => {
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const skill = createSkill(`skill-published-${i}-${Date.now()}`);
        await skillsStorage.create({ skill });
        const latest = await skillsStorage.getLatestVersion(skill.id);
        await skillsStorage.update({ id: skill.id, activeVersionId: latest!.id, status: 'published' });
        ids.push(skill.id);
      }

      const result = await skillsStorage.listResolved({ perPage: false, status: 'published' });
      expect(result.skills).toHaveLength(5);
      for (const skill of result.skills) {
        expect(ids).toContain(skill.id);
        expect(skill.resolvedVersionId).toBe(skill.activeVersionId);
        expect(skill.instructions).toBe('Original instructions');
      }
    });
  });
}
