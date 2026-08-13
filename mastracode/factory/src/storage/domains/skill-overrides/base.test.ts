import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../../test-utils.js';

describe('SkillOverridesStorage', () => {
  it('creates an override on first upsert and scopes reads to (org, name)', async () => {
    const seed = await createFactoryStorageForTests();

    const record = await seed.skillOverrides.upsert({
      orgId: 'org-1',
      name: 'factory-triage',
      description: 'Custom triage',
      content: '# My triage playbook',
    });

    expect(record).toMatchObject({
      orgId: 'org-1',
      name: 'factory-triage',
      description: 'Custom triage',
      content: '# My triage playbook',
    });
    expect(await seed.skillOverrides.get({ orgId: 'org-1', name: 'factory-triage' })).toEqual(record);
    expect(await seed.skillOverrides.get({ orgId: 'other-org', name: 'factory-triage' })).toBeNull();
    expect(await seed.skillOverrides.get({ orgId: 'org-1', name: 'factory-plan' })).toBeNull();
  });

  it('replaces description and content on subsequent upserts', async () => {
    const seed = await createFactoryStorageForTests();

    const first = await seed.skillOverrides.upsert({
      orgId: 'org-1',
      name: 'factory-plan',
      description: 'v1',
      content: 'one',
    });
    const second = await seed.skillOverrides.upsert({
      orgId: 'org-1',
      name: 'factory-plan',
      description: 'v2',
      content: 'two',
    });

    expect(second.description).toBe('v2');
    expect(second.content).toBe('two');
    expect(second.createdAt).toEqual(first.createdAt);
    const stored = await seed.skillOverrides.get({ orgId: 'org-1', name: 'factory-plan' });
    expect(stored?.content).toBe('two');
  });

  it('lists overrides for one org sorted by name', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.skillOverrides.upsert({ orgId: 'org-1', name: 'factory-triage', description: 'd', content: 'c' });
    await seed.skillOverrides.upsert({ orgId: 'org-1', name: 'factory-plan', description: 'd', content: 'c' });
    await seed.skillOverrides.upsert({ orgId: 'org-2', name: 'factory-review', description: 'd', content: 'c' });

    const listed = await seed.skillOverrides.list({ orgId: 'org-1' });
    expect(listed.map(record => record.name)).toEqual(['factory-plan', 'factory-triage']);
  });

  it('deletes an override and reports whether a row existed', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.skillOverrides.upsert({ orgId: 'org-1', name: 'factory-review', description: 'd', content: 'c' });

    expect(await seed.skillOverrides.delete({ orgId: 'org-1', name: 'factory-review' })).toBe(true);
    expect(await seed.skillOverrides.get({ orgId: 'org-1', name: 'factory-review' })).toBeNull();
    expect(await seed.skillOverrides.delete({ orgId: 'org-1', name: 'factory-review' })).toBe(false);
  });

  it('resolves concurrent first writes to a single row', async () => {
    const seed = await createFactoryStorageForTests();

    const [a, b] = await Promise.all([
      seed.skillOverrides.upsert({ orgId: 'org-1', name: 'factory-triage', description: 'a', content: 'a' }),
      seed.skillOverrides.upsert({ orgId: 'org-1', name: 'factory-triage', description: 'b', content: 'b' }),
    ]);

    expect(a.name).toBe('factory-triage');
    expect(b.name).toBe('factory-triage');
    const listed = await seed.skillOverrides.list({ orgId: 'org-1' });
    expect(listed).toHaveLength(1);
  });
});
