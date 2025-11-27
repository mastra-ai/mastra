import type { HonoRequest } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { MastraAuthProvider } from './auth';
import { CompositeAuth } from './composite-auth';

// Mock auth provider class for testing
class MockAuthProvider extends MastraAuthProvider {
  private _shouldAuthenticate: boolean;
  private _shouldAuthorize: boolean;
  private _shouldThrow: boolean;
  private _user: any;

  constructor(
    shouldAuthenticate: boolean = false,
    shouldAuthorize: boolean = false,
    shouldThrow: boolean = false,
    user: any = null,
  ) {
    super({ name: 'mock' });
    this._shouldAuthenticate = shouldAuthenticate;
    this._shouldAuthorize = shouldAuthorize;
    this._shouldThrow = shouldThrow;
    this._user = user;
  }

  async authenticateToken(_token: string, _request: HonoRequest): Promise<any | null> {
    if (this._shouldThrow) {
      throw new Error('Authentication failed');
    }
    return this._shouldAuthenticate ? this._user : null;
  }

  async authorizeUser(_user: any, _request: HonoRequest): Promise<boolean> {
    return this._shouldAuthorize;
  }
}

// Mock HonoRequest
const mockRequest = {
  url: 'http://localhost/test',
  method: 'GET',
} as HonoRequest;

