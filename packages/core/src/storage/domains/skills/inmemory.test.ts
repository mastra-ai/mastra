import { describe, expect, it } from 'vitest';

import { InMemoryDB } from '../inmemory-db';
import { InMemorySkillsStorage } from './inmemory';

describe('InMemorySkillsStorage', () => {
  it('does not create a new version for reordered metadata and tree with undefined license', async () => {
    const skills = new InMemorySkillsStorage({ db: new InMemoryDB() });

    await skills.create({
      skill: {
        id: 'stable-skill',
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

    const latest = await skills.getLatestVersion('stable-skill');
    expect(latest?.versionNumber).toBe(1);

    await skills.update({
      id: 'stable-skill',
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

    expect(await skills.countVersions('stable-skill')).toBe(1);
    expect((await skills.getLatestVersion('stable-skill'))?.versionNumber).toBe(1);
  });
});
