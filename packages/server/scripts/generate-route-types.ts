import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import prettier from 'prettier';
import type * as z4 from 'zod/v4/core';
import { printNode, zodToTs } from 'zod-to-ts';

import { SERVER_ROUTES } from '../src/server/server-adapter/routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_PATH = path.join(__dirname, '../../../client-sdks/client-js/src/route-types.generated.ts');

type RouteSchemaKind = 'PathParams' | 'QueryParams' | 'Body' | 'Response' | 'Request';

type GeneratedRoutePart = {
  aliasName: string;
  content: string;
};

type PathRouteMethod = {
  method: string;
  routeKey: string;
  contractName: string;
};

function toPascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function getRouteBaseName(method: string, routePath: string): string {
  const segments = routePath
    .split('/')
    .filter(Boolean)
    .map(segment => segment.replace(/^:/, ''));

  return [toPascalCase(method.toLowerCase()), ...segments.map(toPascalCase)].join('') || 'Route';
}

function createAuxiliaryTypeStore(prefix: string) {
  let index = 0;

  return {
    nextId: () => `${prefix}_Auxiliary_${index++}`,
    definitions: new Map(),
  };
}

function renderSchemaType(aliasName: string, schema: z4.$ZodType, deprecated: boolean): string {
  const auxiliaryTypeStore = createAuxiliaryTypeStore(aliasName);
  const { node } = zodToTs(schema, {
    auxiliaryTypeStore,
    unrepresentable: 'any',
    io: 'output',
  });

  const auxiliaryDeclarations = [...auxiliaryTypeStore.definitions.values()]
    .map(definition => printNode(definition.node))
    .join('\n\n');

  const aliasDeclaration = `${deprecated ? '/** @deprecated */\n' : ''}export type ${aliasName} = ${printNode(node)};`;

  return auxiliaryDeclarations ? `${auxiliaryDeclarations}\n\n${aliasDeclaration}` : aliasDeclaration;
}

function getRoutePart(
  baseName: string,
  kind: Exclude<RouteSchemaKind, 'Request'>,
  schema: z4.$ZodType | undefined,
  deprecated: boolean,
): GeneratedRoutePart | null {
  if (!schema) {
    return null;
  }

  const aliasName = `${baseName}_${kind}`;
  return {
    aliasName,
    content: renderSchemaType(aliasName, schema, deprecated),
  };
}

function getRouteMapTypeName(part: GeneratedRoutePart | null): string {
  return part?.aliasName ?? 'never';
}

function renderRequestType(
  aliasName: string,
  pathParams: GeneratedRoutePart | null,
  queryParams: GeneratedRoutePart | null,
  body: GeneratedRoutePart | null,
  deprecated: boolean,
): string {
  const pathParamsType = getRouteMapTypeName(pathParams);
  const queryParamsType = getRouteMapTypeName(queryParams);
  const bodyType = getRouteMapTypeName(body);

  return `${deprecated ? '/** @deprecated */\n' : ''}export type ${aliasName} = Simplify<
  (${pathParamsType} extends never ? {} : { params: ${pathParamsType} }) &
    (${queryParamsType} extends never
      ? {}
      : {} extends ${queryParamsType}
        ? { query?: ${queryParamsType} }
        : { query: ${queryParamsType} }) &
    (${bodyType} extends never ? {} : {} extends ${bodyType} ? { body?: ${bodyType} } : { body: ${bodyType} })
>;`;
}

function renderRouteBlock(route: (typeof SERVER_ROUTES)[number]): string {
  const baseName = getRouteBaseName(route.method, route.path);
  const pathParams = getRoutePart(
    baseName,
    'PathParams',
    route.pathParamSchema as z4.$ZodType | undefined,
    !!route.deprecated,
  );
  const queryParams = getRoutePart(
    baseName,
    'QueryParams',
    route.queryParamSchema as z4.$ZodType | undefined,
    !!route.deprecated,
  );
  const body = getRoutePart(baseName, 'Body', route.bodySchema as z4.$ZodType | undefined, !!route.deprecated);
  const response = getRoutePart(
    baseName,
    'Response',
    route.responseSchema as z4.$ZodType | undefined,
    !!route.deprecated,
  );
  const requestAliasName = `${baseName}_Request`;
  const request = {
    aliasName: requestAliasName,
    content: renderRequestType(requestAliasName, pathParams, queryParams, body, !!route.deprecated),
  };
  const routeKey = `${route.method} ${route.path}`;
  const routeParts = [pathParams, queryParams, body, response, request].filter((part): part is GeneratedRoutePart =>
    Boolean(part),
  );
  const deprecatedComment = route.deprecated ? '/** @deprecated */\n' : '';

  const declarations = routeParts.length > 0 ? `${routeParts.map(part => part.content).join('\n\n')}\n\n` : '';

  return `// ============================================================================\n// Route: ${routeKey}\n// ============================================================================\n${declarations}${deprecatedComment}export interface ${baseName}_RouteContract {\n  pathParams: ${getRouteMapTypeName(pathParams)};\n  queryParams: ${getRouteMapTypeName(queryParams)};\n  body: ${getRouteMapTypeName(body)};\n  request: ${requestAliasName};\n  response: ${getRouteMapTypeName(response) === 'never' ? 'unknown' : getRouteMapTypeName(response)};\n  responseType: '${route.responseType}';\n}`;
}

