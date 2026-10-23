import { SimpleAuth } from '@mastra/core/server';
import type { MiddlewareHandler } from '@mastra/core/server';
import { timingSafeEqual } from 'node:crypto';
import { serviceLimits } from '../contracts/service-limits.ts';

function accessToken(env: NodeJS.ProcessEnv) {
  const token = env.MASTRA_STUDIO_TOKEN?.trim();
  if (!token) throw new Error('MASTRA_STUDIO_TOKEN_REQUIRED');
  return token;
}

export function studioAuth(env: NodeJS.ProcessEnv = process.env) {
  const token = accessToken(env);
  return new SimpleAuth({ tokens: { [token]: { id: 'operator', role: 'admin' } } });
}

// Require a bearer credential at the template boundary, including through the dev proxy.
export function questionnaireAccess(env: NodeJS.ProcessEnv = process.env, now = Date.now): MiddlewareHandler {
  const credential = Buffer.from(`Bearer ${accessToken(env)}`);
  let mutations: number[] = [];
  return async (c, next) => {
    // Do not accept ambient Studio cookies: browsers attach them to requests automatically.
    const supplied = Buffer.from(c.req.header('Authorization') ?? '');
    if (supplied.length !== credential.length || !timingSafeEqual(supplied, credential))
      return c.json({ error: 'UNAUTHORIZED' }, 401);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
      const time = now();
      mutations = mutations.filter(at => at > time - 60_000);
      if (mutations.length >= serviceLimits.maxMutationsPerMinute)
        return c.json({ error: 'REQUEST_LIMIT' }, 429, { 'Retry-After': '60' });
      mutations.push(time);
    }
    await next();
  };
}
