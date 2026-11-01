import { randomUUID } from 'node:crypto';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { describe, expect, it, onTestFinished } from 'vitest';

import { SkillOverridesStorage } from './base.js';

// Set FACTORY_TEST_POSTGRES_URL to a disposable database to also run on PostgreSQL.
const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('SkillOverridesStorage on %s', backend => {
  async function makeStorage() {
    const storage =
      backend === 'postgres'
        ? new PgFactoryStorage({ id: 'skill-overrides-test', connectionString: postgresUrl! })
        : new LibSQLFactoryStorage({ id: 'skill-overrides-test', url: ':memory:' });
    const overrides = storage.registerDomain(new SkillOverridesStorage());
    await storage.init();
    onTestFinished(() => storage.close());
    // The Postgres database is shared across runs, so every test gets its own org.
    return { overrides, orgId: `org-${randomUUID()}` };
  }

  const save = (
    overrides: SkillOverridesStorage,
    scope: { orgId: string; projectId: string },
    skillName: string,
    content: string,
  ) => overrides.upsert({ ...scope, skillName, content, baseHash: 'base', updatedBy: 'user-1' });

  it('keeps each project’s edits to itself', async () => {
    const { overrides, orgId } = await makeStorage();
    const a = { orgId, projectId: 'project-a' };
    const b = { orgId, projectId: 'project-b' };

    await save(overrides, a, 'factory-build', 'edited in A');

    expect((await overrides.list(a)).map(o => [o.skillName, o.content])).toEqual([['factory-build', 'edited in A']]);
    expect(await overrides.list(b)).toEqual([]);
    expect(await overrides.get({ ...b, skillName: 'factory-build' })).toBeNull();
    expect(await overrides.revision(b)).toBe(0);
  });

  it('moves the revision on every save and revert, and not on a revert of nothing', async () => {
    const { overrides, orgId } = await makeStorage();
    const scope = { orgId, projectId: 'project-a' };

    await save(overrides, scope, 'factory-build', 'first');
    expect(await overrides.revision(scope)).toBe(1);
    const second = await save(overrides, scope, 'factory-build', 'second');
    expect(await overrides.revision(scope)).toBe(2);
    expect(await overrides.get({ ...scope, skillName: 'factory-build' })).toEqual(second);

    expect(await overrides.delete({ ...scope, skillName: 'factory-build' })).toBe(true);
    expect(await overrides.revision(scope)).toBe(3);
    expect(await overrides.list(scope)).toEqual([]);

    expect(await overrides.delete({ ...scope, skillName: 'factory-build' })).toBe(false);
    expect(await overrides.revision(scope)).toBe(3);
  });

  it('counts every concurrent save once', async () => {
    const { overrides, orgId } = await makeStorage();
    const scope = { orgId, projectId: 'project-a' };

    await Promise.all(Array.from({ length: 8 }, (_, i) => save(overrides, scope, `skill-${i % 3}`, `content ${i}`)));

    expect(await overrides.revision(scope)).toBe(8);
    expect((await overrides.list(scope)).map(o => o.skillName)).toEqual(['skill-0', 'skill-1', 'skill-2']);
  });
});
