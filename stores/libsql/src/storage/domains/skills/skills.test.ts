import { createClient } from '@libsql/client';
import { beforeEach, describe, expect, it } from 'vitest';

import { LibSQLStore } from '../../index';

describe('SkillsLibSQL - record-level metadata', () => {
  let store: LibSQLStore;

  beforeEach(async () => {
    // Each test gets its own isolated in-memory database.
    store = new LibSQLStore({
      id: `skills-test-${Math.random().toString(36).slice(2)}`,
      client: createClient({ url: ':memory:' }),
    });
    await store.init();
  });

  it('persists metadata on the thin record at create time', async () => {
    const skills = await store.getStore('skills');
    expect(skills).toBeTruthy();

    const skillId = 'skill-meta-create';
    const result = await skills!.create({
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

    const fetched = await skills!.getById(skillId);
    expect(fetched?.metadata).toEqual({ visibility: 'public' });
  });

  it('merges metadata on update without creating a new version', async () => {
    const skills = await store.getStore('skills');
    const skillId = 'skill-meta-update';

    await skills!.create({
      skill: {
        id: skillId,
        authorId: 'user-1',
        metadata: { visibility: 'private', stars: 0 },
        name: 'Skill',
        description: 'd',
        instructions: 'i',
      },
    });

    const before = await skills!.countVersions(skillId);
    expect(before).toBe(1);

    const updated = await skills!.update({
      id: skillId,
      metadata: { visibility: 'public' },
    });

    expect(updated.metadata).toEqual({ visibility: 'public', stars: 0 });

    const after = await skills!.countVersions(skillId);
    expect(after).toBe(1);
  });

  it('does not fail when the update body spreads all snapshot fields as undefined', async () => {
    // Reproduces the crash where HTTP handlers forward every body key even when
    // only `metadata` changed. `undefined` must not leak into the insert args.
    const skills = await store.getStore('skills');
    const skillId = 'skill-undefined-fields';

    await skills!.create({
      skill: {
        id: skillId,
        authorId: 'user-1',
        metadata: { visibility: 'private' },
        name: 'Skill',
        description: 'd',
        instructions: 'i',
      },
    });

    const before = await skills!.countVersions(skillId);

    const updated = await skills!.update({
      id: skillId,
      authorId: undefined,
      name: undefined,
      description: undefined,
      instructions: undefined,
      license: undefined,
      compatibility: undefined,
      source: undefined,
      references: undefined,
      scripts: undefined,
      assets: undefined,
      metadata: { visibility: 'public' },
    });

    expect(updated.metadata).toEqual({ visibility: 'public' });
    const after = await skills!.countVersions(skillId);
    expect(after).toBe(before);
  });

  it('filters list() by metadata fields (AND match)', async () => {
    const skills = await store.getStore('skills');

    await skills!.create({
      skill: {
        id: 'skill-public',
        authorId: 'user-1',
        metadata: { visibility: 'public' },
        name: 'Public',
        description: 'd',
        instructions: 'i',
      },
    });
    await skills!.create({
      skill: {
        id: 'skill-private',
        authorId: 'user-1',
        metadata: { visibility: 'private' },
        name: 'Private',
        description: 'd',
        instructions: 'i',
      },
    });
    await skills!.create({
      skill: {
        id: 'skill-no-meta',
        authorId: 'user-1',
        name: 'NoMeta',
        description: 'd',
        instructions: 'i',
      },
    });

    const publicOnly = await skills!.list({ metadata: { visibility: 'public' } });
    expect(publicOnly.skills.map(s => s.id)).toEqual(['skill-public']);

    const privateOnly = await skills!.list({ metadata: { visibility: 'private' } });
    expect(privateOnly.skills.map(s => s.id)).toEqual(['skill-private']);
  });

  it('resolveEntity prefers record-level metadata over version metadata', async () => {
    const skills = await store.getStore('skills');
    const skillId = 'skill-resolve-meta';

    await skills!.create({
      skill: {
        id: skillId,
        authorId: 'user-1',
        metadata: { visibility: 'public' },
        name: 'Skill',
        description: 'd',
        instructions: 'i',
      },
    });

    const resolved = await skills!.getByIdResolved(skillId);
    expect(resolved?.metadata).toEqual({ visibility: 'public' });
  });
});
