import type { ApiCommandDescriptor } from './commands.js';
import { ApiCliError, toApiCliError } from './errors.js';

export interface ApiRequestOptions {
  baseUrl: string;
  headers: Record<string, string>;
  timeoutMs: number;
  descriptor: ApiCommandDescriptor;
  pathParams: Record<string, string>;
  input?: Record<string, unknown>;
}

export async function requestApi(options: ApiRequestOptions): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const { queryInput, bodyInput } = splitInput(options.descriptor, options.input);
    const url = buildUrl(options.baseUrl, options.descriptor.path, options.pathParams, queryInput);
    const init: RequestInit = {
      method: options.descriptor.method,
      headers: { ...options.headers },
      signal: controller.signal,
    };

    if (options.descriptor.method !== 'GET' && bodyInput) {
      init.headers = { 'content-type': 'application/json', ...init.headers };
      init.body = JSON.stringify(bodyInput);
    }

    const response = await fetch(url, init);
    const body = await parseResponse(response);

    if (!response.ok) {
      throw new ApiCliError('HTTP_ERROR', `Request failed with status ${response.status}`, {
        status: response.status,
        body,
      });
    }

    return body;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiCliError('REQUEST_TIMEOUT', `Request timed out after ${options.timeoutMs}ms`, {
        timeoutMs: options.timeoutMs,
      });
    }
    throw toApiCliError(error);
  } finally {
    clearTimeout(timeout);
  }
}

export function buildUrl(
  baseUrl: string,
  path: string,
  pathParams: Record<string, string>,
  input?: Record<string, unknown>,
): string {
  const pathParamNames = new Set<string>();
  const resolvedPath = path.replace(/:([A-Za-z0-9_]+)/g, (_, name: string) => {
    pathParamNames.add(name);
    const value = pathParams[name];
    if (!value) {
      throw new ApiCliError('MISSING_ARGUMENT', `Missing required argument <${name}>`, { argument: name });
    }
    return encodeURIComponent(value);
  });
  const url = new URL(joinUrl(baseUrl, resolvedPath));

  for (const [key, value] of Object.entries(pathParams)) {
    if (!pathParamNames.has(key)) url.searchParams.set(key, value);
  }

  if (input) {
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
  }

  return url.toString();
}

export function splitInput(
  descriptor: ApiCommandDescriptor,
  input?: Record<string, unknown>,
): { queryInput?: Record<string, unknown>; bodyInput?: Record<string, unknown> } {
  if (!input) return {};
  if (descriptor.method === 'GET') return { queryInput: input };

  const normalizedInput = normalizeInput(descriptor, input);
  const queryParamNames = new Set(descriptor.queryParams);
  const bodyParamNames = new Set(descriptor.bodyParams);
  if (queryParamNames.size === 0) return { bodyInput: normalizedInput };

  const queryInput: Record<string, unknown> = {};
  const bodyInput: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(normalizedInput)) {
    if (queryParamNames.has(key) && !bodyParamNames.has(key)) {
      queryInput[key] = value;
    } else {
      bodyInput[key] = value;
    }
  }

  return {
    queryInput: Object.keys(queryInput).length ? queryInput : undefined,
    bodyInput: Object.keys(bodyInput).length ? bodyInput : undefined,
  };
}

function normalizeInput(descriptor: ApiCommandDescriptor, input: Record<string, unknown>): Record<string, unknown> {
  if ((descriptor.key === 'toolExecute' || descriptor.key === 'mcpToolExecute') && !Object.hasOwn(input, 'data')) {
    return { data: input };
  }

  return input;
}

export async function fetchSchemaManifest(
  baseUrl: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<any> {
  const descriptor: ApiCommandDescriptor = {
    key: 'schema',
    name: 'system api-schema',
    description: 'Fetch API schema manifest',
    method: 'GET',
    path: '/system/api-schema',
    positionals: [],
    acceptsInput: false,
    inputRequired: false,
    list: false,
    responseShape: { kind: 'single' },
    queryParams: [],
    bodyParams: [],
  };
  return requestApi({ baseUrl, headers, timeoutMs, descriptor, pathParams: {} });
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (normalizedBase.endsWith('/api')) return `${normalizedBase}${normalizedPath}`;
  return `${normalizedBase}/api${normalizedPath}`;
}