function renderPathClient(): string {
  const pathMap = new Map<string, PathRouteMethod[]>();

  for (const route of SERVER_ROUTES) {
    const methods = pathMap.get(route.path) ?? [];
    methods.push({
      method: route.method,
      routeKey: `${route.method} ${route.path}`,
      contractName: `${getRouteBaseName(route.method, route.path)}_RouteContract`,
    });
    pathMap.set(route.path, methods);
  }

  const lines = ['export interface Client {'];

  for (const [routePath, methods] of [...pathMap.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    lines.push(`  ${JSON.stringify(routePath)}: {`);

    for (const method of [...methods].sort((left, right) => left.method.localeCompare(right.method))) {
      lines.push(`    ${method.method}: ${method.contractName};`);
    }

    lines.push('  };');
  }

  lines.push('}');

  return lines.join('\n');
}

function generateRouteTypesFileContent(): string {
  const routeBlocks = SERVER_ROUTES.map(renderRouteBlock).join('\n\n');
  const routeMapEntries = SERVER_ROUTES.map(route => {
    const routeKey = `${route.method} ${route.path}`;
    const contractName = `${getRouteBaseName(route.method, route.path)}_RouteContract`;
    return `  ${JSON.stringify(routeKey)}: ${contractName};`;
  }).join('\n');
  const clientInterface = renderPathClient();

  return `/**
 * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
 *
 * Generated by packages/server/scripts/generate-route-types.ts
 * Run \`pnpm generate:route-types\` from packages/server to regenerate.
 */

export type Simplify<T> = { [K in keyof T]: T[K] } & {};

${routeBlocks}

// ============================================================================
// Master Route Type Map
// ============================================================================
export interface RouteTypes {
${routeMapEntries}
}

export type RouteKey = keyof RouteTypes;
export type PathParams<K extends RouteKey> = RouteTypes[K]['pathParams'];
export type QueryParams<K extends RouteKey> = RouteTypes[K]['queryParams'];
export type Body<K extends RouteKey> = RouteTypes[K]['body'];
export type RouteRequest<K extends RouteKey> = RouteTypes[K]['request'];
export type RouteResponse<K extends RouteKey> = RouteTypes[K]['response'];
export type RouteResponseType<K extends RouteKey> = RouteTypes[K]['responseType'];

// ============================================================================
// Path-based Client Types
// ============================================================================
${clientInterface}

export type ClientPath = keyof Client;
export type HttpMethod = 'ALL' | 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
export type ClientMethod<P extends ClientPath> = Extract<keyof Client[P], HttpMethod>;
export type ClientRoute<P extends ClientPath, M extends ClientMethod<P>> = Client[P][M];
export type ClientRequest<P extends ClientPath, M extends ClientMethod<P>> = ClientRoute<P, M> extends {
  request: infer Request;
}
  ? Request
  : never;
export type ClientResponse<P extends ClientPath, M extends ClientMethod<P>> = ClientRoute<P, M> extends {
  response: infer Response;
}
  ? Response
  : never;
export type ClientResponseKind<P extends ClientPath, M extends ClientMethod<P>> = ClientRoute<P, M> extends {
  responseType: infer ResponseType;
}
  ? ResponseType
  : never;
`;
}

async function formatGeneratedFileContent(fileContent: string): Promise<string> {
  const prettierConfig = await prettier.resolveConfig(OUTPUT_PATH);

  return prettier.format(fileContent, {
    ...prettierConfig,
    filepath: OUTPUT_PATH,
  });
}

const rawFileContent = generateRouteTypesFileContent();
const fileContent = await formatGeneratedFileContent(rawFileContent);
const existingFileContent = fs.existsSync(OUTPUT_PATH) ? fs.readFileSync(OUTPUT_PATH, 'utf8') : null;

if (existingFileContent !== fileContent) {
  fs.writeFileSync(OUTPUT_PATH, fileContent);
}

console.info(`✓ Generated ${OUTPUT_PATH}`);
console.info(`  - ${SERVER_ROUTES.length} routes`);
