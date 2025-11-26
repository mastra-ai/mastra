import type { HonoRequest } from 'hono';
import { MastraAuthProvider, type MastraAuthProviderOptions } from './auth';

export interface SimpleAuthOptions<TUser = unknown> extends MastraAuthProviderOptions<TUser> {
  /**
   * A map of tokens to users.
   * When a token is provided, it will be looked up in this map.
   */
  tokens: Record<string, TUser>;
  /**
   * Headers to check for the token.
   * Defaults to 'Authorization' with Bearer token extraction.
   * Can be a string or array of strings for custom header names.
   */
  headers?: string | string[];
}

/**
 * SimpleAuth is a basic token-based authentication provider.
 * It validates tokens against a predefined map of tokens to users.
 */
export class SimpleAuth<TUser = unknown> extends MastraAuthProvider<TUser> {
  private tokens: Record<string, TUser>;
  private headerNames: string[];
  private authenticatedUsers: Set<TUser>;

  constructor(options: SimpleAuthOptions<TUser>) {
    super(options);
    this.tokens = options.tokens;
    this.headerNames = this.normalizeHeaders(options.headers);
    // Store reference to all valid users for authorization
    this.authenticatedUsers = new Set(Object.values(this.tokens));
  }

  private normalizeHeaders(headers?: string | string[]): string[] {
    if (!headers) {
      return ['Authorization'];
    }
    return Array.isArray(headers) ? headers : [headers];
  }

  private extractBearerToken(value: string): string {
    if (value.startsWith('Bearer ')) {
      return value.slice(7);
    }
    return value;
  }

  private findTokenInHeaders(request: HonoRequest): string | null {
    for (const headerName of this.headerNames) {
      const headerValue = request.header(headerName);
      if (headerValue) {
        // For Authorization header, extract Bearer token
        if (headerName.toLowerCase() === 'authorization') {
          return this.extractBearerToken(headerValue);
        }
        return headerValue;
      }
    }
    return null;
  }

  async authenticateToken(token: string, request: HonoRequest): Promise<TUser | null> {
    // First, try the direct token
    const directToken = this.extractBearerToken(token);
    if (directToken in this.tokens) {
      return this.tokens[directToken]!;
    }

    // Then, try to find token in headers
    const headerToken = this.findTokenInHeaders(request);
    if (headerToken && headerToken in this.tokens) {
      return this.tokens[headerToken]!;
    }

    return null;
  }

  async authorizeUser(user: TUser, _request: HonoRequest): Promise<boolean> {
    // Check if this user was authenticated through our tokens
    return this.authenticatedUsers.has(user);
  }
}
