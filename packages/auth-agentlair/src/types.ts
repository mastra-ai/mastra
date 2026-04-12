import type { MastraAuthProviderOptions } from '@mastra/core/server';

/**
 * AgentLair Agent Authentication Token (AAT) claims.
 * Decoded from an EdDSA-signed JWT, verifiable via JWKS at agentlair.dev.
 */
export interface AATClaims {
  /** Issuer — always "https://agentlair.dev" */
  iss: string;
  /** Subject — AgentLair account ID */
  sub: string;
  /** Audience — target service URL */
  aud: string;
  /** Expiration time (Unix seconds) */
  exp: number;
  /** Issued at (Unix seconds) */
  iat: number;
  /** Unique token ID */
  jti: string;
  /** Agent display name */
  al_name?: string;
  /** Agent @agentlair.dev email address */
  al_email?: string;
  /** Granted scopes */
  al_scopes: string[];
  /** Audit trail URL */
  al_audit_url: string;
}

/**
 * Behavioral trust score for an agent (0-1000).
 */
export interface TrustScore {
  agentId: string;
  score: number;
  tier: 'untrusted' | 'provisional' | 'trusted' | 'verified';
  breakdown: TrustBreakdown;
  computedAt: string;
  observationCount: number;
}

export interface TrustBreakdown {
  /** Adherence to declared behavior patterns (0-250) */
  behavioral: number;
  /** Consistency of actions over time (0-250) */
  consistency: number;
  /** Quality of interactions with other agents (0-250) */
  reputation: number;
  /** Audit trail completeness and transparency (0-250) */
  transparency: number;
}

/**
 * Verified agent identity — the TUser type for the auth provider.
 */
export interface VerifiedAgent {
  /** AgentLair account ID */
  accountId: string;
  /** Agent display name */
  name?: string;
  /** Agent email address */
  email?: string;
  /** Granted scopes */
  scopes: string[];
  /** Audit trail URL */
  auditUrl: string;
  /** Trust score (populated when fetchTrustScore is enabled) */
  trustScore?: TrustScore;
  /** Decoded JWT claims */
  claims: AATClaims;
}

/**
 * Configuration options for MastraAgentLairAuth.
 */
export interface MastraAgentLairAuthOptions extends MastraAuthProviderOptions<VerifiedAgent> {
  /**
   * AgentLair API base URL.
   * @default "https://agentlair.dev"
   */
  baseUrl?: string;

  /**
   * AgentLair API key for trust score lookups (al_live_...).
   */
  apiKey?: string;

  /**
   * JWKS endpoint URL for fetching signing keys.
   * @default "{baseUrl}/.well-known/jwks.json"
   */
  jwksUrl?: string;

  /**
   * Expected JWT audience. If set, tokens with a different `aud` are rejected.
   */
  audience?: string;

  /**
   * Expected JWT issuer.
   * @default "https://agentlair.dev"
   */
  issuer?: string;

  /**
   * Whether to fetch trust scores during authentication.
   * Requires `apiKey`.
   * @default false
   */
  fetchTrustScore?: boolean;

  /**
   * Minimum trust score required for authorization.
   * Set to 0 to allow all verified agents.
   * @default 0
   */
  minimumTrustScore?: number;

  /**
   * Required trust tier for authorization.
   * If set alongside minimumTrustScore, both must pass.
   */
  requiredTier?: TrustScore['tier'];

  /**
   * Required scopes. The agent must have ALL listed scopes
   * (or the wildcard scope "*").
   */
  requiredScopes?: string[];
}
