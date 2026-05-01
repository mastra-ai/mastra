import { MastraAuthProvider } from '@mastra/core/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import type { AgentLairUser, MastraAuthAgentLairOptions } from './types';

const DEFAULT_JWKS_URL = 'https://agentlair.dev/.well-known/jwks.json';

export class MastraAuthAgentLair extends MastraAuthProvider<AgentLairUser> {
  private jwks: ReturnType<typeof createRemoteJWKSet>;
  private issuer?: string;
  private requiredTrustScore: number;

  constructor(options: MastraAuthAgentLairOptions = {}) {
    super({ name: options?.name ?? 'agentlair', ...options });

    this.jwks = createRemoteJWKSet(new URL(options.jwksUrl ?? DEFAULT_JWKS_URL));
    this.issuer = options.issuer;

    const requiredTrustScore = options.requiredTrustScore ?? 0;
    if (!Number.isFinite(requiredTrustScore) || requiredTrustScore < 0 || requiredTrustScore > 1000) {
      throw new Error(`requiredTrustScore must be a finite number between 0 and 1000, got: ${requiredTrustScore}`);
    }
    this.requiredTrustScore = requiredTrustScore;

    this.registerOptions(options);
  }

  async authenticateToken(token: string): Promise<AgentLairUser | null> {
    if (!token || typeof token !== 'string') {
      return null;
    }

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        algorithms: ['EdDSA'],
      });

      const agentId = payload.sub;
      if (!agentId) {
        return null;
      }

      const iss = payload.iss;
      if (typeof iss !== 'string' || !iss) {
        return null;
      }

      return {
        agentId,
        iss,
        trustScore: typeof payload.trust_score === 'number' ? (payload.trust_score as number) : undefined,
        behavioralHealthScore:
          typeof payload.behavioral_health_score === 'number'
            ? (payload.behavioral_health_score as number)
            : undefined,
        claims: payload as Record<string, unknown>,
      };
    } catch {
      return null;
    }
  }

  async authorizeUser(user: AgentLairUser): Promise<boolean> {
    if (!user || !user.agentId) {
      return false;
    }

    if (this.requiredTrustScore > 0 && (user.trustScore ?? 0) < this.requiredTrustScore) {
      return false;
    }

    return true;
  }
}
