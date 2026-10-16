import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';

import { isServerProblem } from '../../error-codes';
import { formatErrorResponse } from '../index';
import { A2A_ROUTES } from './a2a';
import type { ServerRoute } from '.';
import { SERVER_ROUTES } from '.';

const NON_JSON_RESPONSE_TYPES = new Set(['stream', 'datastream-response', 'mcp-http', 'mcp-sse']);
const a2aRoutes = new Set<unknown>(A2A_ROUTES);

const jsonRoutes = SERVER_ROUTES.filter(
  route => !NON_JSON_RESPONSE_TYPES.has(route.responseType) && !a2aRoutes.has(route) && !route.deprecated,
);

const noopLogger = new Proxy({}, { get: () => () => {} });

/** A member whose calls throw, and whose own members (e.g. `mastra.schedules.get`) behave the same way. */
function createFailingMember(): unknown {
  return new Proxy(
    () => {
      throw new Error('mastra unavailable');
    },
    { get: (_target, prop) => (prop === 'then' ? undefined : createFailingMember()) },
  );
}

/** A Mastra instance where every call fails (except logging), so each handler takes its error path. */
function createFailingMastra(): Mastra {
  return new Proxy({} as Mastra, {
    get: (_target, prop) => {
      if (prop === 'then') return undefined;
      if (prop === 'getLogger') return () => noopLogger;
      return createFailingMember();
    },
  });
}

function pathParams(route: ServerRoute): Record<string, string> {
  const params: Record<string, string> = {};
  for (const match of route.path.matchAll(/:(\w+)/g)) {
    params[match[1]!] = 'does-not-exist';
  }
  return params;
}

async function runRoute(route: ServerRoute): Promise<unknown> {
  try {
    await Promise.race([
      route.handler({
        ...pathParams(route),
        mastra: createFailingMastra(),
        requestContext: new RequestContext(),
        abortSignal: new AbortController().signal,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
    ]);
    return undefined;
  } catch (error) {
    return error;
  }
}

describe('error code contract', () => {
  it('covers the JSON routes', () => {
    expect(jsonRoutes.length).toBeGreaterThan(100);
  });

  it.each(jsonRoutes.map(route => [`${route.method} ${route.path}`, route] as const))(
    '%s returns a catalog problem when it fails',
    async (_name, route) => {
      const error = await runRoute(route);
      if (error === undefined) return;

      const { body } = formatErrorResponse(error);
      expect(isServerProblem(body.problem)).toBe(true);
      expect(body.problem.code).not.toBe('UNEXPECTED_ERROR');
    },
  );
});
