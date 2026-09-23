import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { format } from 'oxfmt';
import type { FormatConfig } from 'oxfmt';
import type ts from 'typescript-classic';
import type * as z4 from 'zod/v4/core';
import { printNode, zodToTs } from 'zod-to-ts';

import { SERVER_ROUTES } from '../src/server/server-adapter/routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_PATH = path.join(__dirname, '../../../client-sdks/client-js/src/route-types.generated.ts');

const OXFMT_CONFIG = {
  arrowParens: 'avoid',
  bracketSpacing: true,
  endOfLine: 'lf',
  printWidth: 120,
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
  useTabs: false,
} satisfies FormatConfig;

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

type ZodIo = 'input' | 'output';

type RenderState = {
  auxiliaryTypeStore: ReturnType<typeof createAuxiliaryTypeStore>;
  nestedOccurrenceCounts: Map<z4.$ZodType, number>;
  promotedSchemaNames: Map<z4.$ZodType, string | null>;
  promotedTextNames: Map<string, string>;
  promotionInProgress: Set<z4.$ZodType>;
  sharedTypeDeclarations: string[];
  sharedTypeIndex: number;
  renderedSchemaAliases: Map<z4.$ZodType, string>;
  renderedTextAliases: Map<string, string>;
};

function createRenderState(prefix: string): RenderState {
  return {
    auxiliaryTypeStore: createAuxiliaryTypeStore(prefix),
    nestedOccurrenceCounts: new Map(),
    promotedSchemaNames: new Map(),
    promotedTextNames: new Map(),
    promotionInProgress: new Set(),
    sharedTypeDeclarations: [],
    sharedTypeIndex: 0,
    renderedSchemaAliases: new Map(),
    renderedTextAliases: new Map(),
  };
}

function createRenderStates(): Record<ZodIo, RenderState> {
  return {
    input: createRenderState('InputShared'),
    output: createRenderState('Shared'),
  };
}

let renderStates = createRenderStates();
let countingPass = true;

/**
 * Nested shared-schema promotion (two-pass generation).
 *
 * Request schemas use Zod input semantics while response schemas use output
 * semantics. Each I/O mode therefore has independent occurrence, promotion,
 * auxiliary, and alias state so a defaulted schema cannot cause an input alias to
 * reuse its required output representation (or the reverse).
 */
const MIN_SHARED_TYPE_LENGTH = 160;

/**
 * zod-to-ts cannot represent these schema types (their TypeScript type is only known
 * at runtime, e.g. a transform's return value), so we emit `unknown` instead of
 * letting `any` leak into the generated SDK types. Any *new* unrepresentable type
 * not listed here makes zod-to-ts throw at generation time (the default
 * `unrepresentable: 'throw'` behavior), so it gets caught in CI instead of
 * silently widening client types.
 */
const UNREPRESENTABLE_SCHEMA_TYPES = new Set(['transform', 'custom']);

function createSchemaOverrideFunction(io: ZodIo) {
  const state = renderStates[io];

  return (schema: z4.$ZodType, tsLib: typeof ts): ts.TypeNode | undefined => {
    if (UNREPRESENTABLE_SCHEMA_TYPES.has(schema._zod.def.type)) {
      return tsLib.factory.createKeywordTypeNode(tsLib.SyntaxKind.UnknownKeyword);
    }

    if (countingPass) {
      state.nestedOccurrenceCounts.set(schema, (state.nestedOccurrenceCounts.get(schema) ?? 0) + 1);
      return undefined;
    }

    // While a schema's own shared declaration is being rendered, let the default
    // conversion (and the auxiliary store, for recursive schemas) handle it.
    if (state.promotionInProgress.has(schema)) {
      return undefined;
    }

    if ((state.nestedOccurrenceCounts.get(schema) ?? 0) < 2) {
      return undefined;
    }

    let sharedName = state.promotedSchemaNames.get(schema);
    if (sharedName === undefined) {
      state.promotionInProgress.add(schema);
      const { node } = zodToTs(schema, {
        auxiliaryTypeStore: state.auxiliaryTypeStore,
        io,
        overrideFunction: createSchemaOverrideFunction(io),
      });
      state.promotionInProgress.delete(schema);

      const printed = printNode(node);
      if (printed.length < MIN_SHARED_TYPE_LENGTH) {
        sharedName = null;
      } else {
        const existingTextName = state.promotedTextNames.get(printed);
        if (existingTextName) {
          sharedName = existingTextName;
        } else {
          sharedName = `${io === 'input' ? 'InputShared' : 'Shared'}_Type_${state.sharedTypeIndex++}`;
          state.promotedTextNames.set(printed, sharedName);
          state.sharedTypeDeclarations.push(`type ${sharedName} = ${printed};`);
        }
      }
      state.promotedSchemaNames.set(schema, sharedName);
    }

    if (!sharedName) {
      return undefined;
    }

    return tsLib.factory.createTypeReferenceNode(sharedName);
  };
}

/**
 * Many routes share the same Zod schema instance (e.g. one body schema reused by
 * dozens of agent routes). Rendering each occurrence inline is the main source of
 * generated-file bloat, so the first occurrence renders the full type and every
 * later occurrence becomes a one-line alias to it. Aliases are scoped by Zod I/O
 * mode because a schema can have different request-input and response-output types.
 */
