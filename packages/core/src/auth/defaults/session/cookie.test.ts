import { describe, it, expect, beforeEach } from 'vitest';

import { CookieSessionProvider } from './cookie';

describe('CookieSessionProvider', () => {
  const TEST_SECRET = 'test-secret-that-is-at-least-32-characters-long';
  let provider: CookieSessionProvider;

  beforeEach(() => {
    provider = new CookieSessionProvider({ secret: TEST_SECRET });
  });

  describe('constructor', () => {
    it('should throw if secret is too short', () => {
      expect(() => new CookieSessionProvider({ secret: 'short' })).toThrow(
        'CookieSessionProvider requires a secret of at least 32 characters',
      );
    });

    it('should accept a valid secret', () => {
      expect(() => new CookieSessionProvider({ secret: TEST_SECRET })).not.toThrow();
    });
  });

  describe('session creation', () => {
    it('should create a session with valid fields', async () => {
      const session = await provider.createSession('user-123');

      expect(session.id).toBeDefined();
      expect(session.userId).toBe('user-123');
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.expiresAt).toBeInstanceOf(Date);
      expect(session.expiresAt.getTime()).toBeGreaterThan(session.createdAt.getTime());
    });

    it('should generate unique session IDs', async () => {
      const session1 = await provider.createSession('user-123');
      const session2 = await provider.createSession('user-123');

      expect(session1.id).not.toBe(session2.id);
    });

    it('should include metadata when provided', async () => {
      const metadata = { role: 'admin', permissions: ['read', 'write'] };
      const session = await provider.createSession('user-123', metadata);

      expect(session.metadata).toEqual(metadata);
    });
  });

  describe('cookie signing and verification', () => {
    it('should create signed cookies that can be verified', async () => {
      const session = await provider.createSession('user-123');
      const headers = provider.getSessionHeaders(session);
      const cookieValue = headers['Set-Cookie'];

      // Extract the cookie value
      const match = cookieValue.match(/mastra_session=([^;]+)/);
      expect(match).toBeTruthy();

      // Create a request with the cookie
      const request = new Request('http://localhost', {
        headers: { cookie: `mastra_session=${match![1]}` },
      });

      const retrievedSession = provider.getSessionFromCookie(request);
      expect(retrievedSession).not.toBeNull();
      expect(retrievedSession!.id).toBe(session.id);
      expect(retrievedSession!.userId).toBe(session.userId);
    });

    it('should reject tampered cookie data', async () => {
      const session = await provider.createSession('user-123');
      const headers = provider.getSessionHeaders(session);
      const cookieValue = headers['Set-Cookie'];

      // Extract the cookie value
      const match = cookieValue.match(/mastra_session=([^;]+)/);
      const originalCookie = decodeURIComponent(match![1]);

      // Tamper with the data portion (base64 encoded JSON before the dot)
      const [data, signature] = originalCookie.split('.');
      // The implementation uses btoa(encodeURIComponent(str)), so we need to decode accordingly
      const decodedData = JSON.parse(decodeURIComponent(atob(data)));
      decodedData.userId = 'attacker-456'; // Tamper with userId
      const tamperedData = btoa(encodeURIComponent(JSON.stringify(decodedData)));
      const tamperedCookie = encodeURIComponent(`${tamperedData}.${signature}`);

      // Create a request with the tampered cookie
      const request = new Request('http://localhost', {
        headers: { cookie: `mastra_session=${tamperedCookie}` },
      });

      const retrievedSession = provider.getSessionFromCookie(request);
      expect(retrievedSession).toBeNull();
    });

    it('should reject tampered signatures', async () => {
      const session = await provider.createSession('user-123');
      const headers = provider.getSessionHeaders(session);
      const cookieValue = headers['Set-Cookie'];

      // Extract the cookie value
      const match = cookieValue.match(/mastra_session=([^;]+)/);
      const originalCookie = decodeURIComponent(match![1]);

      // Tamper with the signature
      const [data] = originalCookie.split('.');
      const tamperedCookie = encodeURIComponent(`${data}.tampered-signature`);

      const request = new Request('http://localhost', {
        headers: { cookie: `mastra_session=${tamperedCookie}` },
      });

      const retrievedSession = provider.getSessionFromCookie(request);
      expect(retrievedSession).toBeNull();
    });

    it('should reject cookies with missing signature', async () => {
      const session = await provider.createSession('user-123');
      const headers = provider.getSessionHeaders(session);
      const cookieValue = headers['Set-Cookie'];

      // Extract the cookie value and remove the signature
      const match = cookieValue.match(/mastra_session=([^;]+)/);
      const originalCookie = decodeURIComponent(match![1]);
      const [data] = originalCookie.split('.');
      const cookieWithoutSignature = encodeURIComponent(data);

      const request = new Request('http://localhost', {
        headers: { cookie: `mastra_session=${cookieWithoutSignature}` },
      });

      const retrievedSession = provider.getSessionFromCookie(request);
      expect(retrievedSession).toBeNull();
    });
  });

  describe('session expiration', () => {
    it('should reject expired sessions', async () => {
      // Create provider with very short TTL
      const shortLivedProvider = new CookieSessionProvider({
        secret: TEST_SECRET,
        ttl: 1, // 1 millisecond
      });

      const session = await shortLivedProvider.createSession('user-123');
      const headers = shortLivedProvider.getSessionHeaders(session);
      const cookieValue = headers['Set-Cookie'];

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      const match = cookieValue.match(/mastra_session=([^;]+)/);
      const request = new Request('http://localhost', {
        headers: { cookie: `mastra_session=${match![1]}` },
      });

      const retrievedSession = shortLivedProvider.getSessionFromCookie(request);
      expect(retrievedSession).toBeNull();
    });
  });

  describe('security properties', () => {
    it('should produce different signatures for different data', async () => {
      const session1 = await provider.createSession('user-123');
      const session2 = await provider.createSession('user-456');

      const headers1 = provider.getSessionHeaders(session1);
      const headers2 = provider.getSessionHeaders(session2);

      // Extract signatures
      const match1 = headers1['Set-Cookie'].match(/mastra_session=([^;]+)/);
      const match2 = headers2['Set-Cookie'].match(/mastra_session=([^;]+)/);

      const cookie1 = decodeURIComponent(match1![1]);
      const cookie2 = decodeURIComponent(match2![1]);

      const sig1 = cookie1.split('.')[1];
      const sig2 = cookie2.split('.')[1];

      expect(sig1).not.toBe(sig2);
    });

    it('should produce different signatures with different secrets', async () => {
      const provider1 = new CookieSessionProvider({ secret: TEST_SECRET });
      const provider2 = new CookieSessionProvider({ secret: 'different-secret-that-is-long-enough-32-chars' });

      // Create identical sessions (same user, same time)
      const session = {
        id: 'fixed-id',
        userId: 'user-123',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        expiresAt: new Date('2024-01-08T00:00:00Z'),
      };

      const headers1 = provider1.getSessionHeaders(session);
      const headers2 = provider2.getSessionHeaders(session);

      const match1 = headers1['Set-Cookie'].match(/mastra_session=([^;]+)/);
      const match2 = headers2['Set-Cookie'].match(/mastra_session=([^;]+)/);

      const cookie1 = decodeURIComponent(match1![1]);
      const cookie2 = decodeURIComponent(match2![1]);

      const sig1 = cookie1.split('.')[1];
      const sig2 = cookie2.split('.')[1];

      expect(sig1).not.toBe(sig2);
    });

    it('should produce cryptographically secure signatures (no easy collisions)', async () => {
      // This test verifies that similar inputs produce very different signatures
      // A weak hash would be more likely to produce collisions or predictable patterns
      const signatures = new Set<string>();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const session = await provider.createSession(`user-${i}`);
        const headers = provider.getSessionHeaders(session);
        const match = headers['Set-Cookie'].match(/mastra_session=([^;]+)/);
        const cookie = decodeURIComponent(match![1]);
        const sig = cookie.split('.')[1];
        signatures.add(sig);
      }

      // With a proper cryptographic hash, all signatures should be unique
      // With the weak hash, collisions are possible (especially with 32-bit output)
      expect(signatures.size).toBe(iterations);
    });

    it('should produce signatures of consistent length', async () => {
      // HMAC-SHA256 with base64url encoding produces fixed-length output
      // This helps verify we're using proper crypto
      const signatures: string[] = [];

      for (let i = 0; i < 10; i++) {
        const session = await provider.createSession(`user-${i}`);
        const headers = provider.getSessionHeaders(session);
        const match = headers['Set-Cookie'].match(/mastra_session=([^;]+)/);
        const cookie = decodeURIComponent(match![1]);
        const sig = cookie.split('.')[1];
        signatures.push(sig);
      }

      // All signatures should have the same length with HMAC-SHA256
      const lengths = signatures.map(s => s.length);
      const uniqueLengths = new Set(lengths);
      expect(uniqueLengths.size).toBe(1);
    });
  });

  describe('cookie headers', () => {
    it('should include HttpOnly and SameSite flags', async () => {
      const session = await provider.createSession('user-123');
      const headers = provider.getSessionHeaders(session);
      const cookie = headers['Set-Cookie'];

      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
    });

    it('should clear session with Max-Age=0', () => {
      const headers = provider.getClearSessionHeaders();
      const cookie = headers['Set-Cookie'];

      expect(cookie).toContain('Max-Age=0');
      expect(cookie).toContain('mastra_session=');
    });
  });
});
