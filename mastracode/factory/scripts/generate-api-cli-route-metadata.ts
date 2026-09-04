import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { z } from 'zod';

import { FACTORY_ROUTE_CONTRACTS } from '../src/routes/contracts.js';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export const DEFAULT_FACTORY_CLI_METADATA_PATH = resolve(
  rootDir,
  'packages/cli/src/commands/api/factory-route-metadata.generated.ts',
);

type JsonSchema = Record<string, unknown>;
type ResponseShape = {
  kind: 'array' | 'record' | 'object-property' | 'single' | 'unknown';
  listProperty?: string;
  paginationProperty?: string;
};

export function factorySchemaToJsonSchema(schema: z.ZodType | undefined): JsonSchema | undefined {
  return schema ? (z.toJSONSchema(schema, { io: 'input', reused: 'ref' }) as JsonSchema) : undefined;
}

function schemaRecord(value: unknown): JsonSchema | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonSchema) : undefined;
}

function resolveSchema(schema: JsonSchema | undefined, root: JsonSchema): JsonSchema | undefined {
  if (!schema) return undefined;
  const ref = schema.$ref;
  if (typeof ref === 'string' && ref.startsWith('#/')) {
    const resolved = ref
      .slice(2)
      .split('/')
      .reduce<unknown>((value, part) => schemaRecord(value)?.[part.replaceAll('~1', '/').replaceAll('~0', '~')], root);
    return resolveSchema(schemaRecord(resolved), root);
  }
  for (const keyword of ['anyOf', 'oneOf'] as const) {
    const variants = schema[keyword];
    if (!Array.isArray(variants)) continue;
    const resolved = variants
      .map(variant => resolveSchema(schemaRecord(variant), root))
      .find(variant => variant?.type !== 'null');
    if (resolved) return resolved;
  }
  return schema;
}

function schemaType(schema: JsonSchema | undefined, root: JsonSchema): string | undefined {
  const type = resolveSchema(schema, root)?.type;
  return Array.isArray(type)
    ? type.find(value => typeof value === 'string')
    : typeof type === 'string'
      ? type
      : undefined;
}

export function extractSchemaProperties(schema: JsonSchema | undefined): string[] {
  if (!schema) return [];
  const resolved = resolveSchema(schema, schema);
  const properties = schemaRecord(resolved?.properties);
  return properties ? Object.keys(properties).sort() : [];
}

export function inferFactoryResponseShape(responseSchema: JsonSchema | undefined): ResponseShape {
  if (!responseSchema) return { kind: 'unknown' };
  const resolved = resolveSchema(responseSchema, responseSchema);
  const type = schemaType(resolved, responseSchema);
  if (type === 'array') return { kind: 'array' };
  if (type !== 'object') return { kind: 'single' };

  const properties = schemaRecord(resolved?.properties) ?? {};
  const propertyNames = Object.keys(properties);
  const paginationProperty = 'page' in properties ? 'page' : 'pagination' in properties ? 'pagination' : undefined;
  const listProperty = Object.entries(properties).find(
    ([, property]) => schemaType(schemaRecord(property), responseSchema) === 'array',
  )?.[0];

  if (listProperty && (paginationProperty || propertyNames.length <= 2)) {
    return { kind: 'object-property', listProperty, ...(paginationProperty ? { paginationProperty } : {}) };
  }
  if (resolved?.additionalProperties && propertyNames.length === 0) return { kind: 'record' };
  return { kind: 'single' };
}

export function buildFactoryApiCliArtifact(): string {
  const entries = Object.entries(FACTORY_ROUTE_CONTRACTS)
    .map(([contractKey, contract]) => {
      const pathSchema = factorySchemaToJsonSchema(contract.pathSchema);
      const querySchema = factorySchemaToJsonSchema(contract.querySchema);
      const bodySchema = factorySchemaToJsonSchema(contract.bodySchema);
      const responseSchema = factorySchemaToJsonSchema(contract.responseSchema);
      const routeKey = `${contract.method} ${contract.path}`;
      return {
        routeKey,
        contractKey,
        metadata: {
          contractKey,
          method: contract.method,
          path: contract.path,
          description: contract.description,
          pathParams: [...contract.path.matchAll(/:([A-Za-z0-9_]+)/g)].map(match => match[1]),
          queryParams: extractSchemaProperties(querySchema),
          bodyParams: extractSchemaProperties(bodySchema),
          hasQuery: Boolean(querySchema),
          hasBody: Boolean(bodySchema),
          responseShape: inferFactoryResponseShape(responseSchema),
        },
        schemas: {
          ...(pathSchema ? { path: pathSchema } : {}),
          ...(querySchema ? { query: querySchema } : {}),
          ...(bodySchema ? { body: bodySchema } : {}),
          response: responseSchema,
        },
      };
    })
    .sort((left, right) => left.routeKey.localeCompare(right.routeKey));

  const metadata = Object.fromEntries(entries.map(entry => [entry.routeKey, entry.metadata]));
  const schemas = Object.fromEntries(entries.map(entry => [entry.routeKey, entry.schemas]));
  const catalog = Object.fromEntries(entries.map(entry => [entry.contractKey, entry.routeKey]));

  return (
    '// This file is generated by mastracode/factory/scripts/generate-api-cli-route-metadata.ts. Do not edit by hand.\n\n' +
    `export const FACTORY_API_ROUTE_METADATA = ${JSON.stringify(metadata, null, 2)} as const;\n\n` +
    `export const FACTORY_API_ROUTE_SCHEMAS = ${JSON.stringify(schemas, null, 2)} as const;\n\n` +
    `export const FACTORY_API_ROUTE_CATALOG = ${JSON.stringify(catalog, null, 2)} as const;\n`
  );
}

export function generateFactoryApiCliRouteMetadata({
  outputPath = DEFAULT_FACTORY_CLI_METADATA_PATH,
  check = false,
}: { outputPath?: string; check?: boolean } = {}): void {
  const artifact = buildFactoryApiCliArtifact();
  if (check) {
    let current: string | undefined;
    try {
      current = readFileSync(outputPath, 'utf8');
    } catch {
      // A missing generated file is stale by definition.
    }
    if (current !== artifact) throw new Error(`Factory API CLI metadata is stale: ${outputPath}`);
    return;
  }
  writeFileSync(outputPath, artifact);
}

function parseCliArgs(args: string[]): { outputPath?: string; check: boolean } {
  const outputIndex = args.indexOf('--output');
  return {
    check: args.includes('--check'),
    ...(outputIndex >= 0 && args[outputIndex + 1] ? { outputPath: resolve(args[outputIndex + 1]) } : {}),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateFactoryApiCliRouteMetadata(parseCliArgs(process.argv.slice(2)));
}
