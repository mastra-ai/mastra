import {
  generateOpenAPIDocument,
  convertCustomRoutesToOpenAPIPaths,
  SERVER_ROUTES,
} from '@mastra/server/server-adapter';
import type { MastraServer } from './index';

/**
 * OpenAPI documentation cache to avoid regenerating on each call.
 * Keyed by a combination of prefix and whether custom routes exist.
 */
const openapiDocCache = new Map<
  string,
  {
    paths: Record<string, any>;
    components?: Record<string, any>;
    info: { title: string; version: string; description?: string };
  }
>();

/**
 * Generate a cache key based on server configuration
 */
function getCacheKey(server: MastraServer): string {
  const prefix = (server as any).prefix || '';
  const hasCustomRoutes = (server as any).customApiRoutes?.length > 0;
  return `${prefix}:${hasCustomRoutes}`;
}

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
  const cacheKey = getCacheKey(server);

  // Clear cache if requested
  if (options?.clearCache) {
    openapiDocCache.delete(cacheKey);
  }

  // Return cached result if available
  const cached = openapiDocCache.get(cacheKey);
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
  openapiDocCache.set(cacheKey, result);

  return result;
}

/**
 * Clear the OpenAPI documentation cache.
 * Call this if routes are added dynamically after initialization.
 */
export function clearMastraOpenAPICache(): void {
  openapiDocCache.clear();
}
