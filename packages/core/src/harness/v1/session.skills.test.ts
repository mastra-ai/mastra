/**
 * Harness v1 — `session.skills.list` / `get` / `refresh` (§4.6).
 *
 * Code-registered skills merge ahead of workspace-discovered skills.
 * Workspace skills remain discoverable unless a static descriptor owns the
 * same name.
 */

import { describe, expect, it } from 'vitest';

import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import type { Workspace } from '../../workspace';

import { MockAgent, setupHarness } from './__test-utils__';
import { HarnessConfigError, HarnessSessionClosedError, HarnessValidationError } from './errors';
import { Harness } from './harness';
import type { HarnessSkill } from './types';
import type { WorkspaceProvider } from './workspace-provider';

type FakeSkillMeta = {
  name: string;
  description: string;
  path?: string;
  instructions?: string;
  metadata?: Record<string, unknown>;
};

class FakeWorkspaceSkills {
  public listCallCount = 0;
  public refreshCallCount = 0;
  constructor(public entries: FakeSkillMeta[]) {}
  async list() {
    this.listCallCount++;
    return this.entries.map(e => ({
      name: e.name,
      description: e.description,
      path: e.path ?? `skills/${e.name}`,
      ...(e.metadata ? { metadata: e.metadata } : {}),
    }));
  }
  async get(name: string) {
    const e = this.entries.find(x => x.name === name || x.path === name || `skills/${x.name}` === name);
    if (!e) return null;
    return {
      name: e.name,
      description: e.description,
      path: e.path ?? `skills/${e.name}`,
      instructions: e.instructions ?? `# ${e.name}\n\nFake body.`,
      source: { type: 'local' as const, projectPath: '/fake' },
      references: [],
      scripts: [],
      assets: [],
    };
  }
  async has(name: string) {
    return this.entries.some(e => e.name === name);
  }
  async refresh() {
    this.refreshCallCount++;
  }
  async maybeRefresh() {
    /* no-op */
  }
  async search() {
    return [];
  }
  async getReference() {
    return null;
  }
  async getScript() {
    return null;
  }
  async getAsset() {
    return null;
  }
  async listReferences() {
    return [];
  }
  async listScripts() {
    return [];
  }
  async listAssets() {
    return [];
  }
}

function makeWorkspaceWithSkills(skills: FakeWorkspaceSkills | null): Workspace {
  return {
    id: `ws-${Math.random().toString(36).slice(2, 8)}`,
    name: 'fake-ws',
    status: 'ready' as const,
    createdAt: new Date(),
    lastAccessedAt: new Date(),
    skills: skills ?? undefined,
    async init() {},
    async destroy() {},
  } as unknown as Workspace;
}

function resumableProviderFor(skills: FakeWorkspaceSkills | null): WorkspaceProvider {
  const ws = makeWorkspaceWithSkills(skills);
  return {
    providerId: 'p-skills',
    resumable: true,
    create: async () => ws,
    resume: async () => ws,
  };
}

