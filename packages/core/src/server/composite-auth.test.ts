import type { HonoRequest } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { IUserProvider, User } from '../auth';
import { MastraAuthProvider } from './auth';
import { CompositeAuth } from './composite-auth';

class FakeUserAuth extends MastraAuthProvider implements IUserProvider<User> {
  public getUserMock: ReturnType<typeof vi.fn<(id: string) => Promise<User | null>>>;

  constructor(private readonly users: Record<string, User | Error>) {
    super({});
    this.getUserMock = vi.fn(async (id: string): Promise<User | null> => {
      const v = this.users[id];
      if (v instanceof Error) throw v;
      return v ?? null;
    });
  }

  async authenticateToken(_token: string, _request: HonoRequest): Promise<unknown | null> {
    return null;
  }

  async authorizeUser(_user: unknown, _request: HonoRequest): Promise<boolean> {
    return true;
  }

  async getCurrentUser(_request: Request): Promise<User | null> {
    return null;
  }

  async getUser(userId: string): Promise<User | null> {
    return this.getUserMock(userId);
  }
}

class NonUserAuth extends MastraAuthProvider {
  constructor() {
    super({});
  }

  async authenticateToken(_token: string, _request: HonoRequest): Promise<unknown | null> {
    return null;
  }

  async authorizeUser(_user: unknown, _request: HonoRequest): Promise<boolean> {
    return true;
  }
}

describe('CompositeAuth.getUsers', () => {
  it('returns the first non-null match per id across providers in order', async () => {
    const a = new FakeUserAuth({ u1: { id: 'u1', name: 'A1' } });
    const b = new FakeUserAuth({
      u1: { id: 'u1', name: 'B1' }, // shadowed by a
      u2: { id: 'u2', name: 'B2' },
    });
    const composite = new CompositeAuth([a, b]);

    const result = await composite.getUsers!(['u1', 'u2']);
    expect(result).toEqual([
      { id: 'u1', name: 'A1' },
      { id: 'u2', name: 'B2' },
    ]);
  });

  it('returns null for ids no provider can resolve', async () => {
    const a = new FakeUserAuth({ u1: { id: 'u1', name: 'A1' } });
    const composite = new CompositeAuth([a]);

    const result = await composite.getUsers!(['u1', 'missing']);
    expect(result).toEqual([{ id: 'u1', name: 'A1' }, null]);
  });

  it('skips providers that throw and tries the next one', async () => {
    const a = new FakeUserAuth({ u1: new Error('boom') });
    const b = new FakeUserAuth({ u1: { id: 'u1', name: 'B1' } });
    const composite = new CompositeAuth([a, b]);

    const result = await composite.getUsers!(['u1']);
    expect(result).toEqual([{ id: 'u1', name: 'B1' }]);
  });

  it('is undefined when no inner provider implements IUserProvider', () => {
    const composite = new CompositeAuth([new NonUserAuth()]);
    // ensure feature-detection logic null-outs both methods together
    expect((composite as any).getUser).toBeUndefined();
    expect((composite as any).getUsers).toBeUndefined();
  });

  it('returns empty array for empty input', async () => {
    const a = new FakeUserAuth({ u1: { id: 'u1' } });
    const composite = new CompositeAuth([a]);
    await expect(composite.getUsers!([])).resolves.toEqual([]);
  });
});

describe('CompositeAuth.consumePendingResponseHeaders', () => {
  class HeaderAuth extends NonUserAuth {
    constructor(private readonly impl: () => Record<string, string> | undefined) {
      super();
    }
    consumePendingResponseHeaders() {
      return this.impl();
    }
  }

  const req = new Request('https://studio.example/api/agents');

  it('delegates to inner providers and merges their headers', () => {
    const composite = new CompositeAuth([
      new NonUserAuth(),
      new HeaderAuth(() => ({ 'Set-Cookie': 'wos-session=v2; Path=/' })),
    ]);
    expect(composite.consumePendingResponseHeaders(req)).toEqual({ 'Set-Cookie': 'wos-session=v2; Path=/' });
  });

  it('returns undefined when no provider has pending headers', () => {
    expect(new CompositeAuth([new NonUserAuth()]).consumePendingResponseHeaders(req)).toBeUndefined();
  });

  it('ignores a provider that throws', () => {
    const composite = new CompositeAuth([
      new HeaderAuth(() => {
        throw new Error('boom');
      }),
      new HeaderAuth(() => ({ 'X-Test': '1' })),
    ]);
    expect(composite.consumePendingResponseHeaders(req)).toEqual({ 'X-Test': '1' });
  });
});

