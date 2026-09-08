import {
  generateOpenAPIDocument,
  convertCustomRoutesToOpenAPIPaths,
  SERVER_ROUTES,
} from '@mastra/server/server-adapter';
import type { MastraServer } from './index';

/**
 * OpenAPI documentation cache to avoid regenerating on each call.
 * Uses WeakMap to prevent cache collisions between server instances.
 */
const openapiDocCache = new WeakMap<
  MastraServer,
  {
    paths: Record<string, any>;
    components?: Record<string, any>;
    info: { title: string; version: string; description?: string };
  }
>();

/**
 * Get OpenAPI documentation from a MastraServer instance, formatted for Elysia's openapi plugin.
 *
 * This function:
 * - Extracts all Mastra routes with their Zod schemas
 * - Converts them to OpenAPI 3.1.0 format
 * - Merges custom routes if registered
 * - Applies the configured route prefix to all paths
 * - Caches the result for performance
 *
 * @param server - The MastraServer instance (must be initialized with init())
 * @param options - Optional configuration for OpenAPI metadata
 * @returns OpenAPI documentation with paths, components, and info
 *
 * @example
 * ```typescript
 * import { getMastraOpenAPIDoc } from '@mastra/elysia';
 *
 * const srv = new MastraServer({ mastra, app, prefix: '/api' });
 * await srv.init();
 *
 * const openAPIDoc = getMastraOpenAPIDoc(srv, {
 *   title: 'My Mastra API',
 *   version: '1.0.0',
 *   description: 'API with weather agent'
 * });
 *
 * app.use(openapi({
 *   documentation: {
 *     info: openAPIDoc.info,
 *     paths: openAPIDoc.paths,
 *     components: openAPIDoc.components
 *   }
 * }));
 * ```
 */
export function getMastraOpenAPIDoc(
  server: MastraServer,
  options?: {
    title?: string;
    version?: string;
    description?: string;
    clearCache?: boolean;
  },
): {
  paths: Record<string, any>;
  components?: Record<string, any>;
  info: { title: string; version: string; description?: string };
} {
  // Clear cache if requested
  if (options?.clearCache) {
    openapiDocCache.delete(server);
  }

  // Return cached result if available
  const cached = openapiDocCache.get(server);
  if (cached) {
    // Merge custom info if provided
    if (options) {
      return {
        ...cached,
        info: {
          ...cached.info,
          ...(options.title && { title: options.title }),
          ...(options.version && { version: options.version }),
          ...(options.description && { description: options.description }),
        },
      };
    }
    return cached;
  }

  // Generate complete OpenAPI spec from Mastra's route definitions
  const openApiSpec = generateOpenAPIDocument(SERVER_ROUTES, {
    title: options?.title || 'Mastra API',
    version: options?.version || '1.0.0',
    description: options?.description || 'Mastra Server API',
  });

  // Merge custom API routes if present
  const customApiRoutes = (server as any).customApiRoutes;
  if (customApiRoutes && customApiRoutes.length > 0) {
    const customPaths = convertCustomRoutesToOpenAPIPaths(customApiRoutes);
    openApiSpec.paths = { ...openApiSpec.paths, ...customPaths };
  }

  let paths = openApiSpec.paths || {};

  // Apply prefix transformation if configured
  const prefix = (server as any).prefix;
  if (prefix && prefix !== '/') {
    const prefixedPaths: Record<string, any> = {};
    for (const [path, pathItem] of Object.entries(paths)) {
      // Combine prefix with path, ensuring no double slashes
      const prefixedPath = `${prefix}${path}`.replace(/\/+/g, '/');
      prefixedPaths[prefixedPath] = pathItem;
    }
    paths = prefixedPaths;
  }

  const result = {
    paths,
    components: openApiSpec.components,
    info: openApiSpec.info,
  };

  // Cache the result
  openapiDocCache.set(server, result);

  return result;
}

/**
 * Clear the OpenAPI documentation cache.
 * Call this if routes are added dynamically after initialization.
 *
 * `@param` server - The MastraServer instance to clear cache for.
 * Note: WeakMap does not support clearing all entries. Pass the specific server instance whose cache should be invalidated.
 */
export function clearMastraOpenAPICache(server?: MastraServer): void {
  if (server) {
    openapiDocCache.delete(server);
  }
  // Cannot clear all entries in WeakMap - they will be garbage collected when servers are released
}
