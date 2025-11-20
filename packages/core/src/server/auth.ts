import type { HonoRequest } from 'hono';
import { MastraBase } from '../base';
import type { MastraAuthConfig } from './types';

export interface MastraAuthProviderOptions<TUser = unknown> {
  name?: string;
  authorizeUser?: (user: TUser, request: HonoRequest) => Promise<boolean> | boolean;
  /**
   * Protected paths for the auth provider
   */
  protected?: MastraAuthConfig['protected'];
  /**
   * Public paths for the auth provider
   */
  public?: MastraAuthConfig['public'];
}

export abstract class MastraAuthProvider<TUser = unknown> extends MastraBase {
  public protected?: MastraAuthConfig['protected'];
  public public?: MastraAuthConfig['public'];

  constructor(options?: MastraAuthProviderOptions<TUser>) {
    super({ component: 'AUTH', name: options?.name });

    if (options?.authorizeUser) {
      this.authorizeUser = options.authorizeUser.bind(this);
    }

    this.protected = options?.protected;
    this.public = options?.public;
  }

  /**
   * Authenticate a token and return the payload
   * @param token - The token to authenticate
   * @param request - The request
   * @returns The payload
   */
  abstract authenticateToken(token: string, request: HonoRequest): Promise<TUser | null>;

  /**
   * Authorize a user for a path and method
   * @param user - The user to authorize
   * @param request - The request
   * @returns The authorization result
   */
  abstract authorizeUser(user: TUser, request: HonoRequest): Promise<boolean> | boolean;

  protected registerOptions(opts?: MastraAuthProviderOptions<TUser>) {
    if (opts?.authorizeUser) {
      this.authorizeUser = opts.authorizeUser.bind(this);
    }
    if (opts?.protected) {
      this.protected = opts.protected;
    }
    if (opts?.public) {
      this.public = opts.public;
    }
  }
}
