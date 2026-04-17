import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryDB } from '../inmemory-db';
import { InMemorySkillsStorage } from './inmemory';

describe('InMemorySkillsStorage - record-level metadata', () => {
  let db: InMemoryDB;
  let storage: InMemorySkillsStorage;

  beforeEach(() => {
    db = new InMemoryDB();
    storage = new InMemorySkillsStorage({ db });
  });

  it('persists metadata on the thin record at create time', async () => {
    const skillId = 'skill-meta-create';
    const result = await storage.create({
      skill: {
        id: skillId,
        authorId: 'user-1',
        metadata: { visibility: 'public' },
        name: 'Public Skill',
        description: 'Shared skill',
        instructions: 'Do the thing',
      },
    });

    expect(result.id).toBe(skillId);
    expect(result.metadata).toEqual({ visibility: 'public' });

    const fetched = await storage.getById(skillId);
    expect(fetched?.metadata).toEqual({ visibility: 'public' });
  });

  it('merges metadata on update without creating a new version', async () => {
    const skillId = 'skill-meta-update';
    await storage.create({
      skill: {
        id: skillId,
        authorId: 'user-1',
        metadata: { visibility: 'private', stars: 0 },
        name: 'Skill',
        description: 'd',
        instructions: 'i',
      },
    });

    const before = await storage.countVersions(skillId);
    expect(before).toBe(1);

    const updated = await storage.update({
      id: skillId,
      metadata: { visibility: 'public' },
    });

    expect(updated.metadata).toEqual({ visibility: 'public', stars: 0 });

    const after = await storage.countVersions(skillId);
    expect(after).toBe(1);
  });

  it('filters list() by metadata fields (AND match)', async () => {
    await storage.create({
      skill: {
        id: 'skill-public',
        authorId: 'user-1',
        metadata: { visibility: 'public' },
        name: 'Public',
        description: 'd',
        instructions: 'i',
      },
    });
    await storage.create({
      skill: {
        id: 'skill-private',
        authorId: 'user-1',
        metadata: { visibility: 'private' },
        name: 'Private',
        description: 'd',
        instructions: 'i',
      },
    });
    await storage.create({
      skill: {
        id: 'skill-no-meta',
        authorId: 'user-1',
        name: 'NoMeta',
        description: 'd',
        instructions: 'i',
      },
    });

    const publicOnly = await storage.list({ metadata: { visibility: 'public' } });
    expect(publicOnly.skills.map(s => s.id)).toEqual(['skill-public']);

    const privateOnly = await storage.list({ metadata: { visibility: 'private' } });
    expect(privateOnly.skills.map(s => s.id)).toEqual(['skill-private']);
  });
});
