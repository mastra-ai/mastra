/**
 * Cross-layer integration tests for the stars feature.
 *
 * Drives real route handlers (LIST/GET/STAR/UNSTAR/UPDATE/DELETE) against a
 * real `InMemoryStore`. Covers scenarios that span enrichment + visibility +
 * the two-step `?starredOnly=true` pipeline + `authorId` transfer + archive.
 *
 * Phases 0–2 already unit-test storage primitives, namespace, route auth /
 * cascade / EE gate. This file only adds the scenarios that need every layer
 * wired together.
 */
import type { IAgentBuilder } from '@mastra/core/agent-builder/ee';
import type { IMastraEditor } from '@mastra/core/editor';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STAR_STORED_AGENT_ROUTE } from './stored-agent-stars';
import { LIST_STORED_AGENTS_ROUTE, UPDATE_STORED_AGENT_ROUTE } from './stored-agents';
import { STAR_STORED_SKILL_ROUTE } from './stored-skill-stars';
import { LIST_STORED_SKILLS_ROUTE, UPDATE_STORED_SKILL_ROUTE } from './stored-skills';

// ----------------------------------------------------------------------------
// Fixtures
// ----------------------------------------------------------------------------

function createEditor(starsEnabled: boolean): Partial<IMastraEditor> {
  const builder: IAgentBuilder = {
    enabled: true,
    getFeatures: () => ({ agent: { stars: starsEnabled } }),
    getConfiguration: () => ({}),
  };
  return {
    hasEnabledBuilderConfig: () => true,
    resolveBuilder: vi.fn().mockResolvedValue(builder),
    agent: { clearCache: vi.fn() } as any,
  };
}

function createMastra(storage: InMemoryStore, starsEnabled = true) {
  return {
    getStorage: () => storage,
    getEditor: () => createEditor(starsEnabled),
    getLogger: () => ({ warn: vi.fn() }),
  } as any;
}

function ctx(mastra: any, callerId: string | null) {
  const requestContext = new RequestContext();
  if (callerId) requestContext.set(MASTRA_RESOURCE_ID_KEY, callerId);
  return {
    mastra,
    requestContext,
    abortSignal: new AbortController().signal,
  };
}

async function seedAgent(
  storage: InMemoryStore,
  opts: { id: string; authorId?: string; visibility?: 'public' | 'private' },
) {
  const store = await storage.getStore('agents');
  await store!.create({
    agent: {
      id: opts.id,
      name: opts.id,
      instructions: 'be helpful',
      model: { provider: 'openai', name: 'gpt-4' } as any,
      authorId: opts.authorId,
      visibility: opts.visibility,
    },
  });
}

async function seedSkill(
  storage: InMemoryStore,
  opts: { id: string; authorId?: string; visibility?: 'public' | 'private' },
) {
  const store = await storage.getStore('skills');
  await store!.create({
    skill: {
      id: opts.id,
      name: opts.id,
      description: 'a skill',
      instructions: 'be helpful',
      authorId: opts.authorId,
      visibility: opts.visibility,
    } as any,
  });
}

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe('stars integration: list enrichment shape', () => {
  let storage: InMemoryStore;
  let mastra: any;

  beforeEach(async () => {
    storage = new InMemoryStore();
    await storage.init();
    mastra = createMastra(storage, true);
    await seedAgent(storage, { id: 'a1', authorId: 'user-a', visibility: 'public' });
  });

  it('list as starring user shows isStarred:true; list as another user shows isStarred:false; counter is shared', async () => {
    // user-A stars a1.
    await STAR_STORED_AGENT_ROUTE.handler({
      ...ctx(mastra, 'user-a'),
      storedAgentId: 'a1',
    } as any);

    const asA = await LIST_STORED_AGENTS_ROUTE.handler({
      ...ctx(mastra, 'user-a'),
      page: 0,
      perPage: 100,
    } as any);
    const asB = await LIST_STORED_AGENTS_ROUTE.handler({
      ...ctx(mastra, 'user-b'),
      page: 0,
      perPage: 100,
    } as any);

    const aRow = asA.agents.find((r: any) => r.id === 'a1') as any;
    const bRow = asB.agents.find((r: any) => r.id === 'a1') as any;

    expect(aRow.isStarred).toBe(true);
    expect(bRow.isStarred).toBe(false);
    expect(aRow.starCount).toBe(1);
    expect(bRow.starCount).toBe(1);
  });
});

