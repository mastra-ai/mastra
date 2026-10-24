import { expectTypeOf, test } from 'vitest';
import type { RouteError, ServerError } from '../src/route-types.generated';
import { getServerError } from '../src/types';

declare const error: unknown;

test('getServerError returns the whole catalog union by default', () => {
  const serverError = getServerError(error);
  expectTypeOf(serverError).toEqualTypeOf<ServerError | undefined>();
  if (serverError?.code === 'WORKFLOW_NOT_FOUND') {
    expectTypeOf(serverError.metadata).toEqualTypeOf<{ workflowId: string }>();
  }
  expectTypeOf<Extract<ServerError, { code: 'AGENT_NOT_FOUND' }>>().toEqualTypeOf<{
    error: string;
    code: 'AGENT_NOT_FOUND';
    metadata: { agentId: string };
  }>();
});

test('getServerError narrows the union to the codes a route can return', () => {
  const serverError = getServerError(error, 'GET /agents/:agentId');
  expectTypeOf(serverError).toEqualTypeOf<RouteError<'GET /agents/:agentId'> | undefined>();
  if (!serverError) return;
  expectTypeOf(serverError.error).toEqualTypeOf<string>();
  switch (serverError.code) {
    case 'AGENT_NOT_FOUND':
      expectTypeOf(serverError.metadata).toEqualTypeOf<{ agentId: string }>();
      break;
    case 'AGENT_GET_FAILED':
      expectTypeOf(serverError.metadata).toEqualTypeOf<undefined>();
      break;
    case 'AUTHENTICATION_REQUIRED':
    case 'REQUEST_VALIDATION_FAILED':
      break;
    // @ts-expect-error GET /agents/:agentId never returns workflow codes
    case 'WORKFLOW_NOT_FOUND':
      break;
  }
});

test('public routes never return auth codes', () => {
  expectTypeOf<Extract<RouteError<'GET /auth/sso/callback'>['code'], 'AUTHENTICATION_REQUIRED'>>().toBeNever();
  expectTypeOf<Extract<RouteError<'GET /agents/:agentId'>['code'], 'AUTHENTICATION_REQUIRED'>>().not.toBeNever();
});
