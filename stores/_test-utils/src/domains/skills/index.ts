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
