import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, it, expect } from 'vitest';

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

  describe('toMastraUser', () => {
    it('normalizes the payload through mapUser', () => {
      const auth = new MastraJwtAuth({ secret: SECRET });
      expect(auth.toMastraUser({ sub: 'user-1', email: 'a@b.co', picture: 'https://img.test/p.png' })).toEqual({
        id: 'user-1',
        email: 'a@b.co',
        name: undefined,
        avatarUrl: 'https://img.test/p.png',
      });
    });

    it('maps the role claim by default', () => {
      const auth = new MastraJwtAuth({ secret: SECRET });
      expect(auth.toMastraUser({ sub: 'user-1', role: 'admin' })).toMatchObject({ id: 'user-1', role: 'admin' });
    });

    it('uses a custom mapUser when provided', () => {
      const auth = new MastraJwtAuth({
        secret: SECRET,
        mapUser: payload => ({ id: `custom-${payload.sub}`, role: 'member' }),
      });
      expect(auth.toMastraUser({ sub: 'u1' })).toEqual({ id: 'custom-u1', role: 'member' });
    });

    it('falls back to shared normalization when mapUser returns null', () => {
      const auth = new MastraJwtAuth({
        secret: SECRET,
        mapUser: () => null,
      });
      expect(auth.toMastraUser({ userId: 'uid-7' })).toEqual({ id: 'uid-7' });
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

    it('enforces the issuer when configured', async () => {
      const auth = new MastraJwtAuth({ secret: SECRET, issuer: 'https://issuer.example' });

      await expect(
        auth.authenticateToken(jwt.sign({ sub: 'u', iss: 'https://issuer.example' }, SECRET)),
      ).resolves.toEqual(expect.objectContaining({ sub: 'u' }));
      await expect(
        auth.authenticateToken(jwt.sign({ sub: 'u', iss: 'https://other.example' }, SECRET)),
      ).rejects.toThrow(/issuer/);
      await expect(auth.authenticateToken(signToken({ sub: 'u' }))).rejects.toThrow(/issuer/);
    });
  });

  describe('construction', () => {
    it('rejects both a secret and a jwksUri', () => {
      expect(() => new MastraJwtAuth({ secret: SECRET, jwksUri: 'http://localhost/jwks' })).toThrow(/either/);
    });
  });

  describe('JWKS', () => {
    const ISSUER = 'https://issuer.example';
    let server: Server;
    let jwksUri: string;
    let privateKey: CryptoKey;
    let otherPrivateKey: CryptoKey;

    beforeAll(async () => {
      const pair = await generateKeyPair('RS256');
      privateKey = pair.privateKey;
      otherPrivateKey = (await generateKeyPair('RS256')).privateKey;
      const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'key-1', alg: 'RS256', use: 'sig' };
      server = createServer((_req, res) => {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ keys: [jwk] }));
      });
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
      jwksUri = `http://127.0.0.1:${(server.address() as AddressInfo).port}/.well-known/jwks.json`;
    });

    afterAll(async () => {
      await new Promise(resolve => server.close(resolve));
    });

    function sign(claims: Record<string, unknown>, key: CryptoKey = privateKey) {
      return new SignJWT(claims)
        .setProtectedHeader({ alg: 'RS256', kid: 'key-1' })
        .setIssuer(ISSUER)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(key);
    }

    it('verifies tokens signed by a key in the JWKS', async () => {
      const auth = new MastraJwtAuth({ jwksUri, issuer: ISSUER });
      const payload = await auth.authenticateToken(await sign({ sub: 'user-1' }));
      expect(payload).toEqual(expect.objectContaining({ sub: 'user-1', iss: ISSUER }));
    });

    it('rejects tokens signed by another key', async () => {
      const auth = new MastraJwtAuth({ jwksUri, issuer: ISSUER });
      await expect(auth.authenticateToken(await sign({ sub: 'user-1' }, otherPrivateKey))).rejects.toThrow(/signature/);
    });

    it('rejects HMAC tokens signed with the public key material (algorithm confusion)', async () => {
      const auth = new MastraJwtAuth({ jwksUri });
      const forged = jwt.sign({ sub: 'attacker' }, 'anything', { header: { alg: 'HS256', kid: 'key-1' } });
      await expect(auth.authenticateToken(forged)).rejects.toThrow();
    });

    it('rejects tokens from another issuer', async () => {
      const auth = new MastraJwtAuth({ jwksUri, issuer: 'https://someone-else.example' });
      await expect(auth.authenticateToken(await sign({ sub: 'user-1' }))).rejects.toThrow(/issuer/);
    });

    it('advertises the issuer as authorization server', () => {
      expect(new MastraJwtAuth({ jwksUri, issuer: ISSUER }).getOAuthMetadata()).toEqual({
        authorizationServers: [ISSUER],
      });
      expect(new MastraJwtAuth({ jwksUri }).getOAuthMetadata()).toBeUndefined();
    });

    it('checks the token audience for string and array aud claims', async () => {
      const auth = new MastraJwtAuth({ jwksUri, issuer: ISSUER });
      const resource = 'https://api.example.com/api/mcp';

      const single = await auth.authenticateToken(await sign({ sub: 'u', aud: resource }));
      const multiple = await auth.authenticateToken(await sign({ sub: 'u', aud: ['https://other', resource] }));
      const other = await auth.authenticateToken(await sign({ sub: 'u', aud: 'https://other' }));
      const none = await auth.authenticateToken(await sign({ sub: 'u' }));

      expect(auth.verifyAudience(single, resource)).toBe(true);
      expect(auth.verifyAudience(multiple, resource)).toBe(true);
      expect(auth.verifyAudience(other, resource)).toBe(false);
      expect(auth.verifyAudience(none, resource)).toBe(false);
    });
  });
});
