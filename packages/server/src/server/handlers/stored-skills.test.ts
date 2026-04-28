import type { Mastra } from '@mastra/core';
import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MASTRA_RESOURCE_ID_KEY, MASTRA_USER_PERMISSIONS_KEY } from '../constants';
import { HTTPException } from '../http-exception';
import type { ServerContext } from '../server-adapter';
import {
  LIST_STORED_SKILLS_ROUTE,
  GET_STORED_SKILL_ROUTE,
  CREATE_STORED_SKILL_ROUTE,
  UPDATE_STORED_SKILL_ROUTE,
  DELETE_STORED_SKILL_ROUTE,
} from './stored-skills';

// =============================================================================
// Mock Factories
// =============================================================================

interface MockStoredSkill {
  id: string;
  name: string;
  description?: string;
  instructions?: string;
  license?: string;
  authorId?: string;
  visibility?: 'private' | 'public';
  metadata?: Record<string, unknown>;
  status?: string;
  activeVersionId?: string;
}

interface MockSkillsStore {
  create: ReturnType<typeof vi.fn>;
  getById: ReturnType<typeof vi.fn>;
  getByIdResolved: ReturnType<typeof vi.fn>;
  listResolved: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

function createMockSkillsStore(skillsData: Map<string, MockStoredSkill> = new Map()): MockSkillsStore {
  return {
    create: vi.fn().mockImplementation(async ({ skill }: { skill: MockStoredSkill }) => {
      if (skillsData.has(skill.id)) {
        throw new Error('Skill already exists');
      }
      skillsData.set(skill.id, skill);
      return skill;
    }),
    getById: vi.fn().mockImplementation(async (id: string) => {
      return skillsData.get(id) || null;
    }),
    getByIdResolved: vi.fn().mockImplementation(async (id: string) => {
      return skillsData.get(id) || null;
    }),
    listResolved: vi.fn().mockImplementation(
      async ({
        page = 1,
        perPage = 20,
        authorId,
      }: {
        page?: number;
        perPage?: number;
        authorId?: string;
      } = {}) => {
        let skills = Array.from(skillsData.values());

        if (authorId) {
          skills = skills.filter(s => s.authorId === authorId);
        }

        const start = (page - 1) * perPage;
        const end = start + perPage;
        const paginatedSkills = skills.slice(start, end);

        return {
          skills: paginatedSkills,
          total: skills.length,
          page,
          perPage,
          hasMore: end < skills.length,
        };
      },
    ),
    update: vi.fn().mockImplementation(async (updates: Partial<MockStoredSkill> & { id: string }) => {
      const existing = skillsData.get(updates.id);
      if (!existing) return null;

      const updated = { ...existing };
      Object.keys(updates).forEach(key => {
        if (updates[key as keyof MockStoredSkill] !== undefined && key !== 'id') {
          (updated as any)[key] = updates[key as keyof MockStoredSkill];
        }
      });

      skillsData.set(updates.id, updated);
      return updated;
    }),
    delete: vi.fn().mockImplementation(async (id: string) => {
      return skillsData.delete(id);
    }),
  };
}

interface MockStorage {
  getStore: ReturnType<typeof vi.fn>;
}

function createMockStorage(skillsStore?: MockSkillsStore): MockStorage {
  return {
    getStore: vi.fn().mockImplementation(async (storeName: string) => {
      if (storeName === 'skills' && skillsStore) {
        return skillsStore;
      }
      return null;
    }),
  };
}

interface MockMastra {
  getStorage: ReturnType<typeof vi.fn>;
  getEditor: ReturnType<typeof vi.fn>;
}

function createMockMastra(options: { storage?: MockStorage } = {}): MockMastra {
  return {
    getStorage: vi.fn().mockReturnValue(options.storage),
    getEditor: vi.fn().mockReturnValue(undefined),
  };
}

function createTestContext(mastra: MockMastra): ServerContext {
  return {
    mastra: mastra as unknown as Mastra,
    requestContext: new RequestContext(),
    abortSignal: new AbortController().signal,
  };
}

function createAuthenticatedContext(mastra: MockMastra, userId: string, permissions: string[] = []): ServerContext {
  const ctx = createTestContext(mastra);
  ctx.requestContext.set(MASTRA_RESOURCE_ID_KEY, userId);
  if (permissions.length > 0) {
    ctx.requestContext.set(MASTRA_USER_PERMISSIONS_KEY, permissions);
  }
  return ctx;
}

// =============================================================================
// Tests
// =============================================================================

describe('Stored Skills Handlers', () => {
  let mockSkillsData: Map<string, MockStoredSkill>;
  let mockSkillsStore: MockSkillsStore;
  let mockStorage: MockStorage;
  let mockMastra: MockMastra;

  beforeEach(() => {
    mockSkillsData = new Map();
    mockSkillsStore = createMockSkillsStore(mockSkillsData);
    mockStorage = createMockStorage(mockSkillsStore);
    mockMastra = createMockMastra({ storage: mockStorage });
  });

  // ---------------------------------------------------------------------------
  // LIST
  // ---------------------------------------------------------------------------

  describe('LIST_STORED_SKILLS_ROUTE', () => {
    it('should return empty list when no skills exist', async () => {
      const result = await LIST_STORED_SKILLS_ROUTE.handler({
        ...createTestContext(mockMastra),
        page: 1,
      });

      expect(result).toEqual({
        skills: [],
        total: 0,
        page: 1,
        perPage: 20,
        hasMore: false,
      });
    });

    it('should return list of stored skills', async () => {
      mockSkillsData.set('skill1', {
        id: 'skill1',
        name: 'Skill One',
        description: 'First skill',
        instructions: 'do something',
        authorId: 'user-a',
        visibility: 'public',
      });
      mockSkillsData.set('skill2', {
        id: 'skill2',
        name: 'Skill Two',
        description: 'Second skill',
        instructions: 'do something else',
        authorId: 'user-a',
        visibility: 'private',
      });

      const result = await LIST_STORED_SKILLS_ROUTE.handler({
        ...createTestContext(mockMastra),
        page: 1,
      });

      expect(result.skills).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter list to owned + public for an authenticated non-admin caller', async () => {
      mockSkillsData.set('my-skill', {
        id: 'my-skill',
        name: 'My Skill',
        instructions: 'mine',
        authorId: 'user-a',
        visibility: 'private',
      });
      mockSkillsData.set('other-public', {
        id: 'other-public',
        name: 'Other Public Skill',
        instructions: 'other',
        authorId: 'user-b',
        visibility: 'public',
      });
      mockSkillsData.set('other-private', {
        id: 'other-private',
        name: 'Other Private Skill',
        instructions: 'hidden',
        authorId: 'user-b',
        visibility: 'private',
      });
      mockSkillsData.set('unowned', {
        id: 'unowned',
        name: 'Unowned Skill',
        instructions: 'legacy',
      });

      const result = await LIST_STORED_SKILLS_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-a'),
        page: 1,
      });

      const ids = result.skills.map((s: any) => s.id);
      expect(ids).toContain('my-skill');
      expect(ids).toContain('other-public');
      expect(ids).toContain('unowned');
      expect(ids).not.toContain('other-private');
    });

    it('should return all skills for an admin caller', async () => {
      mockSkillsData.set('my-skill', {
        id: 'my-skill',
        name: 'My Skill',
        instructions: 'mine',
        authorId: 'user-a',
        visibility: 'private',
      });
      mockSkillsData.set('other-private', {
        id: 'other-private',
        name: 'Other Private Skill',
        instructions: 'hidden',
        authorId: 'user-b',
        visibility: 'private',
      });

      const result = await LIST_STORED_SKILLS_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-a', ['*']),
        page: 1,
      });

      const ids = result.skills.map((s: any) => s.id);
      expect(ids).toContain('my-skill');
      expect(ids).toContain('other-private');
    });

