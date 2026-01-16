import type { ToolsInput } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import type { InMemoryTaskStore } from '@mastra/server/a2a/store';
import type { BodyLimitOptions, ParsedRequestParams, ServerRoute, StreamOptions } from '@mastra/server/server-adapter';
import type { INestApplication } from '@nestjs/common';

/**
 * Platform-agnostic context interface stored on requests.
 */
export interface MastraContext {
  mastra: Mastra;
  requestContext: RequestContext;
  tools: ToolsInput;
  taskStore?: InMemoryTaskStore;
  abortSignal: AbortSignal;
  customRouteAuthConfig?: Map<string, boolean>;
}

/**
 * Options for creating a MastraServer instance.
 */
export interface MastraServerOptions {
  /** The NestJS application instance */
  app: INestApplication;
  /** The Mastra instance to use for handling requests */
  mastra: Mastra;
  /** Optional body limit configuration */
  bodyLimitOptions?: BodyLimitOptions;
  /** Optional tools to make available to handlers */
  tools?: ToolsInput;
  /** Optional route prefix (e.g., '/api') */
  prefix?: string;
  /** Optional path for OpenAPI spec endpoint */
  openapiPath?: string;
  /** Optional task store for A2A communication */
  taskStore?: InMemoryTaskStore;
  /** Optional per-route auth configuration */
  customRouteAuthConfig?: Map<string, boolean>;
  /** Optional stream options (e.g., redaction) */
  streamOptions?: StreamOptions;
}

/**
 * Supported HTTP platforms for NestJS.
 */
export type PlatformType = 'express' | 'fastify';

/**
 * Abstract interface for platform-specific implementations.
 * Each platform (Express, Fastify) implements this interface.
 */
export interface PlatformAdapter {
  /** Platform identifier */
  readonly platform: PlatformType;

  /** Get the underlying framework instance */
  getInstance(): unknown;

  /** Create context middleware for this platform */
  createContextMiddleware(): unknown;

  /** Extract params from request */
  getParams(route: ServerRoute, request: unknown): Promise<ParsedRequestParams>;

  /** Send response to client */
  sendResponse(route: ServerRoute, response: unknown, result: unknown, request?: unknown): Promise<void>;

  /** Handle streaming responses */
  stream(route: ServerRoute, response: unknown, result: unknown): Promise<void>;

  /** Register a route with the platform */
  registerRoute(route: ServerRoute, options: { prefix?: string }): Promise<void>;

  /** Register context middleware globally */
  registerContextMiddleware(): void;

  /** Register auth middleware globally */
  registerAuthMiddleware(): void;
}