function renderSchemaType(aliasName: string, schema: z4.$ZodType, deprecated: boolean, io: ZodIo): string {
  const deprecatedComment = deprecated ? '/** @deprecated */\n' : '';
  const state = renderStates[io];

  const existingAlias = state.renderedSchemaAliases.get(schema);
  if (existingAlias) {
    return `${deprecatedComment}export type ${aliasName} = ${existingAlias};`;
  }

  // Unrepresentable schemas (transforms, customs) are intercepted as `unknown` in
  // createSchemaOverrideFunction; anything unexpected throws at generation time.
  const { node } = zodToTs(schema, {
    auxiliaryTypeStore: state.auxiliaryTypeStore,
    io,
    overrideFunction: createSchemaOverrideFunction(io),
  });

  const printed = printNode(node);
  const existingTextAlias = state.renderedTextAliases.get(printed);
  if (existingTextAlias) {
    state.renderedSchemaAliases.set(schema, existingTextAlias);
    return `${deprecatedComment}export type ${aliasName} = ${existingTextAlias};`;
  }

  state.renderedSchemaAliases.set(schema, aliasName);
  state.renderedTextAliases.set(printed, aliasName);

  // Auxiliary declarations are collected per I/O mode and emitted once at the top
  // of the generated file instead of inline per alias.
  return `${deprecatedComment}export type ${aliasName} = ${printed};`;
}

function getRoutePart(
  baseName: string,
  kind: Exclude<RouteSchemaKind, 'Request'>,
  schema: z4.$ZodType | undefined,
  deprecated: boolean,
  io: ZodIo,
): GeneratedRoutePart | null {
  if (!schema) {
    return null;
  }

  const aliasName = `${baseName}_${kind}`;
  return {
    aliasName,
    content: renderSchemaType(aliasName, schema, deprecated, io),
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

export type RouteDefinition = (typeof SERVER_ROUTES)[number];

function renderRouteBlock(route: RouteDefinition): string {
  const baseName = getRouteBaseName(route.method, route.path);
  const pathParams = getRoutePart(
    baseName,
    'PathParams',
    route.pathParamSchema as z4.$ZodType | undefined,
    !!route.deprecated,
    'input',
  );
  const queryParams = getRoutePart(
    baseName,
    'QueryParams',
    route.queryParamSchema as z4.$ZodType | undefined,
    !!route.deprecated,
    'input',
  );
  const body = getRoutePart(baseName, 'Body', route.bodySchema as z4.$ZodType | undefined, !!route.deprecated, 'input');
  const response = getRoutePart(
    baseName,
    'Response',
    route.responseSchema as z4.$ZodType | undefined,
    !!route.deprecated,
    'output',
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

function renderPathClient(routes: readonly RouteDefinition[]): string {
  const pathMap = new Map<string, PathRouteMethod[]>();

  for (const route of routes) {
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

function generateRouteTypesFileContent(routes: readonly RouteDefinition[]): string {
  const routeBlocks = routes.map(renderRouteBlock).join('\n\n');
  const routeMapEntries = routes
    .map(route => {
      const routeKey = `${route.method} ${route.path}`;
      const contractName = `${getRouteBaseName(route.method, route.path)}_RouteContract`;
      return `  ${JSON.stringify(routeKey)}: ${contractName};`;
    })
    .join('\n');
  const clientInterface = renderPathClient(routes);

  const auxiliaryDeclarations = (['input', 'output'] as const)
    .flatMap(io => [...renderStates[io].auxiliaryTypeStore.definitions.values()])
    .map(definition => printNode(definition.node))
    .join('\n\n');

  const sharedDeclarations = (['input', 'output'] as const)
    .flatMap(io => renderStates[io].sharedTypeDeclarations)
    .join('\n\n');

  return `/**
 * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
 *
 * Generated by packages/server/scripts/generate-route-types.ts
 * Run \`pnpm generate:route-types\` from packages/server to regenerate.
 */

export type Simplify<T> = { [K in keyof T]: T[K] } & {};

${auxiliaryDeclarations}

${sharedDeclarations}

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
  const result = await format(OUTPUT_PATH, fileContent, OXFMT_CONFIG);

  if (result.errors.length > 0) {
    throw new Error(
      result.errors
        .map(error => [error.message, error.codeframe, error.helpMessage].filter(Boolean).join('\n'))
        .join('\n\n'),
    );
  }

  return result.code;
}

export function renderRouteTypesFileContent(routes: readonly RouteDefinition[] = SERVER_ROUTES): string {
  // Pass 1: convert everything once purely to count nested schema instance reuse.
  renderStates = createRenderStates();
  countingPass = true;
  generateRouteTypesFileContent(routes);

  // Pass 2: real generation, extracting schemas seen more than once into shared types.
  const inputOccurrenceCounts = renderStates.input.nestedOccurrenceCounts;
  const outputOccurrenceCounts = renderStates.output.nestedOccurrenceCounts;
  renderStates = createRenderStates();
  renderStates.input.nestedOccurrenceCounts = inputOccurrenceCounts;
  renderStates.output.nestedOccurrenceCounts = outputOccurrenceCounts;
  countingPass = false;
  const rawFileContent = generateRouteTypesFileContent(routes);

  // Strip `[x: string]: never` index signatures emitted by zod-to-ts for `.strict()` schemas.
  // These conflict with concrete properties under `strict: true` in tsconfig, producing
  // TS errors like "Property 'modelId' of type 'string' is not assignable to 'string' index type 'never'".
  return rawFileContent.replace(/\[x:\s*string\]:\s*never;?\s*\n?/g, '');
}

async function main(): Promise<void> {
  const fileContent = await formatGeneratedFileContent(renderRouteTypesFileContent());
  const existingFileContent = fs.existsSync(OUTPUT_PATH) ? fs.readFileSync(OUTPUT_PATH, 'utf8') : null;

  if (existingFileContent !== fileContent) {
    fs.writeFileSync(OUTPUT_PATH, fileContent);
  }

  console.info(`✓ Generated ${OUTPUT_PATH}`);
  console.info(`  - ${SERVER_ROUTES.length} routes`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  void main();
}
