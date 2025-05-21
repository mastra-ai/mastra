import { MastraAuthProvider } from '@mastra/core/server';

import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';

interface MastraAuthAuth0Options {
  domain?: string; // set this to your Auth0 domain
  audience?: string; // set this to your Auth0 API identifier
}

type Auth0User = JWTPayload;

export class MastraAuthAuth0 extends MastraAuthProvider<Auth0User> {
  protected domain: string;
  protected audience: string;
  constructor(options?: MastraAuthAuth0Options) {
    super({ name: 'supabase' });

    const domain = options?.domain ?? process.env.AUTH0_DOMAIN;
    const audience = options?.audience ?? process.env.AUTH0_AUDIENCE;

    if (!domain || !audience) {
      throw new Error(
        'Auth0 domain and audience are required, please provide them in the options or set the environment variables AUTH0_DOMAIN and AUTH0_AUDIENCE',
      );
    }

    this.domain = domain;
    this.audience = audience;
  }

  async authenticateToken(token: string): Promise<Auth0User | null> {
    const JWKS = createRemoteJWKSet(new URL(`https://${this.domain}/.well-known/jwks.json`));

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://${this.domain}/`,
      audience: this.audience,
    });

    return payload;
  }

  async authorizeUser(user: Auth0User) {
    return !!user;
  }
}
