/**
 * Harness v1 — `session.listSkills` / `getSkill` / `refreshSkills` (§4.6).
 *
 * Phase 1: workspace-discovered skills only. Code-registered skills and
 * `useSkill` programmatic execution land in a follow-up slice.
 */

import { describe, expect, it } from 'vitest';

import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import type { Workspace } from '../../workspace';

import { MockAgent, setupHarness } from './__test-utils__';
import { HarnessSessionClosedError, HarnessValidationError } from './errors';
import { Harness } from './harness';
import type { HarnessSkill } from './types';
import type { WorkspaceProvider } from './workspace-provider';

type FakeSkillMeta = {
  name: string;
  description: string;
  path?: string;
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
    const e = this.entries.find(x => x.name === name);
    if (!e) return null;
    return {
      name: e.name,
      description: e.description,
      path: e.path ?? `skills/${e.name}`,
      instructions: `# ${e.name}\n\nFake body.`,
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

  it('projects workspace skills into HarnessSkill descriptors with source="workspace"', async () => {
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
      source: 'workspace',
      filePath: 'skills/lint',
      instructions: '',
    });
    expect(skills[1]).toMatchObject<Partial<HarnessSkill>>({
      name: 'format',
      description: 'Format files',
      source: 'workspace',
      filePath: 'tools/format/SKILL.md',
    });
  });

  it('getSkill returns the matching descriptor or undefined', async () => {
    const fakeSkills = new FakeWorkspaceSkills([{ name: 'lint', description: 'Lint the repo' }]);
    const harness = makeHarnessWithSkills(fakeSkills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const lint = await session.skills.get('lint');
    expect(lint?.name).toBe('lint');
    expect(lint?.source).toBe('workspace');
    expect(await session.skills.get('unknown')).toBeUndefined();
  });

  it('getSkill rejects empty / non-string names', async () => {
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

  it('refreshSkills clears the cache so the next read re-discovers', async () => {
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
