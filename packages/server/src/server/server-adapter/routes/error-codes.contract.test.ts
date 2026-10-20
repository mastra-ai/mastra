import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

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

const ROUTE_TIMEOUT_MS = 2000;
const TIMED_OUT = Symbol('timed out');

type RouteOutcome = { ok: true } | { ok: false; error: unknown } | { timedOut: true };

async function runRoute(route: ServerRoute): Promise<RouteOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      route.handler({
        ...pathParams(route),
        mastra: createFailingMastra(),
        requestContext: new RequestContext(),
        abortSignal: new AbortController().signal,
      }),
      new Promise<typeof TIMED_OUT>(resolve => {
        timer = setTimeout(() => resolve(TIMED_OUT), ROUTE_TIMEOUT_MS);
      }),
    ]);
    return result === TIMED_OUT ? { timedOut: true } : { ok: true };
  } catch (error) {
    return { ok: false, error };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Routes that legitimately succeed without touching Mastra, so the failing instance never reaches them.
 * Any other route that resolves is swallowing the injected failure.
 */
const ROUTES_THAT_SUCCEED_WITHOUT_MASTRA = new Set<string>([
  // Static data
  'GET /auth/permission-patterns',
  'GET /embedders',
  'GET /system/api-schema',
  // Only reads the logger, which stays usable on the failing instance
  'GET /logs/transports',
  // Fall back to "memory not configured" defaults when the agent can't be resolved
  'GET /memory/config',
  'GET /memory/threads/:threadId/working-memory',
]);

const routeName = (route: ServerRoute) => `${route.method} ${route.path}`;

describe('error code contract', () => {
  // Routes that call external services (e.g. skills.sh) must fail too, and must not hit the network.
  beforeAll(() => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('network unavailable')));
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('covers the JSON routes', () => {
    expect(jsonRoutes.length).toBeGreaterThan(100);
  });

  it('only lists existing JSON routes as succeeding without Mastra', () => {
    const names = new Set(jsonRoutes.map(routeName));
    expect([...ROUTES_THAT_SUCCEED_WITHOUT_MASTRA].filter(name => !names.has(name))).toEqual([]);
  });

  it.each(jsonRoutes.map(route => [routeName(route), route] as const))(
    '%s returns a catalog problem when it fails',
    async (name, route) => {
      const outcome = await runRoute(route);
      if ('timedOut' in outcome) {
        expect.fail(`${name} neither resolved nor rejected within ${ROUTE_TIMEOUT_MS}ms`);
      }
      if (outcome.ok) {
        expect(ROUTES_THAT_SUCCEED_WITHOUT_MASTRA.has(name), `${name} resolved despite a failing Mastra`).toBe(true);
        return;
      }
      expect(ROUTES_THAT_SUCCEED_WITHOUT_MASTRA.has(name), `${name} is allowlisted but failed`).toBe(false);

      const { body } = formatErrorResponse(outcome.error);
      expect(isServerProblem(body.problem)).toBe(true);
      // Built-in routes always set a business code: these two are reserved for errors that carry none.
      expect(body.problem.code).not.toBe('UNEXPECTED_ERROR');
      expect(body.problem.code).not.toBe('UNCATEGORIZED_ERROR');
    },
  );
});
