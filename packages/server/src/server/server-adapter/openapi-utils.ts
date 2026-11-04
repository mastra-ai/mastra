import type { PublicSchema } from '@mastra/core/schema';
import { toStandardSchema } from '@mastra/core/schema';
import type { ApiRoute } from '@mastra/core/server';
import { zodToJsonSchema } from '@mastra/core/utils/zod-to-json';
import { standardSchemaToJSONSchema } from '@mastra/schema-compat';
import type { JSONSchema7 } from '@mastra/schema-compat';
import type { ServerRoute } from './routes';

type SchemaApiRoute = Extract<ApiRoute, { readonly _mastraSchemaRoute: true }>;

function isSchemaApiRoute(route: ApiRoute): route is SchemaApiRoute {
  return '_mastraSchemaRoute' in route && route._mastraSchemaRoute === true;
}

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
export function schemaToJsonSchema(schema: PublicSchema<unknown>): JSONSchema7 {
  const standardSchema = toStandardSchema(schema);

  return standardSchemaToJSONSchema(standardSchema);
}

/** Shared `components.schemas` map that route schemas hoist their definitions into. */
export type OpenAPIComponentSchemas = Record<string, any>;

const DEFINITION_KEYWORDS = ['$defs', 'definitions'] as const;
// Names zod generates for unnamed recursive (z.lazy) schemas.
const GENERATED_DEFINITION_NAME = /^__schema\d+$/;

function createComponentSchemas(): OpenAPIComponentSchemas {
  // Null prototype so that a schema id like "__proto__" cannot pollute Object.prototype.
  return Object.create(null);
}

function escapeJsonPointer(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

function componentRef(name: string): string {
  return `#/components/schemas/${escapeJsonPointer(name)}`;
}

function toComponentName(name: string): string {
  // OpenAPI component keys must match ^[a-zA-Z0-9.\-_]+$
  return GENERATED_DEFINITION_NAME.test(name) ? 'Schema' : name.replace(/[^a-zA-Z0-9.\-_]/g, '_') || 'Schema';
}

function containsRootRef(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(containsRootRef);
  if (!node || typeof node !== 'object') return false;
  return Object.entries(node).some(([key, value]) => (key === '$ref' ? value === '#' : containsRootRef(value)));
}

function rewriteRefs(node: unknown, rewrite: (ref: string) => string): any {
  if (Array.isArray(node)) return node.map(child => rewriteRefs(child, rewrite));
  if (!node || typeof node !== 'object') return node;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    result[key] = key === '$ref' && typeof value === 'string' ? rewrite(value) : rewriteRefs(value, rewrite);
  }
  return result;
}

/**
 * Moves the local `$defs`/`definitions` of a standalone JSON Schema into the shared
 * `components.schemas` map and rewrites its local refs to `#/components/schemas/<name>`.
 *
 * A converted schema references its own definitions as `#/definitions/__schema0` (or
 * `#/$defs/Invoice`, or `#` for a recursive root), which only resolves while the schema is
 * the document. Once embedded in the OpenAPI document `#` is the document root, so the refs
 * would dangle. Identical definitions are shared; different ones get a unique name.
 */
export function hoistSchemaDefinitions(schema: unknown, components: OpenAPIComponentSchemas): any {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return schema;

  const root: Record<string, any> = { ...(schema as Record<string, any>) };
  const members: Array<{ pointer: string; base: string; body: unknown }> = [];
  for (const keyword of DEFINITION_KEYWORDS) {
    const definitions = root[keyword];
    if (!definitions || typeof definitions !== 'object') continue;
    delete root[keyword];
    for (const [name, body] of Object.entries(definitions)) {
      members.push({ pointer: `#/${keyword}/${escapeJsonPointer(name)}`, base: toComponentName(name), body });
    }
  }

  const rootIsReferenced = containsRootRef(root) || members.some(member => containsRootRef(member.body));
  if (rootIsReferenced) members.push({ pointer: '#', base: 'Schema', body: root });
  if (members.length === 0) return schema;

  const names = members.map(member => member.base);
  const suffixes = members.map(() => 1);
  const rewrite = (ref: string) => {
    for (let i = 0; i < members.length; i++) {
      const { pointer } = members[i]!;
      if (ref === pointer) return componentRef(names[i]!);
      if (pointer !== '#' && ref.startsWith(`${pointer}/`)) return componentRef(names[i]!) + ref.slice(pointer.length);
    }
    return ref;
  };

  // Pick names until every definition either takes a free name or matches the identical
  // schema already registered under that name. Bodies are compared after ref rewriting, so a
  // recursive definition only matches an existing one with the same shape.
  let bodies: string[];
  for (;;) {
    bodies = members.map(member => JSON.stringify(rewriteRefs(member.body, rewrite)));
    const taken = new Set<string>();
    let conflict = false;
    members.forEach((_, i) => {
      const name = names[i]!;
      const existing = components[name];
      if (taken.has(name) || (existing !== undefined && JSON.stringify(existing) !== bodies[i])) {
        suffixes[i]! += 1;
        names[i] = `${members[i]!.base}_${suffixes[i]}`;
        conflict = true;
      }
      taken.add(name);
    });
    if (!conflict) break;
  }

  members.forEach((_, i) => {
    components[names[i]!] ??= JSON.parse(bodies[i]!);
  });

  return rootIsReferenced ? { $ref: componentRef(names[names.length - 1]!) } : rewriteRefs(root, rewrite);
}

