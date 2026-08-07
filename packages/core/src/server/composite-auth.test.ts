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
