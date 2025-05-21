import type { HonoRequest } from 'hono';
import { MastraBase } from '../base';
import { InstrumentClass } from '../telemetry';
import type { MastraAuthConfig } from './types';

export function defineAuth<TUser>(config: MastraAuthConfig<TUser>): MastraAuthConfig<TUser> {
  return config;
}

@InstrumentClass({
  prefix: 'auth',
  excludeMethods: ['__setTools', '__setLogger', '__setTelemetry', '#log'],
})
export abstract class MastraAuthProvider<TUser = unknown> extends MastraBase {
  constructor(options?: { name?: string }) {
    super({ component: 'AUTH', name: options?.name });
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
  abstract authorizeUser(user: TUser, request: HonoRequest): Promise<boolean>;
}
