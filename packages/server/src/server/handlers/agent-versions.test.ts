import type { Mastra } from '@mastra/core';
import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { HTTPException } from '../http-exception';
import type { ServerContext } from '../server-adapter';

import {
  ACTIVATE_AGENT_VERSION_ROUTE,
  DELETE_AGENT_VERSION_ROUTE,
  RESTORE_AGENT_VERSION_ROUTE,
} from './agent-versions';

interface MockAgent {
  id: string;
  name: string;
  instructions: string;
  model: { provider: string; name: string };
  activeVersionId?: string;
  status?: 'draft' | 'published' | 'archived';
  metadata?: Record<string, unknown>;
}

interface MockVersion {
  id: string;
  agentId: string;
  versionNumber: number;
  name: string;
  instructions: string;
  model: { provider: string; name: string };
  changedFields?: string[];
  changeMessage?: string;
}

function createAgentsStore(agents: Map<string, MockAgent>, versions: Map<string, MockVersion>) {
  return {
    getById: vi.fn(async (id: string) => agents.get(id) ?? null),
    update: vi.fn(async (update: Partial<MockAgent> & { id: string }) => {
      const existing = agents.get(update.id);
      if (!existing) return null;
      const updated = { ...existing, ...update } as MockAgent;
      agents.set(update.id, updated);
      return updated;
    }),
    getLatestVersion: vi.fn(async (agentId: string) => {
      const agentVersions = [...versions.values()].filter(version => version.agentId === agentId);
      return agentVersions.sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null;
    }),
    getVersion: vi.fn(async (id: string) => versions.get(id) ?? null),
    createVersion: vi.fn(async (version: MockVersion) => {
      versions.set(version.id, version);
      return version;
    }),
    listVersions: vi.fn(async ({ agentId }: { agentId: string }) => {
      const agentVersions = [...versions.values()].filter(version => version.agentId === agentId);
      return {
        versions: agentVersions,
        total: agentVersions.length,
        page: 0,
        perPage: false,
        hasMore: false,
      };
    }),
    deleteVersion: vi.fn(async (id: string) => {
      versions.delete(id);
    }),
  };
}

function createMastra(agentsStore: ReturnType<typeof createAgentsStore>) {
  const clearCache = vi.fn();
  const mastra = {
    getStorage: vi.fn(() => ({
      getStore: vi.fn(async (storeName: string) => (storeName === 'agents' ? agentsStore : undefined)),
    })),
    getEditor: vi.fn(() => ({
      agent: { clearCache },
    })),
  } as unknown as Mastra;

  return { mastra, clearCache };
}

function createContext(mastra: Mastra): ServerContext {
  return {
    mastra,
    requestContext: new RequestContext(),
    abortSignal: new AbortController().signal,
  } as ServerContext;
}

describe('agent version editor contract routes', () => {
  let agents: Map<string, MockAgent>;
  let versions: Map<string, MockVersion>;
  let agentsStore: ReturnType<typeof createAgentsStore>;
  let mastra: Mastra;
  let clearCache: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    agents = new Map([
      [
        'agent-1',
        {
          id: 'agent-1',
          name: 'Draft support agent',
          instructions: 'Use draft instructions.',
          model: { provider: 'openai', name: 'gpt-4o-mini' },
          activeVersionId: 'version-1',
          status: 'draft',
        },
      ],
    ]);
    versions = new Map([
      [
        'version-1',
        {
          id: 'version-1',
          agentId: 'agent-1',
          versionNumber: 1,
          name: 'Published support agent',
          instructions: 'Use published instructions.',
          model: { provider: 'openai', name: 'gpt-4o-mini' },
        },
      ],
      [
        'version-2',
        {
          id: 'version-2',
          agentId: 'agent-1',
          versionNumber: 2,
          name: 'Updated support agent',
          instructions: 'Use updated instructions.',
          model: { provider: 'openai', name: 'gpt-4o' },
        },
      ],
    ]);
    agentsStore = createAgentsStore(agents, versions);
    ({ mastra, clearCache } = createMastra(agentsStore));
  });

  it('publishes a selected stored-agent version and invalidates the editor agent cache', async () => {
    // USER STORY: a Studio user activates a saved version and expects subsequent agent runs to use it.
    // ARRANGE happens in beforeEach with a draft agent and two saved versions.

    const result = await ACTIVATE_AGENT_VERSION_ROUTE.handler({
      ...createContext(mastra),
      agentId: 'agent-1',
      versionId: 'version-2',
    });

    expect(result).toEqual({
      success: true,
      message: 'Version 2 is now active',
      activeVersionId: 'version-2',
    });
    expect(agentsStore.update).toHaveBeenCalledWith({
      id: 'agent-1',
      activeVersionId: 'version-2',
      status: 'published',
    });
    expect(agents.get('agent-1')).toMatchObject({ activeVersionId: 'version-2', status: 'published' });
    expect(clearCache).toHaveBeenCalledWith('agent-1');
  });

  it('restores a stored-agent version as a new draft version without activating it', async () => {
    // USER STORY: a Studio user restores an older version, reviews the restored draft, then publishes separately.

    const result = await RESTORE_AGENT_VERSION_ROUTE.handler({
      ...createContext(mastra),
      agentId: 'agent-1',
      versionId: 'version-1',
    });

    expect(agentsStore.update).toHaveBeenCalledWith({
      id: 'agent-1',
      name: 'Published support agent',
      instructions: 'Use published instructions.',
      model: { provider: 'openai', name: 'gpt-4o-mini' },
    });
    expect(agentsStore.createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'agent-1',
        versionNumber: 3,
        name: 'Published support agent',
        instructions: 'Use published instructions.',
        changedFields: ['name', 'instructions', 'model'],
        changeMessage: 'Restored from version 1',
      }),
    );
    expect(result).toMatchObject({
      agentId: 'agent-1',
      versionNumber: 3,
      instructions: 'Use published instructions.',
    });
    expect(agents.get('agent-1')?.activeVersionId).toBe('version-1');
    expect(clearCache).toHaveBeenCalledWith('agent-1');
  });

  it('deletes an inactive stored-agent version and invalidates version-specific editor cache lookups', async () => {
    // USER STORY: a Studio user removes an obsolete inactive version and future lookups cannot resolve it.

    const result = await DELETE_AGENT_VERSION_ROUTE.handler({
      ...createContext(mastra),
      agentId: 'agent-1',
      versionId: 'version-2',
    });

    expect(result).toEqual({ success: true, message: 'Version 2 deleted successfully' });
    expect(agentsStore.deleteVersion).toHaveBeenCalledWith('version-2');
    expect(versions.has('version-2')).toBe(false);
    expect(clearCache).toHaveBeenCalledWith('agent-1');
  });

  it('rejects deletion of the active stored-agent version without clearing editor cache', async () => {
    // USER STORY: a Studio user cannot delete the version currently backing runtime behavior.

    await expect(
      DELETE_AGENT_VERSION_ROUTE.handler({
        ...createContext(mastra),
        agentId: 'agent-1',
        versionId: 'version-1',
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Cannot delete the active version. Activate a different version first.',
    } satisfies Partial<HTTPException>);

    expect(agentsStore.deleteVersion).not.toHaveBeenCalled();
    expect(clearCache).not.toHaveBeenCalled();
  });
});
