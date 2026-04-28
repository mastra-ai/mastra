import type { IAgentBuilder } from '@mastra/core/agent-builder/ee';
import type { IMastraEditor } from '@mastra/core/editor';
import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MASTRA_RESOURCE_ID_KEY } from '../constants';

import { STAR_STORED_AGENT_ROUTE, UNSTAR_STORED_AGENT_ROUTE } from './stored-agent-stars';
import { DELETE_STORED_AGENT_ROUTE } from './stored-agents';
import { STAR_STORED_SKILL_ROUTE, UNSTAR_STORED_SKILL_ROUTE } from './stored-skill-stars';
import { DELETE_STORED_SKILL_ROUTE } from './stored-skills';

// =============================================================================
// Helpers
// =============================================================================

interface MockRecord {
  id: string;
  authorId?: string | null;
  visibility?: 'public' | 'private';
}

function createBuilder(features: { stars?: boolean } | null): Partial<IMastraEditor> {
  if (features === null) {
    return {};
  }
  const builder: IAgentBuilder = {
    enabled: true,
    getFeatures: () => ({ agent: features }),
    getConfiguration: () => ({}),
  };
  return {
    hasEnabledBuilderConfig: () => true,
    resolveBuilder: vi.fn().mockResolvedValue(builder),
  };
}

function createMastra(opts: {
  agents?: Map<string, MockRecord>;
  skills?: Map<string, MockRecord>;
  starsStore?: ReturnType<typeof createStarsStore>;
  editor?: Partial<IMastraEditor>;
}) {
  const agents = opts.agents ?? new Map<string, MockRecord>();
  const skills = opts.skills ?? new Map<string, MockRecord>();
  const starsStore = opts.starsStore ?? createStarsStore();

  const agentStore = {
    getById: vi.fn(async (id: string) => agents.get(id) ?? null),
    delete: vi.fn(async (id: string) => agents.delete(id)),
  };
  const skillStore = {
    getById: vi.fn(async (id: string) => skills.get(id) ?? null),
    delete: vi.fn(async (id: string) => skills.delete(id)),
  };
  const storage = {
    getStore: vi.fn(async (name: string) => {
      if (name === 'agents') return agentStore;
      if (name === 'skills') return skillStore;
      if (name === 'stars') return starsStore;
      return null;
    }),
  };

  const editorBase: Partial<IMastraEditor> = {
    agent: { clearCache: vi.fn() } as any,
  };

  return {
    getStorage: () => storage,
    getEditor: () => ({ ...editorBase, ...(opts.editor ?? {}) }),
    getLogger: () => ({ warn: vi.fn() }),
    starsStore,
    agentStore,
    skillStore,
    agents,
    skills,
  };
}

function createStarsStore() {
  return {
    star: vi.fn(async () => ({ starred: true, starCount: 1 })),
    unstar: vi.fn(async () => ({ starred: false, starCount: 0 })),
    deleteStarsForEntity: vi.fn(async () => {}),
  };
}