    it('should throw error when storage is not configured', async () => {
      const mastraNoStorage = createMockMastra({});

      await expect(
        LIST_STORED_SKILLS_ROUTE.handler({
          ...createTestContext(mastraNoStorage),
          page: 1,
        }),
      ).rejects.toThrow(HTTPException);
    });
  });

  // ---------------------------------------------------------------------------
  // GET
  // ---------------------------------------------------------------------------

  describe('GET_STORED_SKILL_ROUTE', () => {
    it('should get a specific stored skill', async () => {
      mockSkillsData.set('test-skill', {
        id: 'test-skill',
        name: 'Test Skill',
        description: 'A test skill',
        instructions: 'Be helpful',
      });

      const result = await GET_STORED_SKILL_ROUTE.handler({
        ...createTestContext(mockMastra),
        storedSkillId: 'test-skill',
      });

      expect(result).toMatchObject({
        id: 'test-skill',
        name: 'Test Skill',
        description: 'A test skill',
      });
    });

    it('should throw 404 when skill does not exist', async () => {
      await expect(
        GET_STORED_SKILL_ROUTE.handler({
          ...createTestContext(mockMastra),
          storedSkillId: 'nonexistent',
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should allow owner to read their private skill', async () => {
      mockSkillsData.set('private-skill', {
        id: 'private-skill',
        name: 'Private Skill',
        instructions: 'secret',
        authorId: 'user-a',
        visibility: 'private',
      });

      const result = await GET_STORED_SKILL_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-a'),
        storedSkillId: 'private-skill',
      });

      expect(result).toMatchObject({ id: 'private-skill' });
    });

    it('should allow anyone to read a public skill', async () => {
      mockSkillsData.set('public-skill', {
        id: 'public-skill',
        name: 'Public Skill',
        instructions: 'open',
        authorId: 'user-a',
        visibility: 'public',
      });

      const result = await GET_STORED_SKILL_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-b'),
        storedSkillId: 'public-skill',
      });

      expect(result).toMatchObject({ id: 'public-skill' });
    });

    it('should throw 404 when non-owner reads a private skill', async () => {
      mockSkillsData.set('private-skill', {
        id: 'private-skill',
        name: 'Private Skill',
        instructions: 'secret',
        authorId: 'user-a',
        visibility: 'private',
      });

      await expect(
        GET_STORED_SKILL_ROUTE.handler({
          ...createAuthenticatedContext(mockMastra, 'user-b'),
          storedSkillId: 'private-skill',
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should allow unowned skills to be read by anyone', async () => {
      mockSkillsData.set('unowned-skill', {
        id: 'unowned-skill',
        name: 'Unowned Skill',
        instructions: 'legacy',
      });

      const result = await GET_STORED_SKILL_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-b'),
        storedSkillId: 'unowned-skill',
      });

      expect(result).toMatchObject({ id: 'unowned-skill' });
    });
  });

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  describe('CREATE_STORED_SKILL_ROUTE', () => {
    it('should create a new stored skill', async () => {
      const result = await CREATE_STORED_SKILL_ROUTE.handler({
        ...createTestContext(mockMastra),
        name: 'New Skill',
        description: 'A new skill',
        instructions: 'Do the thing',
      });

      expect(result).toMatchObject({
        id: 'new-skill',
        name: 'New Skill',
      });
    });

    it('should inject authorId from authenticated caller', async () => {
      await CREATE_STORED_SKILL_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-a'),
        name: 'Owned Skill',
        description: 'owned',
        instructions: 'do it',
      });

      expect(mockSkillsStore.create).toHaveBeenCalledWith({
        skill: expect.objectContaining({
          authorId: 'user-a',
        }),
      });
    });

    it('should default visibility to private when caller is authenticated', async () => {
      await CREATE_STORED_SKILL_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-a'),
        name: 'Default Vis Skill',
        description: 'test',
        instructions: 'do it',
      });

      expect(mockSkillsStore.create).toHaveBeenCalledWith({
        skill: expect.objectContaining({
          visibility: 'private',
        }),
      });
    });

    it('should default visibility to public when no auth context', async () => {
      await CREATE_STORED_SKILL_ROUTE.handler({
        ...createTestContext(mockMastra),
        name: 'No Auth Skill',
        description: 'test',
        instructions: 'do it',
      });

      expect(mockSkillsStore.create).toHaveBeenCalledWith({
        skill: expect.objectContaining({
          visibility: 'public',
        }),
      });
    });

    it('should respect explicit visibility from body', async () => {
      await CREATE_STORED_SKILL_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-a'),
        name: 'Public Skill',
        description: 'explicitly public',
        instructions: 'do it',
        visibility: 'public',
      });

      expect(mockSkillsStore.create).toHaveBeenCalledWith({
        skill: expect.objectContaining({
          visibility: 'public',
        }),
      });
    });

    it('should derive id from name if not provided', async () => {
      const result = await CREATE_STORED_SKILL_ROUTE.handler({
        ...createTestContext(mockMastra),
        name: 'My Cool Skill',
        description: 'cool',
        instructions: 'be cool',
      });

      expect(result).toMatchObject({ id: 'my-cool-skill' });
    });

    it('should use provided id when explicitly set', async () => {
      const result = await CREATE_STORED_SKILL_ROUTE.handler({
        ...createTestContext(mockMastra),
        id: 'custom-id-123',
        name: 'My Skill',
        description: 'custom',
        instructions: 'do it',
      });

      expect(result).toMatchObject({ id: 'custom-id-123' });
    });

    it('should throw 409 when skill with same ID already exists', async () => {
      mockSkillsData.set('existing-skill', {
        id: 'existing-skill',
        name: 'Existing Skill',
        instructions: 'exists',
      });

      await expect(
        CREATE_STORED_SKILL_ROUTE.handler({
          ...createTestContext(mockMastra),
          id: 'existing-skill',
          name: 'Duplicate Skill',
          description: 'dup',
          instructions: 'dup',
        }),
      ).rejects.toThrow(HTTPException);
    });
  });

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  describe('UPDATE_STORED_SKILL_ROUTE', () => {
    it('should allow owner to update their skill', async () => {
      mockSkillsData.set('owned-skill', {
        id: 'owned-skill',
        name: 'My Skill',
        instructions: 'original',
        authorId: 'user-a',
        visibility: 'private',
      });

      const result = await UPDATE_STORED_SKILL_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-a'),
        storedSkillId: 'owned-skill',
        name: 'Updated Name',
      });

      expect(result).toMatchObject({
        id: 'owned-skill',
        name: 'Updated Name',
      });
    });

    it('should throw 404 when skill does not exist', async () => {
      await expect(
        UPDATE_STORED_SKILL_ROUTE.handler({
          ...createTestContext(mockMastra),
          storedSkillId: 'nonexistent',
          name: 'Updated',
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should throw 404 when non-owner tries to update', async () => {
      mockSkillsData.set('other-skill', {
        id: 'other-skill',
        name: 'Other Skill',
        instructions: 'other',
        authorId: 'user-a',
        visibility: 'public',
      });

      await expect(
        UPDATE_STORED_SKILL_ROUTE.handler({
          ...createAuthenticatedContext(mockMastra, 'user-b'),
          storedSkillId: 'other-skill',
          name: 'Hacked Name',
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should allow admin to update any skill', async () => {
      mockSkillsData.set('other-skill', {
        id: 'other-skill',
        name: 'Other Skill',
        instructions: 'other',
        authorId: 'user-a',
        visibility: 'private',
      });

      const result = await UPDATE_STORED_SKILL_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'admin-user', ['*']),
        storedSkillId: 'other-skill',
        name: 'Admin Updated',
      });

      expect(result).toMatchObject({
        id: 'other-skill',
        name: 'Admin Updated',
      });
    });

    it('should allow updating visibility', async () => {
      mockSkillsData.set('vis-skill', {
        id: 'vis-skill',
        name: 'Vis Skill',
        instructions: 'vis',
        authorId: 'user-a',
        visibility: 'private',
      });

      const result = await UPDATE_STORED_SKILL_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-a'),
        storedSkillId: 'vis-skill',
        visibility: 'public',
      });

      expect(result).toMatchObject({
        id: 'vis-skill',
        visibility: 'public',
      });
    });

    it('should allow unowned skills to be updated by anyone', async () => {
      mockSkillsData.set('unowned-skill', {
        id: 'unowned-skill',
        name: 'Unowned Skill',
        instructions: 'legacy',
      });

      const result = await UPDATE_STORED_SKILL_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-a'),
        storedSkillId: 'unowned-skill',
        name: 'Now Owned',
      });

      expect(result).toMatchObject({
        id: 'unowned-skill',
        name: 'Now Owned',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------

  describe('DELETE_STORED_SKILL_ROUTE', () => {
    it('should allow owner to delete their skill', async () => {
      mockSkillsData.set('my-skill', {
        id: 'my-skill',
        name: 'My Skill',
        instructions: 'mine',
        authorId: 'user-a',
        visibility: 'private',
      });

      const result = await DELETE_STORED_SKILL_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-a'),
        storedSkillId: 'my-skill',
      });

      expect(result).toMatchObject({ success: true });
      expect(mockSkillsData.has('my-skill')).toBe(false);
    });

    it('should throw 404 when skill does not exist', async () => {
      await expect(
        DELETE_STORED_SKILL_ROUTE.handler({
          ...createTestContext(mockMastra),
          storedSkillId: 'nonexistent',
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should throw 404 when non-owner tries to delete', async () => {
      mockSkillsData.set('other-skill', {
        id: 'other-skill',
        name: 'Other Skill',
        instructions: 'other',
        authorId: 'user-a',
        visibility: 'public',
      });

      await expect(
        DELETE_STORED_SKILL_ROUTE.handler({
          ...createAuthenticatedContext(mockMastra, 'user-b'),
          storedSkillId: 'other-skill',
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should allow admin to delete any skill', async () => {
      mockSkillsData.set('other-skill', {
        id: 'other-skill',
        name: 'Other Skill',
        instructions: 'other',
        authorId: 'user-a',
        visibility: 'private',
      });

      const result = await DELETE_STORED_SKILL_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'admin-user', ['*']),
        storedSkillId: 'other-skill',
      });

      expect(result).toMatchObject({ success: true });
    });
  });
});
