import type { ToolsInput } from '@mastra/core/agent';
import { MASTRA_AUTH_TOKEN_KEY } from '@mastra/core/request-context';
import type { RequestContext } from '@mastra/core/request-context';
import { toStandardSchema } from '@mastra/core/schema';
import { createTool } from '@mastra/core/tools';

import { MASTRA_API_OPERATIONS } from './mastra-api-operations.generated';
import { MCPServer } from './server';

type JsonObject = Record<string, unknown>;

interface ApiSchemaRoute {
  method: string;
  path: string;
  pathParamSchema?: JsonObject;
  queryParamSchema?: JsonObject;
  bodySchema?: JsonObject;
}

/** Options for creating an MCP server that controls a remote Mastra server. */
export interface MastraApiMCPServerOptions {
  /** Base URL of the target Mastra server. */
  url: string | URL;
  /** Headers used to read the API schema and as a fallback for tool calls. */
  headers?: Record<string, string>;
  /** Mastra API prefix. Defaults to `/api`. */
  apiPrefix?: string;
  /** Request timeout in milliseconds. Defaults to two minutes. */
  timeoutMs?: number;
  /** Fetch implementation. Defaults to the global fetch implementation. */
  fetch?: typeof globalThis.fetch;
  /** MCP server identifier. Defaults to `mastra-api`. */
  id?: string;
  /** MCP server display name. Defaults to `Mastra Server`. */
  name?: string;
  /** MCP server version. Defaults to `1.0.0`. */
  version?: string;
}

interface MastraApiRequesterOptions {
  baseUrl: string;
  apiPrefix: string;
  headers: Record<string, string>;
  timeoutMs: number;
  fetch: typeof globalThis.fetch;
}

class MastraApiRequester {
  constructor(private readonly options: MastraApiRequesterOptions) {}

