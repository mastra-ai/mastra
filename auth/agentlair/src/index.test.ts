import { jwtVerify, createRemoteJWKSet } from 'jose';
import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest';

import { MastraAuthAgentLair } from './auth-provider';
import { MastraRBACAgentLair } from './rbac-provider';
import type { AgentLairUser } from './types';

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(),
  jwtVerify: vi.fn(),
}));

describe('MastraAuthAgentLair', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    test('initializes with default JWKS URL', () => {
      const auth = new MastraAuthAgentLair();
      expect(createRemoteJWKSet).toHaveBeenCalledWith(new URL('https://agentlair.dev/.well-known/jwks.json'));
    });

    test('accepts a custom JWKS URL', () => {
      new MastraAuthAgentLair({ jwksUrl: 'https://custom.example.com/.well-known/jwks.json' });
      expect(createRemoteJWKSet).toHaveBeenCalledWith(new URL('https://custom.example.com/.well-known/jwks.json'));
    });

    test('accepts an issuer', () => {
      const auth = new MastraAuthAgentLair({ issuer: 'https://agentlair.dev' });
      expect(auth).toBeDefined();
    });
  });

  describe('authenticateToken', () => {
    test('verifies an EdDSA JWT and returns agent identity', async () => {
      const mockJWKS = vi.fn();
      (createRemoteJWKSet as any).mockReturnValue(mockJWKS);
      (jwtVerify as any).mockResolvedValue({
        payload: {
          sub: 'agent-abc-123',
          iss: 'https://agentlair.dev',
          trust_score: 750,
          behavioral_health_score: 92,
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      });

      const auth = new MastraAuthAgentLair();
      const result = await auth.authenticateToken('valid-token');

      expect(jwtVerify).toHaveBeenCalledWith('valid-token', mockJWKS, {
        issuer: undefined,
        algorithms: ['EdDSA'],
      });
      expect(result).toEqual({
        agentId: 'agent-abc-123',
        iss: 'https://agentlair.dev',
        trustScore: 750,
        behavioralHealthScore: 92,
        claims: {
          sub: 'agent-abc-123',
          iss: 'https://agentlair.dev',
          trust_score: 750,
          behavioral_health_score: 92,
          exp: expect.any(Number),
        },
      });
    });

    test('passes issuer to jwtVerify when configured', async () => {
      const mockJWKS = vi.fn();
      (createRemoteJWKSet as any).mockReturnValue(mockJWKS);
      (jwtVerify as any).mockResolvedValue({
        payload: { sub: 'agent-1', iss: 'https://agentlair.dev' },
      });

      const auth = new MastraAuthAgentLair({ issuer: 'https://agentlair.dev' });
      await auth.authenticateToken('some-token');

      expect(jwtVerify).toHaveBeenCalledWith('some-token', mockJWKS, {
        issuer: 'https://agentlair.dev',
        algorithms: ['EdDSA'],
      });
    });

    test('returns null for empty token', async () => {
      const auth = new MastraAuthAgentLair();
      expect(await auth.authenticateToken('')).toBeNull();
    });

    test('returns null for non-string token', async () => {
      const auth = new MastraAuthAgentLair();
      expect(await auth.authenticateToken(null as any)).toBeNull();
    });

    test('returns null when verification fails (expired token)', async () => {
      (createRemoteJWKSet as any).mockReturnValue(vi.fn());
      (jwtVerify as any).mockRejectedValue(new Error('Token expired'));

      const auth = new MastraAuthAgentLair();
      expect(await auth.authenticateToken('expired-token')).toBeNull();
    });

    test('returns null when verification fails (wrong signature)', async () => {
      (createRemoteJWKSet as any).mockReturnValue(vi.fn());
      (jwtVerify as any).mockRejectedValue(new Error('Signature verification failed'));

      const auth = new MastraAuthAgentLair();
      expect(await auth.authenticateToken('bad-sig-token')).toBeNull();
    });

    test('returns null when sub claim is missing', async () => {
      (createRemoteJWKSet as any).mockReturnValue(vi.fn());
      (jwtVerify as any).mockResolvedValue({
        payload: { iss: 'https://agentlair.dev' },
      });

      const auth = new MastraAuthAgentLair();
      expect(await auth.authenticateToken('no-sub-token')).toBeNull();
    });

    test('returns null when iss claim is missing', async () => {
      (createRemoteJWKSet as any).mockReturnValue(vi.fn());
      (jwtVerify as any).mockResolvedValue({
        payload: { sub: 'agent-no-iss' },
      });

      const auth = new MastraAuthAgentLair();
      expect(await auth.authenticateToken('no-iss-token')).toBeNull();
    });

    test('handles token without trust_score', async () => {
      (createRemoteJWKSet as any).mockReturnValue(vi.fn());
      (jwtVerify as any).mockResolvedValue({
        payload: { sub: 'agent-minimal', iss: 'https://agentlair.dev' },
      });

      const auth = new MastraAuthAgentLair();
      const result = await auth.authenticateToken('minimal-token');

      expect(result).toEqual({
        agentId: 'agent-minimal',
        iss: 'https://agentlair.dev',
        trustScore: undefined,
        behavioralHealthScore: undefined,
        claims: { sub: 'agent-minimal', iss: 'https://agentlair.dev' },
      });
    });
  });

  describe('authorizeUser', () => {
    test('returns true when no trust score requirement', async () => {
      const auth = new MastraAuthAgentLair();
      const user: AgentLairUser = {
        agentId: 'agent-1',
        iss: 'https://agentlair.dev',
        trustScore: 100,
        claims: {},
      };
      expect(await auth.authorizeUser(user)).toBe(true);
    });

    test('returns true when trust score meets threshold', async () => {
      const auth = new MastraAuthAgentLair({ requiredTrustScore: 500 });
      const user: AgentLairUser = {
        agentId: 'agent-1',
        iss: 'https://agentlair.dev',
        trustScore: 750,
        claims: {},
      };
      expect(await auth.authorizeUser(user)).toBe(true);
    });

    test('returns true when trust score equals threshold exactly', async () => {
      const auth = new MastraAuthAgentLair({ requiredTrustScore: 500 });
      const user: AgentLairUser = {
        agentId: 'agent-1',
        iss: 'https://agentlair.dev',
        trustScore: 500,
        claims: {},
      };
      expect(await auth.authorizeUser(user)).toBe(true);
    });

    test('returns false when trust score is below threshold', async () => {
      const auth = new MastraAuthAgentLair({ requiredTrustScore: 500 });
      const user: AgentLairUser = {
        agentId: 'agent-1',
        iss: 'https://agentlair.dev',
        trustScore: 200,
        claims: {},
      };
      expect(await auth.authorizeUser(user)).toBe(false);
    });

    test('returns false when trust score is missing and threshold is set', async () => {
      const auth = new MastraAuthAgentLair({ requiredTrustScore: 500 });
      const user: AgentLairUser = {
        agentId: 'agent-1',
        iss: 'https://agentlair.dev',
        claims: {},
      };
      expect(await auth.authorizeUser(user)).toBe(false);
    });

    test('returns false for null user', async () => {
      const auth = new MastraAuthAgentLair();
      expect(await auth.authorizeUser(null as any)).toBe(false);
    });

    test('returns false for user without agentId', async () => {
      const auth = new MastraAuthAgentLair();
      expect(await auth.authorizeUser({ agentId: '', iss: '', claims: {} })).toBe(false);
    });

    test('accepts custom authorizeUser override', async () => {
      const auth = new MastraAuthAgentLair({
        async authorizeUser(user: AgentLairUser): Promise<boolean> {
          return user.agentId.startsWith('trusted-');
        },
      });

      const trusted: AgentLairUser = { agentId: 'trusted-agent', iss: '', claims: {} };
      const untrusted: AgentLairUser = { agentId: 'random-agent', iss: '', claims: {} };

      expect(await auth.authorizeUser(trusted)).toBe(true);
      expect(await auth.authorizeUser(untrusted)).toBe(false);
    });
  });
});

