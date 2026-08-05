export interface HonoRequestLike {
  raw?: Request;
  headers?: Headers;
  header(name: string): string | undefined;
}

export type MastraAuthRequest = Request | HonoRequestLike;

export type AuthenticateTokenFn<TUser, TResult = Promise<TUser | null>> = {
  bivarianceHack(token: string, request: MastraAuthRequest): TResult;
}['bivarianceHack'];

export type AuthorizeUserFn<TUser, TResult = Promise<boolean> | boolean> = {
  bivarianceHack(user: TUser, request: MastraAuthRequest): TResult;
}['bivarianceHack'];

export function getRequestHeader(request: MastraAuthRequest, name: string): string | null {
  if (request instanceof Request) {
    return request.headers.get(name);
  }

  return request.raw?.headers.get(name) ?? request.headers?.get(name) ?? request.header(name) ?? null;
}

export function getWebRequest(request: MastraAuthRequest): Request | undefined {
  if (request instanceof Request) {
    return request;
  }

  return request.raw instanceof Request ? request.raw : undefined;
}

export type Methods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ALL';

export type MastraAuthConfig<TUser = unknown, TContext = unknown> = {
  /**
   * Protected paths for the server.
   */
  protected?: (RegExp | string | [string, Methods | Methods[]])[];

  /**
   * Public paths for the server.
   */
  public?: (RegExp | string | [string, Methods | Methods[]])[];

  /**
   * Authenticate a token and return the user.
   */
  authenticateToken?: AuthenticateTokenFn<TUser, Promise<TUser>>;

  /**
   * Maps the authenticated user to a resource ID for memory/thread scoping.
   */
  mapUserToResourceId?(user: TUser): string | undefined | null;

  /**
   * Authorization function for the server.
   */
  authorize?: (path: string, method: string, user: TUser, context: TContext) => Promise<boolean>;

  /**
   * Rules for the server.
   */
  rules?: {
    /** Path for the rule. */
    path?: RegExp | string | string[];
    /** Method for the rule. */
    methods?: Methods | Methods[];
    /** Condition for the rule. */
    condition?: (user: TUser) => Promise<boolean> | boolean;
    /** Allow the rule. */
    allow?: boolean;
  }[];
};

export type { MastraAuthProviderOptions } from '../provider';