  async getSchemaManifest(): Promise<ApiSchemaRoute[]> {
    const value = await this.request(
      {
        method: 'GET',
        path: '/system/api-schema',
        pathParamSchema: undefined,
        queryParamSchema: undefined,
        bodySchema: undefined,
      },
      {},
    );

    if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.routes)) {
      throw new Error(
        'The Mastra server returned an invalid API schema manifest. Confirm that the target server supports GET /api/system/api-schema.',
      );
    }

    const routes = value.routes.filter(isApiSchemaRoute);
    if (routes.length !== value.routes.length) {
      throw new Error('The Mastra server API schema manifest contains an invalid route definition.');
    }

    return routes;
  }

  async request(
    route: ApiSchemaRoute,
    input: Record<string, unknown>,
    authInfo?: unknown,
    requestSignal?: AbortSignal,
  ): Promise<unknown> {
    const pathParams = schemaPropertyNames(route.pathParamSchema);
    const queryParams = new Set(schemaPropertyNames(route.queryParamSchema));
    const bodyParams = new Set(schemaPropertyNames(route.bodySchema));
    const remainingInput = { ...input };
    let path = route.path;

    for (const name of pathParams) {
      const value = remainingInput[name];
      if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`The ${name} argument must be a non-empty string.`);
      }
      path = path.replace(`:${name}`, encodeURIComponent(value));
      delete remainingInput[name];
    }

    const url = new URL(joinUrl(this.options.baseUrl, this.options.apiPrefix, path));
    const body: Record<string, unknown> = {};

    for (const [name, value] of Object.entries(remainingInput)) {
      if (value === undefined || value === null) continue;

      if (route.method === 'GET' || (queryParams.has(name) && !bodyParams.has(name))) {
        url.searchParams.set(name, typeof value === 'object' ? JSON.stringify(value) : String(value));
      } else {
        body[name] = value;
      }
    }

    const headers = new Headers(this.options.headers);
    headers.set('accept', 'application/json');
    const callerToken = getAuthToken(authInfo);
    if (callerToken) headers.set('authorization', `Bearer ${callerToken}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('request timed out')), this.options.timeoutMs);
    const abortRequest = () => controller.abort(requestSignal?.reason);
    if (requestSignal?.aborted) {
      abortRequest();
    } else {
      requestSignal?.addEventListener('abort', abortRequest, { once: true });
    }

    try {
      const hasBody = route.method !== 'GET' && route.bodySchema !== undefined;
      if (hasBody) headers.set('content-type', 'application/json');

      const response = await this.options.fetch(url, {
        method: route.method,
        headers,
        signal: controller.signal,
        ...(hasBody ? { body: JSON.stringify(body) } : {}),
      });
      const responseBody = await readResponseBody(response);

      if (!response.ok) {
        const detail = getErrorDetail(responseBody);
        throw new Error(
          `Mastra API request ${route.method} ${route.path} failed with status ${response.status}${detail ? `: ${detail}` : '.'}`,
        );
      }

      return responseBody;
    } catch (error) {
      if (controller.signal.aborted) {
        if (requestSignal?.aborted) {
          throw new Error(`Mastra API request ${route.method} ${route.path} was canceled.`, { cause: error });
        }
        throw new Error(
          `Mastra API request ${route.method} ${route.path} timed out after ${this.options.timeoutMs}ms.`,
          { cause: error },
        );
      }
      if (error instanceof Error && error.message.startsWith('Mastra API request ')) throw error;
      throw new Error(
        `Could not reach the Mastra server at ${this.options.baseUrl}. Check the server URL and network access.`,
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
      requestSignal?.removeEventListener('abort', abortRequest);
    }
  }
}

/**
 * An MCP server that exposes the Mastra API CLI operations from a remote Mastra server.
 *
 * The factory reads the target server's schema manifest, registers the CLI operations
 * supported by that server, and uses the route schemas as MCP tool input schemas.
 */
export class MastraApiMCPServer extends MCPServer {
  private constructor(options: MastraApiMCPServerOptions, tools: ToolsInput) {
    super({
      id: options.id ?? 'mastra-api',
      name: options.name ?? 'Mastra Server',
      version: options.version ?? '1.0.0',
      description: 'Inspect and operate a Mastra server.',
      instructions:
        'Inspect resources before using them. Pass tool input inside the data field for tool_execute and mcp_tool_execute. Ask for confirmation before calling a tool marked as destructive.',
      protocolVersion: '2026-07-28',
      tools,
    });
  }

  /** Creates a stateless MCP server for the target Mastra server. */
  static async create(options: MastraApiMCPServerOptions): Promise<MastraApiMCPServer> {
    const requester = new MastraApiRequester(normalizeOptions(options));
    const routes = await requester.getSchemaManifest();
    const tools = createApiTools(routes, requester);

    if (Object.keys(tools).length === 0) {
      throw new Error('The target Mastra server does not support any of the MCP server operations.');
    }

    return new MastraApiMCPServer(options, tools);
  }
}

function createApiTools(routes: ApiSchemaRoute[], requester: MastraApiRequester): ToolsInput {
  const tools: ToolsInput = {};

  for (const operation of MASTRA_API_OPERATIONS) {
    const primaryRoute = routes.find(
      candidate => candidate.method === operation.method && candidate.path === operation.path,
    );
    const verboseRoute =
      'verbosePath' in operation
        ? routes.find(candidate => candidate.method === operation.method && candidate.path === operation.verbosePath)
        : undefined;
    const route = primaryRoute ?? verboseRoute;
    if (!route) continue;
    const readOnly = operation.method === 'GET';

    tools[operation.name] = createTool({
      id: operation.name,
      description: operation.description,
      inputSchema: toStandardSchema<Record<string, unknown>>(
        mergeInputSchemas(route, primaryRoute !== undefined && verboseRoute !== undefined),
      ),
      mcp: {
        annotations: {
          title: operation.description,
          readOnlyHint: readOnly,
          destructiveHint: operation.destructive,
          idempotentHint: readOnly || operation.method === 'DELETE',
          openWorldHint: true,
        },
      },
      execute: async (input, context) => {
        let requestInput = input;
        let selectedRoute = route;
        if (primaryRoute && verboseRoute) {
          const { verbose, ...inputWithoutVerbose } = input;
          requestInput = inputWithoutVerbose;
          if (verbose === true) selectedRoute = verboseRoute;
        }
        return requester.request(
          selectedRoute,
          requestInput,
          context.mcp?.extra.authInfo ?? getRequestAuthInfo(context.requestContext),
          context.abortSignal ?? context.mcp?.extra.signal,
        );
      },
    });
  }

  return tools;
}

function normalizeOptions(options: MastraApiMCPServerOptions): MastraApiRequesterOptions {
  let url: URL;
  try {
    url = new URL(options.url);
  } catch (error) {
    throw new Error('The Mastra server URL must be a valid absolute URL.', { cause: error });
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('The Mastra server URL must use HTTP or HTTPS.');
  }
  if (url.username || url.password) {
    throw new Error('The Mastra server URL cannot contain credentials. Use the headers option for authentication.');
  }
  if (url.search || url.hash) {
    throw new Error('The Mastra server URL cannot contain a query string or fragment.');
  }

  const apiPrefix = normalizeApiPrefix(options.apiPrefix ?? '/api');
  const timeoutMs = options.timeoutMs ?? 120_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('The request timeout must be a positive integer in milliseconds.');
  }
  return {
    baseUrl: url.toString().replace(/\/$/, ''),
    apiPrefix,
    headers: { ...options.headers },
    timeoutMs,
    fetch: options.fetch ?? globalThis.fetch,
  };
}

function normalizeApiPrefix(value: string): string {
  if (value.includes('..') || value.includes('?') || value.includes('#')) {
    throw new Error('The Mastra API prefix cannot contain "..", a query string, or a fragment.');
  }
  if (value === '' || value === '/') return '';
  return `/${value.replace(/^\/+|\/+$/g, '')}`;
}

function joinUrl(baseUrl: string, apiPrefix: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!apiPrefix || baseUrl.endsWith(apiPrefix)) return `${baseUrl}${normalizedPath}`;
  return `${baseUrl}${apiPrefix}${normalizedPath}`;
}

function mergeInputSchemas(route: ApiSchemaRoute, supportsVerbose = false): JsonObject {
  const schemas = [route.pathParamSchema, route.queryParamSchema, route.bodySchema].filter(isRecord);
  const properties: JsonObject = {};
  const required = new Set<string>();
  let allowsAdditionalProperties = false;

  for (const schema of schemas) {
    if (isRecord(schema.properties)) Object.assign(properties, schema.properties);
    if (Array.isArray(schema.required)) {
      for (const name of schema.required) {
        if (typeof name === 'string') required.add(name);
      }
    }
    if (schema.additionalProperties === true || isRecord(schema.additionalProperties)) {
      allowsAdditionalProperties = true;
    }
  }

  if (supportsVerbose) {
    properties.verbose = {
      type: 'boolean',
      description: 'Return the full response instead of the lightweight response.',
      default: false,
    };
  }

  return {
    type: 'object',
    properties,
    required: [...required],
    additionalProperties: allowsAdditionalProperties,
  };
}

function schemaPropertyNames(schema: JsonObject | undefined): string[] {
  return isRecord(schema?.properties) ? Object.keys(schema.properties) : [];
}

function isApiSchemaRoute(value: unknown): value is ApiSchemaRoute {
  if (!isRecord(value) || typeof value.method !== 'string' || typeof value.path !== 'string') return false;
  return ['pathParamSchema', 'queryParamSchema', 'bodySchema'].every(
    key => value[key] === undefined || isRecord(value[key]),
  );
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getAuthToken(authInfo: unknown): string | undefined {
  if (!isRecord(authInfo)) return undefined;
  return typeof authInfo.token === 'string' && authInfo.token.length > 0 ? authInfo.token : undefined;
}

function getRequestAuthInfo(requestContext: RequestContext | undefined): unknown {
  const authInfo = requestContext?.get('authInfo');
  if (authInfo !== undefined) return authInfo;

  const token = requestContext?.get(MASTRA_AUTH_TOKEN_KEY);
  return typeof token === 'string' && token.length > 0 ? { token } : undefined;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getErrorDetail(body: unknown): string | undefined {
  if (typeof body === 'string') return body.slice(0, 500);
  if (!isRecord(body)) return undefined;

  const error = isRecord(body.error) ? body.error : body;
  if (typeof error.message === 'string') return error.message.slice(0, 500);
  return JSON.stringify(body).slice(0, 500);
}
