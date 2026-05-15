import { randomUUID } from 'node:crypto';

import type { MastraStorage, SkillsStorage } from '@mastra/core/storage';
import { beforeAll, describe, expect, it } from 'vitest';

export function createSkillsTests({ storage }: { storage: MastraStorage }) {
  const describeSkills = storage.stores?.skills ? describe : describe.skip;

  let skillsStorage: SkillsStorage;

  describeSkills('Skills Storage', () => {
    beforeAll(async () => {
      const store = await storage.getStore('skills');
      if (!store) {
        throw new Error('Skills storage not found');
      }
      skillsStorage = store;
      await skillsStorage.dangerouslyClearAll();
    });

    it('does not create a new version for reordered metadata and tree with undefined license', async () => {
      const skillId = `stable-skill-${randomUUID()}`;

      await skillsStorage.create({
        skill: {
          id: skillId,
          name: 'stable-skill',
          description: 'A skill used to verify snapshot update stability',
          instructions: 'Keep the stored snapshot stable',
          metadata: {
            scope: 'project',
            origin: 'local',
            path: 'skills/stable-skill',
          },
          tree: {
            entries: {
              'SKILL.md': {
                blobHash: 'skill-hash',
                size: 42,
              },
              'references/guide.md': {
                blobHash: 'guide-hash',
                size: 24,
              },
            },
          },
        },
      });

      const latest = await skillsStorage.getLatestVersion(skillId);
      expect(latest?.versionNumber).toBe(1);

      await skillsStorage.update({
        id: skillId,
        license: undefined,
        metadata: {
          path: 'skills/stable-skill',
          origin: 'local',
          scope: 'project',
        },
        tree: {
          entries: {
            'references/guide.md': {
              size: 24,
              blobHash: 'guide-hash',
            },
            'SKILL.md': {
              size: 42,
              blobHash: 'skill-hash',
              mimeType: undefined,
            },
          },
        },
      });

      expect(await skillsStorage.countVersions(skillId)).toBe(1);
      expect((await skillsStorage.getLatestVersion(skillId))?.versionNumber).toBe(1);
    });
  });
}
