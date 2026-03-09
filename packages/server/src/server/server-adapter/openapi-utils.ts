import type { PublicSchema } from '@mastra/core/schema';
import { toStandardSchema } from '@mastra/core/schema';
import type { ApiRoute } from '@mastra/core/server';
import { zodToJsonSchema } from '@mastra/core/utils/zod-to-json';
import { standardSchemaToJSONSchema } from '@mastra/schema-compat';
import type { JSONSchema7 } from '@mastra/schema-compat';
import type { ServerRoute } from './routes';

interface RouteOpenAPIConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  summary?: string;
  description?: string;
  tags?: string[];
  pathParamSchema?: PublicSchema<unknown>;
  queryParamSchema?: PublicSchema<unknown>;
  bodySchema?: PublicSchema<unknown>;
  responseSchema?: PublicSchema<unknown>;
  deprecated?: boolean;
}

interface OpenAPIRoute {
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  requestParams?: {
    path?: PublicSchema<unknown>;
    query?: PublicSchema<unknown>;
  };
  requestBody?: {
    content: {
      'application/json': {
        schema: PublicSchema<unknown>;
      };
    };
  };
  responses: {
    [statusCode: string]: {
      description: string;
      content?: {
        'application/json': {
          schema: PublicSchema<unknown>;
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
 * Helper to convert any PublicSchema to JSON Schema for OpenAPI
 */
function schemaToJsonSchema(schema: PublicSchema<unknown>): JSONSchema7 {
  const standardSchema = toStandardSchema(schema);

  return standardSchemaToJSONSchema(standardSchema);
}

/**
 * Converts an OpenAPI route spec with PublicSchema to one with JSON Schema
 */
function convertToJsonSchema(spec: OpenAPIRoute): any {
  const converted: any = {
    summary: spec.summary,
    description: spec.description,
    tags: spec.tags,
    responses: {},
  };

  const parameters: any[] = [];

  // Convert path parameters
  if (spec.requestParams?.path) {
    const pathSchema = schemaToJsonSchema(spec.requestParams.path) as any;
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
    const querySchema = schemaToJsonSchema(spec.requestParams.query) as any;
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
          schema: schemaToJsonSchema(spec.requestBody.content['application/json'].schema),
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
          schema: schemaToJsonSchema(response.content['application/json'].schema),
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
    paths[openapiPath][route.method.toLowerCase()] = convertToJsonSchema(route.openapi);
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

/**
 * Converts custom API routes with DescribeRouteOptions to OpenAPI path entries.
 * The DescribeRouteOptions from hono-openapi extends OpenAPIV3_1.OperationObject,
 * so it already has the standard OpenAPI structure (parameters, requestBody, responses, etc.).
 *
 * @param routes - Array of ApiRoute objects with optional openapi specifications
 * @returns OpenAPI paths object to be merged into the main spec
 */
export function convertCustomRoutesToOpenAPIPaths(routes: ApiRoute[]): Record<string, any> {
  const paths: Record<string, any> = {};

  for (const route of routes) {
    // Skip routes without openapi metadata or routes marked as hidden
    if (!route.openapi || route.openapi.hide) {
      continue;
    }

    // Skip routes with method 'ALL' as they don't map well to OpenAPI
    if (route.method === 'ALL') {
      continue;
    }

    // Convert Express-style :param to OpenAPI-style {param}
    const openapiPath = route.path.replace(/:(\w+)/g, '{$1}');

    if (!paths[openapiPath]) {
      paths[openapiPath] = {};
    }

    const method = route.method.toLowerCase();
    const openapi = route.openapi;

    // Build the OpenAPI operation object from DescribeRouteOptions
    // DescribeRouteOptions extends OpenAPIV3_1.OperationObject, so it already has:
    // - summary, description, tags, deprecated, externalDocs, operationId
    // - parameters (array of OpenAPIV3_1.ParameterObject)
    // - requestBody (OpenAPIV3_1.RequestBodyObject)
    // - responses (OpenAPIV3_1.ResponsesObject)
    // - security, servers, callbacks
    const operation: Record<string, any> = {
      summary: openapi.summary || `${route.method} ${route.path}`,
      description: openapi.description,
      tags: openapi.tags || ['custom'],
      deprecated: openapi.deprecated,
      externalDocs: openapi.externalDocs,
      security: openapi.security,
      servers: openapi.servers,
    };

    // Copy parameters directly if provided (already in OpenAPI format)
    if (openapi.parameters && Array.isArray(openapi.parameters)) {
      operation.parameters = openapi.parameters.map((param: any) => {
        // Convert Zod schemas in parameter schemas if needed
        if (param.schema && typeof param.schema === 'object' && '_def' in param.schema) {
          return {
            ...param,
            schema: zodToJsonSchema(param.schema, 'openApi3', 'none'),
          };
        }
        return param;
      });
    }

    // Handle request body - convert Zod schemas if needed
    if (openapi.requestBody) {
      const requestBody = openapi.requestBody as any;
      operation.requestBody = { ...requestBody };

      // Convert Zod schemas in requestBody content
      if (requestBody.content) {
        operation.requestBody.content = {};
        for (const [mediaType, mediaContent] of Object.entries(requestBody.content as Record<string, any>)) {
          if (mediaContent?.schema && typeof mediaContent.schema === 'object' && '_def' in mediaContent.schema) {
            operation.requestBody.content[mediaType] = {
              ...mediaContent,
              schema: zodToJsonSchema(mediaContent.schema, 'openApi3', 'none'),
            };
          } else {
            operation.requestBody.content[mediaType] = mediaContent;
          }
        }
      }
    }

    // Handle responses - convert Zod schemas if needed
    if (openapi.responses) {
      operation.responses = {};
      for (const [statusCode, response] of Object.entries(openapi.responses as Record<string, any>)) {
        if (!response) continue;

        // Handle reference objects
        if ('$ref' in response) {
          operation.responses[statusCode] = response;
          continue;
        }

        operation.responses[statusCode] = { ...response };

        // Convert Zod schemas in response content
        if (response.content) {
          operation.responses[statusCode].content = {};
          for (const [mediaType, mediaContent] of Object.entries(response.content as Record<string, any>)) {
            if (mediaContent?.schema && typeof mediaContent.schema === 'object' && '_def' in mediaContent.schema) {
              operation.responses[statusCode].content[mediaType] = {
                ...mediaContent,
                schema: zodToJsonSchema(mediaContent.schema, 'openApi3', 'none'),
              };
            } else {
              operation.responses[statusCode].content[mediaType] = mediaContent;
            }
          }
        }
      }
    } else {
      // Provide default response if none specified
      operation.responses = {
        200: {
          description: 'Successful response',
        },
      };
    }

    // Remove undefined values
    Object.keys(operation).forEach(key => {
      if (operation[key] === undefined) {
        delete operation[key];
      }
    });

    paths[openapiPath][method] = operation;
  }

  return paths;
}
