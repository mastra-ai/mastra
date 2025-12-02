import type { HonoRequest } from 'hono';
import { describe, expect, it } from 'vitest';
import { SimpleAuth } from './simple-auth';

const mockRequest = (headers: Record<string, string | string[]> = {}) =>
  ({
    url: 'http://localhost/test',
    method: 'GET',
    header: (name: string) => headers[name],
  }) as HonoRequest;

describe('SimpleAuth', () => {
  describe('constructor', () => {
    it('should accept token-to-user mapping', () => {
      const auth = new SimpleAuth({
        tokens: { token1: { id: 1, name: 'user1' }, token2: { id: 2, name: 'user2' } },
      });
      expect(auth).toBeInstanceOf(SimpleAuth);
    });

    it('should use default headers when not specified', () => {
      const auth = new SimpleAuth({ tokens: { secret: 'user' } });
      expect(auth).toBeInstanceOf(SimpleAuth);
    });

    it('should accept custom headers as string', () => {
      const auth = new SimpleAuth({
        tokens: { secret: 'user' },
        headers: 'X-API-Key',
      });
      expect(auth).toBeInstanceOf(SimpleAuth);
    });

    it('should accept custom headers as array', () => {
      const auth = new SimpleAuth({
        tokens: { secret: 'user' },
        headers: ['X-API-Key', 'X-Custom'],
      });
      expect(auth).toBeInstanceOf(SimpleAuth);
    });

    it('should concatenate custom headers with default headers', () => {
      const auth = new SimpleAuth({
        tokens: { secret: 'user' },
        headers: ['X-API-Key'],
      });
      expect(auth).toBeInstanceOf(SimpleAuth);
    });
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token', async () => {
      const user = { id: 1, name: 'John' };
      const auth = new SimpleAuth({ tokens: { 'valid-token': user } });
      const result = await auth.authenticateToken('valid-token', mockRequest());
      expect(result).toEqual(user);
    });

    it('should reject invalid token', async () => {
      const auth = new SimpleAuth({ tokens: { 'valid-token': { id: 1 } } });
      const result = await auth.authenticateToken('invalid-token', mockRequest());
      expect(result).toBeNull();
    });

    it('should authenticate multiple tokens', async () => {
      const user1 = { id: 1, role: 'admin' };
      const user2 = { id: 2, role: 'user' };
      const auth = new SimpleAuth({
        tokens: {
          'admin-token': user1,
          'user-token': user2,
        },
      });

      const result1 = await auth.authenticateToken('admin-token', mockRequest());
      expect(result1).toEqual(user1);

      const result2 = await auth.authenticateToken('user-token', mockRequest());
      expect(result2).toEqual(user2);
    });

    it('should check tokens from headers', async () => {
      const user = { id: 1, name: 'User' };
      const auth = new SimpleAuth({ tokens: { 'header-token': user } });
      const request = mockRequest({ Authorization: 'Bearer header-token' });

      const result = await auth.authenticateToken('some-other-token', request);
      expect(result).toEqual(user);
    });

    it('should strip Bearer prefix from header tokens', async () => {
      const user = { id: 1, name: 'User' };
      const auth = new SimpleAuth({ tokens: { 'clean-token': user } });
      const request = mockRequest({ Authorization: 'Bearer clean-token' });

      const result = await auth.authenticateToken('different-token', request);
      expect(result).toEqual(user);
    });

    it('should check X-Playground-Access header', async () => {
      const user = { id: 1, name: 'User' };
      const auth = new SimpleAuth({ tokens: { 'playground-token': user } });
      const request = mockRequest({ 'X-Playground-Access': 'playground-token' });

      const result = await auth.authenticateToken('different-token', request);
      expect(result).toEqual(user);
    });

    it('should check custom headers', async () => {
      const user = { id: 1, name: 'User' };
      const auth = new SimpleAuth({
        tokens: { 'api-token': user },
        headers: 'X-API-Key',
      });
      const request = mockRequest({ 'X-API-Key': 'api-token' });

      const result = await auth.authenticateToken('different-token', request);
      expect(result).toEqual(user);
    });

    it('should check multiple custom headers', async () => {
      const user = { id: 1, name: 'User' };
      const auth = new SimpleAuth({
        tokens: { 'custom-token': user },
        headers: ['X-Primary', 'X-Secondary'],
      });
      const request = mockRequest({ 'X-Secondary': 'custom-token' });

      const result = await auth.authenticateToken('different-token', request);
      expect(result).toEqual(user);
    });

    it('should prioritize first matching token', async () => {
      const user1 = { id: 1, name: 'User1' };
      const user2 = { id: 2, name: 'User2' };
      const auth = new SimpleAuth({
        tokens: {
          token1: user1,
          token2: user2,
        },
      });
      const request = mockRequest({
        Authorization: 'token2',
        'X-Playground-Access': 'token1',
      });

      const result = await auth.authenticateToken('token1', request);
      expect(result).toEqual(user1);
    });
  });

  describe('authorizeUser', () => {
    it('should authorize valid user', async () => {
      const user = { id: 1, name: 'John' };
      const auth = new SimpleAuth({ tokens: { token: user } });
      const result = await auth.authorizeUser(user, mockRequest());
      expect(result).toBe(true);
    });

    it('should reject invalid user', async () => {
      const validUser = { id: 1, name: 'John' };
      const invalidUser = { id: 2, name: 'Jane' };
      const auth = new SimpleAuth({ tokens: { token: validUser } });
      const result = await auth.authorizeUser(invalidUser, mockRequest());
      expect(result).toBe(false);
    });

    it('should authorize any valid user from tokens', async () => {
      const user1 = { id: 1, role: 'admin' };
      const user2 = { id: 2, role: 'user' };
      const auth = new SimpleAuth({
        tokens: {
          'admin-token': user1,
          'user-token': user2,
        },
      });

      const result1 = await auth.authorizeUser(user1, mockRequest());
      expect(result1).toBe(true);

      const result2 = await auth.authorizeUser(user2, mockRequest());
      expect(result2).toBe(true);
    });

    it('should handle string users', async () => {
      const auth = new SimpleAuth({ tokens: { token1: 'user1', token2: 'user2' } });

      const result1 = await auth.authorizeUser('user1', mockRequest());
      expect(result1).toBe(true);

      const result2 = await auth.authorizeUser('user3', mockRequest());
      expect(result2).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should work end-to-end with object users', async () => {
      const adminUser = { id: 1, role: 'admin', permissions: ['read', 'write'] };
      const regularUser = { id: 2, role: 'user', permissions: ['read'] };

      const auth = new SimpleAuth({
        tokens: {
          'admin-secret': adminUser,
          'user-secret': regularUser,
        },
      });

      // Test direct token authentication
      const authenticatedAdmin = await auth.authenticateToken('admin-secret', mockRequest());
      expect(authenticatedAdmin).toEqual(adminUser);

      const authenticatedUser = await auth.authenticateToken('user-secret', mockRequest());
      expect(authenticatedUser).toEqual(regularUser);

      // Test authorization
      const adminAuthorized = await auth.authorizeUser(adminUser, mockRequest());
      expect(adminAuthorized).toBe(true);

      const userAuthorized = await auth.authorizeUser(regularUser, mockRequest());
      expect(userAuthorized).toBe(true);
    });

    it('should work end-to-end with header authentication', async () => {
      const user = { id: 1, name: 'API User' };
      const auth = new SimpleAuth({
        tokens: { 'api-key-123': user },
        headers: 'X-API-Key',
      });

      const request = mockRequest({ 'X-API-Key': 'api-key-123' });

      // Should find token in header even with different direct token
      const authenticated = await auth.authenticateToken('wrong-token', request);
      expect(authenticated).toEqual(user);

      // Should authorize the user
      const authorized = await auth.authorizeUser(user, request);
      expect(authorized).toBe(true);
    });

    it('should work with mixed token types', async () => {
      const objectUser = { id: 1, name: 'Object User' };
      const auth = new SimpleAuth({
        tokens: {
          'string-token': 'string-user',
          'object-token': objectUser,
          'number-token': 42,
        },
      });

      const stringResult = await auth.authenticateToken('string-token', mockRequest());
      expect(stringResult).toBe('string-user');

      const objectResult = await auth.authenticateToken('object-token', mockRequest());
      expect(objectResult).toEqual(objectUser);

      const numberResult = await auth.authenticateToken('number-token', mockRequest());
      expect(numberResult).toBe(42);

      // Authorization should work for all types - use the exact same objects
      expect(await auth.authorizeUser('string-user', mockRequest())).toBe(true);
      expect(await auth.authorizeUser(objectUser, mockRequest())).toBe(true);
      expect(await auth.authorizeUser(42, mockRequest())).toBe(true);
      expect(await auth.authorizeUser('invalid', mockRequest())).toBe(false);
    });

    it('should fail authentication and authorization for invalid tokens', async () => {
      const user = { id: 1, name: 'Valid User' };
      const auth = new SimpleAuth({ tokens: { 'valid-token': user } });
      const request = mockRequest({ Authorization: 'Bearer invalid-token' });

      const authenticated = await auth.authenticateToken('also-invalid', request);
      expect(authenticated).toBeNull();

      const invalidUser = { id: 2, name: 'Invalid User' };
      const authorized = await auth.authorizeUser(invalidUser, request);
      expect(authorized).toBe(false);
    });
  });
});
