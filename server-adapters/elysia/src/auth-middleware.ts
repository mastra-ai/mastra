import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { coreAuthMiddleware } from '@mastra/server/auth';

export interface ElysiaAuthMiddlewareOptions {
  mastra: Mastra;
  requiresAuth?: boolean;
}

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
    customRouteAuthConfig.set(`${method}:${path}`, true);

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
      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: { ...result.headers, 'Content-Type': 'application/json' },
      });
    }

    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) {
        if (key.toLowerCase() === 'set-cookie') {
          // Elysia overwrites set.headers['set-cookie'] when serializing ctx.cookie,
          // so register the refreshed cookie in the cookie jar instead.
          // Raw set-cookie headers from earlier hooks move into the jar too, so they survive.
          const existing = ctx.set.headers['set-cookie'];
          delete ctx.set.headers['set-cookie'];
          ctx.set.cookie ??= {};
          for (const raw of [...[existing ?? []].flat(), value]) {
            const cookie = parseSetCookie(raw);
            if (cookie) ctx.set.cookie[cookie.name] = cookie.options;
          }
        } else {
          ctx.set.headers[key] = value;
        }
      }
    }
  };
}

function parseSetCookie(header: string): { name: string; options: Record<string, unknown> } | undefined {
  const [pair = '', ...attributes] = header.split(';');
  const separator = pair.indexOf('=');
  if (separator <= 0) return undefined;

  const name = pair.slice(0, separator).trim();
  // Identity encoding keeps the provider's already-encoded value byte-for-byte.
  const options: Record<string, unknown> = { value: pair.slice(separator + 1).trim(), encode: (v: string) => v };

  for (const attribute of attributes) {
    const [rawKey = '', ...rest] = attribute.split('=');
    const attrValue = rest.join('=').trim();
    switch (rawKey.trim().toLowerCase()) {
      case 'path':
        options.path = attrValue;
        break;
      case 'domain':
        options.domain = attrValue;
        break;
      case 'max-age':
        options.maxAge = Number(attrValue);
        break;
      case 'expires':
        options.expires = new Date(attrValue);
        break;
      case 'samesite':
        options.sameSite = attrValue.toLowerCase();
        break;
      case 'priority':
        options.priority = attrValue.toLowerCase();
        break;
      case 'httponly':
        options.httpOnly = true;
        break;
      case 'secure':
        options.secure = true;
        break;
      case 'partitioned':
        options.partitioned = true;
        break;
    }
  }

  return { name, options };
}
