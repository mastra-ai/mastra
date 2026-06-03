import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';
import { attachAuthor, prepareAuthorEnrichment } from './author-enrichment';

type FakeUser = { id: string; name?: string; email?: string; avatarUrl?: string; secret?: string };

function makeMastra(auth: unknown) {
  return { getServer: () => ({ auth }) } as any;
}

function makeUserProvider(users: Record<string, FakeUser | Error>, opts: { batch?: boolean } = {}) {
  const getUser = vi.fn(async (id: string): Promise<FakeUser | null> => {
    const v = users[id];
    if (v instanceof Error) throw v;
    return v ?? null;
  });

  const provider: any = {
    authenticateToken: vi.fn(),
    getCurrentUser: vi.fn(),
    getUser,
  };

  if (opts.batch) {
    provider.getUsers = vi.fn(async (ids: string[]): Promise<Array<FakeUser | null>> => {
      const out: Array<FakeUser | null> = [];
      for (const id of ids) {
        const v = users[id];
        if (v instanceof Error) throw v;
        out.push(v ?? null);
      }
      return out;
    });
  }

  return provider;
}

describe('prepareAuthorEnrichment', () => {
  const ctx = new RequestContext();

  it('uses provider.getUsers once with deduped ids when available', async () => {
    const provider = makeUserProvider({ a: { id: 'a', name: 'Alice' }, b: { id: 'b', name: 'Bob' } }, { batch: true });
    const mastra = makeMastra(provider);

    const map = await prepareAuthorEnrichment(mastra, ctx, ['a', 'b', 'a', null, undefined, '']);
    expect(provider.getUsers).toHaveBeenCalledTimes(1);
    expect(provider.getUsers.mock.calls[0][0]).toEqual(['a', 'b']);
    expect(provider.getUser).not.toHaveBeenCalled();
    expect(map?.get('a')).toEqual({ id: 'a', name: 'Alice' });
    expect(map?.get('b')).toEqual({ id: 'b', name: 'Bob' });
  });

  it('falls back to getUser per unique id when getUsers is not implemented', async () => {
    const provider = makeUserProvider({
      a: { id: 'a', name: 'Alice' },
      b: { id: 'b', name: 'Bob' },
    });
    const mastra = makeMastra(provider);

    const map = await prepareAuthorEnrichment(mastra, ctx, ['a', 'a', 'b']);
    expect(provider.getUser).toHaveBeenCalledTimes(2);
    expect(map?.get('a')).toEqual({ id: 'a', name: 'Alice' });
    expect(map?.get('b')).toEqual({ id: 'b', name: 'Bob' });
  });

  it('ignores null, undefined, and empty string ids', async () => {
    const provider = makeUserProvider({ a: { id: 'a' } });
    const mastra = makeMastra(provider);

    const map = await prepareAuthorEnrichment(mastra, ctx, [null, undefined, '']);
    expect(provider.getUser).not.toHaveBeenCalled();
    expect(map).not.toBeNull();
    expect(map?.size).toBe(0);
  });

  it('per-id throws are caught and treated as unresolved', async () => {
    const provider = makeUserProvider({
      a: { id: 'a', name: 'Alice' },
      bad: new Error('boom'),
    });
    const mastra = makeMastra(provider);

    const map = await prepareAuthorEnrichment(mastra, ctx, ['a', 'bad']);
    expect(map?.get('a')).toEqual({ id: 'a', name: 'Alice' });
    expect(map?.has('bad')).toBe(false);
  });

  it('returns null when there is no auth provider on the server', async () => {
    const mastra = makeMastra(undefined);
    const map = await prepareAuthorEnrichment(mastra, ctx, ['a']);
    expect(map).toBeNull();
  });

  it('returns null when auth is not an IUserProvider (no getCurrentUser)', async () => {
    const provider = { authenticateToken: vi.fn() }; // no getCurrentUser
    const mastra = makeMastra(provider);
    const map = await prepareAuthorEnrichment(mastra, ctx, ['a']);
    expect(map).toBeNull();
  });

  it('returns null when provider has getCurrentUser but no getUser', async () => {
    const provider = { authenticateToken: vi.fn(), getCurrentUser: vi.fn() }; // no getUser
    const mastra = makeMastra(provider);
    const map = await prepareAuthorEnrichment(mastra, ctx, ['a']);
    expect(map).toBeNull();
  });

  it('returns null when auth is a config object (no authenticateToken)', async () => {
    const mastra = makeMastra({ public: [] }); // looks like MastraAuthConfig, not provider
    const map = await prepareAuthorEnrichment(mastra, ctx, ['a']);
    expect(map).toBeNull();
  });

  it('keys the result map by the requested id, even if provider returns a different id', async () => {
    const provider = makeUserProvider({
      a: { id: 'normalized-A', name: 'Alice' },
    });
    const mastra = makeMastra(provider);
    const map = await prepareAuthorEnrichment(mastra, ctx, ['a']);
    // We requested 'a'; the helper must key by the requested id, not the user's id field
    expect(map?.get('a')).toEqual({ id: 'a', name: 'Alice' });
  });

  it('strips provider-specific extra fields from the resolved author', async () => {
    const provider = makeUserProvider({
      a: { id: 'a', name: 'Alice', email: 'alice@example.com', avatarUrl: 'https://x/y.png', secret: 'nope' },
    });
    const mastra = makeMastra(provider);
    const map = await prepareAuthorEnrichment(mastra, ctx, ['a']);
    expect(map?.get('a')).toEqual({
      id: 'a',
      name: 'Alice',
      email: 'alice@example.com',
      avatarUrl: 'https://x/y.png',
    });
    expect(map?.get('a')).not.toHaveProperty('secret');
  });

  it('treats a batch getUsers throw as "no enrichment" (empty map)', async () => {
    const provider = makeUserProvider({ a: { id: 'a' } }, { batch: true });
    provider.getUsers = vi.fn().mockRejectedValue(new Error('batch boom'));
    const mastra = makeMastra(provider);

    const map = await prepareAuthorEnrichment(mastra, ctx, ['a']);
    expect(map).not.toBeNull();
    expect(map?.size).toBe(0);
  });
});

describe('attachAuthor', () => {
  it('returns record unchanged when authors map is null', () => {
    const record = { id: 'r1', authorId: 'a1' };
    expect(attachAuthor(record, null)).toEqual(record);
  });

  it('returns record unchanged when authorId is missing', () => {
    const record = { id: 'r1' } as { id: string; authorId?: string | null };
    const map = new Map([['a1', { id: 'a1', name: 'Alice' }]]);
    const result = attachAuthor(record, map);
    expect(result).toEqual(record);
    expect((result as any).author).toBeUndefined();
  });

  it('returns record unchanged when authorId is not in the map', () => {
    const record = { id: 'r1', authorId: 'unknown' };
    const map = new Map([['a1', { id: 'a1', name: 'Alice' }]]);
    expect(attachAuthor(record, map)).toEqual(record);
  });

  it('attaches author when authorId is in the map and preserves all original fields', () => {
    const record = { id: 'r1', authorId: 'a1', name: 'agent', description: 'd' };
    const map = new Map([['a1', { id: 'a1', name: 'Alice' }]]);
    const result = attachAuthor(record, map);
    expect(result).toEqual({
      id: 'r1',
      authorId: 'a1',
      name: 'agent',
      description: 'd',
      author: { id: 'a1', name: 'Alice' },
    });
  });
});
