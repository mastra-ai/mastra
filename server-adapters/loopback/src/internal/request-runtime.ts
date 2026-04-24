import type { Request } from '@loopback/rest';
import type { RequestContext } from '@mastra/core/request-context';

import type {
  LoopbackAuthResolverInput,
  LoopbackAuthorizationResult,
  LoopbackMastraConfig,
  MastraAuthContext,
} from '../types.js';
import {
  extractAuthContext as defaultExtractAuthContext,
  getHeaderValueOptional,
  getQueryValueOptional,
  toHeaderRecord,
  toWebRequest,
} from './request-utils.js';
import type { AuthError, RegisteredMastraRoute } from './types.js';

export interface LoopbackRequestRuntimeHooks {
  config: LoopbackMastraConfig;
  parseQueryParamsHook?: (
    route: RegisteredMastraRoute,
    queryParams: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  parseBodyHook?: (route: RegisteredMastraRoute, body: unknown) => Promise<unknown>;
  parsePathParamsHook?: (
    route: RegisteredMastraRoute,
    pathParams: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  checkRouteAuthHook?: (
    route: RegisteredMastraRoute,
    input: {
      path: string;
      method: string;
      getHeader: (key: string) => string | undefined;
      getQuery: (key: string) => string | undefined;
      requestContext: RequestContext;
      request: globalThis.Request;
      buildAuthorizeContext: () => globalThis.Request;
    },
  ) => Promise<AuthError | null>;
  legacyAuthResolver?: (
    input: LoopbackAuthResolverInput,
  ) => MastraAuthContext | undefined | Promise<MastraAuthContext | undefined>;
  resolveTools: () => unknown;
  resolveTaskStore: () => unknown;
  redactStreamChunkHook?: (chunk: unknown) => unknown | Promise<unknown>;
}

export class LoopbackRequestRuntime {
  constructor(private readonly hooks: LoopbackRequestRuntimeHooks) {}

  async parseQueryParams(
    route: RegisteredMastraRoute,
    queryParams: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (this.hooks.parseQueryParamsHook) {
      return this.hooks.parseQueryParamsHook(route, queryParams);
    }

    return queryParams;
  }

  async parseBody(route: RegisteredMastraRoute, body: unknown): Promise<unknown> {
    if (this.hooks.parseBodyHook) {
      return this.hooks.parseBodyHook(route, body);
    }

    return body;
  }

  async parsePathParams(
    route: RegisteredMastraRoute,
    pathParams: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (this.hooks.parsePathParamsHook) {
      return this.hooks.parsePathParamsHook(route, pathParams);
    }

    return pathParams;
  }

  async checkRouteAuth(
    route: RegisteredMastraRoute,
    req: Request,
    requestContext: RequestContext,
  ): Promise<AuthError | null> {
    if (!this.isAuthEnabled()) {
      return null;
    }

    const authConfig = this.hooks.config.auth;
    const customAuthorize = authConfig?.authorize;
    const authorizeMode = authConfig?.authorizeMode ?? 'after';

    const runDefault = async (): Promise<AuthError | null> => {
      if (!this.hooks.checkRouteAuthHook) {
        return null;
      }

      const buildAuthorizeContext = () => toWebRequest(req);
      return (
        (await this.hooks.checkRouteAuthHook(route, {
          path: req.path,
          method: req.method,
          getHeader: key => getHeaderValueOptional(req, key),
          getQuery: key => getQueryValueOptional(req, key),
          requestContext,
          request: buildAuthorizeContext(),
          buildAuthorizeContext,
        })) ?? null
      );
    };

    const runCustom = async (): Promise<AuthError | null> => {
      if (!customAuthorize) {
        return null;
      }

      return (
        (await customAuthorize({
          request: req,
          method: req.method,
          path: req.path,
          headers: toHeaderRecord(req.headers),
          requestContext,
          getHeader: key => getHeaderValueOptional(req, key),
          getQuery: key => getQueryValueOptional(req, key),
          buildAuthorizeContext: () => toWebRequest(req),
        })) ?? null
      );
    };

    if (authorizeMode === 'replace') {
      return runCustom();
    }

    if (authorizeMode === 'before') {
      return (await runCustom()) ?? runDefault();
    }

    return (await runDefault()) ?? runCustom();
  }

  async resolveAuthContext(req: Request, requestContext: RequestContext): Promise<MastraAuthContext | undefined> {
    if (!this.isAuthEnabled()) {
      return undefined;
    }

    const authConfig = this.hooks.config.auth;
    const customResolver = authConfig?.resolveContext ?? this.hooks.legacyAuthResolver;
    const customExtractor = authConfig?.extractContext ?? defaultExtractAuthContext;
    const resolveMode = authConfig?.resolveContextMode ?? 'before';

    const runCustomResolver = async (): Promise<MastraAuthContext | undefined> => {
      if (!customResolver) {
        return undefined;
      }

      return customResolver({
        request: req,
        method: req.method,
        path: req.path,
        headers: toHeaderRecord(req.headers),
        requestContext,
      });
    };

    const runDefaultExtractor = (): MastraAuthContext | undefined => {
      return customExtractor(requestContext);
    };

    if (resolveMode === 'replace') {
      return runCustomResolver();
    }

    if (resolveMode === 'after') {
      return runDefaultExtractor() ?? runCustomResolver();
    }

    return (await runCustomResolver()) ?? runDefaultExtractor();
  }

  resolveTools(): unknown {
    return this.hooks.resolveTools();
  }

  resolveTaskStore(): unknown {
    return this.hooks.resolveTaskStore();
  }

  async redactStreamChunk(chunk: unknown): Promise<unknown> {
    if (this.hooks.redactStreamChunkHook) {
      return this.hooks.redactStreamChunkHook(chunk);
    }

    return chunk;
  }

  private isAuthEnabled(): boolean {
    if (this.hooks.config.enableAuth === false) {
      return false;
    }
    if (this.hooks.config.auth?.enabled === false) {
      return false;
    }
    return true;
  }
}

export function toAuthError(result: LoopbackAuthorizationResult | null | undefined): AuthError | null {
  return result ?? null;
}
