import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { MastraAgentLairAuth } from './provider';
import type { VerifiedAgent, TrustScore } from './types';

// ── Mock jose ───────────────────────────────────────────────────────────────

const mockJwtVerify = vi.fn();
const mockCreateRemoteJWKSet = vi.fn().mockReturnValue('mock-jwks');

vi.mock('jose', () => ({
  jwtVerify: (...args: unknown[]) => mockJwtVerify(...args),
  createRemoteJWKSet: (...args: unknown[]) => mockCreateRemoteJWKSet(...args),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

function validClaims() {
  return {
    iss: 'https://agentlair.dev',
    sub: 'agent_test_123',
    aud: 'https://my-service.com',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    jti: 'jti_abc',
    al_name: 'Test Agent',
    al_email: 'test@agentlair.dev',
    al_scopes: ['read', 'write'],
    al_audit_url: 'https://agentlair.dev/audit/agent_test_123',
  };
}

function mockRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/test', { headers });
}

function mockHonoRequest(headers: Record<string, string> = {}) {
  const req = mockRequest(headers);
  return {
    header: (name: string) => req.headers.get(name),
    url: 'http://localhost/api/test',
    method: 'GET',
    raw: req,
  };
}

function mockTrustScore(overrides: Partial<TrustScore> = {}): TrustScore {
  return {
    agentId: 'agent_test_123',
    score: 750,
    tier: 'trusted',
    breakdown: { behavioral: 200, consistency: 200, reputation: 200, transparency: 150 },
    computedAt: '2026-04-12T00:00:00Z',
    observationCount: 42,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MastraAgentLairAuth', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('constructor', () => {
    it('constructs with default options', () => {
      const auth = new MastraAgentLairAuth();
      expect(auth).toBeInstanceOf(MastraAgentLairAuth);
    });

    it('constructs with custom options', () => {
      const auth = new MastraAgentLairAuth({
        baseUrl: 'https://custom.agentlair.dev',
        apiKey: 'al_live_test',
        audience: 'https://my-service.com',
        fetchTrustScore: true,
        minimumTrustScore: 500,
        requiredTier: 'trusted',
        requiredScopes: ['admin'],
      });
      expect(auth).toBeInstanceOf(MastraAgentLairAuth);
    });

    it('creates JWKS client with correct URL', () => {
      new MastraAgentLairAuth({ baseUrl: 'https://custom.example.com' });
      expect(mockCreateRemoteJWKSet).toHaveBeenCalledWith(
        new URL('https://custom.example.com/.well-known/jwks.json'),
      );
    });

    it('accepts custom JWKS URL', () => {
      new MastraAgentLairAuth({ jwksUrl: 'https://keys.example.com/jwks' });
      expect(mockCreateRemoteJWKSet).toHaveBeenCalledWith(new URL('https://keys.example.com/jwks'));
    });
  });

  describe('authenticateToken', () => {
    it('verifies valid EdDSA token', async () => {
      const claims = validClaims();
      mockJwtVerify.mockResolvedValue({ payload: claims, protectedHeader: { alg: 'EdDSA' } });

      const auth = new MastraAgentLairAuth({ audience: 'https://my-service.com' });
      const agent = await auth.authenticateToken('valid.jwt.token', mockHonoRequest() as any);

      expect(agent).not.toBeNull();
      expect(agent!.accountId).toBe('agent_test_123');
      expect(agent!.name).toBe('Test Agent');
      expect(agent!.email).toBe('test@agentlair.dev');
      expect(agent!.scopes).toEqual(['read', 'write']);
      expect(agent!.auditUrl).toBe('https://agentlair.dev/audit/agent_test_123');
    });

    it('passes correct verification options to jose', async () => {
      mockJwtVerify.mockResolvedValue({ payload: validClaims() });

      const auth = new MastraAgentLairAuth({
        audience: 'https://my-service.com',
        issuer: 'https://custom-issuer.dev',
      });
      await auth.authenticateToken('test.token', mockHonoRequest() as any);

      expect(mockJwtVerify).toHaveBeenCalledWith('test.token', 'mock-jwks', {
        issuer: 'https://custom-issuer.dev',
        audience: 'https://my-service.com',
        algorithms: ['EdDSA'],
      });
    });

    it('returns null for invalid token', async () => {
      mockJwtVerify.mockRejectedValue(new Error('Invalid signature'));

      const auth = new MastraAgentLairAuth();
      const agent = await auth.authenticateToken('invalid.token', mockHonoRequest() as any);

      expect(agent).toBeNull();
    });

    it('fetches trust score when configured', async () => {
      const claims = validClaims();
      mockJwtVerify.mockResolvedValue({ payload: claims });

      const score = mockTrustScore();
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(score),
      });

      const auth = new MastraAgentLairAuth({
        apiKey: 'al_live_test',
        fetchTrustScore: true,
      });
      const agent = await auth.authenticateToken('valid.token', mockHonoRequest() as any);

      expect(agent!.trustScore).toEqual(score);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://agentlair.dev/v1/trust/agent_test_123',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer al_live_test' }),
        }),
      );
    });

    it('succeeds even when trust score fetch fails', async () => {
      mockJwtVerify.mockResolvedValue({ payload: validClaims() });
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      const auth = new MastraAgentLairAuth({ apiKey: 'key', fetchTrustScore: true });
      const agent = await auth.authenticateToken('valid.token', mockHonoRequest() as any);

      expect(agent).not.toBeNull();
      expect(agent!.trustScore).toBeUndefined();
    });
  });

  describe('authorizeUser', () => {
    it('authorizes agent with no trust requirements', async () => {
      const auth = new MastraAgentLairAuth();
      const agent: VerifiedAgent = {
        accountId: 'test',
        scopes: [],
        auditUrl: '',
        claims: validClaims(),
      };

      const result = await auth.authorizeUser(agent, mockHonoRequest() as any);
      expect(result).toBe(true);
    });

    it('rejects agent missing required scope', async () => {
      const auth = new MastraAgentLairAuth({ requiredScopes: ['admin'] });
      const agent: VerifiedAgent = {
        accountId: 'test',
        scopes: ['read', 'write'],
        auditUrl: '',
        claims: validClaims(),
      };

      const result = await auth.authorizeUser(agent, mockHonoRequest() as any);
      expect(result).toBe(false);
    });

    it('allows wildcard scope to satisfy any requirement', async () => {
      const auth = new MastraAgentLairAuth({ requiredScopes: ['admin', 'superuser'] });
      const agent: VerifiedAgent = {
        accountId: 'test',
        scopes: ['*'],
        auditUrl: '',
        claims: validClaims(),
      };

      const result = await auth.authorizeUser(agent, mockHonoRequest() as any);
      expect(result).toBe(true);
    });

    it('rejects agent below minimum trust score', async () => {
      const auth = new MastraAgentLairAuth({ minimumTrustScore: 800 });
      const agent: VerifiedAgent = {
        accountId: 'test',
        scopes: [],
        auditUrl: '',
        claims: validClaims(),
        trustScore: mockTrustScore({ score: 400 }),
      };

      const result = await auth.authorizeUser(agent, mockHonoRequest() as any);
      expect(result).toBe(false);
    });

    it('allows agent meeting minimum trust score', async () => {
      const auth = new MastraAgentLairAuth({ minimumTrustScore: 500 });
      const agent: VerifiedAgent = {
        accountId: 'test',
        scopes: [],
        auditUrl: '',
        claims: validClaims(),
        trustScore: mockTrustScore({ score: 750 }),
      };

      const result = await auth.authorizeUser(agent, mockHonoRequest() as any);
      expect(result).toBe(true);
    });

    it('rejects agent below required tier', async () => {
      const auth = new MastraAgentLairAuth({ requiredTier: 'verified' });
      const agent: VerifiedAgent = {
        accountId: 'test',
        scopes: [],
        auditUrl: '',
        claims: validClaims(),
        trustScore: mockTrustScore({ tier: 'trusted' }),
      };

      const result = await auth.authorizeUser(agent, mockHonoRequest() as any);
      expect(result).toBe(false);
    });

    it('allows agent meeting required tier', async () => {
      const auth = new MastraAgentLairAuth({ requiredTier: 'trusted' });
      const agent: VerifiedAgent = {
        accountId: 'test',
        scopes: [],
        auditUrl: '',
        claims: validClaims(),
        trustScore: mockTrustScore({ tier: 'trusted' }),
      };

      const result = await auth.authorizeUser(agent, mockHonoRequest() as any);
      expect(result).toBe(true);
    });

    it('fetches trust score on demand when needed for authorization', async () => {
      const score = mockTrustScore({ score: 800 });
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(score),
      });

      const auth = new MastraAgentLairAuth({
        apiKey: 'al_live_test',
        minimumTrustScore: 500,
      });
      const agent: VerifiedAgent = {
        accountId: 'test',
        scopes: [],
        auditUrl: '',
        claims: validClaims(),
        // No trustScore — should be fetched on demand
      };

      const result = await auth.authorizeUser(agent, mockHonoRequest() as any);
      expect(result).toBe(true);
      expect(agent.trustScore).toEqual(score);
    });

    it('rejects when trust score needed but no API key', async () => {
      const auth = new MastraAgentLairAuth({ minimumTrustScore: 500 });
      const agent: VerifiedAgent = {
        accountId: 'test',
        scopes: [],
        auditUrl: '',
        claims: validClaims(),
      };

      const result = await auth.authorizeUser(agent, mockHonoRequest() as any);
      expect(result).toBe(false);
    });
  });

  describe('getCurrentUser (IUserProvider)', () => {
    it('returns user from valid Bearer token', async () => {
      mockJwtVerify.mockResolvedValue({ payload: validClaims() });

      const auth = new MastraAgentLairAuth();
      const request = mockRequest({ Authorization: 'Bearer valid.token' });
      const user = await auth.getCurrentUser(request);

      expect(user).toEqual({
        id: 'agent_test_123',
        email: 'test@agentlair.dev',
        name: 'Test Agent',
        avatarUrl: undefined,
      });
    });

    it('returns null when no Authorization header', async () => {
      const auth = new MastraAgentLairAuth();
      const user = await auth.getCurrentUser(mockRequest());
      expect(user).toBeNull();
    });

    it('returns null for invalid token', async () => {
      mockJwtVerify.mockRejectedValue(new Error('Invalid'));

      const auth = new MastraAgentLairAuth();
      const user = await auth.getCurrentUser(mockRequest({ Authorization: 'Bearer bad' }));
      expect(user).toBeNull();
    });

    it('accepts case-insensitive Bearer scheme', async () => {
      mockJwtVerify.mockResolvedValue({ payload: validClaims() });

      const auth = new MastraAgentLairAuth();
      const user = await auth.getCurrentUser(mockRequest({ Authorization: 'BEARER valid.token' }));
      expect(user).not.toBeNull();
    });

    it('returns null when authorization fails', async () => {
      mockJwtVerify.mockResolvedValue({ payload: validClaims() });

      const auth = new MastraAgentLairAuth({ requiredScopes: ['admin'] });
      const user = await auth.getCurrentUser(mockRequest({ Authorization: 'Bearer valid.token' }));
      expect(user).toBeNull();
    });
  });

  describe('getUser', () => {
    it('returns null (JWT is stateless)', async () => {
      const auth = new MastraAgentLairAuth();
      const user = await auth.getUser('agent_123');
      expect(user).toBeNull();
    });
  });

  describe('convenience methods', () => {
    it('hasScope returns true for matching scope', () => {
      const auth = new MastraAgentLairAuth();
      const agent: VerifiedAgent = {
        accountId: 'test',
        scopes: ['read', 'write'],
        auditUrl: '',
        claims: validClaims(),
      };
      expect(auth.hasScope(agent, 'read')).toBe(true);
      expect(auth.hasScope(agent, 'admin')).toBe(false);
    });

    it('hasScope returns true for wildcard', () => {
      const auth = new MastraAgentLairAuth();
      const agent: VerifiedAgent = {
        accountId: 'test',
        scopes: ['*'],
        auditUrl: '',
        claims: validClaims(),
      };
      expect(auth.hasScope(agent, 'anything')).toBe(true);
    });

    it('meetsTrustTier compares tiers correctly', () => {
      const auth = new MastraAgentLairAuth();
      const agent: VerifiedAgent = {
        accountId: 'test',
        scopes: [],
        auditUrl: '',
        claims: validClaims(),
        trustScore: mockTrustScore({ tier: 'trusted' }),
      };

      expect(auth.meetsTrustTier(agent, 'provisional')).toBe(true);
      expect(auth.meetsTrustTier(agent, 'trusted')).toBe(true);
      expect(auth.meetsTrustTier(agent, 'verified')).toBe(false);
    });

    it('meetsTrustTier returns false without trust score', () => {
      const auth = new MastraAgentLairAuth();
      const agent: VerifiedAgent = {
        accountId: 'test',
        scopes: [],
        auditUrl: '',
        claims: validClaims(),
      };
      expect(auth.meetsTrustTier(agent, 'provisional')).toBe(false);
    });

    it('getUserProfileUrl returns correct URL', () => {
      const auth = new MastraAgentLairAuth();
      const url = auth.getUserProfileUrl({ id: 'agent_123', name: 'Test' });
      expect(url).toBe('https://agentlair.dev/agents/agent_123');
    });
  });

  describe('fetchTrustScore', () => {
    it('requires API key', async () => {
      const auth = new MastraAgentLairAuth();
      await expect(auth.fetchTrustScore('agent_123')).rejects.toThrow('API key required');
    });

    it('calls trust API correctly', async () => {
      const score = mockTrustScore();
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(score),
      });

      const auth = new MastraAgentLairAuth({ apiKey: 'al_live_test' });
      const result = await auth.fetchTrustScore('agent_123');

      expect(result).toEqual(score);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://agentlair.dev/v1/trust/agent_123',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer al_live_test' }),
        }),
      );
    });

    it('throws on API error', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 404 });

      const auth = new MastraAgentLairAuth({ apiKey: 'al_live_test' });
      await expect(auth.fetchTrustScore('agent_404')).rejects.toThrow('HTTP 404');
    });
  });
});
