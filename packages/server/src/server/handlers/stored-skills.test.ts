import type { Mastra } from '@mastra/core';
import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { ServerContext } from '../server-adapter';

import { DELETE_STORED_SKILL_ROUTE, UPDATE_STORED_SKILL_ROUTE } from './stored-skills';

interface MockStoredSkill {
  id: string;
  name: string;
  description: string;
  instructions: string;
  metadata?: Record<string, unknown>;
}

interface MockSkillsStore {
  getById: ReturnType<typeof vi.fn>;
  getByIdResolved: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

interface MockStorage {
  getStore: ReturnType<typeof vi.fn>;
}

interface MockMastra {
  getStorage: ReturnType<typeof vi.fn>;
  getServer: ReturnType<typeof vi.fn>;
}

function createMockSkillsStore(skills: Map<string, MockStoredSkill>): MockSkillsStore {
  return {
    getById: vi.fn(async (id: string) => skills.get(id) ?? null),
    getByIdResolved: vi.fn(async (id: string) => skills.get(id) ?? null),
    update: vi.fn(async (updates: Partial<MockStoredSkill> & { id: string }) => {
      const existing = skills.get(updates.id);
      if (!existing) return null;

      const updated = { ...existing };
      for (const [key, value] of Object.entries(updates)) {
        if (key !== 'id' && value !== undefined) {
          (updated as Record<string, unknown>)[key] = value;
        }
      }
      skills.set(updates.id, updated);
      return updated;
    }),
    delete: vi.fn(async (id: string) => {
      skills.delete(id);
    }),
  };
}

function createMockMastra(skillsStore: MockSkillsStore): MockMastra {
  const storage: MockStorage = {
    getStore: vi.fn(async (storeName: string) => (storeName === 'skills' ? skillsStore : null)),
  };

  return {
    getStorage: vi.fn(() => storage),
    getServer: vi.fn(() => ({ storedResources: { scope: true } })),
  };
}

function createTestContext(mastra: MockMastra): ServerContext {
  const requestContext = new RequestContext();
  requestContext.set('mastra__resourceId', 'team-a');

  return {
    mastra: mastra as unknown as Mastra,
    requestContext,
    abortSignal: new AbortController().signal,
  };
}

describe('Stored Skills Handlers', () => {
  let skills: Map<string, MockStoredSkill>;
  let skillsStore: MockSkillsStore;
  let mastra: MockMastra;

  beforeEach(() => {
    skills = new Map([
      [
        'skill-1',
        {
          id: 'skill-1',
          name: 'skill-one',
          description: 'Skill one',
          instructions: 'Use skill one.',
          metadata: { 'mastra.resourceId': 'team-a', existing: true },
        },
      ],
    ]);
    skillsStore = createMockSkillsStore(skills);
    mastra = createMockMastra(skillsStore);
  });

  it('merges existing metadata with incoming metadata during scoped updates', async () => {
    await UPDATE_STORED_SKILL_ROUTE.handler({
      ...createTestContext(mastra),
      storedSkillId: 'skill-1',
      metadata: { incoming: 'value', 'mastra.resourceId': 'team-b' },
    });

    expect(skillsStore.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'skill-1',
        metadata: {
          'mastra.resourceId': 'team-a',
          existing: true,
          incoming: 'value',
        },
      }),
    );
    expect(skillsStore.getById).not.toHaveBeenCalled();
  });

  it('uses the resolved skill for delete scope checks', async () => {
    await DELETE_STORED_SKILL_ROUTE.handler({
      ...createTestContext(mastra),
      storedSkillId: 'skill-1',
    });

    expect(skillsStore.getById).not.toHaveBeenCalled();
    expect(skillsStore.getByIdResolved).toHaveBeenCalledTimes(1);
    expect(skillsStore.delete).toHaveBeenCalledWith('skill-1');
  });
});
