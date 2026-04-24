import { BindingScope } from '@loopback/core';
import type { Request, Response, RestApplication } from '@loopback/rest';
import type { Mastra } from '@mastra/core';
import type { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';
import { MastraServer, normalizeQueryParams } from '@mastra/server/server-adapter';
import type { ParsedRequestParams, ServerRoute } from '@mastra/server/server-adapter';

import { MastraLoopbackBindings, MastraLoopbackProviderBindings } from './bindings.js';
import { MastraLoopbackComponent } from './component.js';
import { logLoopbackRequest } from './internal/logging.js';
import {
  createOperationSpec,
  extractPathParamNames,
  joinPath,
  toLoopbackMethods,
  toLoopbackPath,
} from './internal/path-utils.js';
import { LoopbackRequestRuntime } from './internal/request-runtime.js';
import type { LoopbackRequestRuntimeHooks } from './internal/request-runtime.js';
import {
  bindRequestContextValues,
  buildCustomRouteUrl,
  createMastraRequestContext,
  normalizeUrlParams,
  toHeaderRecord,
} from './internal/request-utils.js';
import { LoopbackResponseWriter } from './internal/response-writer.js';
import { createLoopbackRouteEntry } from './internal/route-entry-factory.js';
import type { LoopbackRouteInvocationContext } from './internal/route-entry-factory.js';
import type { RegisteredMastraRoute } from './internal/types.js';
import type { LoopbackAuthResolverInput, LoopbackMastraConfig, MastraAuthContext } from './types.js';

export interface LoopbackMastraServerOptions {
  app: RestApplication;
  mastra: Mastra;
  config?: LoopbackMastraConfig;
}

/**
 * Native LoopBack 4 adapter for Mastra.
 * Uses LoopBack route registration and request context bindings directly.
 */
export class LoopbackMastraServer extends MastraServer<RestApplication, Request, Response> {
  readonly config: LoopbackMastraConfig;
  private readonly responseWriter: LoopbackResponseWriter;
  private readonly runtime: LoopbackRequestRuntime;
  private authResolver?: (
    input: LoopbackAuthResolverInput,
  ) => MastraAuthContext | undefined | Promise<MastraAuthContext | undefined>;

  constructor(options: LoopbackMastraServerOptions) {
    const config = options.config ?? {};
    super({
      app: options.app,
      mastra: options.mastra,
      prefix: config.prefix,
      openapiPath: config.openapiPath,
      mcpOptions: config.mcp,
    } as never);
    this.config = config;
    this.responseWriter = new LoopbackResponseWriter({
      prefix: this.config.prefix,
      applyStreamRedaction: chunk => this.runtime.redactStreamChunk(chunk),
    });
    this.runtime = new LoopbackRequestRuntime({
      config: this.config,
      parseQueryParamsHook: (route, queryParams) => this.invokeParseQueryParamsHook(route, queryParams),
      parseBodyHook: (route, body) => this.invokeParseBodyHook(route, body),
      parsePathParamsHook: (route, pathParams) => this.invokeParsePathParamsHook(route, pathParams),
      checkRouteAuthHook: (route, input) => this.invokeCheckRouteAuthHook(route, input),
      legacyAuthResolver: input => this.getConfiguredAuthResolver()?.(input),
      resolveTools: () => this.resolveToolsForRoute(),
      resolveTaskStore: () => this.resolveTaskStore(),
      redactStreamChunkHook: chunk => this.invokeRedactStreamChunkHook(chunk),
    });

    this.ensureSupportBindingsRegistered(options.app);
    options.app.bind(MastraLoopbackBindings.CONFIG).to(this.config).inScope(BindingScope.SINGLETON);
    options.app.bind(MastraLoopbackBindings.MASTRA_INSTANCE).to(options.mastra).inScope(BindingScope.SINGLETON);
  }

  registerContextMiddleware(): void {
    this.ensureSupportBindingsRegistered(this.app);
  }

  registerAuthMiddleware(): void {
    this.ensureSupportBindingsRegistered(this.app);
    this.authResolver = this.getConfiguredAuthResolver();
    this.app.bind(MastraLoopbackBindings.AUTH_RESOLVER).to(this.authResolver).inScope(BindingScope.SINGLETON);
  }

  registerHttpLoggingMiddleware(): void {
    this.ensureSupportBindingsRegistered(this.app);
    this.app
      .bind(MastraLoopbackBindings.HTTP_LOGGING_CONFIG)
      .to(this.httpLoggingConfig)
      .inScope(BindingScope.SINGLETON);
  }

  async registerCustomApiRoutes(): Promise<void> {
    const hasCustomRoutes = await this.buildCustomRouteHandler();
    if (!hasCustomRoutes) {
      return;
    }

    const customRoutes = this.getCustomApiRoutes();
    if (customRoutes.length === 0) {
      return;
    }

    this.customApiRoutes = customRoutes;
    this.syncCustomRouteAuthConfig(customRoutes);

    for (const route of customRoutes) {
      for (const method of toLoopbackMethods(route.method)) {
        await this.registerCustomApiRoute(method, route);
      }
    }
  }

  async registerRoute(app: RestApplication, route: ServerRoute, opts: { prefix?: string } = {}): Promise<void> {
    const mastraRoute = route as RegisteredMastraRoute;
    const routeHandler = this.resolveRouteHandler(mastraRoute);
    const fullPath = toLoopbackPath(joinPath(opts.prefix ?? this.config.prefix, mastraRoute.path));
    const pathParamNames = extractPathParamNames(fullPath);
    const operationSpec = mastraRoute.openapi ?? createOperationSpec(pathParamNames);

    app.route(
      createLoopbackRouteEntry({
        verb: mastraRoute.method,
        path: fullPath,
        spec: operationSpec,
        handle: lifecycle => this.handleRegisteredRouteInvocation(lifecycle, mastraRoute, routeHandler),
      }),
    );
  }

  async getParams(route: ServerRoute, req: Request): Promise<ParsedRequestParams> {
    void route;

    return {
      urlParams: normalizeUrlParams(req.params),
      queryParams: normalizeQueryParams((req.query ?? {}) as Record<string, unknown>),
      body: req.body,
    };
  }

  async sendResponse(route: ServerRoute, res: Response, result: unknown, request?: Request): Promise<void> {
    await this.responseWriter.sendResponse(route, res, result, request);
  }

  async stream(route: ServerRoute, res: Response, result: unknown): Promise<void> {
    await this.responseWriter.stream(route, res, result);
  }

  async init(): Promise<void> {
    await super.init();
  }

  private async handleRegisteredRouteInvocation(
    lifecycle: LoopbackRouteInvocationContext,
    route: RegisteredMastraRoute,
    routeHandler: (params: unknown) => unknown | Promise<unknown>,
  ): Promise<Response> {
    const { requestContext, req, res, startedAt, abortController } = lifecycle;

    try {
      const params = await this.getParams(route, req);
      const queryParams = await this.runtime.parseQueryParams(route, params.queryParams);
      const body = await this.runtime.parseBody(route, params.body);
      if (params.bodyParseError) {
        res.status(400).json({ error: params.bodyParseError.message });
        return res;
      }
      const pathParams = await this.runtime.parsePathParams(route, params.urlParams);
      const mastraRequestContext = createMastraRequestContext({
        app: this.app,
        mergeRequestContext: input => this.mergeRequestContext(input),
        loopbackContext: requestContext,
        request: req,
        response: res,
        queryParams: req.query as Record<string, unknown> | undefined,
        body: req.body,
      });
      mastraRequestContext.set('abortSignal', abortController.signal);

      const authError = await this.runtime.checkRouteAuth(route, req, mastraRequestContext);
      if (authError) {
        res.status(authError.status).json({ error: authError.error });
        return res;
      }

      const authContext = await this.runtime.resolveAuthContext(req, mastraRequestContext);
      if (authContext) {
        mastraRequestContext.set('auth', authContext);
      }
      bindRequestContextValues({
        requestContext,
        request: req,
        abortSignal: abortController.signal,
        mastraRequestContext,
        authContext,
      });

      const handlerResult = await routeHandler({
        method: req.method,
        path: req.path,
        query: queryParams,
        body,
        headers: req.headers,
        params: pathParams,
        request: req,
        response: res,
        getRawRequest: () => req,
        getRawResponse: () => res,
        mastra: this.mastra,
        requestContext: mastraRequestContext,
        tools: this.runtime.resolveTools(),
        abortSignal: abortController.signal,
        taskStore: this.runtime.resolveTaskStore(),
      });

      if (this.isStreamRoute(route)) {
        await this.stream(route, res, handlerResult);
      } else {
        await this.sendResponse(route, res, handlerResult, req);
      }

      this.logRequest(req, res, startedAt);
      return res;
    } catch (error: unknown) {
      this.sendErrorResponse(res, error);
      this.logRequest(req, res, startedAt);
      return res;
    }
  }

  private async registerCustomApiRoute(method: string, route: ApiRoute): Promise<void> {
    const fullPath = toLoopbackPath(joinPath(this.config.prefix, route.path));
    const operationSpec = createOperationSpec(extractPathParamNames(fullPath));

    this.app.route(
      createLoopbackRouteEntry({
        verb: method,
        path: fullPath,
        spec: operationSpec,
        handle: lifecycle => this.handleCustomRouteInvocation(lifecycle, method, route),
      }),
    );
  }

  private async handleCustomRouteInvocation(
    lifecycle: LoopbackRouteInvocationContext,
    method: string,
    route: ApiRoute,
  ): Promise<Response> {
    const { requestContext, req, res, startedAt, abortController } = lifecycle;

    try {
      const mastraRequestContext = createMastraRequestContext({
        app: this.app,
        mergeRequestContext: input => this.mergeRequestContext(input),
        loopbackContext: requestContext,
        request: req,
        response: res,
        queryParams: req.query as Record<string, unknown> | undefined,
        body: req.body,
      });
      mastraRequestContext.set('abortSignal', abortController.signal);

      const authRoute = {
        method,
        path: joinPath(this.config.prefix, route.path),
        requiresAuth: route.requiresAuth,
      } as RegisteredMastraRoute;
      const authError = await this.runtime.checkRouteAuth(authRoute, req, mastraRequestContext);
      if (authError) {
        res.status(authError.status).json({ error: authError.error });
        this.logRequest(req, res, startedAt);
        return res;
      }

      const authContext = await this.runtime.resolveAuthContext(req, mastraRequestContext);
      if (authContext) {
        mastraRequestContext.set('auth', authContext);
      }
      bindRequestContextValues({
        requestContext,
        request: req,
        abortSignal: abortController.signal,
        mastraRequestContext,
        authContext,
      });

      const customResponse = await this.handleCustomRouteRequest(
        buildCustomRouteUrl(req, this.config.prefix).toString(),
        method,
        toHeaderRecord(req.headers),
        req.body,
        mastraRequestContext,
      );

      if (!customResponse) {
        res.status(404).json({ error: 'Not Found' });
        this.logRequest(req, res, startedAt);
        return res;
      }

      await this.writeCustomRouteResponse(customResponse, {
        writeHead: (status, headers) => {
          res.status(status);
          for (const [key, value] of Object.entries(headers)) {
            res.setHeader(key, value);
          }
        },
        write: chunk => {
          res.write(chunk as string | Buffer | Uint8Array);
        },
        end: data => {
          if (data !== undefined) {
            res.end(data);
            return;
          }
          res.end();
        },
      });
      this.logRequest(req, res, startedAt);
      return res;
    } catch (error: unknown) {
      this.sendErrorResponse(res, error);
      this.logRequest(req, res, startedAt);
      return res;
    }
  }

  private resolveRouteHandler(route: RegisteredMastraRoute): (params: unknown) => unknown | Promise<unknown> {
    if (typeof route.handler !== 'function') {
      throw new Error(`Route handler is not configured for ${route.method} ${route.path}`);
    }
    return route.handler;
  }

  private getCustomApiRoutes(): ApiRoute[] {
    return (this.customApiRoutes ?? this.mastra.getServer()?.apiRoutes ?? []) as ApiRoute[];
  }

  private syncCustomRouteAuthConfig(routes: ApiRoute[]): void {
    const config = this.customRouteAuthConfig ?? new Map<string, boolean>();
    for (const route of routes) {
      if (route.requiresAuth === undefined) {
        continue;
      }
      config.set(`${route.method}:${joinPath(this.config.prefix, route.path)}`, route.requiresAuth);
    }
    this.customRouteAuthConfig = config;
  }

  private resolveToolsForRoute(): unknown {
    const serverInternals = this as unknown as {
      tools?: unknown;
      getToolsets?: (tools: unknown) => unknown;
    };

    if (typeof serverInternals.getToolsets === 'function') {
      return serverInternals.getToolsets.call(this, serverInternals.tools);
    }

    return serverInternals.tools;
  }

  private resolveTaskStore(): unknown {
    return (this as unknown as { taskStore?: unknown }).taskStore;
  }

  private isStreamRoute(route: RegisteredMastraRoute): boolean {
    return route.responseType === 'stream';
  }

  private sendErrorResponse(res: Response, error: unknown): void {
    this.responseWriter.sendErrorResponse(res, error);
  }

  private logRequest(req: Request, res: Response, startedAt: number): void {
    logLoopbackRequest({
      req,
      res,
      startedAt,
      config: this.httpLoggingConfig,
      shouldLogRequest: path => this.shouldLogRequest(path),
    });
  }

  private ensureSupportBindingsRegistered(app: RestApplication): void {
    if (!app.isBound(MastraLoopbackProviderBindings.REQUEST_CONTEXT)) {
      app.component(MastraLoopbackComponent);
    }
  }

  private getConfiguredAuthResolver(): LoopbackMastraConfig['authResolver'] {
    return this.config.auth?.resolveContext ?? this.config.authResolver;
  }

  private async invokeParseQueryParamsHook(
    route: RegisteredMastraRoute,
    queryParams: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const parseQueryParams = (
      this as unknown as {
        parseQueryParams?: (
          route: RegisteredMastraRoute,
          queryParams: Record<string, unknown>,
        ) => Promise<Record<string, unknown>>;
      }
    ).parseQueryParams;

    return typeof parseQueryParams === 'function' ? parseQueryParams.call(this, route, queryParams) : queryParams;
  }

  private async invokeParseBodyHook(route: RegisteredMastraRoute, body: unknown): Promise<unknown> {
    const parseBody = (
      this as unknown as {
        parseBody?: (route: RegisteredMastraRoute, body: unknown) => Promise<unknown>;
      }
    ).parseBody;

    return typeof parseBody === 'function' ? parseBody.call(this, route, body) : body;
  }

  private async invokeParsePathParamsHook(
    route: RegisteredMastraRoute,
    pathParams: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const parsePathParams = (
      this as unknown as {
        parsePathParams?: (
          route: RegisteredMastraRoute,
          pathParams: Record<string, unknown>,
        ) => Promise<Record<string, unknown>>;
      }
    ).parsePathParams;

    return typeof parsePathParams === 'function' ? parsePathParams.call(this, route, pathParams) : pathParams;
  }

  private async invokeCheckRouteAuthHook(
    route: RegisteredMastraRoute,
    input: Parameters<NonNullable<LoopbackRequestRuntimeHooks['checkRouteAuthHook']>>[1],
  ): Promise<{ status: number; error: string } | null> {
    const checkRouteAuth = (
      this as unknown as {
        checkRouteAuth?: (
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
        ) => Promise<{ status: number; error: string } | null>;
      }
    ).checkRouteAuth;

    return typeof checkRouteAuth === 'function' ? checkRouteAuth.call(this, route, input) : null;
  }

  private invokeRedactStreamChunkHook(chunk: unknown): unknown | Promise<unknown> {
    const streamOptions = (this as unknown as { streamOptions?: { redact?: unknown } }).streamOptions;
    const redact = streamOptions?.redact;

    return typeof redact === 'function' ? redact(chunk) : chunk;
  }
}
