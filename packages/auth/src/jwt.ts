import type { User, IUserProvider } from '@mastra/core/auth';
import { MastraAuthProvider } from '@mastra/core/server';
import type { MastraAuthProviderOptions } from '@mastra/core/server';

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
