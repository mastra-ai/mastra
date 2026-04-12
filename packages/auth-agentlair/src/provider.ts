import type { User, IUserProvider } from '@mastra/core/auth';
import { MastraAuthProvider } from '@mastra/core/server';
import type { HonoRequest } from 'hono';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import type { AATClaims, MastraAgentLairAuthOptions, TrustScore, VerifiedAgent } from './types';

const TIER_ORDER: TrustScore['tier'][] = ['untrusted', 'provisional', 'trusted', 'verified'];

/**
 * AgentLair auth provider for Mastra.
 *
 * Verifies agent identity using EdDSA-signed JWTs (Agent Authentication Tokens)
 * against AgentLair's JWKS endpoint. Optionally enriches authentication with
 * behavioral trust scores and enforces trust-based authorization.
 *
 * @example Basic setup
 * ```typescript
 * import { MastraAgentLairAuth } from '@mastra/auth-agentlair';
 *
 * const auth = new MastraAgentLairAuth({
 *   audience: 'https://my-service.com',
 * });
 * ```
 *
 * @example With trust-based authorization
 * ```typescript
 * const auth = new MastraAgentLairAuth({
 *   apiKey: process.env.AGENTLAIR_API_KEY,
 *   fetchTrustScore: true,
 *   minimumTrustScore: 500,
 *   requiredTier: 'trusted',
 *   requiredScopes: ['write:data'],
 * });
 * ```
 */
export class MastraAgentLairAuth extends MastraAuthProvider<VerifiedAgent> implements IUserProvider {
  private readonly baseUrl: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly apiKey?: string;
  private readonly audience?: string;
  private readonly issuer: string;
  private readonly fetchTrustScoreOnAuth: boolean;
  private readonly minimumTrustScore: number;
  private readonly requiredTier?: TrustScore['tier'];
  private readonly requiredScopes?: string[];

  constructor(options?: MastraAgentLairAuthOptions) {
    super({ name: options?.name ?? 'agentlair', ...options });

    this.baseUrl = (options?.baseUrl ?? 'https://agentlair.dev').replace(/\/$/, '');
    const jwksUrl = options?.jwksUrl ?? `${this.baseUrl}/.well-known/jwks.json`;
    this.jwks = createRemoteJWKSet(new URL(jwksUrl));
    this.apiKey = options?.apiKey;
    this.audience = options?.audience;
    this.issuer = options?.issuer ?? 'https://agentlair.dev';
    this.fetchTrustScoreOnAuth = options?.fetchTrustScore ?? false;
    this.minimumTrustScore = options?.minimumTrustScore ?? 0;
    this.requiredTier = options?.requiredTier;
    this.requiredScopes = options?.requiredScopes;

    this.registerOptions(options);
  }

  /**
   * Verify an EdDSA-signed Agent Authentication Token.
   *
   * Uses `jose` to fetch the signing key from AgentLair's JWKS endpoint
   * and verify the JWT signature. Returns a VerifiedAgent on success.
   */
  async authenticateToken(token: string, _request: HonoRequest): Promise<VerifiedAgent | null> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['EdDSA'],
      });

      const claims = payload as unknown as AATClaims;

      const agent: VerifiedAgent = {
        accountId: claims.sub,
        name: claims.al_name,
        email: claims.al_email,
        scopes: claims.al_scopes ?? [],
        auditUrl: claims.al_audit_url,
        claims,
      };

      // Optionally enrich with trust score
      if (this.fetchTrustScoreOnAuth && this.apiKey) {
        try {
          agent.trustScore = await this.fetchTrustScore(claims.sub);
        } catch {
          // Trust score fetch failure is non-fatal
        }
      }

      return agent;
    } catch {
      return null;
    }
  }

  /**
   * Ensure the agent has a trust score, fetching it on-demand if needed.
   *
   * Returns true if the agent already has a trust score or one was
   * successfully fetched. Returns false if no API key is configured or
   * the fetch fails.
   */
  private async ensureTrustScore(agent: VerifiedAgent): Promise<boolean> {
    if (agent.trustScore) return true;
    if (!this.apiKey) return false;
    try {
      agent.trustScore = await this.fetchTrustScore(agent.accountId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Authorize a verified agent based on trust score, tier, and scopes.
   *
   * When no trust requirements are configured, all verified agents pass.
   * Otherwise checks (in order):
   * 1. Required scopes (agent must have all, or wildcard "*")
   * 2. Minimum trust score
   * 3. Required trust tier
   */
  async authorizeUser(agent: VerifiedAgent, _request: HonoRequest): Promise<boolean> {
    // Check required scopes
    if (this.requiredScopes?.length) {
      const agentScopes = new Set(agent.scopes);
      const hasWildcard = agentScopes.has('*');
      for (const scope of this.requiredScopes) {
        if (!hasWildcard && !agentScopes.has(scope)) {
          return false;
        }
      }
    }

    // Check minimum trust score
    if (this.minimumTrustScore > 0) {
      if (!(await this.ensureTrustScore(agent))) return false;
      if (agent.trustScore!.score < this.minimumTrustScore) {
        return false;
      }
    }

    // Check required tier
    if (this.requiredTier) {
      if (!(await this.ensureTrustScore(agent))) return false;
      const agentTierIdx = TIER_ORDER.indexOf(agent.trustScore!.tier);
      const requiredTierIdx = TIER_ORDER.indexOf(this.requiredTier);
      if (agentTierIdx < requiredTierIdx) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get the current user (agent) from a request.
   * Implements IUserProvider for Mastra Studio integration.
   */
  async getCurrentUser(request: Request): Promise<User | null> {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null;
    if (!token) return null;

    try {
      const agent = await this.authenticateToken(token, request as unknown as HonoRequest);
      if (!agent) return null;

      const allowed = await this.authorizeUser(agent, request as unknown as HonoRequest);
      if (!allowed) return null;

      return {
        id: agent.accountId,
        email: agent.email,
        name: agent.name,
        avatarUrl: undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get user by ID. Returns null because agent identity is stateless (JWT-based).
   */
  async getUser(_userId: string): Promise<User | null> {
    return null;
  }

  /**
   * Get the agent's audit trail URL as their profile URL.
   */
  getUserProfileUrl(user: User): string {
    return `https://agentlair.dev/agents/${user.id}`;
  }

  /**
   * Fetch the behavioral trust score for an agent.
   */
  async fetchTrustScore(agentId: string): Promise<TrustScore> {
    if (!this.apiKey) {
      throw new Error('API key required for trust score lookups');
    }

    const response = await fetch(`${this.baseUrl}/v1/trust/${encodeURIComponent(agentId)}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Trust score lookup failed: HTTP ${response.status}`);
    }

    return response.json() as Promise<TrustScore>;
  }

  // ── Convenience methods ───────────────────────────────────────────────────

  /**
   * Check if an agent has a specific scope.
   */
  hasScope(agent: VerifiedAgent, scope: string): boolean {
    return agent.scopes.includes(scope) || agent.scopes.includes('*');
  }

  /**
   * Check if an agent meets a minimum trust tier.
   */
  meetsTrustTier(agent: VerifiedAgent, requiredTier: TrustScore['tier']): boolean {
    if (!agent.trustScore) return false;
    const agentTierIdx = TIER_ORDER.indexOf(agent.trustScore.tier);
    const requiredTierIdx = TIER_ORDER.indexOf(requiredTier);
    return agentTierIdx >= requiredTierIdx;
  }
}
