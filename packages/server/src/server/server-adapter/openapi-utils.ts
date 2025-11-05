import { z, type ZodSchema } from 'zod';
import { createDocument } from 'zod-openapi';

interface RouteOpenAPIConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  summary?: string;
  description?: string;
  tags?: string[];
  queryParamSchema?: ZodSchema;
  bodySchema?: ZodSchema;
  responseSchema?: ZodSchema;
}

interface OpenAPIRoute {
  summary?: string;
  description?: string;
  tags?: string[];
  requestParams?: {
    path?: ZodSchema;
    query?: ZodSchema;
  };
  requestBody?: {
    content: {
      'application/json': {
        schema: ZodSchema;
      };
    };
  };
  responses: {
    [statusCode: string]: {
      description: string;
      content?: {
        'application/json': {
          schema: ZodSchema;
        };
      };
    };
  };
}

/**
 * Generates OpenAPI specification for a single route
 * Extracts path parameters, query parameters, request body, and response schemas
 */
export function generateRouteOpenAPI({
  method,
  path,
  summary,
  description,
  tags = [],
  queryParamSchema,
  bodySchema,
  responseSchema,
}: RouteOpenAPIConfig): OpenAPIRoute {
  const route: OpenAPIRoute = {
    summary: summary || `${method} ${path}`,
    description,
    tags,
    responses: {
      200: {
        description: 'Successful response',
      },
    },
  };

  // Extract and document path parameters (e.g., :agentId, :threadId, :toolId)
  const pathParams = path.match(/:(\w+)/g);
  if (pathParams || queryParamSchema) {
    route.requestParams = {};

    if (pathParams) {
      // Build a Zod schema for path parameters
      const pathSchemaObj: Record<string, ZodSchema> = {};
      pathParams.forEach(param => {
        const paramName = param.slice(1); // Remove the ':'
        pathSchemaObj[paramName] = z.string().describe(`The ${paramName} parameter`);
      });
      route.requestParams.path = z.object(pathSchemaObj);
    }

    if (queryParamSchema) {
      route.requestParams.query = queryParamSchema;
    }
  }

  // Add request body with raw Zod schema
  if (bodySchema) {
    route.requestBody = {
      content: {
        'application/json': {
          schema: bodySchema,
        },
      },
    };
  }

  // Add response schema with raw Zod schema
  if (responseSchema) {
    route.responses[200] = {
      description: 'Successful response',
      content: {
        'application/json': {
          schema: responseSchema,
        },
      },
    };
  }

  return route;
}

// Store all route definitions for full document generation
const allRoutes: Array<{ path: string; method: string; spec: OpenAPIRoute }> = [];

/**
 * Registers a route for inclusion in the full OpenAPI document
 */
export function registerRoute(path: string, method: string, spec: OpenAPIRoute) {
  allRoutes.push({ path, method, spec });
}

/**
 * Generates a complete OpenAPI 3.1.0 document from all registered routes
 */
export function generateOpenAPIDocument(info: { title: string; version: string; description?: string }): any {
  const paths: Record<string, any> = {};

  // Build paths object from all registered routes
  // Convert Express-style :param to OpenAPI-style {param}
  allRoutes.forEach(({ path, method, spec }) => {
    const openapiPath = path.replace(/:(\w+)/g, '{$1}');
    if (!paths[openapiPath]) {
      paths[openapiPath] = {};
    }
    paths[openapiPath][method.toLowerCase()] = spec;
  });

  return createDocument({
    openapi: '3.1.0',
    info: {
      title: info.title,
      version: info.version,
      description: info.description,
    },
    paths,
  });
}

/**
 * Clears all registered routes (useful for testing)
 */
export function clearRegisteredRoutes() {
  allRoutes.length = 0;
}
