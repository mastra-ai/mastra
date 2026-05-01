import type { MastraAuthProviderOptions } from '@mastra/core/server';

/**
 * Verified agent identity returned after token validation.
 */
export interface AgentLairUser {
  /** The agent's unique identifier (JWT `sub` claim). */
  agentId: string;
  /** Token issuer (JWT `iss` claim). */
  iss: string;
  /** Behavioral trust score (0-1000), from AgentLair's trust API. */
  trustScore?: number;
  /** Behavioral health score, when present in the token. */
  behavioralHealthScore?: number;
  /** All remaining JWT claims. */
  claims: Record<string, unknown>;
}

export interface MastraAuthAgentLairOptions extends MastraAuthProviderOptions<AgentLairUser> {
  /**
   * JWKS endpoint for verifying agent tokens.
   * @default 'https://agentlair.dev/.well-known/jwks.json'
   */
  jwksUrl?: string;
  /**
   * Expected token issuer. When set, tokens from other issuers are rejected.
   */
  issuer?: string;
  /**
   * Minimum behavioral trust score required for authorization.
   * Agents with a score below this threshold are rejected by `authorizeUser`.
   */
  requiredTrustScore?: number;
}

export interface MastraRBACAgentLairOptions {
  /**
   * Maps role names to minimum trust scores and granted permissions.
   *
   * ```ts
   * {
   *   'agent:untrusted': { minScore: 0, permissions: ['agents:read'] },
   *   'agent:verified':  { minScore: 500, permissions: ['agents:read', 'agents:execute'] },
   *   'agent:trusted':   { minScore: 800, permissions: ['agents:*', 'workflows:*'] },
   * }
   * ```
   */
  tierMapping: Record<string, { minScore: number; permissions: string[] }>;
}
