import { expectTypeOf, test } from 'vitest';
import type { ClientError, RouteError, ServerError } from '../src/route-types.generated';
import { isRouteError, isServerError, matchRouteError, matchServerError } from '../src/types';
import type { ServerErrorHandlers } from '../src/types';

declare const error: unknown;

test('narrows metadata by switching on the code of a route error', () => {
  if (isRouteError(error, 'GET /agents/:agentId')) {
    switch (error.code) {
      case 'AGENT_NOT_FOUND':
        expectTypeOf(error.metadata).toEqualTypeOf<{ agentId: string }>();
        break;
      case 'AGENT_GET_FAILED':
        expectTypeOf(error.metadata).toEqualTypeOf<undefined>();
        break;
      case 'AUTHENTICATION_REQUIRED':
      case 'REQUEST_VALIDATION_FAILED':
        break;
      // @ts-expect-error GET /agents/:agentId never returns workflow codes
      case 'WORKFLOW_NOT_FOUND':
        break;
    }
    expectTypeOf(error.status).toEqualTypeOf<number>();
  }
});

test('public routes never return auth codes', () => {
  expectTypeOf<Extract<RouteError<'GET /auth/sso/callback'>['code'], 'AUTHENTICATION_REQUIRED'>>().toBeNever();
  expectTypeOf<Extract<RouteError<'GET /agents/:agentId'>['code'], 'AUTHENTICATION_REQUIRED'>>().not.toBeNever();
});

test('path-based client errors match route-key errors', () => {
  expectTypeOf<ClientError<'/agents/:agentId', 'GET'>>().toEqualTypeOf<RouteError<'GET /agents/:agentId'>>();
});

test('isServerError covers the whole catalog', () => {
  if (isServerError(error) && error.code === 'WORKFLOW_NOT_FOUND') {
    expectTypeOf(error.metadata).toEqualTypeOf<{ workflowId: string }>();
  }
  expectTypeOf<Extract<ServerError, { code: 'AGENT_NOT_FOUND' }>>().toEqualTypeOf<{
    error: string;
    code: 'AGENT_NOT_FOUND';
    metadata: { agentId: string };
  }>();
});

test('matchRouteError types each handler and infers the result', () => {
  const message = matchRouteError(error, 'GET /agents/:agentId', {
    AGENT_NOT_FOUND: e => {
      expectTypeOf(e.metadata).toEqualTypeOf<{ agentId: string }>();
      expectTypeOf(e.status).toEqualTypeOf<number>();
      return `Unknown agent ${e.metadata.agentId}`;
    },
    AUTHENTICATION_REQUIRED: e => e.code,
    default: () => 'Something went wrong',
  });
  expectTypeOf(message).toEqualTypeOf<string>();

  matchRouteError(error, 'GET /agents/:agentId', {
    // @ts-expect-error GET /agents/:agentId never returns workflow codes
    WORKFLOW_NOT_FOUND: () => 'x',
    default: () => 'x',
  });
});

test('matchServerError accepts any catalog code', () => {
  matchServerError(error, {
    WORKFLOW_NOT_FOUND: e => expectTypeOf(e.metadata).toEqualTypeOf<{ workflowId: string }>(),
    default: () => {},
  });
});

test('handlers are exhaustive unless default is given', () => {
  type Handlers = ServerErrorHandlers<'AGENT_NOT_FOUND' | 'AGENT_GET_FAILED', string>;
  const all: Handlers = { AGENT_NOT_FOUND: () => 'a', AGENT_GET_FAILED: () => 'b' };
  const some: Handlers = { AGENT_NOT_FOUND: () => 'a', default: () => 'c' };
  // @ts-expect-error AGENT_GET_FAILED is unhandled and there is no default
  const missing: Handlers = { AGENT_NOT_FOUND: () => 'a' };
  void [all, some, missing];
});
