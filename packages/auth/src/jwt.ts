import { MastraAuthProvider } from '@mastra/core/server';
import type { MastraAuthProviderOptions } from '@mastra/core/server';

import jwt from 'jsonwebtoken';

type JwtUser = jwt.JwtPayload;

interface MastraJwtAuthOptions extends MastraAuthProviderOptions<JwtUser> {
  secret?: string;
}

export class MastraJwtAuth extends MastraAuthProvider<JwtUser> {
  protected secret: string;

  constructor(options?: MastraJwtAuthOptions) {
    super({ name: options?.name ?? 'jwt' });

    this.secret = options?.secret ?? process.env.JWT_AUTH_SECRET ?? '';

    if (!this.secret) {
      throw new Error('JWT auth secret is required');
    }

    this.registerOptions(options);
  }

  async authenticateToken(token: string): Promise<JwtUser> {
    return jwt.verify(token, this.secret) as JwtUser;
  }

  async authorizeUser(user: JwtUser) {
    return !!user;
  }
}
