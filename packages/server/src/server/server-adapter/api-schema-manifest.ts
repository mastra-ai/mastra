import type { JSONSchema7 } from '@mastra/schema-compat';
import { schemaToJsonSchema } from './openapi-utils';
import { SERVER_ROUTES } from './routes/index';
import type { ServerRoute } from './routes/index';

export interface ApiSchemaResponseShape {
  kind: 'array' | 'record' | 'object-property' | 'single' | 'unknown';
  listProperty?: string;
  paginationProperty?: string;
}

export interface ApiSchemaManifestRoute {
  method: string;
  path: string;
  responseType: string;
  pathParamSchema?: JSONSchema7;
  queryParamSchema?: JSONSchema7;
  bodySchema?: JSONSchema7;
  responseSchema?: JSONSchema7;
  responseShape: ApiSchemaResponseShape;
}

export interface ApiSchemaManifest {
  version: 1;
  routes: ApiSchemaManifestRoute[];
}

function convertSchema(schema: ServerRoute['bodySchema']): JSONSchema7 | undefined {
  return schema ? schemaToJsonSchema(schema) : undefined;
}

function asJsonSchema(value: unknown): JSONSchema7 | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JSONSchema7) : undefined;
}

function schemaType(schema: JSONSchema7 | undefined): JSONSchema7['type'] | undefined {
  const type = schema?.type;
  return Array.isArray(type) ? type.find(Boolean) : type;
}

function inferResponseShape(responseSchema: JSONSchema7 | undefined): ApiSchemaResponseShape {
  if (!responseSchema) return { kind: 'unknown' };

  const type = schemaType(responseSchema);
  if (type === 'array') return { kind: 'array' };
  if (type !== 'object') return { kind: 'single' };

  const properties =
    responseSchema.properties && !Array.isArray(responseSchema.properties) ? responseSchema.properties : {};
  const propertyNames = Object.keys(properties);
  const paginationProperty = 'page' in properties ? 'page' : 'pagination' in properties ? 'pagination' : undefined;
  const listProperty = Object.entries(properties).find(
    ([, property]) => schemaType(asJsonSchema(property)) === 'array',
  )?.[0];

  if (listProperty && (paginationProperty || propertyNames.length <= 2)) {
    return { kind: 'object-property', listProperty, paginationProperty };
  }
  if (responseSchema.additionalProperties && propertyNames.length === 0) return { kind: 'record' };
  return { kind: 'single' };
}

function isManifestRoute(route: ServerRoute): boolean {
  return route.responseType === 'json' && !route.deprecated;
}

export function buildApiSchemaManifest(routes: readonly ServerRoute[] = SERVER_ROUTES): ApiSchemaManifest {
  return {
    version: 1,
    routes: routes.filter(isManifestRoute).map(route => {
      const responseSchema = convertSchema(route.responseSchema);
      return {
        method: route.method,
        path: route.path,
        responseType: route.responseType,
        pathParamSchema: convertSchema(route.pathParamSchema),
        queryParamSchema: convertSchema(route.queryParamSchema),
        bodySchema: convertSchema(route.bodySchema),
        responseSchema,
        responseShape: inferResponseShape(responseSchema),
      };
    }),
  };
}