function createCtx(mastra: ReturnType<typeof createMastra>, callerId: string | null) {
  const requestContext = new RequestContext();
  if (callerId) requestContext.set(MASTRA_RESOURCE_ID_KEY, callerId);
  return {
    mastra: mastra as any,
    requestContext,
    abortSignal: new AbortController().signal,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Star route EE gating', () => {
  it('PUT /stored/agents/:id/star → 404 when stars feature disabled', async () => {
    const agents = new Map<string, MockRecord>([['a1', { id: 'a1', visibility: 'public' }]]);
    const mastra = createMastra({ agents, editor: createBuilder({ stars: false }) });

    await expect(
      STAR_STORED_AGENT_ROUTE.handler({
        ...createCtx(mastra, 'user-1'),
        storedAgentId: 'a1',
      } as any),
    ).rejects.toMatchObject({ status: 404 });

    expect(mastra.starsStore.star).not.toHaveBeenCalled();
  });

  it('PUT /stored/skills/:id/star → 404 when no editor configured', async () => {
    const skills = new Map<string, MockRecord>([['s1', { id: 's1', visibility: 'public' }]]);
    const mastra = createMastra({ skills, editor: {} });

    await expect(
      STAR_STORED_SKILL_ROUTE.handler({
        ...createCtx(mastra, 'user-1'),
        storedSkillId: 's1',
      } as any),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('PUT /stored/agents/:id/star → 200 happy path when feature enabled', async () => {
    const agents = new Map<string, MockRecord>([['a1', { id: 'a1', visibility: 'public' }]]);
    const mastra = createMastra({ agents, editor: createBuilder({ stars: true }) });

    const result = await STAR_STORED_AGENT_ROUTE.handler({
      ...createCtx(mastra, 'user-1'),
      storedAgentId: 'a1',
    } as any);

    expect(result).toEqual({ starred: true, starCount: 1 });
    expect(mastra.starsStore.star).toHaveBeenCalledWith({
      userId: 'user-1',
      entityType: 'agent',
      entityId: 'a1',
    });
  });

  it('DELETE /stored/skills/:id/star → 200 happy path', async () => {
    const skills = new Map<string, MockRecord>([['s1', { id: 's1', visibility: 'public' }]]);
    const mastra = createMastra({ skills, editor: createBuilder({ stars: true }) });

    const result = await UNSTAR_STORED_SKILL_ROUTE.handler({
      ...createCtx(mastra, 'user-1'),
      storedSkillId: 's1',
    } as any);

    expect(result).toEqual({ starred: false, starCount: 0 });
    expect(mastra.starsStore.unstar).toHaveBeenCalledWith({
      userId: 'user-1',
      entityType: 'skill',
      entityId: 's1',
    });
  });
});

describe('Star route auth + visibility', () => {
  it('returns 401 when no caller id', async () => {
    const agents = new Map<string, MockRecord>([['a1', { id: 'a1', visibility: 'public' }]]);
    const mastra = createMastra({ agents, editor: createBuilder({ stars: true }) });

    await expect(
      STAR_STORED_AGENT_ROUTE.handler({
        ...createCtx(mastra, null),
        storedAgentId: 'a1',
      } as any),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('returns 404 when entity does not exist', async () => {
    const mastra = createMastra({ editor: createBuilder({ stars: true }) });

    await expect(
      STAR_STORED_AGENT_ROUTE.handler({
        ...createCtx(mastra, 'user-1'),
        storedAgentId: 'missing',
      } as any),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('returns 404 when caller cannot read a private entity owned by someone else', async () => {
    const agents = new Map<string, MockRecord>([['a1', { id: 'a1', visibility: 'private', authorId: 'owner-2' }]]);
    const mastra = createMastra({ agents, editor: createBuilder({ stars: true }) });

    await expect(
      STAR_STORED_AGENT_ROUTE.handler({
        ...createCtx(mastra, 'user-1'),
        storedAgentId: 'a1',
      } as any),
    ).rejects.toMatchObject({ status: 404 });

    expect(mastra.starsStore.star).not.toHaveBeenCalled();
  });
});

describe('Cascade on entity hard delete', () => {
  it('DELETE /stored/agents/:id calls deleteStarsForEntity', async () => {
    const agents = new Map<string, MockRecord>([['a1', { id: 'a1', authorId: 'user-1', visibility: 'public' }]]);
    const mastra = createMastra({ agents });

    const result = await DELETE_STORED_AGENT_ROUTE.handler({
      ...createCtx(mastra, 'user-1'),
      storedAgentId: 'a1',
    } as any);

    expect(result).toMatchObject({ success: true });
    expect(mastra.starsStore.deleteStarsForEntity).toHaveBeenCalledWith({
      entityType: 'agent',
      entityId: 'a1',
    });
  });

  it('DELETE /stored/skills/:id calls deleteStarsForEntity', async () => {
    const skills = new Map<string, MockRecord>([['s1', { id: 's1', authorId: 'user-1', visibility: 'public' }]]);
    const mastra = createMastra({ skills });

    const result = await DELETE_STORED_SKILL_ROUTE.handler({
      ...createCtx(mastra, 'user-1'),
      storedSkillId: 's1',
    } as any);

    expect(result).toMatchObject({ success: true });
    expect(mastra.starsStore.deleteStarsForEntity).toHaveBeenCalledWith({
      entityType: 'skill',
      entityId: 's1',
    });
  });

  it('cascade failure does not abort the entity delete', async () => {
    const agents = new Map<string, MockRecord>([['a1', { id: 'a1', authorId: 'user-1', visibility: 'public' }]]);
    const failingStars = createStarsStore();
    failingStars.deleteStarsForEntity.mockRejectedValueOnce(new Error('boom'));
    const mastra = createMastra({ agents, starsStore: failingStars });

    const result = await DELETE_STORED_AGENT_ROUTE.handler({
      ...createCtx(mastra, 'user-1'),
      storedAgentId: 'a1',
    } as any);

    expect(result).toMatchObject({ success: true });
    expect(mastra.agentStore.delete).toHaveBeenCalledWith('a1');
  });
});

describe('Star route metadata', () => {
  beforeEach(() => {
    // metadata-only assertions
  });

  it('agent star routes use stored-agents:read permission', () => {
    expect(STAR_STORED_AGENT_ROUTE.requiresPermission).toBe('stored-agents:read');
    expect(UNSTAR_STORED_AGENT_ROUTE.requiresPermission).toBe('stored-agents:read');
  });

  it('skill star routes use stored-skills:read permission', () => {
    expect(STAR_STORED_SKILL_ROUTE.requiresPermission).toBe('stored-skills:read');
    expect(UNSTAR_STORED_SKILL_ROUTE.requiresPermission).toBe('stored-skills:read');
  });

  it('all star routes require auth', () => {
    expect(STAR_STORED_AGENT_ROUTE.requiresAuth).toBe(true);
    expect(UNSTAR_STORED_AGENT_ROUTE.requiresAuth).toBe(true);
    expect(STAR_STORED_SKILL_ROUTE.requiresAuth).toBe(true);
    expect(UNSTAR_STORED_SKILL_ROUTE.requiresAuth).toBe(true);
  });
});
