import type { HonoRequest } from 'hono';
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

export class SimpleAuth<TUser> extends MastraAuthProvider<TUser> {
  private tokens: TokenToUser<TUser>;
  private headers: string[];
  private users: TUser[];

  constructor(options: SimpleAuthOptions<TUser>) {
    super(options);
    this.tokens = options.tokens;
    this.users = Object.values(this.tokens);
    this.headers = [...DEFAULT_HEADERS].concat(options.headers || []);
  }

  async authenticateToken(token: string, request: HonoRequest): Promise<TUser | null> {
    const requestTokens = this.getTokensFromHeaders(token, request);

    for (const requestToken of requestTokens) {
      const tokenToUser = this.tokens[requestToken];
      if (tokenToUser) {
        return tokenToUser;
      }
    }

    return null;
  }

  async authorizeUser(user: TUser, _request: HonoRequest): Promise<boolean> {
    return this.users.includes(user);
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
