import { describe, expect, it } from 'vitest';

import { CompositeAuth, MastraAuthProvider, normalizeMastraUser } from './index';
import type { MastraUser } from '..';

class StubAuth<TUser = unknown> extends MastraAuthProvider<TUser> {
  constructor(private readonly user: TUser | null) {
    super({ name: 'stub' });
  }

  async authenticateToken(): Promise<TUser | null> {
    return this.user;
  }

  authorizeUser(): boolean {
    return true;
  }
}

describe('normalizeMastraUser', () => {
  it('normalizes a user object with id, name, email, avatarUrl, and role', () => {
    expect(
      normalizeMastraUser({
        id: 'user-1',
        name: 'Ada',
        email: 'ada@example.com',
        avatarUrl: 'https://img.test/a.png',
        role: 'admin',
      }),
    ).toEqual({
      id: 'user-1',
      name: 'Ada',
      email: 'ada@example.com',
      avatarUrl: 'https://img.test/a.png',
      role: 'admin',
    });
  });

  it('derives id from sub, then userId, when id is absent', () => {
    expect(normalizeMastraUser({ sub: 'sub-1' })).toEqual({ id: 'sub-1' });
    expect(normalizeMastraUser({ userId: 'uid-1' })).toEqual({ id: 'uid-1' });
    expect(normalizeMastraUser({ id: 'id-1', sub: 'sub-1' })).toEqual({ id: 'id-1' });
  });

  it('stringifies numeric ids', () => {
    expect(normalizeMastraUser({ id: 42 })).toEqual({ id: '42' });
  });

  it('maps picture to avatarUrl when avatarUrl is absent', () => {
    expect(normalizeMastraUser({ sub: 'sub-1', picture: 'https://img.test/p.png' })).toEqual({
      id: 'sub-1',
      avatarUrl: 'https://img.test/p.png',
    });
  });

  it('treats a non-empty string user as the user id', () => {
    expect(normalizeMastraUser('user-1')).toEqual({ id: 'user-1' });
  });

  it('omits non-string optional fields', () => {
    expect(normalizeMastraUser({ id: 'u', name: 123, email: null, role: { nested: true } })).toEqual({ id: 'u' });
  });

  it('throws when no id can be derived', () => {
    expect(() => normalizeMastraUser({ email: 'no-id@example.com' })).toThrow(/override toMastraUser/i);
  });

  it('throws for primitives that are not non-empty strings', () => {
    expect(() => normalizeMastraUser(true)).toThrow(/override toMastraUser/i);
    expect(() => normalizeMastraUser(null)).toThrow(/override toMastraUser/i);
    expect(() => normalizeMastraUser('')).toThrow(/override toMastraUser/i);
  });
});

describe('MastraAuthProvider.toMastraUser', () => {
  it('uses the default normalization', () => {
    const provider = new StubAuth({ sub: 'sub-9', name: 'Grace' });
    expect(provider.toMastraUser({ sub: 'sub-9', name: 'Grace' })).toEqual({ id: 'sub-9', name: 'Grace' });
  });

  it('can be overridden by subclasses', () => {
    class CustomAuth extends StubAuth<{ uid: string }> {
      override toMastraUser(user: { uid: string }): MastraUser {
        return { id: user.uid, role: 'custom' };
      }
    }
    const provider = new CustomAuth({ uid: 'u-1' });
    expect(provider.toMastraUser({ uid: 'u-1' })).toEqual({ id: 'u-1', role: 'custom' });
  });
});

describe('CompositeAuth.toMastraUser', () => {
  it('delegates to the provider that authenticated the user', async () => {
    const user = { uid: 'winner' };
    class WinnerAuth extends MastraAuthProvider<{ uid: string }> {
      async authenticateToken() {
        return user;
      }
      authorizeUser() {
        return true;
      }
      override toMastraUser(u: { uid: string }): MastraUser {
        return { id: u.uid, role: 'winner-role' };
      }
    }
    const loser = new StubAuth(null);
    const composite = new CompositeAuth([loser, new WinnerAuth()]);

    const authenticated = await composite.authenticateToken('token', new Request('http://localhost/'));
    expect(authenticated).toBe(user);
    expect(composite.toMastraUser(authenticated)).toEqual({ id: 'winner', role: 'winner-role' });
  });

  it('does not consume the authenticated-provider mapping (resource id mapping still works after)', async () => {
    const user = { uid: 'both' };
    class BothAuth extends MastraAuthProvider<{ uid: string }> {
      constructor() {
        super({ mapUserToResourceId: u => u.uid });
      }
      async authenticateToken() {
        return user;
      }
      authorizeUser() {
        return true;
      }
      override toMastraUser(u: { uid: string }): MastraUser {
        return { id: u.uid };
      }
    }
    const composite = new CompositeAuth([new BothAuth()]);

    const authenticated = await composite.authenticateToken('token', new Request('http://localhost/'));
    expect(composite.toMastraUser(authenticated)).toEqual({ id: 'both' });
    expect(composite.mapUserToResourceId?.(authenticated)).toBe('both');
  });

  it('falls back to default normalization for users it did not authenticate', () => {
    const composite = new CompositeAuth([new StubAuth(null)]);
    expect(composite.toMastraUser({ sub: 'external' })).toEqual({ id: 'external' });
  });
});
