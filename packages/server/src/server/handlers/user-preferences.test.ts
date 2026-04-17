/**
 * Tests for user-preferences handlers.
 *
 * Covers:
 * - Anonymous requests are rejected with 401.
 * - Authenticated GET returns defaults when nothing is persisted yet.
 * - PATCH writes through to the storage domain and returns the merged record.
 */

import { Mastra } from '@mastra/core';
import type { MastraAuthProvider, MastraServerConfig } from '@mastra/core/server';
import { MockStore } from '@mastra/core/storage';
import { describe, it, expect, vi } from 'vitest';

import { HTTPException } from '../http-exception';
import { createTestServerContext } from './test-utils';
import { GET_USER_PREFERENCES_ROUTE, UPDATE_USER_PREFERENCES_ROUTE } from './user-preferences';

function mockAuthProvider(currentUser: { id: string; email?: string } | null) {
  return {
    name: 'mock-auth',
    authenticateToken: vi.fn().mockResolvedValue(null),
    authorizeUser: vi.fn().mockResolvedValue(true),
    getCurrentUser: vi.fn().mockResolvedValue(currentUser),
    isSimpleAuth: true,
  } as unknown as MastraAuthProvider;
}

function createMastraWithAuth(auth: MastraAuthProvider | null): Mastra {
  const mastra = new Mastra({ logger: false, storage: new MockStore() });
  const originalGetServer = mastra.getServer.bind(mastra);
  vi.spyOn(mastra, 'getServer').mockImplementation(() => {
    const server = originalGetServer() || ({} as MastraServerConfig);
    return { ...server, auth } as MastraServerConfig;
  });
  return mastra;
}

describe('GET /user/preferences', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const mastra = createMastraWithAuth(mockAuthProvider(null));
    const request = new Request('http://localhost:4000/user/preferences');

    await expect(
      GET_USER_PREFERENCES_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        request,
      } as any),
    ).rejects.toBeInstanceOf(HTTPException);
  });

  it('returns default preferences when no record is persisted', async () => {
    const mastra = createMastraWithAuth(mockAuthProvider({ id: 'user-42' }));
    const request = new Request('http://localhost:4000/user/preferences');

    const result = await GET_USER_PREFERENCES_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      request,
    } as any);

    expect(result.userId).toBe('user-42');
    expect(result.agentStudio.starredAgents).toEqual([]);
    expect(result.agentStudio.previewMode).toBe(false);
  });
});

describe('PATCH /user/preferences', () => {
  it('writes through to storage and returns the merged record', async () => {
    const mastra = createMastraWithAuth(mockAuthProvider({ id: 'user-42' }));
    const request = new Request('http://localhost:4000/user/preferences', { method: 'PATCH' });

    const updated = await UPDATE_USER_PREFERENCES_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      request,
      agentStudio: { starredAgents: ['agent-1'], previewMode: true },
    } as any);

    expect(updated.userId).toBe('user-42');
    expect(updated.agentStudio.starredAgents).toEqual(['agent-1']);
    expect(updated.agentStudio.previewMode).toBe(true);

    // A subsequent GET must observe the update.
    const fetched = await GET_USER_PREFERENCES_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      request,
    } as any);

    expect(fetched.agentStudio.starredAgents).toEqual(['agent-1']);
    expect(fetched.agentStudio.previewMode).toBe(true);
  });

  it('rejects unauthenticated patches', async () => {
    const mastra = createMastraWithAuth(mockAuthProvider(null));
    const request = new Request('http://localhost:4000/user/preferences', { method: 'PATCH' });

    await expect(
      UPDATE_USER_PREFERENCES_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        request,
        agentStudio: { previewMode: true },
      } as any),
    ).rejects.toBeInstanceOf(HTTPException);
  });
});
