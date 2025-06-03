import type { HonoRequest } from 'hono';
import { MastraBase } from '../base';
import { InstrumentClass } from '../telemetry';

export interface MastraAuthProviderOptions<TUser = unknown> {
  name?: string;
  authorizeUser?: (user: TUser, request: HonoRequest) => Promise<boolean> | boolean;
}

@InstrumentClass({
  prefix: 'auth',
  excludeMethods: ['__setTools', '__setLogger', '__setTelemetry', '#log'],
})
export abstract class MastraAuthProvider<TUser = unknown> extends MastraBase {
  constructor(options?: MastraAuthProviderOptions<TUser>) {
    super({ component: 'AUTH', name: options?.name });

    if (options?.authorizeUser) {
      this.authorizeUser = options.authorizeUser.bind(this);
    }
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
  }
}
