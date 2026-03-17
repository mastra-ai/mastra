import jwt from 'jsonwebtoken';
import { describe, it, expect } from 'vitest';

import { MastraJwtAuth } from './jwt';

const SECRET = 'test-secret-key';

function createRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/test', { headers });
}

function signToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, SECRET);
}

describe('MastraJwtAuth', () => {
  describe('getCurrentUser', () => {
    it('returns user from valid Bearer token', async () => {
      const auth = new MastraJwtAuth({ secret: SECRET });
      const token = signToken({ sub: 'user-123', email: 'test@example.com', name: 'Test User' });
      const request = createRequest({ Authorization: `Bearer ${token}` });

      const user = await auth.getCurrentUser(request);

      expect(user).toEqual(
        expect.objectContaining({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        }),
      );
    });

    it('uses sub claim as id', async () => {
      const auth = new MastraJwtAuth({ secret: SECRET });
      const token = signToken({ sub: 'from-sub' });
      const request = createRequest({ Authorization: `Bearer ${token}` });

      const user = await auth.getCurrentUser(request);

      expect(user?.id).toBe('from-sub');
    });

    it('returns null when no Authorization header', async () => {
      const auth = new MastraJwtAuth({ secret: SECRET });
      const request = createRequest();

      const user = await auth.getCurrentUser(request);

      expect(user).toBeNull();
    });

    it('falls back to id claim when sub is missing', async () => {
      const auth = new MastraJwtAuth({ secret: SECRET });
      const token = signToken({ id: 'from-id-claim', email: 'id@example.com' });
      const request = createRequest({ Authorization: `Bearer ${token}` });

      const user = await auth.getCurrentUser(request);

      expect(user?.id).toBe('from-id-claim');
    });

    it('returns null when both sub and id are missing', async () => {
      const auth = new MastraJwtAuth({ secret: SECRET });
      const token = signToken({ email: 'noone@example.com' });
      const request = createRequest({ Authorization: `Bearer ${token}` });

      const user = await auth.getCurrentUser(request);

      expect(user).toBeNull();
    });

    it('accepts case-insensitive Bearer scheme', async () => {
      const auth = new MastraJwtAuth({ secret: SECRET });
      const token = signToken({ sub: 'user-123' });
      const request = createRequest({ Authorization: `bearer ${token}` });

      const user = await auth.getCurrentUser(request);

      expect(user?.id).toBe('user-123');
    });

    it('returns null when Authorization header is not Bearer', async () => {
      const auth = new MastraJwtAuth({ secret: SECRET });
      const request = createRequest({ Authorization: 'Basic abc123' });

      const user = await auth.getCurrentUser(request);

      expect(user).toBeNull();
    });

    it('returns null when token is invalid', async () => {
      const auth = new MastraJwtAuth({ secret: SECRET });
      const request = createRequest({ Authorization: 'Bearer invalid-token' });

      const user = await auth.getCurrentUser(request);

      expect(user).toBeNull();
    });

    it('returns null when token is signed with wrong secret', async () => {
      const auth = new MastraJwtAuth({ secret: SECRET });
      const token = jwt.sign({ sub: 'user-123' }, 'wrong-secret');
      const request = createRequest({ Authorization: `Bearer ${token}` });

      const user = await auth.getCurrentUser(request);

      expect(user).toBeNull();
    });

    it('returns null when token is expired', async () => {
      const auth = new MastraJwtAuth({ secret: SECRET });
      const token = jwt.sign({ sub: 'user-123' }, SECRET, { expiresIn: -1 });
      const request = createRequest({ Authorization: `Bearer ${token}` });

      const user = await auth.getCurrentUser(request);

      expect(user).toBeNull();
    });

    it('supports custom mapUser function', async () => {
      const auth = new MastraJwtAuth({
        secret: SECRET,
        mapUser: payload => ({
          id: payload.userId as string,
          name: payload.displayName as string,
          email: payload.mail as string,
        }),
      });
      const token = signToken({ userId: 'custom-id', displayName: 'Custom Name', mail: 'custom@test.com' });
      const request = createRequest({ Authorization: `Bearer ${token}` });

      const user = await auth.getCurrentUser(request);

      expect(user).toEqual(
        expect.objectContaining({
          id: 'custom-id',
          name: 'Custom Name',
          email: 'custom@test.com',
        }),
      );
    });
  });

  describe('getUser', () => {
    it('returns null (JWT is stateless)', async () => {
      const auth = new MastraJwtAuth({ secret: SECRET });
      const user = await auth.getUser('any-id');
      expect(user).toBeNull();
    });
  });

  describe('authenticateToken', () => {
    it('verifies a valid token', async () => {
      const auth = new MastraJwtAuth({ secret: SECRET });
      const token = signToken({ sub: 'user-123' });

      const payload = await auth.authenticateToken(token);

      expect(payload.sub).toBe('user-123');
    });
  });
});
