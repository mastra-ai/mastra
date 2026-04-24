import type { Context } from '@loopback/core';
import type { Request, Response, RestApplication } from '@loopback/rest';
import { RequestContext } from '@mastra/core/request-context';

import { MastraLoopbackBindings } from '../bindings.js';
import type { LoopbackMastraBridge, MastraAuthContext } from '../types.js';

export type MergeRequestContextFn = (input: {
  paramsRequestContext?: Record<string, unknown>;
  bodyRequestContext?: Record<string, unknown>;
}) => RequestContext;

export function createMastraRequestContext(input: {
  app: RestApplication;
  mergeRequestContext: MergeRequestContextFn;
  loopbackContext: Context;
  request: Request;
  response: Response;
  queryParams?: Record<string, unknown>;
  body: unknown;
}): RequestContext {
  const requestContext = input.mergeRequestContext({
    paramsRequestContext: extractRequestContext(input.queryParams),
    bodyRequestContext: extractRequestContext(input.body),
  });
  const bridge = createLoopbackBridge(input.app, input.loopbackContext, input.request, input.response);
  requestContext.set('loopback', bridge);
  return requestContext;
}

export function bindRequestContextValues(input: {
  requestContext: Context;
  request: Request;
  abortSignal: AbortSignal;
  mastraRequestContext: RequestContext;
  authContext: MastraAuthContext | undefined;
}): void {
  const bridge = getLoopbackBridge(input.mastraRequestContext);
  if (!bridge) {
    throw new Error('LoopBack bridge was not initialized for the Mastra request context.');
  }

  input.requestContext.bind(MastraLoopbackBindings.REQUEST_CONTEXT).to({
    method: input.request.method,
    path: input.request.path,
    headers: toHeaderRecord(input.request.headers),
    value: input.mastraRequestContext,
    bridge,
  });
  input.requestContext.bind(MastraLoopbackBindings.REQUEST_CONTEXT_VALUE).to(input.mastraRequestContext);
  input.requestContext.bind(MastraLoopbackBindings.AUTH_CONTEXT).to(input.authContext);
  input.requestContext.bind(MastraLoopbackBindings.ABORT_SIGNAL).to(input.abortSignal);
  input.requestContext.bind(MastraLoopbackBindings.BRIDGE).to(bridge);
}

export function extractAuthContext(requestContext: unknown): MastraAuthContext | undefined {
  if (!(requestContext instanceof RequestContext)) {
    return undefined;
  }
  const candidate =
    requestContext.get('auth') ??
    requestContext.get('user') ??
    requestContext.get('session') ??
    requestContext.get('principal') ??
    requestContext.get('identity');

  if (!candidate || typeof candidate !== 'object') {
    return undefined;
  }

  const auth = candidate as Record<string, unknown>;
  const scopes = Array.isArray(auth.scopes) ? auth.scopes.filter(scope => typeof scope === 'string') : undefined;

  return {
    userId: toOptionalString(auth.userId ?? auth.id ?? auth.sub),
    sessionId: toOptionalString(auth.sessionId ?? auth.sid),
    scopes,
    raw: candidate,
  };
}

export function createLoopbackBridge(
  app: RestApplication,
  context: Context,
  request: Request,
  response: Response,
): LoopbackMastraBridge {
  return {
    app,
    context,
    request,
    response,
    resolve: async binding => context.get(binding),
    resolveSync: binding => {
      try {
        return context.getSync(binding);
      } catch {
        return undefined;
      }
    },
    isBound: binding => context.isBound(binding),
  };
}

export function getLoopbackBridge(requestContext: RequestContext): LoopbackMastraBridge | undefined {
  const bridge = requestContext.get('loopback');
  if (!bridge || typeof bridge !== 'object') {
    return undefined;
  }
  return bridge as LoopbackMastraBridge;
}

