import type { PublicSchema } from '@mastra/core/schema';
import { toStandardSchema } from '@mastra/core/schema';
import type { ApiRoute, ZodOpenAPIRouteConfig } from '@mastra/core/server';
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

export interface OpenAPIRoute {
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
  routes: readonly ServerRoute[],
  info: { title: string; version: string; description?: string },
): any {
  // Use Object.create(null) to prevent prototype pollution if a route path is
  // ever '__proto__', 'constructor', or 'toString'.
  const paths: Record<string, any> = Object.create(null);

  // Build paths object from routes
  // Convert Express-style :param to OpenAPI-style {param}
  routes.forEach(route => {
    if (!route.openapi) return;

    const openapiPath = route.path.replace(/:(\w+)/g, '{$1}');
    if (!paths[openapiPath]) {
      paths[openapiPath] = Object.create(null);
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
 * Type guard: returns true when `openapi` was created using the Zod-based
 * `ZodOpenAPIRouteConfig` format rather than the raw `DescribeRouteOptions` /
 * `OpenAPIV3_1.OperationObject` format.
 *
 * `DescribeRouteOptions` extends `OpenAPIV3_1.OperationObject` which uses
 * `parameters[]` / `requestBody`; `ZodOpenAPIRouteConfig` uses `request.params`,
 * `request.query`, and `request.body` instead.
 *
 * Detection strategy:
 *  1. If `request` is present → ZodOpenAPIRouteConfig (unambiguous).
 *  2. If `parameters` (array) or `requestBody` is present → DescribeRouteOptions.
 *  3. Otherwise, if `responses` is present, assume ZodOpenAPIRouteConfig so that
 *     configs like `{ operationId, responses }` (no request schemas) are routed
 *     through the Zod converter and don't silently lose `operationId`.
 */
function isZodOpenAPIRouteConfig(openapi: unknown): openapi is ZodOpenAPIRouteConfig {
  if (typeof openapi !== 'object' || openapi === null) return false;
  if ('request' in openapi) return true;
  // DescribeRouteOptions distinguishing fields
  const hasDescribeRouteFields =
    ('parameters' in openapi && Array.isArray((openapi as any).parameters)) ||
    'requestBody' in openapi;
  if (hasDescribeRouteFields) return false;
  // No request schemas provided and no DescribeRouteOptions fields — treat as
  // ZodOpenAPIRouteConfig when `responses` is present (required field on the type).
  return 'responses' in openapi;
}

/**
 * Returns true when `schema` looks like a Zod schema (v3 uses `_def`, v4 uses `_zod`).
 */
function isZodSchema(schema: unknown): boolean {
  return (
    typeof schema === 'object' &&
    schema !== null &&
    ('_def' in schema || '_zod' in (schema as Record<string, unknown>))
  );
}

/**
 * Converts a `ZodOpenAPIRouteConfig` to a plain OpenAPI operation object,
 * translating Zod schemas in `request.params`, `request.query`, `request.body`,
 * and `responses` to JSON Schema.
 */
function convertZodRouteConfigToOperation(route: ApiRoute, openapi: ZodOpenAPIRouteConfig): Record<string, any> {
  const operation: Record<string, any> = {
    summary: openapi.summary || `${route.method} ${route.path}`,
    description: openapi.description,
    tags: openapi.tags || ['custom'],
    deprecated: openapi.deprecated,
    operationId: openapi.operationId,
    externalDocs: openapi.externalDocs,
    security: openapi.security,
  };

  const parameters: any[] = [];

  // Convert request.params (Zod object → path parameters)
  if (openapi.request?.params && isZodSchema(openapi.request.params)) {
    const jsonSchema = zodToJsonSchema(openapi.request.params as any, 'openApi3', 'none') as any;
    const properties = jsonSchema.properties || {};
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

  // Convert request.query (Zod object → query parameters)
  if (openapi.request?.query && isZodSchema(openapi.request.query)) {
    const jsonSchema = zodToJsonSchema(openapi.request.query as any, 'openApi3', 'none') as any;
    const properties = jsonSchema.properties || {};
    const required: string[] = jsonSchema.required || [];
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
    operation.parameters = parameters;
  }

  // Convert request.body (multi-media-type support)
  if (openapi.request?.body?.content) {
    operation.requestBody = {
      required: openapi.request.body.required ?? true,
      description: openapi.request.body.description,
      content: {},
    };
    for (const [mediaType, mediaContent] of Object.entries(openapi.request.body.content)) {
      if (mediaContent?.schema && isZodSchema(mediaContent.schema)) {
        operation.requestBody.content[mediaType] = {
          schema: zodToJsonSchema(mediaContent.schema as any, 'openApi3', 'none'),
        };
      } else if (mediaContent?.schema) {
        operation.requestBody.content[mediaType] = mediaContent;
      }
    }
  }

  // Convert responses
  operation.responses = {};
  for (const [statusCode, response] of Object.entries(openapi.responses)) {
    if (!response) continue;
    operation.responses[statusCode] = { description: response.description };

    if (response.content) {
      operation.responses[statusCode].content = {};
      for (const [mediaType, mediaContent] of Object.entries(response.content)) {
        if (mediaContent?.schema && isZodSchema(mediaContent.schema)) {
          operation.responses[statusCode].content[mediaType] = {
            schema: zodToJsonSchema(mediaContent.schema as any, 'openApi3', 'none'),
          };
        } else if (mediaContent?.schema) {
          operation.responses[statusCode].content[mediaType] = mediaContent;
        }
      }
    }
  }

  // Remove undefined values
  Object.keys(operation).forEach(key => {
    if (operation[key] === undefined) {
      delete operation[key];
    }
  });

  return operation;
}

/**
 * Converts custom API routes with DescribeRouteOptions to OpenAPI path entries.
 * The DescribeRouteOptions from hono-openapi extends OpenAPIV3_1.OperationObject,
 * so it already has the standard OpenAPI structure (parameters, requestBody, responses, etc.).
 *
 * Also supports ZodOpenAPIRouteConfig where Zod schemas are specified via
 * `request.params`, `request.query`, and `request.body` and are automatically
 * converted to JSON Schema.
 *
 * @param routes - Array of ApiRoute objects with optional openapi specifications
 * @returns OpenAPI paths object to be merged into the main spec
 */
export function convertCustomRoutesToOpenAPIPaths(routes: ApiRoute[]): Record<string, any> {
  // Use Object.create(null) to prevent prototype pollution if a route path is
  // ever '__proto__', 'constructor', or 'toString'.
  const paths: Record<string, any> = Object.create(null);

  for (const route of routes) {
    // Skip routes without openapi metadata or routes marked as hidden
    if (!route.openapi || (route.openapi as any).hide) {
      continue;
    }

    // Skip routes with method 'ALL' as they don't map well to OpenAPI
    if (route.method === 'ALL') {
      continue;
    }

    // Convert Express-style :param to OpenAPI-style {param}
    const openapiPath = route.path.replace(/:(\w+)/g, '{$1}');

    if (!paths[openapiPath]) {
      paths[openapiPath] = Object.create(null);
    }

    const method = route.method.toLowerCase();
    const openapi = route.openapi;

    // ZodOpenAPIRouteConfig: detected by the presence of a `request` property.
    // Convert Zod schemas in request.params/query/body and responses to JSON Schema.
    if (isZodOpenAPIRouteConfig(openapi)) {
      paths[openapiPath][method] = convertZodRouteConfigToOperation(route, openapi);
      continue;
    }

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
        // Convert Zod schemas (v3: _def, v4: _zod) in parameter schemas if needed
        if (param.schema && isZodSchema(param.schema)) {
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
          if (mediaContent?.schema && isZodSchema(mediaContent.schema)) {
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
            if (mediaContent?.schema && isZodSchema(mediaContent.schema)) {
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
