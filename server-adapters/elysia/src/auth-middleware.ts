import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { coreAuthMiddleware, isCustomRoutePublic } from '@mastra/server/auth';
import { serializeCookie } from 'elysia/cookies';

export interface ElysiaAuthMiddlewareOptions {
  mastra: Mastra;
  requiresAuth?: boolean;
}

// Refreshed session headers from an allowed request, applied to the final response by applyAuthRefreshHeaders.
const pendingRefreshHeaders = new WeakMap<Request, Record<string, string>>();

export function createAuthMiddleware({
  mastra,
  requiresAuth = true,
}: ElysiaAuthMiddlewareOptions): (ctx: any) => Promise<globalThis.Response | void> {
  return async (ctx: any) => {
    if (!requiresAuth) {
      return;
    }

    const authConfig = mastra.getServer()?.auth;
    if (!authConfig) {
      return;
    }

    ctx.requestContext ??= new RequestContext();
    ctx.mastra ??= mastra;

    const url = new URL(ctx.request.url);
    const path = url.pathname;
    const method = ctx.request.method;
    const customRouteAuthConfig = new Map<string, boolean>(ctx.customRouteAuthConfig ?? []);
    // Don't reclassify a custom route the app declared public (requiresAuth: false).
    if (!isCustomRoutePublic(path, method, customRouteAuthConfig)) {
      customRouteAuthConfig.set(`${method}:${path}`, true);
    }

    const authHeader = ctx.request.headers.get('authorization');
    let token: string | null = authHeader ? authHeader.replace('Bearer ', '') : null;
    if (!token && ctx.query?.apiKey) {
      token = ctx.query.apiKey;
    }

    const result = await coreAuthMiddleware({
      path,
      method,
      getHeader: name => ctx.request.headers.get(name) || undefined,
      mastra,
      authConfig,
      customRouteAuthConfig,
      requestContext: ctx.requestContext,
      rawRequest: ctx.request,
      token,
      buildAuthorizeContext: () => ctx,
    });

    if (result.action === 'error') {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      appendHeaders(headers, result.headers);
      return new Response(JSON.stringify(result.body), { status: result.status, headers });
    }

    if (result.headers && Object.keys(result.headers).length > 0) {
      pendingRefreshHeaders.set(ctx.request, result.headers);
    }
  };
}

/**
 * Elysia `onAfterHandle` hook that forwards session headers refreshed by `createAuthMiddleware`
 * onto the final response. `Set-Cookie` values are appended alongside any cookies the app set
 * (via `ctx.cookie`, `set.headers`, or a returned `Response`) so none of them are dropped.
 */
export function applyAuthRefreshHeaders(ctx: any): globalThis.Response | void {
  const refreshHeaders = pendingRefreshHeaders.get(ctx.request);
  if (!refreshHeaders) {
    return;
  }
  pendingRefreshHeaders.delete(ctx.request);

  const set = ctx.set;
  const appCookies = takeSetSideCookies(set);
  const response = ctx.response;

  if (response instanceof Response) {
    const headers = new Headers(response.headers);
    for (const cookie of appCookies) {
      headers.append('set-cookie', cookie);
    }
    appendHeaders(headers, refreshHeaders);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }

  const cookies = [...appCookies];
  for (const [key, value] of Object.entries(refreshHeaders)) {
    if (key.toLowerCase() === 'set-cookie') {
      cookies.push(value);
    } else if (set.headers instanceof Headers) {
      set.headers.set(key, value);
    } else {
      set.headers[key] = value;
    }
  }
  if (cookies.length === 0) {
    return;
  }
  if (set.headers instanceof Headers) {
    for (const cookie of cookies) {
      set.headers.append('set-cookie', cookie);
    }
  } else {
    set.headers['set-cookie'] = cookies;
  }
}

function appendHeaders(headers: Headers, extra: Record<string, string> | undefined): void {
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (key.toLowerCase() === 'set-cookie') {
      headers.append(key, value);
    } else {
      headers.set(key, value);
    }
  }
}

/**
 * Removes and returns cookies queued on Elysia's `set` (both `set.cookie` and raw `set-cookie` headers).
 * Elysia overwrites raw `set-cookie` headers with `set.cookie`, and drops set-side cookies when the
 * returned `Response` already has one, so they are collected here and re-emitted explicitly.
 */
function takeSetSideCookies(set: any): string[] {
  const cookies: string[] = [];

  if (set.headers instanceof Headers) {
    cookies.push(...set.headers.getSetCookie());
    set.headers.delete('set-cookie');
  } else if (set.headers) {
    for (const key of Object.keys(set.headers)) {
      if (key.toLowerCase() !== 'set-cookie') continue;
      const value = set.headers[key];
      cookies.push(...(Array.isArray(value) ? value : [value]));
      delete set.headers[key];
    }
  }

  const serialized = serializeCookie(set.cookie);
  if (serialized) {
    cookies.push(...(Array.isArray(serialized) ? serialized : [serialized]));
  }
  for (const key of Object.keys(set.cookie ?? {})) {
    delete set.cookie[key];
  }

  return cookies;
}