describe('stars integration: ?starredOnly=true + visibility-recomputed total', () => {
  let storage: InMemoryStore;
  let mastra: any;

  beforeEach(async () => {
    storage = new InMemoryStore();
    await storage.init();
    mastra = createMastra(storage, true);
    // user-A owns two public agents; user-B will star both.
    await seedAgent(storage, { id: 'pub-1', authorId: 'user-a', visibility: 'public' });
    await seedAgent(storage, { id: 'pub-2', authorId: 'user-a', visibility: 'public' });
  });

  it('flipping a starred agent to private removes it from B’s starredOnly list AND recomputes total', async () => {
    // user-B stars both.
    for (const id of ['pub-1', 'pub-2']) {
      await STAR_STORED_AGENT_ROUTE.handler({
        ...ctx(mastra, 'user-b'),
        storedAgentId: id,
      } as any);
    }

    // Sanity: both visible to B.
    const before = await LIST_STORED_AGENTS_ROUTE.handler({
      ...ctx(mastra, 'user-b'),
      page: 0,
      perPage: 100,
      starredOnly: true,
    } as any);
    expect(before.agents.map((a: any) => a.id).sort()).toEqual(['pub-1', 'pub-2']);
    expect(before.total).toBe(2);

    // user-A flips pub-1 to private.
    await UPDATE_STORED_AGENT_ROUTE.handler({
      ...ctx(mastra, 'user-a'),
      storedAgentId: 'pub-1',
      visibility: 'private',
    } as any);

    // user-B: pub-1 is no longer visible; total reflects post-filter count.
    const after = await LIST_STORED_AGENTS_ROUTE.handler({
      ...ctx(mastra, 'user-b'),
      page: 0,
      perPage: 100,
      starredOnly: true,
    } as any);
    expect(after.agents.map((a: any) => a.id)).toEqual(['pub-2']);
    expect(after.total).toBe(1);
  });

  it('?starredOnly=true&perPage=1 returns honest total for nav badge', async () => {
    for (const id of ['pub-1', 'pub-2']) {
      await STAR_STORED_AGENT_ROUTE.handler({
        ...ctx(mastra, 'user-b'),
        storedAgentId: id,
      } as any);
    }

    const result = await LIST_STORED_AGENTS_ROUTE.handler({
      ...ctx(mastra, 'user-b'),
      page: 0,
      perPage: 1,
      starredOnly: true,
    } as any);

    expect(result.agents).toHaveLength(1);
    expect(result.total).toBe(2);
    expect(result.hasMore).toBe(true);
  });
});

describe('stars integration: archive survives star + still surfaces under starredOnly', () => {
  it('archived agent keeps its star row and still appears in ?starredOnly=true', async () => {
    const storage = new InMemoryStore();
    await storage.init();
    const mastra = createMastra(storage, true);
    await seedAgent(storage, { id: 'a1', authorId: 'user-a', visibility: 'public' });

    await STAR_STORED_AGENT_ROUTE.handler({
      ...ctx(mastra, 'user-a'),
      storedAgentId: 'a1',
    } as any);

    // Archive it. The public PATCH route doesn't expose `status`, so flip it
    // through the storage domain directly (matches how archival ships in
    // dedicated routes).
    const agentsStore = await storage.getStore('agents');
    await agentsStore!.update({ id: 'a1', status: 'archived' });

    const result = await LIST_STORED_AGENTS_ROUTE.handler({
      ...ctx(mastra, 'user-a'),
      page: 0,
      perPage: 100,
      starredOnly: true,
      status: 'archived',
    } as any);

    const row = result.agents.find((a: any) => a.id === 'a1') as any;
    expect(row).toBeDefined();
    expect(row.isStarred).toBe(true);
    expect(row.starCount).toBe(1);
  });
});

