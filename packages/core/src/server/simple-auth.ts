import type { HonoRequest } from 'hono';
import type { EEUser, IUserProvider, ICredentialsProvider, CredentialsResult } from '../ee';
import type { MastraAuthProviderOptions } from './auth';
import { MastraAuthProvider } from './auth';

const DEFAULT_HEADERS = ['Authorization', 'X-Playground-Access'];

type TokenToUser<TUser> = Record<string, TUser>;

export interface SimpleAuthOptions<TUser> extends MastraAuthProviderOptions<TUser> {
  /**
   * Valid tokens to authenticate against
   */
  tokens: TokenToUser<TUser>;
  /**
   * Headers to check for authentication
   * @default ['Authorization', 'X-Playground-Access']
   */
  headers?: string | string[];
}

export class SimpleAuth<TUser extends EEUser>
  extends MastraAuthProvider<TUser>
  implements IUserProvider<TUser>, ICredentialsProvider<TUser>
{
  /**
   * Marker to exempt SimpleAuth from EE license requirement.
   * SimpleAuth is for development/testing and should work without a license.
   */
  readonly isSimpleAuth = true;

  private tokens: TokenToUser<TUser>;
  private headers: string[];
  private users: TUser[];
  private userById: Map<string, TUser>;

  constructor(options: SimpleAuthOptions<TUser>) {
    super(options);
    this.tokens = options.tokens;
    this.users = Object.values(this.tokens);
    this.headers = [...DEFAULT_HEADERS].concat(options.headers || []);
    this.userById = new Map(this.users.map(u => [u.id, u]));
  }

  async authenticateToken(token: string, request: HonoRequest): Promise<TUser | null> {
    const requestTokens = this.getTokensFromHeaders(token, request);

    for (const requestToken of requestTokens) {
      const tokenToUser = this.tokens[requestToken];
      if (tokenToUser) {
        return tokenToUser;
      }
    }

    // Check cookie (set during sign-in)
    const cookieHeader = request.header('Cookie');
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').map(c => c.trim());
      for (const cookie of cookies) {
        if (cookie.startsWith('mastra-token=')) {
          const cookieToken = cookie.slice('mastra-token='.length);
          const user = this.tokens[cookieToken];
          if (user) {
            return user;
          }
        }
      }
    }

    return null;
  }

  async authorizeUser(user: TUser, _request: HonoRequest): Promise<boolean> {
    return this.users.includes(user);
  }

  /**
   * Get current user from request headers or cookie.
   * Implements IUserProvider for EE user awareness.
   */
  async getCurrentUser(request: Request): Promise<TUser | null> {
    // Check headers first
    for (const headerName of this.headers) {
      const headerValue = request.headers.get(headerName);
      if (headerValue) {
        const token = this.stripBearerPrefix(headerValue);
        const user = this.tokens[token];
        if (user) {
          return user;
        }
      }
    }

    // Check cookie (set during sign-in)
    const cookieHeader = request.headers.get('Cookie');
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').map(c => c.trim());
      for (const cookie of cookies) {
        if (cookie.startsWith('mastra-token=')) {
          const token = cookie.slice('mastra-token='.length);
          const user = this.tokens[token];
          if (user) {
            return user;
          }
        }
      }
    }

    return null;
  }

  /**
   * Get user by ID.
   * Implements IUserProvider for EE user awareness.
   */
  async getUser(userId: string): Promise<TUser | null> {
    return this.userById.get(userId) ?? null;
  }

  /**
   * Sign in with token (passed as password field).
   * The email field is ignored - only the token matters.
   * Implements ICredentialsProvider.
   */
  async signIn(_email: string, password: string, _request: Request): Promise<CredentialsResult<TUser>> {
    const token = password;
    const user = this.tokens[token];

    if (!user) {
      throw new Error('Invalid token');
    }

    // Set cookie so the token persists across requests
    const cookie = `mastra-token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;

    return {
      user,
      token,
      cookies: [cookie],
    };
  }

  /**
   * Sign up is disabled for SimpleAuth.
   * Implements ICredentialsProvider.
   */
  async signUp(): Promise<CredentialsResult<TUser>> {
    throw new Error('Sign up is not supported with SimpleAuth. Use pre-configured tokens.');
  }

  /**
   * Sign up is disabled for SimpleAuth.
   * Implements ICredentialsProvider.
   */
  isSignUpEnabled(): boolean {
    return false;
  }

  /**
   * Get headers to clear the session cookie on logout.
   * Partial ISessionProvider implementation for logout support.
   */
  getClearSessionHeaders(): Record<string, string> {
    return {
      'Set-Cookie': 'mastra-token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    };
  }

  private stripBearerPrefix(token: string): string {
    return token.startsWith('Bearer ') ? token.slice(7) : token;
  }

  private getTokensFromHeaders(token: string, request: HonoRequest): string[] {
    const tokens = [token];
    for (const headerName of this.headers) {
      const headerValue = request.header(headerName);
      if (headerValue) {
        tokens.push(this.stripBearerPrefix(headerValue));
      }
    }
    return tokens;
  }
}
