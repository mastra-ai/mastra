import { describe, it, expect } from 'vitest';
import { SimpleAuth } from './simple-auth';

// Helper to create mock request
function mockRequest(headers: Record<string, string> = {}): any {
  return {
    header: (name: string) => headers[name],
    path: '/test',
    method: 'GET',
  };
}

describe('SimpleAuth', () => {
  describe('authenticateToken', () => {
    it('should authenticate valid token directly', async () => {
      const user = { id: 'user-1', name: 'Test User' };
      const auth = new SimpleAuth({ tokens: { 'test-token': user } });

      const result = await auth.authenticateToken('test-token', mockRequest());
      expect(result).toEqual(user);
    });

    it('should authenticate Bearer token directly', async () => {
      const user = { id: 'user-1', name: 'Test User' };
      const auth = new SimpleAuth({ tokens: { 'test-token': user } });

      const result = await auth.authenticateToken('Bearer test-token', mockRequest());
      expect(result).toEqual(user);
    });

    it('should return null for invalid token', async () => {
      const auth = new SimpleAuth({ tokens: { 'valid-token': { id: 'user' } } });

      const result = await auth.authenticateToken('invalid-token', mockRequest());
      expect(result).toBeNull();
    });

    it('should find token in Authorization header', async () => {
      const user = { id: 'user-1' };
      const auth = new SimpleAuth({ tokens: { 'header-token': user } });
      const request = mockRequest({ Authorization: 'Bearer header-token' });

      const result = await auth.authenticateToken('wrong-token', request);
      expect(result).toEqual(user);
    });

    it('should find token in custom header', async () => {
      const user = { id: 'user-1' };
      const auth = new SimpleAuth({
        tokens: { 'api-key-123': user },
        headers: 'X-API-Key',
      });
      const request = mockRequest({ 'X-API-Key': 'api-key-123' });

      const result = await auth.authenticateToken('wrong-token', request);
      expect(result).toEqual(user);
    });

    it('should check multiple custom headers', async () => {
      const user = { id: 'user-1' };
      const auth = new SimpleAuth({
        tokens: { 'my-token': user },
        headers: ['X-API-Key', 'X-Auth-Token'],
      });

      // Token in second header
      const request = mockRequest({ 'X-Auth-Token': 'my-token' });
      const result = await auth.authenticateToken('wrong', request);
      expect(result).toEqual(user);
    });

    it('should prefer direct token over header token', async () => {
      const user1 = { id: 'user-1' };
      const user2 = { id: 'user-2' };
      const auth = new SimpleAuth({
        tokens: {
          'direct-token': user1,
          'header-token': user2,
        },
      });
      const request = mockRequest({ Authorization: 'Bearer header-token' });

      const result = await auth.authenticateToken('direct-token', request);
      expect(result).toEqual(user1);
    });
  });

  describe('authorizeUser', () => {
    it('should authorize authenticated user', async () => {
      const user = { id: 'user-1' };
      const auth = new SimpleAuth({ tokens: { 'test-token': user } });

      const result = await auth.authorizeUser(user, mockRequest());
      expect(result).toBe(true);
    });

    it('should not authorize unknown user', async () => {
      const validUser = { id: 'user-1' };
      const unknownUser = { id: 'user-2' };
      const auth = new SimpleAuth({ tokens: { 'test-token': validUser } });

      const result = await auth.authorizeUser(unknownUser, mockRequest());
      expect(result).toBe(false);
    });

    it('should authorize with custom authorizeUser function', async () => {
      const auth = new SimpleAuth({
        tokens: {
          'token-1': 'user1',
          'token-2': 'user2',
        },
        authorizeUser: user => user === 'user1',
      });

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
