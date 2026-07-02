import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

import { decodeToken, getTokenIssuer, verifyHmac } from './utils';

const SECRET = 'test-secret-key';

function signToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, SECRET);
}

describe('JWT auth utilities', () => {
  describe('decodeToken', () => {
    it('returns the complete decoded token', async () => {
      const token = signToken({ sub: 'user-123', iss: 'https://issuer.example.com' });

      const decoded = await decodeToken(token);

      expect(decoded).toEqual(
        expect.objectContaining({
          header: expect.objectContaining({ alg: 'HS256' }),
          payload: expect.objectContaining({
            sub: 'user-123',
            iss: 'https://issuer.example.com',
          }),
          signature: expect.any(String),
        }),
      );
    });

    it('returns null for malformed tokens', async () => {
      await expect(decodeToken('not-a-jwt')).resolves.toBeNull();
    });
  });

  describe('getTokenIssuer', () => {
    it('returns the issuer from a decoded token payload', async () => {
      const decoded = await decodeToken(signToken({ iss: 'https://issuer.example.com' }));

      expect(getTokenIssuer(decoded)).toBe('https://issuer.example.com');
    });

    it('throws when the decoded token is null', () => {
      expect(() => getTokenIssuer(null)).toThrow('Invalid token');
    });

    it('throws when the decoded token has a string payload', () => {
      const token = jwt.sign('plain payload', SECRET);
      const decoded = jwt.decode(token, { complete: true });

      expect(() => getTokenIssuer(decoded)).toThrow('Invalid token payload');
    });

    it('throws when the decoded token payload has no issuer', async () => {
      const decoded = await decodeToken(signToken({ sub: 'user-123' }));

      expect(() => getTokenIssuer(decoded)).toThrow('Invalid token header');
    });
  });

  describe('verifyHmac', () => {
    it('verifies a token signed with the shared secret', async () => {
      const token = signToken({ sub: 'user-123' });

      const payload = await verifyHmac(token, SECRET);

      expect(payload.sub).toBe('user-123');
    });

    it('throws when the token cannot be decoded', async () => {
      await expect(verifyHmac('not-a-jwt', SECRET)).rejects.toThrow('Invalid token');
    });

    it('throws when the token was signed with a different secret', async () => {
      const token = jwt.sign({ sub: 'user-123' }, 'wrong-secret');

      await expect(verifyHmac(token, SECRET)).rejects.toThrow('invalid signature');
    });
  });
});
