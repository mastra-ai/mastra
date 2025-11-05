import type { Mastra } from '@mastra/core';
import type { ApiRoute } from '@mastra/core/server';
import type z from 'zod';
import { AGENTS_ROUTES } from './agents';
import { MEMORY_ROUTES } from './memory';
import { OBSERVABILITY_ROUTES } from './observability';
import { SCORES_ROUTES } from './scorers';
import { TOOLS_ROUTES } from './tools';
import { WORKFLOWS_ROUTES } from './workflows';

export type ServerRouteHandler<TParams = Record<string, unknown>, TResponse = unknown> = (
  params: TParams & { mastra: Mastra },
) => Promise<TResponse>;

export type ServerRoute<TParams = Record<string, unknown>, TResponse = unknown> = Omit<
  ApiRoute,
  'handler' | 'createHandler'
> & {
  responseType: 'stream' | 'json';
  handler: ServerRouteHandler<TParams, TResponse>;
  pathParamSchema?: z.ZodSchema;
  queryParamSchema?: z.ZodSchema;
  bodySchema?: z.ZodSchema;
  responseSchema?: z.ZodSchema;
  openapi?: any; // Auto-generated OpenAPI spec for this route
};

export const SERVER_ROUTES: ServerRoute[] = [
  ...AGENTS_ROUTES,
  ...WORKFLOWS_ROUTES,
  ...TOOLS_ROUTES,
  ...MEMORY_ROUTES,
  ...SCORES_ROUTES,
  ...OBSERVABILITY_ROUTES,
];

// Export route builder and OpenAPI utilities
export { createRoute } from './route-builder';
export { generateOpenAPIDocument } from '../openapi-utils';
