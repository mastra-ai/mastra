/**
 * Ownership guard tests for project routes.
 *
 * Projects are supervisor stored-agent records. When the server is configured
 * with a `MastraAuthProvider` that implements `getCurrentUser`, all project
 * reads and writes for a record with an `authorId` must be restricted to the
 * author. When no auth provider is configured, ownership checks are skipped so
 * existing single-user setups keep working. `LIST_PROJECTS` additionally
 * filters the returned list by the current user's id.
 */
import type { Mastra } from '@mastra/core';
import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { ServerContext } from '../server-adapter';
import {
  DELETE_PROJECT_ROUTE,
  GET_PROJECT_ROUTE,
  INVITE_PROJECT_AGENT_ROUTE,
  LIST_PROJECTS_ROUTE,
  UPDATE_PROJECT_ROUTE,
  CREATE_PROJECT_TASK_ROUTE,
  UPDATE_PROJECT_TASK_ROUTE,
  DELETE_PROJECT_TASK_ROUTE,
} from './projects';

vi.mock('./version-helpers', () => ({
  handleAutoVersioning: vi
    .fn()
    .mockImplementation(async (_s: any, _id: any, _k: any, _f: any, _e: any, updated: any) => ({
      agent: updated,
      versionCreated: false,
    })),
}));

type MockProject = {
  id: string;
  name: string;
  role?: 'supervisor';
  authorId?: string;
  status?: 'draft' | 'published' | 'archived';
  metadata?: Record<string, unknown>;
};

function makeStore(initial: MockProject[]) {
  const data = new Map<string, MockProject>(
    initial.map(p => [
      p.id,
      {
        role: 'supervisor',
        status: 'published',
        metadata: { project: { isProject: true, tasks: [], invitedAgentIds: [], invitedSkillIds: [] } },
        ...p,
      },
    ]),
  );
  const clone = (p: MockProject | undefined) => (p ? JSON.parse(JSON.stringify(p)) : p);
  return {
    getById: vi.fn(async (id: string) => clone(data.get(id)) ?? null),
    getByIdResolved: vi.fn(async (id: string) => clone(data.get(id)) ?? null),
    listResolved: vi.fn(async () => ({
      agents: Array.from(data.values()).map(clone),
      total: data.size,
      page: 1,
      perPage: 100,
      hasMore: false,
    })),
    update: vi.fn(async (updates: any) => {
      const existing = data.get(updates.id);
      if (!existing) return null;
      const next = { ...existing, ...updates };
      data.set(updates.id, next);
      return clone(next);
    }),
    delete: vi.fn(async (id: string) => data.delete(id)),
    getLatestVersion: vi.fn(async () => ({ id: 'v1' })),
  };
}

function makeMastra({ store, currentUserId }: { store: ReturnType<typeof makeStore>; currentUserId: string | null }) {
  return {
    getStorage: () => ({
      getStore: async (name: string) => (name === 'agents' ? store : null),
    }),
    getServer: () => ({
      auth:
        currentUserId === null
          ? undefined
          : {
              authenticateToken: () => null,
              getCurrentUser: async () => ({ id: currentUserId }),
            },
    }),
  } as unknown as Mastra;
}

function ctx(mastra: Mastra, extras: Record<string, unknown> = {}): ServerContext & Record<string, unknown> {
  return {
    mastra,
    requestContext: new RequestContext(),
    abortSignal: new AbortController().signal,
    request: new Request('http://localhost/test'),
    ...extras,
  } as ServerContext & Record<string, unknown>;
}

