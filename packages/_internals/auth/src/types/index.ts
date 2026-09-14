/** Request fields used to read authentication headers across server adapters. */
export interface HonoRequestLike {
  /** Underlying Fetch API request, when available. */
  raw?: Request;
  /** Headers represented as a Headers instance or a plain object. */
  headers?: Headers | Record<string, string | string[] | undefined>;
  /**
   * Reads a request header.
   * @param name - Header name to look up.
   */
  header?(name: string): string | undefined;
}

/** Fetch API or adapter request accepted by authentication callbacks. */
export type MastraAuthRequest = Request | HonoRequestLike;

/** Callback that authenticates a token against the current request. */
export type AuthenticateTokenFn<TUser, TResult = Promise<TUser | null>> = {
  /**
   * Authenticates the supplied token.
   * @param token - Token to authenticate.
   * @param request - Request associated with the token.
   */
  bivarianceHack(token: string, request: MastraAuthRequest): TResult;
}['bivarianceHack'];

/** Callback that decides whether an authenticated user may access a request. */
export type AuthorizeUserFn<TUser, TResult = Promise<boolean> | boolean> = {
  /**
   * Authorizes the user for the request.
   * @param user - Authenticated user to authorize.
   * @param request - Request being authorized.
   */
  bivarianceHack(user: TUser, request: MastraAuthRequest): TResult;
}['bivarianceHack'];

function headerFromPlainObject(headers: Record<string, string | string[] | undefined>, name: string): string | null {
  const normalizedName = name.toLowerCase();
  const matchingKey = Object.keys(headers).find(key => key.toLowerCase() === normalizedName);
  const value = matchingKey === undefined ? undefined : headers[matchingKey];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

/**
 * Read a request header across fetch, Hono, and Express-style request shapes.
 * Must not throw when `headers` is a plain object (Express `IncomingHttpHeaders`).
 */
export function getRequestHeader(request: MastraAuthRequest, name: string): string | null {
  if (request instanceof Request) {
    return request.headers.get(name);
  }

  if (request.raw instanceof Request) {
    return request.raw.headers.get(name);
  }

  const headers = request.headers;
  if (headers instanceof Headers) {
    return headers.get(name);
  }

  if (typeof request.header === 'function') {
    return request.header(name) ?? null;
  }

  if (headers && typeof headers === 'object') {
    return headerFromPlainObject(headers, name);
  }

  return null;
}

export function getWebRequest(request: MastraAuthRequest): Request | undefined {
  if (request instanceof Request) {
    return request;
  }

  return request.raw instanceof Request ? request.raw : undefined;
}

/** HTTP methods supported by authentication path rules, including an all-methods selector. */
export type Methods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ALL';

/** Authentication callbacks and path-based authorization rules for the server. */
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
   * @param user - Authenticated user whose resource is being resolved.
   */
  mapUserToResourceId?(user: TUser): string | undefined | null;

  /**
   * Authorization function for the server.
   * @param path - Request path being authorized.
   * @param method - HTTP method of the request.
   * @param user - Authenticated user.
   * @param context - Adapter context for the request.
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
    /**
     * Condition for the rule.
     * @param user - Authenticated user evaluated by the condition.
     */
    condition?: (user: TUser) => Promise<boolean> | boolean;
    /** Allow the rule. */
    allow?: boolean;
  }[];
};

export type { MastraAuthProviderOptions } from '../provider';