describe('MastraRBACAgentLair', () => {
  const rbac = new MastraRBACAgentLair({
    tierMapping: {
      'agent:untrusted': { minScore: 0, permissions: ['agents:read'] },
      'agent:verified': { minScore: 500, permissions: ['agents:read', 'agents:execute'] },
      'agent:trusted': { minScore: 800, permissions: ['agents:*', 'workflows:*', 'memory:read'] },
    },
  });

  const makeUser = (trustScore?: number): AgentLairUser => ({
    agentId: 'agent-test',
    iss: 'https://agentlair.dev',
    trustScore,
    claims: {},
  });

  describe('getRoles', () => {
    test('returns all qualifying roles for high-trust agent', async () => {
      const roles = await rbac.getRoles(makeUser(900));
      expect(roles).toContain('agent:untrusted');
      expect(roles).toContain('agent:verified');
      expect(roles).toContain('agent:trusted');
    });

    test('returns mid-tier roles for mid-trust agent', async () => {
      const roles = await rbac.getRoles(makeUser(600));
      expect(roles).toContain('agent:untrusted');
      expect(roles).toContain('agent:verified');
      expect(roles).not.toContain('agent:trusted');
    });

    test('returns only base role for low-trust agent', async () => {
      const roles = await rbac.getRoles(makeUser(100));
      expect(roles).toEqual(['agent:untrusted']);
    });

    test('returns base role when trust score is missing (defaults to 0)', async () => {
      const roles = await rbac.getRoles(makeUser(undefined));
      expect(roles).toEqual(['agent:untrusted']);
    });

    test('returns base role when trust score is exactly 0', async () => {
      const roles = await rbac.getRoles(makeUser(0));
      expect(roles).toEqual(['agent:untrusted']);
    });

    test('includes role at exact threshold', async () => {
      const roles = await rbac.getRoles(makeUser(500));
      expect(roles).toContain('agent:verified');
    });
  });

  describe('hasRole', () => {
    test('returns true for an earned role', async () => {
      expect(await rbac.hasRole(makeUser(900), 'agent:trusted')).toBe(true);
    });

    test('returns false for a role above the score', async () => {
      expect(await rbac.hasRole(makeUser(100), 'agent:trusted')).toBe(false);
    });
  });

  describe('getPermissions', () => {
    test('returns union of all earned tier permissions', async () => {
      const perms = await rbac.getPermissions(makeUser(900));
      expect(perms).toContain('agents:read');
      expect(perms).toContain('agents:execute');
      expect(perms).toContain('agents:*');
      expect(perms).toContain('workflows:*');
      expect(perms).toContain('memory:read');
    });

    test('deduplicates permissions', async () => {
      const perms = await rbac.getPermissions(makeUser(600));
      const agentsReadCount = perms.filter(p => p === 'agents:read').length;
      expect(agentsReadCount).toBe(1);
    });
  });

  describe('hasPermission', () => {
    test('matches exact permission', async () => {
      expect(await rbac.hasPermission(makeUser(600), 'agents:execute')).toBe(true);
    });

    test('matches wildcard permission', async () => {
      expect(await rbac.hasPermission(makeUser(900), 'agents:delete')).toBe(true);
      expect(await rbac.hasPermission(makeUser(900), 'workflows:trigger')).toBe(true);
    });

    test('rejects unearned permission', async () => {
      expect(await rbac.hasPermission(makeUser(100), 'agents:execute')).toBe(false);
    });

    test('rejects permission from a category without wildcard', async () => {
      expect(await rbac.hasPermission(makeUser(600), 'memory:read')).toBe(false);
    });
  });
});