function toComponentSchema(schema: PublicSchema<unknown>, components?: OpenAPIComponentSchemas): any {
  const jsonSchema = schemaToJsonSchema(schema);
  return components ? hoistSchemaDefinitions(jsonSchema, components) : jsonSchema;
}

function resolveComponentRef(schema: any, components?: OpenAPIComponentSchemas): any {
  if (!components) return schema;
  const prefix = '#/components/schemas/';
  if (typeof schema?.$ref !== 'string' || !schema.$ref.startsWith(prefix)) return schema;
  return components[schema.$ref.slice(prefix.length).replace(/~1/g, '/').replace(/~0/g, '~')] ?? schema;
}

/**
 * Converts an OpenAPI route spec with PublicSchema to one with JSON Schema
 */
function convertToJsonSchema(spec: OpenAPIRoute, components?: OpenAPIComponentSchemas): any {
  const converted: any = {
    summary: spec.summary,
    description: spec.description,
    tags: spec.tags,
    deprecated: spec.deprecated,
    responses: {},
  };

  const parameters: any[] = [];

  // Convert path parameters
  if (spec.requestParams?.path) {
    const pathSchema = resolveComponentRef(toComponentSchema(spec.requestParams.path, components), components);
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
    const querySchema = resolveComponentRef(toComponentSchema(spec.requestParams.query, components), components);
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
          schema: toComponentSchema(spec.requestBody.content['application/json'].schema, components),
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
          schema: toComponentSchema(response.content['application/json'].schema, components),
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
  // Use a null-prototype map so that route paths like "__proto__" cannot
  // pollute Object.prototype via the assignment below.
  const paths: Record<string, any> = Object.create(null);
  const componentSchemas = createComponentSchemas();

  // Build paths object from routes
  // Convert Express-style :param to OpenAPI-style {param}
  routes.forEach(route => {
    if (!route.openapi) return;

    const openapiPath = route.path.replace(/:(\w+)/g, '{$1}');
    if (!paths[openapiPath]) {
      paths[openapiPath] = Object.create(null);
    }

    // Convert Zod schemas to JSON Schema
    paths[openapiPath][route.method.toLowerCase()] = convertToJsonSchema(route.openapi, componentSchemas);
  });

  return {
    openapi: '3.1.0',
    info: {
      title: info.title,
      version: info.version,
      description: info.description,
    },
    paths,
    ...(Object.keys(componentSchemas).length > 0 && { components: { schemas: componentSchemas } }),
  };
}

/**
 * Converts custom API routes with DescribeRouteOptions to OpenAPI path entries.
 * The DescribeRouteOptions from hono-openapi extends OpenAPIV3_1.OperationObject,
 * so it already has the standard OpenAPI structure (parameters, requestBody, responses, etc.).
 *
 * @param routes - Array of ApiRoute objects with optional openapi specifications
 * @param componentSchemas - The document's `components.schemas` map. Nested schema definitions are
 * hoisted into it and referenced as `#/components/schemas/<name>`, so the caller must serve it.
 * When omitted, schemas are left as converted (definitions stay nested), so no ref can point at a
 * component the caller never serves. Callers that serve the returned paths in an OpenAPI document
 * should pass a map and emit it as `components.schemas`; otherwise refs stay schema-relative
 * (for example `#/$defs/Invoice`) and do not resolve from the document root.
 * @returns OpenAPI paths object to be merged into the main spec
 */
export function convertCustomRoutesToOpenAPIPaths(
  routes: ApiRoute[],
  componentSchemas?: OpenAPIComponentSchemas,
): Record<string, any> {
  // Null-prototype maps so a route path like "__proto__" can't pollute Object.prototype.
  const paths: Record<string, any> = Object.create(null);
  const hoist = (schema: unknown) => (componentSchemas ? hoistSchemaDefinitions(schema, componentSchemas) : schema);

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
      paths[openapiPath] = Object.create(null);
    }

    const method = route.method.toLowerCase();

    if (isSchemaApiRoute(route)) {
      paths[openapiPath][method] = convertToJsonSchema(route.openapi as OpenAPIRoute, componentSchemas);
      continue;
    }

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
            schema: hoist(zodToJsonSchema(param.schema, 'openApi3', 'none')),
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
              schema: hoist(zodToJsonSchema(mediaContent.schema, 'openApi3', 'none')),
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
                schema: hoist(zodToJsonSchema(mediaContent.schema, 'openApi3', 'none')),
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
