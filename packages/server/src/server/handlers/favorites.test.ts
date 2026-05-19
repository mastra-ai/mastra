import type { IAgentBuilder } from '@mastra/core/agent-builder/ee';
import type { IMastraEditor } from '@mastra/core/editor';
import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MASTRA_RESOURCE_ID_KEY } from '../constants';

import { FAVORITE_STORED_AGENT_ROUTE, UNFAVORITE_STORED_AGENT_ROUTE } from './stored-agent-favorites';
import { DELETE_STORED_AGENT_ROUTE } from './stored-agents';
import { FAVORITE_STORED_SKILL_ROUTE, UNFAVORITE_STORED_SKILL_ROUTE } from './stored-skill-favorites';
import { DELETE_STORED_SKILL_ROUTE } from './stored-skills';

// =============================================================================
// Helpers
// =============================================================================

interface MockRecord {
  id: string;
  authorId?: string | null;
  visibility?: 'public' | 'private';
}

function createBuilder(features: { favorites?: boolean } | null): Partial<IMastraEditor> {
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
  favoritesStore?: ReturnType<typeof createFavoritesStore>;
  editor?: Partial<IMastraEditor>;
}) {
  const agents = opts.agents ?? new Map<string, MockRecord>();
  const skills = opts.skills ?? new Map<string, MockRecord>();
  const favoritesStore = opts.favoritesStore ?? createFavoritesStore();

  const agentStore = {
    getById: vi.fn(async (id: string) => agents.get(id) ?? null),
    delete: vi.fn(async (id: string) => agents.delete(id)),
  };
  const skillStore = {
    getById: vi.fn(async (id: string) => skills.get(id) ?? null),
    getByIdResolved: vi.fn(async (id: string) => skills.get(id) ?? null),
    delete: vi.fn(async (id: string) => skills.delete(id)),
  };
  const storage = {
    getStore: vi.fn(async (name: string) => {
      if (name === 'agents') return agentStore;
      if (name === 'skills') return skillStore;
      if (name === 'favorites') return favoritesStore;
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
    favoritesStore,
    agentStore,
    skillStore,
    agents,
    skills,
  };
}

function createFavoritesStore() {
  return {
    favorite: vi.fn(async () => ({ favorited: true, favoriteCount: 1 })),
    unfavorite: vi.fn(async () => ({ favorited: false, favoriteCount: 0 })),
    deleteFavoritesForEntity: vi.fn(async () => {}),
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

describe('Favorite route EE gating', () => {
  it('PUT /stored/agents/:id/favorite → 404 when favorites feature disabled', async () => {
    const agents = new Map<string, MockRecord>([['a1', { id: 'a1', visibility: 'public' }]]);
    const mastra = createMastra({ agents, editor: createBuilder({ favorites: false }) });

    await expect(
      FAVORITE_STORED_AGENT_ROUTE.handler({
        ...createCtx(mastra, 'user-1'),
        storedAgentId: 'a1',
      } as any),
    ).rejects.toMatchObject({ status: 404 });

    expect(mastra.favoritesStore.favorite).not.toHaveBeenCalled();
  });

  it('PUT /stored/skills/:id/favorite → 404 when no editor configured', async () => {
    const skills = new Map<string, MockRecord>([['s1', { id: 's1', visibility: 'public' }]]);
    const mastra = createMastra({ skills, editor: {} });

    await expect(
      FAVORITE_STORED_SKILL_ROUTE.handler({
        ...createCtx(mastra, 'user-1'),
        storedSkillId: 's1',
      } as any),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('PUT /stored/agents/:id/favorite → 200 happy path when feature enabled', async () => {
    const agents = new Map<string, MockRecord>([['a1', { id: 'a1', visibility: 'public' }]]);
    const mastra = createMastra({ agents, editor: createBuilder({ favorites: true }) });

    const result = await FAVORITE_STORED_AGENT_ROUTE.handler({
      ...createCtx(mastra, 'user-1'),
      storedAgentId: 'a1',
    } as any);

    expect(result).toEqual({ favorited: true, favoriteCount: 1 });
    expect(mastra.favoritesStore.favorite).toHaveBeenCalledWith({
      userId: 'user-1',
      entityType: 'agent',
      entityId: 'a1',
    });
  });

  it('DELETE /stored/skills/:id/favorite → 200 happy path', async () => {
    const skills = new Map<string, MockRecord>([['s1', { id: 's1', visibility: 'public' }]]);
    const mastra = createMastra({ skills, editor: createBuilder({ favorites: true }) });

    const result = await UNFAVORITE_STORED_SKILL_ROUTE.handler({
      ...createCtx(mastra, 'user-1'),
      storedSkillId: 's1',
    } as any);

    expect(result).toEqual({ favorited: false, favoriteCount: 0 });
    expect(mastra.favoritesStore.unfavorite).toHaveBeenCalledWith({
      userId: 'user-1',
      entityType: 'skill',
      entityId: 's1',
    });
  });
});

describe('Favorite route auth + visibility', () => {
  it('returns 401 when no caller id', async () => {
    const agents = new Map<string, MockRecord>([['a1', { id: 'a1', visibility: 'public' }]]);
    const mastra = createMastra({ agents, editor: createBuilder({ favorites: true }) });

    await expect(
      FAVORITE_STORED_AGENT_ROUTE.handler({
        ...createCtx(mastra, null),
        storedAgentId: 'a1',
      } as any),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('returns 404 when entity does not exist', async () => {
    const mastra = createMastra({ editor: createBuilder({ favorites: true }) });

    await expect(
      FAVORITE_STORED_AGENT_ROUTE.handler({
        ...createCtx(mastra, 'user-1'),
        storedAgentId: 'missing',
      } as any),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('returns 404 when caller cannot read a private entity owned by someone else', async () => {
    const agents = new Map<string, MockRecord>([['a1', { id: 'a1', visibility: 'private', authorId: 'owner-2' }]]);
    const mastra = createMastra({ agents, editor: createBuilder({ favorites: true }) });

    await expect(
      FAVORITE_STORED_AGENT_ROUTE.handler({
        ...createCtx(mastra, 'user-1'),
        storedAgentId: 'a1',
      } as any),
    ).rejects.toMatchObject({ status: 404 });

    expect(mastra.favoritesStore.favorite).not.toHaveBeenCalled();
  });
});

describe('Cascade on entity hard delete', () => {
  it('DELETE /stored/agents/:id calls deleteFavoritesForEntity', async () => {
    const agents = new Map<string, MockRecord>([['a1', { id: 'a1', authorId: 'user-1', visibility: 'public' }]]);
    const mastra = createMastra({ agents });

    const result = await DELETE_STORED_AGENT_ROUTE.handler({
      ...createCtx(mastra, 'user-1'),
      storedAgentId: 'a1',
    } as any);

    expect(result).toMatchObject({ success: true });
    expect(mastra.favoritesStore.deleteFavoritesForEntity).toHaveBeenCalledWith({
      entityType: 'agent',
      entityId: 'a1',
    });
  });

  it('DELETE /stored/skills/:id calls deleteFavoritesForEntity', async () => {
    const skills = new Map<string, MockRecord>([['s1', { id: 's1', authorId: 'user-1', visibility: 'public' }]]);
    const mastra = createMastra({ skills });

    const result = await DELETE_STORED_SKILL_ROUTE.handler({
      ...createCtx(mastra, 'user-1'),
      storedSkillId: 's1',
    } as any);

    expect(result).toMatchObject({ success: true });
    expect(mastra.favoritesStore.deleteFavoritesForEntity).toHaveBeenCalledWith({
      entityType: 'skill',
      entityId: 's1',
    });
  });

  it('cascade failure does not abort the entity delete', async () => {
    const agents = new Map<string, MockRecord>([['a1', { id: 'a1', authorId: 'user-1', visibility: 'public' }]]);
    const failingFavorites = createFavoritesStore();
    failingFavorites.deleteFavoritesForEntity.mockRejectedValueOnce(new Error('boom'));
    const mastra = createMastra({ agents, favoritesStore: failingFavorites });

    const result = await DELETE_STORED_AGENT_ROUTE.handler({
      ...createCtx(mastra, 'user-1'),
      storedAgentId: 'a1',
    } as any);

    expect(result).toMatchObject({ success: true });
    expect(mastra.agentStore.delete).toHaveBeenCalledWith('a1');
  });
});

describe('Favorite route metadata', () => {
  beforeEach(() => {
    // metadata-only assertions
  });

  it('agent favorite routes use stored-agents:read permission', () => {
    expect(FAVORITE_STORED_AGENT_ROUTE.requiresPermission).toBe('stored-agents:read');
    expect(UNFAVORITE_STORED_AGENT_ROUTE.requiresPermission).toBe('stored-agents:read');
  });

  it('skill favorite routes use stored-skills:read permission', () => {
    expect(FAVORITE_STORED_SKILL_ROUTE.requiresPermission).toBe('stored-skills:read');
    expect(UNFAVORITE_STORED_SKILL_ROUTE.requiresPermission).toBe('stored-skills:read');
  });

  it('all favorite routes require auth', () => {
    expect(FAVORITE_STORED_AGENT_ROUTE.requiresAuth).toBe(true);
    expect(UNFAVORITE_STORED_AGENT_ROUTE.requiresAuth).toBe(true);
    expect(FAVORITE_STORED_SKILL_ROUTE.requiresAuth).toBe(true);
    expect(UNFAVORITE_STORED_SKILL_ROUTE.requiresAuth).toBe(true);
  });
});
