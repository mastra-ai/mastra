import type { User, IUserProvider } from '@internal/auth';
import { MastraAuthProvider, jwtAudienceIncludes, normalizeMastraUser } from '@internal/auth/provider';
import type { MastraAuthOAuthMetadata, MastraAuthProviderOptions } from '@internal/auth/provider';

import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

type JwtUser = jwt.JwtPayload;

interface MastraJwtAuthOptions extends MastraAuthProviderOptions<JwtUser> {
  /** Shared secret for HMAC-signed tokens. Defaults to `JWT_AUTH_SECRET`. Not used when `jwksUri` is set. */
  secret?: string;
  /**
   * JWKS URL used to verify asymmetrically signed tokens (RS*, PS*, ES*), e.g.
   * `https://auth.example.com/.well-known/jwks.json`. Defaults to `JWT_AUTH_JWKS_URI`.
   */
  jwksUri?: string;
  /**
   * Expected token issuer (`iss`). When set, tokens from other issuers are rejected and the issuer is advertised
   * as the authorization server to MCP clients. Defaults to `JWT_AUTH_ISSUER`.
   */
  issuer?: string;
  mapUser?: (payload: JwtUser) => User | null;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function defaultMapUser(payload: JwtUser): User | null {
  const id = str(payload.sub) || str(payload.id);
  if (!id) {
    return null;
  }
  return {
    id,
    email: str(payload.email),
    name: str(payload.name),
    avatarUrl: str(payload.avatarUrl) || str(payload.avatar_url) || str(payload.picture),
    role: str(payload.role),
  };
}

export class MastraJwtAuth extends MastraAuthProvider<JwtUser> implements IUserProvider {
  protected secret: string;
  protected issuer?: string;
  private jwks?: jwksClient.JwksClient;
  private mapUser: (payload: JwtUser) => User | null;

  constructor(options?: MastraJwtAuthOptions) {
    super({ name: options?.name ?? 'jwt' });

    if (options?.secret && options?.jwksUri) {
      throw new Error('JWT auth accepts either a secret or a jwksUri, not both');
    }
    const jwksUri = options?.jwksUri ?? (options?.secret ? undefined : process.env.JWT_AUTH_JWKS_URI);
    this.secret = jwksUri ? '' : (options?.secret ?? process.env.JWT_AUTH_SECRET ?? '');

    if (!this.secret && !jwksUri) {
      throw new Error('JWT auth secret is required (or a jwksUri for asymmetric tokens)');
    }

    if (jwksUri) {
      this.jwks = jwksClient({ jwksUri, cache: true });
    }
    this.issuer = options?.issuer ?? process.env.JWT_AUTH_ISSUER;
    this.mapUser = options?.mapUser ?? defaultMapUser;
    this.registerOptions(options);
  }

  async authenticateToken(token: string): Promise<JwtUser> {
    const verifyOptions: jwt.VerifyOptions = this.issuer ? { issuer: this.issuer } : {};
    const jwks = this.jwks;
    if (!jwks) {
      return jwt.verify(token, this.secret, verifyOptions) as JwtUser;
    }
    // A public key restricts the accepted algorithms to its key type, so HMAC tokens can't be passed off as RS*.
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        (header, callback) => {
          jwks.getSigningKey(header.kid).then(
            key => callback(null, key.getPublicKey()),
            error => callback(error),
          );
        },
        verifyOptions,
        (error, payload) => (error ? reject(error) : resolve(payload as JwtUser)),
      );
    });
  }

  async authorizeUser(user: JwtUser) {
    return !!user;
  }

  /**
   * Reuse the configured `mapUser` (or its default) to normalize the JWT
   * payload; fall back to the shared normalization when `mapUser` returns
   * null.
   */
  override toMastraUser(payload: JwtUser): User {
    return this.mapUser(payload) ?? normalizeMastraUser(payload);
  }

  getOAuthMetadata(): MastraAuthOAuthMetadata | undefined {
    return this.issuer ? { authorizationServers: [this.issuer] } : undefined;
  }

  verifyAudience(user: JwtUser, audience: string): boolean {
    return jwtAudienceIncludes(user.aud, audience);
  }

  async getCurrentUser(request: Request): Promise<User | null> {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null;
    if (!token) return null;

    try {
      const payload = await this.authenticateToken(token);
      const allowed = await this.authorizeUser(payload);
      if (!allowed) return null;
      return this.mapUser(payload);
    } catch {
      return null;
    }
  }

  async getUser(_userId: string): Promise<User | null> {
    return null;
  }
}
