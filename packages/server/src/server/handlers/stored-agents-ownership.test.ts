/**
 * Ownership guard tests for stored-agent write routes.
 *
 * When the server is configured with a `MastraAuthProvider` that implements
 * `getCurrentUser`, write operations (UPDATE / DELETE / UPLOAD_AVATAR) against
 * a stored agent with an `authorId` must be rejected for anyone other than the
 * author. When no auth provider is configured, ownership checks are skipped so
 * existing single-user setups keep working.
 */
import type { Mastra } from '@mastra/core';
import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { HTTPException } from '../http-exception';
import type { ServerContext } from '../server-adapter';
import {
  UPDATE_STORED_AGENT_ROUTE,
  DELETE_STORED_AGENT_ROUTE,
  UPLOAD_STORED_AGENT_AVATAR_ROUTE,
} from './stored-agents';

vi.mock('./version-helpers', () => ({
  handleAutoVersioning: vi
    .fn()
    .mockImplementation(async (_s: any, _id: any, _k: any, _f: any, _e: any, updated: any) => {
      return { agent: updated, versionCreated: false };
    }),
}));

type MockAgent = {
  id: string;
  name: string;
  authorId?: string;
  metadata?: Record<string, unknown>;
  model: { name: string; provider: string };
};

function makeStore(initial: MockAgent[]) {
  const data = new Map<string, MockAgent>(initial.map(a => [a.id, a]));
  return {
    getById: vi.fn(async (id: string) => data.get(id) ?? null),
    getByIdResolved: vi.fn(async (id: string) => data.get(id) ?? null),
    update: vi.fn(async (updates: any) => {
      const existing = data.get(updates.id);
      if (!existing) return null;
      const next = { ...existing, ...updates };
      data.set(updates.id, next);
      return next;
    }),
    delete: vi.fn(async (id: string) => data.delete(id)),
  };
}

function makeMastra({ store, authorUserId }: { store: ReturnType<typeof makeStore>; authorUserId: string | null }) {
  return {
    getStorage: () => ({
      getStore: async (name: string) => (name === 'agents' ? store : null),
    }),
    getEditor: () => ({ agent: { clearCache: vi.fn() } }),
    getServer: () => ({
      auth:
        authorUserId === null
          ? undefined
          : {
              authenticateToken: () => null,
              getCurrentUser: async () => ({ id: authorUserId }),
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

describe('Stored agent ownership guards', () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore([
      {
        id: 'agent_owned_by_alice',
        name: 'Alice Agent',
        authorId: 'user_alice',
        model: { name: 'gpt-4', provider: 'openai' },
      },
      {
        id: 'agent_no_author',
        name: 'Legacy Agent',
        model: { name: 'gpt-4', provider: 'openai' },
      },
    ]);
  });

  it('UPDATE rejects a non-author with 403 when auth is configured', async () => {
    const mastra = makeMastra({ store, authorUserId: 'user_bob' });
    await expect(
      (UPDATE_STORED_AGENT_ROUTE.handler as any)(ctx(mastra, { storedAgentId: 'agent_owned_by_alice', name: 'x' })),
    ).rejects.toMatchObject({ status: 403 });
    expect(store.update).not.toHaveBeenCalled();
  });

  it('UPDATE allows the author through', async () => {
    const mastra = makeMastra({ store, authorUserId: 'user_alice' });
    const result = await (UPDATE_STORED_AGENT_ROUTE.handler as any)(
      ctx(mastra, { storedAgentId: 'agent_owned_by_alice', name: 'Alice v2' }),
    );
    expect(result).toBeTruthy();
    expect(store.update).toHaveBeenCalled();
  });

  it('UPDATE skips the ownership check when no auth provider is configured', async () => {
    const mastra = makeMastra({ store, authorUserId: null });
    const result = await (UPDATE_STORED_AGENT_ROUTE.handler as any)(
      ctx(mastra, { storedAgentId: 'agent_owned_by_alice', name: 'Anyone' }),
    );
    expect(result).toBeTruthy();
    expect(store.update).toHaveBeenCalled();
  });

  it('UPDATE skips the ownership check when the agent has no authorId', async () => {
    const mastra = makeMastra({ store, authorUserId: 'user_bob' });
    const result = await (UPDATE_STORED_AGENT_ROUTE.handler as any)(
      ctx(mastra, { storedAgentId: 'agent_no_author', name: 'edited' }),
    );
    expect(result).toBeTruthy();
    expect(store.update).toHaveBeenCalled();
  });

  it('DELETE rejects a non-author with 403', async () => {
    const mastra = makeMastra({ store, authorUserId: 'user_bob' });
    await expect(
      (DELETE_STORED_AGENT_ROUTE.handler as any)(ctx(mastra, { storedAgentId: 'agent_owned_by_alice' })),
    ).rejects.toMatchObject({ status: 403 });
    expect(store.delete).not.toHaveBeenCalled();
  });

  it('DELETE allows the author through', async () => {
    const mastra = makeMastra({ store, authorUserId: 'user_alice' });
    const result = await (DELETE_STORED_AGENT_ROUTE.handler as any)(
      ctx(mastra, { storedAgentId: 'agent_owned_by_alice' }),
    );
    expect(result).toEqual({ success: true, message: expect.any(String) });
  });

  it('UPLOAD_AVATAR rejects a non-author with 403', async () => {
    const mastra = makeMastra({ store, authorUserId: 'user_bob' });
    await expect(
      (UPLOAD_STORED_AGENT_AVATAR_ROUTE.handler as any)(
        ctx(mastra, {
          storedAgentId: 'agent_owned_by_alice',
          contentBase64: Buffer.from('x').toString('base64'),
          contentType: 'image/png',
        }),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('HTTPException surfaces with 403 status code', () => {
    const err = new HTTPException(403, { message: 'not author' });
    expect(err.status).toBe(403);
  });
});