export function normalizeUrlParams(params: Request['params']): Record<string, string> {
  const entries = Object.entries((params ?? {}) as Record<string, unknown>).flatMap(([key, value]) => {
    if (typeof value === 'string') {
      return [[key, value] as const];
    }
    if (value === undefined || value === null) {
      return [];
    }
    return [[key, String(value)] as const];
  });

  return Object.fromEntries(entries);
}

export function toHeaderRecord(headers: Request['headers']): Record<string, string | string[] | undefined> {
  return headers as Record<string, string | string[] | undefined>;
}

export function getHeaderValue(req: Request, key: string): string | null {
  const value = getHeaderValueOptional(req, key);
  return value ?? null;
}

export function getHeaderValueOptional(req: Request, key: string): string | undefined {
  const normalizedKey = key.toLowerCase();
  const value = req.headers[normalizedKey];
  if (Array.isArray(value)) {
    return value.length > 0 ? (value[0] ?? undefined) : undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value === undefined || value === null) {
    return undefined;
  }
  return String(value);
}

export function getQueryValue(req: Request, key: string): string | null {
  const value = getQueryValueOptional(req, key);
  return value ?? null;
}

export function getQueryValueOptional(req: Request, key: string): string | undefined {
  const value = (req.query as Record<string, unknown> | undefined)?.[key];
  if (Array.isArray(value)) {
    return value.length > 0 ? String(value[0]) : undefined;
  }
  if (value === undefined || value === null) {
    return undefined;
  }
  return String(value);
}

export function buildRequestUrl(req: Request): URL {
  const protocol = getHeaderValue(req, 'x-forwarded-proto') ?? (req.secure ? 'https' : 'http');
  const host = getHeaderValue(req, 'x-forwarded-host') ?? getHeaderValue(req, 'host') ?? 'localhost';
  const path = req.originalUrl || req.url || req.path || '/';
  return new URL(path, `${protocol}://${host}`);
}

export function buildCustomRouteUrl(req: Request, prefix: string | undefined): URL {
  const url = buildRequestUrl(req);
  if (!prefix) {
    return url;
  }

  const normalizedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  if (url.pathname === normalizedPrefix) {
    url.pathname = '/';
    return url;
  }
  if (url.pathname.startsWith(`${normalizedPrefix}/`)) {
    url.pathname = url.pathname.slice(normalizedPrefix.length) || '/';
  }
  return url;
}

export function toWebRequest(req: Request): globalThis.Request {
  const url = buildRequestUrl(req);
  const headers = new Headers();
  for (const [key, value] of Object.entries(toHeaderRecord(req.headers))) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        headers.append(key, entry);
      }
    } else {
      headers.set(key, value);
    }
  }

  const method = req.method.toUpperCase();
  const init: RequestInit = { method, headers };
  if (method !== 'GET' && method !== 'HEAD' && req.body !== undefined) {
    init.body = toRequestBody(req.body);
    if (
      typeof req.body === 'object' &&
      req.body !== null &&
      !headers.has('content-type') &&
      !Buffer.isBuffer(req.body) &&
      !(req.body instanceof Uint8Array)
    ) {
      headers.set('content-type', 'application/json');
    }
  }

  return new Request(url, init);
}

export function toRequestBody(body: unknown): string | Buffer | Uint8Array | URLSearchParams | Blob | FormData {
  if (typeof body === 'string') {
    return body;
  }
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (body instanceof Uint8Array) {
    return body;
  }
  if (body instanceof URLSearchParams) {
    return body;
  }
  if (body instanceof Blob) {
    return body;
  }
  if (body instanceof FormData) {
    return body;
  }
  if (body === undefined || body === null) {
    return '';
  }
  return JSON.stringify(body);
}

function extractRequestContext(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'string') {
    try {
      return toPlainObject(JSON.parse(value));
    } catch {
      return undefined;
    }
  }

  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const contextValue = (value as Record<string, unknown>).requestContext;
  if (typeof contextValue === 'string') {
    try {
      return toPlainObject(JSON.parse(contextValue));
    } catch {
      return undefined;
    }
  }
  return toPlainObject(contextValue);
}

function toPlainObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return undefined;
}
