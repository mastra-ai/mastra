import type { ToolsInput } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import { MastraServer as HonoMastraServer } from '@mastra/hono';
import type { HonoApp } from '@mastra/hono';
import type { InMemoryTaskStore } from '@mastra/server/a2a/store';
import type { BodyLimitOptions, MCPOptions, StreamOptions } from '@mastra/server/server-adapter';
import { Hono } from 'hono';
export { createAuthMiddleware } from '@mastra/hono';
export type { HonoAuthMiddlewareOptions } from '@mastra/hono';

export type TanstackStartMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export type TanstackStartHandler = (args: { request: Request }) => Response | Promise<Response>;

export type TanstackStartHandlers = Record<TanstackStartMethod, TanstackStartHandler>;

const DEFAULT_TANSTACK_START_METHODS: readonly TanstackStartMethod[] = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
  'HEAD',
];

/**
 * Minimal app interface required to serve Mastra through TanStack Start server route handlers.
 */
export interface TanstackStartApp extends HonoApp {
  fetch(request: Request): Response | Promise<Response>;
}

export interface MastraTanstackStartServerOptions {
  /**
   * Optional preconfigured Hono-compatible app.
   * If omitted, a new Hono app is created.
   */
  app?: TanstackStartApp;
  mastra: Mastra;
  bodyLimitOptions?: BodyLimitOptions;
  tools?: ToolsInput;
  prefix?: string;
  openapiPath?: string;
  taskStore?: InMemoryTaskStore;
  customRouteAuthConfig?: Map<string, boolean>;
  streamOptions?: StreamOptions;
  mcpOptions?: MCPOptions;
}

/**
 * TanStack Start server adapter that wires Mastra routes into a Hono app and
 * exposes request handlers compatible with `createFileRoute(...).server.handlers`.
 */
export class MastraServer {
  readonly app: TanstackStartApp;
  private readonly honoServer: HonoMastraServer;

  constructor({ app, ...options }: MastraTanstackStartServerOptions) {
    const resolvedApp = (app ?? new Hono()) as TanstackStartApp;
    this.app = resolvedApp;
    this.honoServer = new HonoMastraServer({
      ...options,
      app: resolvedApp,
    });
  }

  async init(): Promise<void> {
    await this.honoServer.init();
  }

  get mastra() {
    return (this.honoServer as any).mastra;
  }

  get logger() {
    return (this.honoServer as any).logger;
  }

  getApp<TApp = TanstackStartApp>(): TApp {
    return this.honoServer.getApp<TApp>();
  }

  createContextMiddleware() {
    return this.honoServer.createContextMiddleware();
  }

  registerContextMiddleware(): void {
    this.honoServer.registerContextMiddleware();
  }

  registerAuthMiddleware(): void {
    this.honoServer.registerAuthMiddleware();
  }

  registerHttpLoggingMiddleware(): void {
    this.honoServer.registerHttpLoggingMiddleware();
  }

  async registerRoute(
    ...args: Parameters<HonoMastraServer['registerRoute']>
  ): ReturnType<HonoMastraServer['registerRoute']> {
    return this.honoServer.registerRoute(...args);
  }

  /**
   * Creates a single request handler function for TanStack Start server routes.
   */
  createRequestHandler(): TanstackStartHandler {
    return ({ request }) => this.app.fetch(request);
  }

  /**
   * Creates an HTTP method map that can be directly assigned to
   * `createFileRoute(...).server.handlers`.
   */
  createRouteHandlers(methods: readonly TanstackStartMethod[] = DEFAULT_TANSTACK_START_METHODS): TanstackStartHandlers {
    const handler = this.createRequestHandler();
    return Object.fromEntries(methods.map(method => [method, handler])) as TanstackStartHandlers;
  }
}
