import type { User, IUserProvider } from '@internal/auth';
import { MastraAuthProvider, normalizeMastraUser } from '@internal/auth/provider';
import type { MastraAuthProviderOptions } from '@internal/auth/provider';

import jwt from 'jsonwebtoken';

type JwtUser = jwt.JwtPayload;

interface MastraJwtAuthOptions extends MastraAuthProviderOptions<JwtUser> {
  secret?: string;
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
  private mapUser: (payload: JwtUser) => User | null;

  constructor(options?: MastraJwtAuthOptions) {
    super({ name: options?.name ?? 'jwt' });

    this.secret = options?.secret ?? process.env.JWT_AUTH_SECRET ?? '';

    if (!this.secret) {
      throw new Error('JWT auth secret is required');
    }

    this.mapUser = options?.mapUser ?? defaultMapUser;
    this.registerOptions(options);
  }

  async authenticateToken(token: string): Promise<JwtUser> {
    return jwt.verify(token, this.secret) as JwtUser;
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