describe('Project ownership guards', () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore([
      { id: 'project_alice', name: 'Alice Project', authorId: 'user_alice' },
      { id: 'project_bob', name: 'Bob Project', authorId: 'user_bob' },
      { id: 'project_legacy', name: 'Legacy Project' },
    ]);
  });

  it('LIST filters to the current user when auth is configured', async () => {
    const mastra = makeMastra({ store, currentUserId: 'user_alice' });
    const res = (await (LIST_PROJECTS_ROUTE.handler as any)(ctx(mastra))) as any;
    const ids = res.projects.map((p: any) => p.id).sort();
    // Alice's own project + the legacy (no authorId) project remain visible.
    expect(ids).toEqual(['project_alice', 'project_legacy']);
  });

  it('LIST returns everything when no auth provider is configured', async () => {
    const mastra = makeMastra({ store, currentUserId: null });
    const res = (await (LIST_PROJECTS_ROUTE.handler as any)(ctx(mastra))) as any;
    expect(res.projects).toHaveLength(3);
  });

  it('GET rejects a non-author with 403', async () => {
    const mastra = makeMastra({ store, currentUserId: 'user_bob' });
    await expect((GET_PROJECT_ROUTE.handler as any)(ctx(mastra, { projectId: 'project_alice' }))).rejects.toMatchObject(
      { status: 403 },
    );
  });

  it('GET allows the author through', async () => {
    const mastra = makeMastra({ store, currentUserId: 'user_alice' });
    const got = (await (GET_PROJECT_ROUTE.handler as any)(ctx(mastra, { projectId: 'project_alice' }))) as any;
    expect(got.id).toBe('project_alice');
  });

  it('GET skips ownership when no auth provider is configured', async () => {
    const mastra = makeMastra({ store, currentUserId: null });
    const got = (await (GET_PROJECT_ROUTE.handler as any)(ctx(mastra, { projectId: 'project_alice' }))) as any;
    expect(got.id).toBe('project_alice');
  });

  it('GET skips ownership when the project has no authorId', async () => {
    const mastra = makeMastra({ store, currentUserId: 'user_bob' });
    const got = (await (GET_PROJECT_ROUTE.handler as any)(ctx(mastra, { projectId: 'project_legacy' }))) as any;
    expect(got.id).toBe('project_legacy');
  });

  it('UPDATE rejects a non-author with 403', async () => {
    const mastra = makeMastra({ store, currentUserId: 'user_bob' });
    await expect(
      (UPDATE_PROJECT_ROUTE.handler as any)(ctx(mastra, { projectId: 'project_alice', name: 'nope' })),
    ).rejects.toMatchObject({ status: 403 });
    expect(store.update).not.toHaveBeenCalled();
  });

  it('DELETE rejects a non-author with 403', async () => {
    const mastra = makeMastra({ store, currentUserId: 'user_bob' });
    await expect(
      (DELETE_PROJECT_ROUTE.handler as any)(ctx(mastra, { projectId: 'project_alice' })),
    ).rejects.toMatchObject({ status: 403 });
    expect(store.delete).not.toHaveBeenCalled();
  });

  it('INVITE rejects a non-author with 403', async () => {
    const mastra = makeMastra({ store, currentUserId: 'user_bob' });
    await expect(
      (INVITE_PROJECT_AGENT_ROUTE.handler as any)(ctx(mastra, { projectId: 'project_alice', agentId: 'intruder' })),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('CREATE_TASK rejects a non-author with 403', async () => {
    const mastra = makeMastra({ store, currentUserId: 'user_bob' });
    await expect(
      (CREATE_PROJECT_TASK_ROUTE.handler as any)(ctx(mastra, { projectId: 'project_alice', title: 'sneaky' })),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('UPDATE_TASK rejects a non-author with 403', async () => {
    const mastra = makeMastra({ store, currentUserId: 'user_bob' });
    await expect(
      (UPDATE_PROJECT_TASK_ROUTE.handler as any)(
        ctx(mastra, { projectId: 'project_alice', taskId: 't1', status: 'done' }),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('DELETE_TASK rejects a non-author with 403', async () => {
    const mastra = makeMastra({ store, currentUserId: 'user_bob' });
    await expect(
      (DELETE_PROJECT_TASK_ROUTE.handler as any)(ctx(mastra, { projectId: 'project_alice', taskId: 't1' })),
    ).rejects.toMatchObject({ status: 403 });
  });
});