class TokenAuth extends MastraAuthProvider<{ token: string; aud?: string }> {
  constructor(
    private readonly accepts: string,
    private readonly hooks: { servers?: string[]; scopes?: string[]; audience?: boolean } = {},
  ) {
    super({});
    if (hooks.audience) {
      this.verifyAudience = (user, audience) => user.aud === audience;
    }
    if (hooks.servers || hooks.scopes) {
      this.getOAuthMetadata = () => ({ authorizationServers: hooks.servers, scopesSupported: hooks.scopes });
    }
  }

  async authenticateToken(token: string) {
    return token.startsWith(this.accepts) ? { token, aud: token.split('|')[1] } : null;
  }

  async authorizeUser() {
    return true;
  }

  mapUserToResourceId(user: { token: string }) {
    return user.token;
  }
}

describe('CompositeAuth OAuth hooks', () => {
  const req = {} as HonoRequest;

  it('unions authorization servers and scopes across providers', () => {
    const composite = new CompositeAuth([
      new TokenAuth('a', { servers: ['https://as-a'], scopes: ['read'] }),
      new TokenAuth('b'),
      new TokenAuth('c', { servers: ['https://as-a', 'https://as-c'] }),
    ]);
    expect(composite.getOAuthMetadata()).toEqual({
      authorizationServers: ['https://as-a', 'https://as-c'],
      scopesSupported: ['read'],
    });
    expect(new CompositeAuth([new TokenAuth('a')]).getOAuthMetadata()).toBeUndefined();
  });

  it('delegates verifyAudience to the provider that authenticated the user', async () => {
    const composite = new CompositeAuth([new TokenAuth('a', { audience: true }), new TokenAuth('b')]);

    const fromA = await composite.authenticateToken('a|https://mcp', req);
    expect(await composite.verifyAudience(fromA, 'https://mcp')).toBe(true);
    const wrongAud = await composite.authenticateToken('a|https://other', req);
    expect(await composite.verifyAudience(wrongAud, 'https://mcp')).toBe(false);

    // Provider b has no hook, so audience is not enforced for its users.
    const fromB = await composite.authenticateToken('b|https://other', req);
    expect(await composite.verifyAudience(fromB, 'https://mcp')).toBe(true);
  });

  it('still finds the authenticating provider after resource-id mapping', async () => {
    const composite = new CompositeAuth([new TokenAuth('a', { audience: true })]);
    const user = await composite.authenticateToken('a|https://other', req);
    expect(composite.mapUserToResourceId?.(user)).toBe('a|https://other');
    expect(await composite.verifyAudience(user, 'https://mcp')).toBe(false);
  });

  it('rejects a user it did not authenticate instead of skipping the audience check', async () => {
    const composite = new CompositeAuth([new TokenAuth('a', { audience: true })]);
    const user = await composite.authenticateToken('a|https://mcp', req);
    expect(await composite.verifyAudience({ ...(user as object) }, 'https://mcp')).toBe(false);
    expect(await composite.verifyAudience('a|https://mcp', 'https://mcp')).toBe(false);
    // Nothing could check the audience anyway, so there is nothing to fail closed on.
    const unchecked = new CompositeAuth([new TokenAuth('b')]);
    expect(await unchecked.verifyAudience({ token: 'b' }, 'https://mcp')).toBe(true);
  });

  it('reports which provider authenticated a user', async () => {
    const a = new TokenAuth('a');
    const b = new TokenAuth('b');
    const composite = new CompositeAuth([a, b]);
    expect(composite.getAuthenticatedProvider(await composite.authenticateToken('b', req))).toBe(b);
    expect(composite.getAuthenticatedProvider({ token: 'b' })).toBeUndefined();
  });

  it('exposes inner providers in order', () => {
    const a = new TokenAuth('a');
    const b = new TokenAuth('b');
    expect(new CompositeAuth([a, b]).getProviders()).toEqual([a, b]);
  });
});