describe('stars integration: authorId transfer leaves stars intact', () => {
  it('changing authorId does not drop the star row', async () => {
    const storage = new InMemoryStore();
    await storage.init();
    const mastra = createMastra(storage, true);
    await seedAgent(storage, { id: 'a1', authorId: 'user-x', visibility: 'public' });

    // user-A stars an agent owned by user-X.
    await STAR_STORED_AGENT_ROUTE.handler({
      ...ctx(mastra, 'user-a'),
      storedAgentId: 'a1',
    } as any);

    // Transfer ownership to user-Y. user-X has admin bypass via owner; we use
    // user-X as caller since they own the record at this moment.
    await UPDATE_STORED_AGENT_ROUTE.handler({
      ...ctx(mastra, 'user-x'),
      storedAgentId: 'a1',
      authorId: 'user-y',
    } as any);

    // user-A's view: still starred, still surfaces under starredOnly.
    const result = await LIST_STORED_AGENTS_ROUTE.handler({
      ...ctx(mastra, 'user-a'),
      page: 0,
      perPage: 100,
      starredOnly: true,
    } as any);
    const row = result.agents.find((a: any) => a.id === 'a1') as any;
    expect(row).toBeDefined();
    expect(row.isStarred).toBe(true);
  });
});

describe('stars integration: skills mirror', () => {
  let storage: InMemoryStore;
  let mastra: any;

  beforeEach(async () => {
    storage = new InMemoryStore();
    await storage.init();
    mastra = createMastra(storage, true);
    await seedSkill(storage, { id: 's1', authorId: 'user-a', visibility: 'public' });
  });

  it('list enrichment is per-caller, counter is shared', async () => {
    await STAR_STORED_SKILL_ROUTE.handler({
      ...ctx(mastra, 'user-a'),
      storedSkillId: 's1',
    } as any);

    const asA = await LIST_STORED_SKILLS_ROUTE.handler({
      ...ctx(mastra, 'user-a'),
      page: 0,
      perPage: 100,
    } as any);
    const asB = await LIST_STORED_SKILLS_ROUTE.handler({
      ...ctx(mastra, 'user-b'),
      page: 0,
      perPage: 100,
    } as any);

    const aRow = asA.skills.find((r: any) => r.id === 's1') as any;
    const bRow = asB.skills.find((r: any) => r.id === 's1') as any;
    expect(aRow.isStarred).toBe(true);
    expect(bRow.isStarred).toBe(false);
    expect(aRow.starCount).toBe(1);
    expect(bRow.starCount).toBe(1);
  });

  it('archived skill keeps its star row and still appears in ?starredOnly=true', async () => {
    await STAR_STORED_SKILL_ROUTE.handler({
      ...ctx(mastra, 'user-a'),
      storedSkillId: 's1',
    } as any);

    // Public PATCH for skills doesn't expose `status`; flip via storage.
    const skillsStore = await storage.getStore('skills');
    await skillsStore!.update({ id: 's1', status: 'archived' });

    const result = await LIST_STORED_SKILLS_ROUTE.handler({
      ...ctx(mastra, 'user-a'),
      page: 0,
      perPage: 100,
      starredOnly: true,
      status: 'archived',
    } as any);

    const row = result.skills.find((s: any) => s.id === 's1') as any;
    expect(row).toBeDefined();
    expect(row.isStarred).toBe(true);
    expect(row.starCount).toBe(1);
  });

  it('changing skill authorId does not drop the star row', async () => {
    await STAR_STORED_SKILL_ROUTE.handler({
      ...ctx(mastra, 'user-a'),
      storedSkillId: 's1',
    } as any);

    await UPDATE_STORED_SKILL_ROUTE.handler({
      ...ctx(mastra, 'user-a'),
      storedSkillId: 's1',
      authorId: 'user-y',
    } as any);

    const result = await LIST_STORED_SKILLS_ROUTE.handler({
      ...ctx(mastra, 'user-a'),
      page: 0,
      perPage: 100,
      starredOnly: true,
    } as any);

    const row = result.skills.find((s: any) => s.id === 's1') as any;
    expect(row).toBeDefined();
    expect(row.isStarred).toBe(true);
  });
});