describe('Session skill discovery (§4.6)', () => {
  it('returns an empty list when no workspace is configured', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    expect(await session.skills.list()).toEqual([]);
    expect(await session.skills.get('anything')).toBeUndefined();
  });

  it('returns code-registered skills when no workspace is configured', async () => {
    const { harness } = setupHarness({
      skills: [{ name: 'code-only', description: 'Code only', instructions: 'Code body.' }],
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    expect(await session.skills.list()).toMatchObject([
      { name: 'code-only', description: 'Code only', instructions: 'Code body.' },
    ]);
    expect(await session.skills.get('code-only')).toMatchObject({ name: 'code-only' });
  });

  it('gets a code-registered skill without materializing the workspace', async () => {
    const provider: WorkspaceProvider = {
      providerId: 'p-unavailable',
      resumable: true,
      create: async () => {
        throw new Error('workspace unavailable');
      },
      resume: async () => {
        throw new Error('workspace unavailable');
      },
    };
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const harness = new Harness({
      agents: { default: new MockAgent({ id: 'default' }) } as any,
      modes: [{ id: 'm', agentId: 'default' }],
      defaultModeId: 'm',
      sessions: { storage },
      workspace: { kind: 'per-session', provider },
      skills: [{ name: 'code-only', description: 'Code only', instructions: 'Code body.' }],
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    expect(await session.skills.get('code-only')).toMatchObject({ name: 'code-only' });
  });

  it('returns an empty list when the workspace has no skills surface', async () => {
    const provider = resumableProviderFor(null);
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const harness = new Harness({
      agents: { default: new MockAgent({ id: 'default' }) } as any,
      modes: [{ id: 'm', agentId: 'default' }],
      defaultModeId: 'm',
      sessions: { storage },
      workspace: { kind: 'per-session', provider },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    expect(await session.skills.list()).toEqual([]);
    expect(await session.skills.get('any')).toBeUndefined();
  });

  it('projects workspace skills into HarnessSkill descriptors', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      { name: 'lint', description: 'Lint the repo' },
      { name: 'format', description: 'Format files', path: 'tools/format/SKILL.md' },
    ]);
    const harness = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const skills = await session.skills.list();
    expect(skills).toHaveLength(2);
    expect(skills[0]).toMatchObject<Partial<HarnessSkill>>({
      name: 'lint',
      description: 'Lint the repo',
      filePath: 'skills/lint',
      instructions: '# lint\n\nFake body.',
    });
    expect(skills[1]).toMatchObject<Partial<HarnessSkill>>({
      name: 'format',
      description: 'Format files',
      filePath: 'tools/format/SKILL.md',
      instructions: '# format\n\nFake body.',
    });
  });

  it('materializes listed workspace skills by path when names are duplicated', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      {
        name: 'shared',
        description: 'A',
        path: 'skills/a/SKILL.md',
        instructions: 'A body.',
      },
      {
        name: 'shared',
        description: 'B',
        path: 'skills/b/SKILL.md',
        instructions: 'B body.',
      },
    ]);
    const harness = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    expect(await session.skills.list()).toMatchObject([
      { name: 'shared', filePath: 'skills/a/SKILL.md', instructions: 'A body.' },
      { name: 'shared', filePath: 'skills/b/SKILL.md', instructions: 'B body.' },
    ]);
  });

  it('lists code-registered skills before workspace skills and keeps code precedence on conflicts', async () => {
    const fakeSkills = new FakeWorkspaceSkills([
      { name: 'shared', description: 'Workspace shared' },
      { name: 'workspace-only', description: 'Workspace only' },
    ]);
    const provider = resumableProviderFor(fakeSkills);
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const harness = new Harness({
      agents: { default: new MockAgent({ id: 'default' }) } as any,
      modes: [{ id: 'm', agentId: 'default' }],
      defaultModeId: 'm',
      sessions: { storage },
      workspace: { kind: 'per-session', provider },
      skills: [{ name: 'shared', description: 'Code shared', instructions: 'Code body.' }],
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const skills = await session.skills.list();
    expect(skills.map(s => s.name)).toEqual(['shared', 'workspace-only']);
    expect(skills[0]).toMatchObject({ name: 'shared', description: 'Code shared', instructions: 'Code body.' });
    expect(await session.skills.get('shared')).toMatchObject({ description: 'Code shared' });
  });

  it('rejects duplicate code-registered skill names at construction', () => {
    expect(
      () =>
        new Harness({
          agents: { default: new MockAgent({ id: 'default' }) } as any,
          modes: [{ id: 'm', agentId: 'default' }],
          defaultModeId: 'm',
          skills: [
            { name: 'dupe', description: 'A', instructions: 'A' },
            { name: 'dupe', description: 'B', instructions: 'B' },
          ],
        }),
    ).toThrow(HarnessConfigError);
  });

  it('rejects malformed code-registered skill metadata at construction', () => {
    expect(
      () =>
        new Harness({
          agents: { default: new MockAgent({ id: 'default' }) } as any,
          modes: [{ id: 'm', agentId: 'default' }],
          defaultModeId: 'm',
          skills: [
            {
              name: 'bad-metadata',
              description: 'Bad metadata',
              instructions: 'Body',
              metadata: 'bad' as unknown as Record<string, unknown>,
            },
          ],
        }),
    ).toThrow(HarnessConfigError);

    expect(
      () =>
        new Harness({
          agents: { default: new MockAgent({ id: 'default' }) } as any,
          modes: [{ id: 'm', agentId: 'default' }],
          defaultModeId: 'm',
          skills: [
            {
              name: 'bad-metadata-instance',
              description: 'Bad metadata',
              instructions: 'Body',
              metadata: new Date() as unknown as Record<string, unknown>,
            },
          ],
        }),
    ).toThrow(HarnessConfigError);

    expect(
      () =>
        new Harness({
          agents: { default: new MockAgent({ id: 'default' }) } as any,
          modes: [{ id: 'm', agentId: 'default' }],
          defaultModeId: 'm',
          skills: [
            {
              name: 'bad-nested-metadata',
              description: 'Bad metadata',
              instructions: 'Body',
              metadata: { nested: new Date() },
            },
          ],
        }),
    ).toThrow(HarnessConfigError);

    expect(
      () =>
        new Harness({
          agents: { default: new MockAgent({ id: 'default' }) } as any,
          modes: [{ id: 'm', agentId: 'default' }],
          defaultModeId: 'm',
          skills: [
            {
              name: 'bad-function-metadata',
              description: 'Bad metadata',
              instructions: 'Body',
              metadata: { nested: () => 'bad' },
            },
          ],
        }),
    ).toThrow(HarnessConfigError);
  });

  it('rejects malformed code-registered skill categories at construction', () => {
    expect(
      () =>
        new Harness({
          agents: { default: new MockAgent({ id: 'default' }) } as any,
          modes: [{ id: 'm', agentId: 'default' }],
          defaultModeId: 'm',
          skills: [
            {
              name: 'bad-category',
              description: 'Bad category',
              instructions: 'Body',
              category: 123 as unknown as string,
            },
          ],
        }),
    ).toThrow(HarnessConfigError);
  });

  it('skills.get returns the matching descriptor or undefined', async () => {
    const fakeSkills = new FakeWorkspaceSkills([{ name: 'lint', description: 'Lint the repo' }]);
    const harness = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const lint = await session.skills.get('lint');
    expect(lint?.name).toBe('lint');
    expect(lint?.filePath).toBe('skills/lint');
    expect(await session.skills.get('unknown')).toBeUndefined();
  });

  it('skills.get rejects empty / non-string names', async () => {
    const harness = makeHarnessWithSkills(new FakeWorkspaceSkills([]));
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await expect(session.skills.get('')).rejects.toBeInstanceOf(HarnessValidationError);
    // @ts-expect-error — runtime validation guards against bad inputs
    await expect(session.skills.get(undefined)).rejects.toBeInstanceOf(HarnessValidationError);
  });

  it('caches the catalog for the session lifetime — workspace.skills.list called once across reads', async () => {
    const fakeSkills = new FakeWorkspaceSkills([{ name: 'a', description: 'A' }]);
    const harness = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.skills.list();
    await session.skills.list();
    await session.skills.get('a');
    expect(fakeSkills.listCallCount).toBe(1);
  });

  it('coalesces concurrent reads onto a single-flight discovery promise', async () => {
    const fakeSkills = new FakeWorkspaceSkills([{ name: 'a', description: 'A' }]);
    const harness = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await Promise.all([session.skills.list(), session.skills.list(), session.skills.get('a')]);
    expect(fakeSkills.listCallCount).toBe(1);
  });

  it('skills.refresh clears the cache so the next read re-discovers', async () => {
    const fakeSkills = new FakeWorkspaceSkills([{ name: 'a', description: 'A' }]);
    const harness = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.skills.list();
    expect(fakeSkills.listCallCount).toBe(1);

    fakeSkills.entries.push({ name: 'b', description: 'B' });
    // Without refresh, the new skill is invisible.
    expect((await session.skills.list()).map(s => s.name)).toEqual(['a']);
    expect(fakeSkills.listCallCount).toBe(1);

    await session.skills.refresh();
    const after = await session.skills.list();
    expect(after.map(s => s.name).sort()).toEqual(['a', 'b']);
    expect(fakeSkills.listCallCount).toBe(2);
  });

  it('all three skill methods throw HarnessSessionClosedError after close()', async () => {
    const harness = makeHarnessWithSkills(new FakeWorkspaceSkills([]));
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.close();
    await expect(session.skills.list()).rejects.toBeInstanceOf(HarnessSessionClosedError);
    await expect(session.skills.get('a')).rejects.toBeInstanceOf(HarnessSessionClosedError);
    await expect(session.skills.refresh()).rejects.toBeInstanceOf(HarnessSessionClosedError);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHarnessWithSkills(skills: FakeWorkspaceSkills): Harness {
  const provider = resumableProviderFor(skills);
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  return new Harness({
    agents: { default: new MockAgent({ id: 'default' }) } as any,
    modes: [{ id: 'm', agentId: 'default' }],
    defaultModeId: 'm',
    sessions: { storage },
    workspace: { kind: 'per-session', provider },
  });
}
