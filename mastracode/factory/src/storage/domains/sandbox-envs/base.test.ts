import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, onTestFinished } from 'vitest';

import { createFactorySecretEncryption } from '../../../secret-encryption.js';
import { SandboxEnvsStorage } from './base.js';

const testKey = { id: 'v1', key: new Uint8Array(32).fill(7) };
const ORG = 'org-1';
const PROJECT = 'proj-1';

async function makeStore(encrypted = true) {
  const backend = new LibSQLFactoryStorage({ id: 'sandbox-envs-test', url: ':memory:' });
  const domain = backend.registerDomain(
    new SandboxEnvsStorage(encrypted ? createFactorySecretEncryption({ primary: testKey }) : undefined),
  );
  await backend.init();
  onTestFinished(() => backend.close());
  return { ops: backend.ops, domain };
}

describe('SandboxEnvsStorage', () => {
  it('stores values as encrypted envelopes and lists metadata only', async () => {
    const { ops, domain } = await makeStore();
    await domain.set(ORG, PROJECT, { name: 'NPM_TOKEN', value: 'sentinel-secret', appliesTo: 'both' }, 'user-1');

    const [row] = await ops.findMany<{ value: string }>('factory_sandbox_envs', {});
    expect(row!.value.startsWith('mastra:factory-secret:v1:')).toBe(true);
    expect(row!.value).not.toContain('sentinel-secret');

    const listed = await domain.list(ORG, PROJECT);
    expect(listed).toEqual([
      expect.objectContaining({ name: 'NPM_TOKEN', appliesTo: 'both', createdBy: 'user-1', updatedBy: 'user-1' }),
    ]);
    expect(Object.keys(listed[0]!)).not.toContain('value');
    expect(JSON.stringify(listed)).not.toContain('sentinel-secret');
  });

  it('resolves values split by where they apply', async () => {
    const { domain } = await makeStore();
    await domain.set(ORG, PROJECT, { name: 'BUILD_ONLY', value: 'b', appliesTo: 'build' }, 'u');
    await domain.set(ORG, PROJECT, { name: 'RUNTIME_ONLY', value: 'r', appliesTo: 'runtime' }, 'u');
    await domain.set(ORG, PROJECT, { name: 'EVERYWHERE', value: 'e', appliesTo: 'both' }, 'u');

    const resolved = await domain.resolve(ORG, PROJECT);
    expect(resolved.build).toEqual({ BUILD_ONLY: 'b', EVERYWHERE: 'e' });
    expect(resolved.runtime).toEqual({ RUNTIME_ONLY: 'r', EVERYWHERE: 'e' });
    expect(resolved).toMatchObject(await domain.revisions(ORG, PROJECT));
  });

  it('upserts by name, keeping one row per project', async () => {
    const { ops, domain } = await makeStore();
    await domain.set(ORG, PROJECT, { name: 'A', value: 'one', appliesTo: 'runtime' }, 'creator');
    await domain.set(ORG, PROJECT, { name: 'A', value: 'two', appliesTo: 'runtime' }, 'editor');
    expect(await ops.findMany('factory_sandbox_envs', {})).toHaveLength(1);
    expect((await domain.resolve(ORG, PROJECT)).runtime).toEqual({ A: 'two' });
    expect(await domain.list(ORG, PROJECT)).toEqual([
      expect.objectContaining({ createdBy: 'creator', updatedBy: 'editor' }),
    ]);
  });

  it('bumps the revision on every write and the build revision only on build-affecting writes', async () => {
    const { domain } = await makeStore();
    expect(await domain.revisions(ORG, PROJECT)).toBeNull();

    const steps: Array<[string, () => Promise<unknown>, boolean]> = [
      ['add runtime', () => domain.set(ORG, PROJECT, { name: 'R', value: '1', appliesTo: 'runtime' }, 'u'), false],
      ['edit runtime', () => domain.set(ORG, PROJECT, { name: 'R', value: '2', appliesTo: 'runtime' }, 'u'), false],
      ['add build', () => domain.set(ORG, PROJECT, { name: 'B', value: '1', appliesTo: 'build' }, 'u'), true],
      ['edit build', () => domain.set(ORG, PROJECT, { name: 'B', value: '2', appliesTo: 'build' }, 'u'), true],
      ['runtime to both', () => domain.updateAppliesTo(ORG, PROJECT, 'R', 'both', 'u'), true],
      ['both to build', () => domain.updateAppliesTo(ORG, PROJECT, 'R', 'build', 'u'), false],
      ['build to runtime', () => domain.updateAppliesTo(ORG, PROJECT, 'R', 'runtime', 'u'), true],
      [
        'set build var to runtime',
        () => domain.set(ORG, PROJECT, { name: 'B', value: '2', appliesTo: 'runtime' }, 'u'),
        true,
      ],
      ['delete runtime', () => domain.delete(ORG, PROJECT, 'B'), false],
      ['add both', () => domain.set(ORG, PROJECT, { name: 'X', value: '1', appliesTo: 'both' }, 'u'), true],
      ['delete both', () => domain.delete(ORG, PROJECT, 'X'), true],
    ];
    let before = (await domain.revisions(ORG, PROJECT)) ?? { revision: '', buildRevision: '' };
    for (const [label, write, buildChanges] of steps) {
      await write();
      const after = (await domain.revisions(ORG, PROJECT))!;
      expect(after.revision, label).not.toBe(before.revision);
      if (buildChanges) expect(after.buildRevision, label).not.toBe(before.buildRevision);
      else expect(after.buildRevision, label).toBe(before.buildRevision);
      before = after;
    }
  });

  it('leaves revisions alone for a no-op applies-to change or a missing variable', async () => {
    const { domain } = await makeStore();
    await domain.set(ORG, PROJECT, { name: 'R', value: '1', appliesTo: 'runtime' }, 'u');
    const before = await domain.revisions(ORG, PROJECT);
    await domain.updateAppliesTo(ORG, PROJECT, 'R', 'runtime', 'u');
    expect(await domain.updateAppliesTo(ORG, PROJECT, 'MISSING', 'both', 'u')).toBeNull();
    expect(await domain.delete(ORG, PROJECT, 'MISSING')).toBe(false);
    expect(await domain.revisions(ORG, PROJECT)).toEqual(before);
  });

  it('deletes the row so it no longer resolves', async () => {
    const { domain } = await makeStore();
    await domain.set(ORG, PROJECT, { name: 'R', value: '1', appliesTo: 'both' }, 'u');
    expect(await domain.delete(ORG, PROJECT, 'R')).toBe(true);
    expect(await domain.list(ORG, PROJECT)).toEqual([]);
    expect(await domain.resolve(ORG, PROJECT)).toMatchObject({ runtime: {}, build: {} });
  });

  it('isolates organizations and projects', async () => {
    const { domain } = await makeStore();
    await domain.set(ORG, PROJECT, { name: 'SHARED', value: 'mine', appliesTo: 'both' }, 'u');
    await domain.set('org-2', PROJECT, { name: 'SHARED', value: 'other-org', appliesTo: 'both' }, 'u');
    await domain.set(ORG, 'proj-2', { name: 'SHARED', value: 'other-project', appliesTo: 'both' }, 'u');

    expect((await domain.resolve(ORG, PROJECT)).runtime).toEqual({ SHARED: 'mine' });
    expect((await domain.resolve('org-2', PROJECT)).runtime).toEqual({ SHARED: 'other-org' });
    expect((await domain.resolve(ORG, 'proj-2')).runtime).toEqual({ SHARED: 'other-project' });

    await domain.delete('org-2', PROJECT, 'SHARED');
    expect((await domain.resolve(ORG, PROJECT)).runtime).toEqual({ SHARED: 'mine' });
    expect(await domain.list('org-3', PROJECT)).toEqual([]);
    expect(await domain.revisions('org-3', PROJECT)).toBeNull();
  });

  it('writes the variable row before the revision, so a new revision never shows old values', async () => {
    const { ops, domain } = await makeStore();
    await domain.set(ORG, PROJECT, { name: 'R', value: 'old', appliesTo: 'runtime' }, 'u');
    const oldRevision = (await domain.revisions(ORG, PROJECT))!.revision;

    // Observe the store at every write the domain makes during an edit and a
    // delete: whenever the new revision is visible, the new value must be too.
    const seen: Array<{ revision: string | undefined; runtime: Record<string, string> }> = [];
    const original = ops.updateAtomic.bind(ops);
    const deleteMany = ops.deleteMany.bind(ops);
    const observe = async () => {
      const revisions = await domain.revisions(ORG, PROJECT);
      seen.push({ revision: revisions?.revision, runtime: (await domain.resolve(ORG, PROJECT)).runtime });
    };
    ops.updateAtomic = (async (...args: Parameters<typeof ops.updateAtomic>) => {
      const result = await original(...args);
      await observe();
      return result;
    }) as typeof ops.updateAtomic;
    ops.deleteMany = (async (...args: Parameters<typeof ops.deleteMany>) => {
      const result = await deleteMany(...args);
      await observe();
      return result;
    }) as typeof ops.deleteMany;

    await domain.set(ORG, PROJECT, { name: 'R', value: 'new', appliesTo: 'runtime' }, 'u');
    const editRevision = (await domain.revisions(ORG, PROJECT))!.revision;
    await domain.delete(ORG, PROJECT, 'R');
    ops.updateAtomic = original;
    ops.deleteMany = deleteMany;

    expect(seen.length).toBeGreaterThanOrEqual(4);
    // A revision may lag the rows (the next write is already in), never lead them.
    for (const state of seen) {
      if (state.revision === oldRevision) continue;
      if (state.revision === editRevision) expect([{ R: 'new' }, {}]).toContainEqual(state.runtime);
      else expect(state.runtime).toEqual({});
    }
    expect(seen.some(state => state.revision === oldRevision && state.runtime.R === 'new')).toBe(true);
  });
});