describe('Composite auth', () => {
  describe('CompositeAuth', () => {
    describe('authenticateToken', () => {
      it('should return null when no providers authenticate', async () => {
        const provider1 = new MockAuthProvider(false);
        const provider2 = new MockAuthProvider(false);
        const compositeAuth = new CompositeAuth([provider1, provider2]);

        const result = await compositeAuth.authenticateToken('test-token', mockRequest);
        expect(result).toBeNull();
      });

      it('should return user from first successful provider', async () => {
        const user1 = { id: 1, name: 'User 1' };
        const user2 = { id: 2, name: 'User 2' };

        const provider1 = new MockAuthProvider(true, false, false, user1);
        const provider2 = new MockAuthProvider(true, false, false, user2);
        const compositeAuth = new CompositeAuth([provider1, provider2]);

        const result = await compositeAuth.authenticateToken('test-token', mockRequest);
        expect(result).toEqual(user1);
      });

      it('should try second provider when first fails', async () => {
        const user2 = { id: 2, name: 'User 2' };

        const provider1 = new MockAuthProvider(false);
        const provider2 = new MockAuthProvider(true, false, false, user2);
        const compositeAuth = new CompositeAuth([provider1, provider2]);

        const result = await compositeAuth.authenticateToken('test-token', mockRequest);
        expect(result).toEqual(user2);
      });

      it('should handle provider errors gracefully and continue to next provider', async () => {
        const user2 = { id: 2, name: 'User 2' };

        const provider1 = new MockAuthProvider(false, false, true); // throws error
        const provider2 = new MockAuthProvider(true, false, false, user2);
        const compositeAuth = new CompositeAuth([provider1, provider2]);

        const result = await compositeAuth.authenticateToken('test-token', mockRequest);
        expect(result).toEqual(user2);
      });

      it('should return null when all providers throw errors', async () => {
        const provider1 = new MockAuthProvider(false, false, true);
        const provider2 = new MockAuthProvider(false, false, true);
        const compositeAuth = new CompositeAuth([provider1, provider2]);

        const result = await compositeAuth.authenticateToken('test-token', mockRequest);
        expect(result).toBeNull();
      });

      it('should pass token and request to providers', async () => {
        const provider1 = new MockAuthProvider(true, false, false, { id: 1 });
        const spy = vi.spyOn(provider1, 'authenticateToken');

        const compositeAuth = new CompositeAuth([provider1]);
        await compositeAuth.authenticateToken('test-token', mockRequest);

        expect(spy).toHaveBeenCalledWith('test-token', mockRequest);
      });
    });

    describe('authorizeUser', () => {
      it('should return false when no providers authorize', async () => {
        const provider1 = new MockAuthProvider(false, false);
        const provider2 = new MockAuthProvider(false, false);
        const compositeAuth = new CompositeAuth([provider1, provider2]);

        const result = await compositeAuth.authorizeUser({ id: 1 }, mockRequest);
        expect(result).toBe(false);
      });

      it('should return true when first provider authorizes', async () => {
        const provider1 = new MockAuthProvider(false, true);
        const provider2 = new MockAuthProvider(false, false);
        const compositeAuth = new CompositeAuth([provider1, provider2]);

        const result = await compositeAuth.authorizeUser({ id: 1 }, mockRequest);
        expect(result).toBe(true);
      });

      it('should return true when second provider authorizes', async () => {
        const provider1 = new MockAuthProvider(false, false);
        const provider2 = new MockAuthProvider(false, true);
        const compositeAuth = new CompositeAuth([provider1, provider2]);

        const result = await compositeAuth.authorizeUser({ id: 1 }, mockRequest);
        expect(result).toBe(true);
      });

      it('should return true when any provider authorizes', async () => {
        const provider1 = new MockAuthProvider(false, false);
        const provider2 = new MockAuthProvider(false, true);
        const provider3 = new MockAuthProvider(false, false);
        const compositeAuth = new CompositeAuth([provider1, provider2, provider3]);

        const result = await compositeAuth.authorizeUser({ id: 1 }, mockRequest);
        expect(result).toBe(true);
      });

      it('should pass user and request to providers', async () => {
        const provider1 = new MockAuthProvider(false, true);
        const spy = vi.spyOn(provider1, 'authorizeUser');

        const user = { id: 1, name: 'Test User' };
        const compositeAuth = new CompositeAuth([provider1]);
        await compositeAuth.authorizeUser(user, mockRequest);

        expect(spy).toHaveBeenCalledWith(user, mockRequest);
      });

      it('should stop at first authorizing provider', async () => {
        const provider1 = new MockAuthProvider(false, true);
        const provider2 = new MockAuthProvider(false, true);
        const spy1 = vi.spyOn(provider1, 'authorizeUser');
        const spy2 = vi.spyOn(provider2, 'authorizeUser');

        const compositeAuth = new CompositeAuth([provider1, provider2]);
        const result = await compositeAuth.authorizeUser({ id: 1 }, mockRequest);

        expect(result).toBe(true);
        expect(spy1).toHaveBeenCalled();
        expect(spy2).not.toHaveBeenCalled();
      });
    });

    describe('constructor', () => {
      it('should accept empty providers array', () => {
        const compositeAuth = new CompositeAuth([]);
        expect(compositeAuth).toBeInstanceOf(CompositeAuth);
      });

      it('should accept multiple providers', () => {
        const provider1 = new MockAuthProvider();
        const provider2 = new MockAuthProvider();
        const compositeAuth = new CompositeAuth([provider1, provider2]);
        expect(compositeAuth).toBeInstanceOf(CompositeAuth);
      });
    });

    describe('integration scenarios', () => {
      it('should work with mixed success/failure authentication and authorization', async () => {
        const user1 = { id: 1, role: 'user' };

        // Provider 1: authenticates user1 but doesn't authorize
        const provider1 = new MockAuthProvider(true, false, false, user1);
        // Provider 2: doesn't authenticate but DOES authorize
        const provider2 = new MockAuthProvider(false, true);

        const compositeAuth = new CompositeAuth([provider1, provider2]);

        // Authentication should return user1 from provider1
        const authResult = await compositeAuth.authenticateToken('token', mockRequest);
        expect(authResult).toEqual(user1);

        // Authorization should succeed because provider2 authorizes (even though provider1 doesn't)
        const authzResult = await compositeAuth.authorizeUser(user1, mockRequest);
        expect(authzResult).toBe(true);
      });

      it('should handle authentication from one provider and authorization from another', async () => {
        const user = { id: 1, role: 'admin' };

        // Provider 1: authenticates but doesn't authorize
        const provider1 = new MockAuthProvider(true, false, false, user);
        // Provider 2: doesn't authenticate but authorizes
        const provider2 = new MockAuthProvider(false, true);

        const compositeAuth = new CompositeAuth([provider1, provider2]);

        const authResult = await compositeAuth.authenticateToken('token', mockRequest);
        expect(authResult).toEqual(user);

        const authzResult = await compositeAuth.authorizeUser(user, mockRequest);
        expect(authzResult).toBe(true);
      });

      it('should fail authorization when all providers reject', async () => {
        const user = { id: 1, role: 'user' };

        // Provider 1: authenticates but doesn't authorize
        const provider1 = new MockAuthProvider(true, false, false, user);
        // Provider 2: doesn't authenticate and doesn't authorize
        const provider2 = new MockAuthProvider(false, false);

        const compositeAuth = new CompositeAuth([provider1, provider2]);

        const authResult = await compositeAuth.authenticateToken('token', mockRequest);
        expect(authResult).toEqual(user);

        // Authorization should fail since neither provider authorizes
        const authzResult = await compositeAuth.authorizeUser(user, mockRequest);
        expect(authzResult).toBe(false);
      });
    });
  });
});
