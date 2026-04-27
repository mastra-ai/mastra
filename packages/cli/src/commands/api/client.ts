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
    const url = buildUrl(
      options.baseUrl,
      options.descriptor.path,
      options.pathParams,
      options.descriptor.method,
      options.input,
    );
    const init: RequestInit = {
      method: options.descriptor.method,
      headers: { ...options.headers },
      signal: controller.signal,
    };

    if (options.descriptor.method !== 'GET' && options.input) {
      init.headers = { 'content-type': 'application/json', ...init.headers };
      init.body = JSON.stringify(options.input);
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
    throw toApiCliError(error);
  } finally {
    clearTimeout(timeout);
  }
}

export function buildUrl(
  baseUrl: string,
  path: string,
  pathParams: Record<string, string>,
  method: string,
  input?: Record<string, unknown>,
): string {
  const pathParamNames = new Set<string>();
  const resolvedPath = path.replace(/:([A-Za-z0-9_]+)/g, (_, name: string) => {
    pathParamNames.add(name);
    return encodeURIComponent(pathParams[name] ?? '');
  });
  const url = new URL(joinUrl(baseUrl, resolvedPath));

  for (const [key, value] of Object.entries(pathParams)) {
    if (!pathParamNames.has(key)) url.searchParams.set(key, value);
  }

  if (method === 'GET' && input) {
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
  }

  return url.toString();
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
