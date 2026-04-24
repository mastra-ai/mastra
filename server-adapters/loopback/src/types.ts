import type { BindingAddress, Context } from '@loopback/core';
import type { Request, Response, RestApplication } from '@loopback/rest';
import type { RequestContext } from '@mastra/core/request-context';

export interface LoopbackAuthorizationResult {
  status: number;
  error: string;
}

export interface LoopbackAuthorizeInput {
  request: Request;
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  requestContext: RequestContext;
  getHeader(key: string): string | undefined;
  getQuery(key: string): string | undefined;
  buildAuthorizeContext(): globalThis.Request;
}

export interface LoopbackAuthConfig {
  /**
   * Enables adapter-managed auth hooks. If false, host app auth remains authoritative.
   */
  enabled?: boolean;

  /**
   * Optional custom authorizer. It can deny requests or defer to the configured mode.
   */
  authorize?: (
    input: LoopbackAuthorizeInput,
  ) => LoopbackAuthorizationResult | null | undefined | Promise<LoopbackAuthorizationResult | null | undefined>;

  /**
   * Controls how custom authorization composes with Mastra's built-in route auth.
   * - `before`: custom authorizer runs first, then Mastra auth
   * - `after`: Mastra auth runs first, then custom authorizer
   * - `replace`: only custom authorizer runs
   */
  authorizeMode?: 'before' | 'after' | 'replace';

  /**
   * Optional custom auth-context resolver for mapping framework/user/session state.
   */
  resolveContext?: (
    input: LoopbackAuthResolverInput,
  ) => MastraAuthContext | undefined | Promise<MastraAuthContext | undefined>;

  /**
   * Controls how custom context resolution composes with default request-context extraction.
   * - `before`: custom resolver first, then default extraction
   * - `after`: default extraction first, then custom resolver
   * - `replace`: only custom resolver runs
   */
  resolveContextMode?: 'before' | 'after' | 'replace';

  /**
   * Optional extractor for deriving auth context from the Mastra RequestContext.
   */
  extractContext?: (requestContext: RequestContext) => MastraAuthContext | undefined;
}

export interface LoopbackMastraConfig {
  /**
   * Path prefix used when registering Mastra routes in the LoopBack app.
   * Example: "/api/mastra"
   */
  prefix?: string;

  /**
   * Optional path where OpenAPI integration can be exposed in future versions.
   */
  openapiPath?: string;

  /**
   * Enables adapter-managed auth hooks. If false, host app auth remains authoritative.
   * Prefer `auth.enabled` for new integrations.
   */
  enableAuth?: boolean;

  /**
   * Optional custom auth resolver invoked per request after route auth checks.
   * Useful for mapping framework/user/session models into adapter auth context.
   * Prefer `auth.resolveContext` for new integrations.
   */
  authResolver?: (
    input: LoopbackAuthResolverInput,
  ) => MastraAuthContext | undefined | Promise<MastraAuthContext | undefined>;

  /**
   * Configurable auth/authorization composition.
   */
  auth?: LoopbackAuthConfig;

  /**
   * MCP transport options.
   */
  mcp?: {
    enabled?: boolean;
    serverless?: boolean;
  };
}

export interface MastraRequestContext {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  value?: RequestContext;
  bridge?: LoopbackMastraBridge;
}

export interface MastraAuthContext {
  userId?: string;
  sessionId?: string;
  scopes?: string[];
  raw?: unknown;
}

export interface LoopbackAuthResolverInput {
  request: Request;
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  requestContext: RequestContext;
}

export interface LoopbackMastraBridge {
  app: RestApplication;
  context: Context;
  request: Request;
  response: Response;
  resolve<T = unknown>(binding: BindingAddress<T>): Promise<T>;
  resolveSync<T = unknown>(binding: BindingAddress<T>): T | undefined;
  isBound(binding: BindingAddress): boolean;
}
