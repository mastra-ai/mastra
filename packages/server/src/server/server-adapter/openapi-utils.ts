import { zodToJsonSchema } from '@mastra/core/utils/zod-to-json';
import type { ZodSchema } from 'zod';
import type { ServerRoute } from './routes';

interface RouteOpenAPIConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  summary?: string;
  description?: string;
  tags?: string[];
  pathParamSchema?: ZodSchema;
  queryParamSchema?: ZodSchema;
  bodySchema?: ZodSchema;
  responseSchema?: ZodSchema;
  deprecated?: boolean;
}

interface OpenAPIRoute {
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
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
  pathParamSchema,
  queryParamSchema,
  bodySchema,
  responseSchema,
  deprecated,
}: RouteOpenAPIConfig): OpenAPIRoute {
  const route: OpenAPIRoute = {
    summary: summary || `${method} ${path}`,
    description,
    tags,
    deprecated,
    responses: {
      200: {
        description: 'Successful response',
      },
    },
  };

  // Add path and query parameters
  if (pathParamSchema || queryParamSchema) {
    route.requestParams = {};

    if (pathParamSchema) {
      route.requestParams.path = pathParamSchema;
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

/**
 * Converts an OpenAPI route spec with Zod schemas to one with JSON Schema
 */
function convertZodToJsonSchema(spec: OpenAPIRoute): any {
  const converted: any = {
    summary: spec.summary,
    description: spec.description,
    tags: spec.tags,
    responses: {},
  };

  const parameters: any[] = [];

  // Convert path parameters
  if (spec.requestParams?.path) {
    const pathSchema = zodToJsonSchema(spec.requestParams.path, 'openApi3', 'none') as any;
    const properties = pathSchema.properties || {};

    Object.entries(properties).forEach(([name, schema]) => {
      parameters.push({
        name,
        in: 'path',
        required: true,
        description: (schema as any).description || `The ${name} parameter`,
        schema,
      });
    });
  }

  // Convert query parameters
  if (spec.requestParams?.query) {
    const querySchema = zodToJsonSchema(spec.requestParams.query, 'openApi3', 'none') as any;
    const properties = querySchema.properties || {};
    const required = querySchema.required || [];

    Object.entries(properties).forEach(([name, schema]) => {
      parameters.push({
        name,
        in: 'query',
        required: required.includes(name),
        description: (schema as any).description || `Query parameter: ${name}`,
        schema,
      });
    });
  }

  if (parameters.length > 0) {
    converted.parameters = parameters;
  }

  // Convert request body
  if (spec.requestBody?.content?.['application/json']?.schema) {
    converted.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: zodToJsonSchema(spec.requestBody.content['application/json'].schema, 'openApi3', 'none'),
        },
      },
    };
  }

  // Convert response schemas
  Object.entries(spec.responses).forEach(([statusCode, response]) => {
    converted.responses[statusCode] = {
      description: response.description,
    };

    if (response.content?.['application/json']?.schema) {
      converted.responses[statusCode].content = {
        'application/json': {
          schema: zodToJsonSchema(response.content['application/json'].schema, 'openApi3', 'none'),
        },
      };
    }
  });

  return converted;
}

/**
 * Generates a complete OpenAPI 3.1.0 document from server routes
 * @param routes - Array of ServerRoute objects with OpenAPI specifications
 * @param info - API metadata (title, version, description)
 * @returns Complete OpenAPI 3.1.0 document
 */
export function generateOpenAPIDocument(
  routes: ServerRoute[],
  info: { title: string; version: string; description?: string },
): any {
  const paths: Record<string, any> = {};

  // Build paths object from routes
  // Convert Express-style :param to OpenAPI-style {param}
  routes.forEach(route => {
    if (!route.openapi) return;

    const openapiPath = route.path.replace(/:(\w+)/g, '{$1}');
    if (!paths[openapiPath]) {
      paths[openapiPath] = {};
    }

    // Convert Zod schemas to JSON Schema
    paths[openapiPath][route.method.toLowerCase()] = convertZodToJsonSchema(route.openapi);
  });

  return {
    openapi: '3.1.0',
    info: {
      title: info.title,
      version: info.version,
      description: info.description,
    },
    paths,
  };
}
