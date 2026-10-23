import type { Mastra } from '../mastra';
import { MASTRA_NORMALIZED_USER_KEY } from '../request-context';
import type { RequestContext } from '../request-context';
import type { DynamicArgument, MastraUser } from '../types';

/**
 * Read the authenticated end user from the request context.
 *
 * The server auth middleware stores the normalized user under
 * `MASTRA_NORMALIZED_USER_KEY` after an auth provider authenticates the
 * request. Returns `undefined` when the request is unauthenticated, no auth
 * provider is configured, or the stored value is malformed.
 */
export function getRequestUser(requestContext: RequestContext<any>): MastraUser | undefined {
  const user = requestContext.getRaw(MASTRA_NORMALIZED_USER_KEY);
  if (user && typeof user === 'object' && typeof (user as MastraUser).id === 'string') {
    return user as MastraUser;
  }
  return undefined;
}

/**
 * Resolve a `DynamicArgument<T>` to its value.
 *
 * Static values pass through unchanged. Callbacks are invoked with
 * `{ requestContext, mastra, user }`, where `user` is the authenticated end
 * user derived from the request context at invocation time (see
 * {@link getRequestUser}).
 */
export function resolveDynamicArgument<T>(
  value: DynamicArgument<T, any>,
  { requestContext, mastra }: { requestContext: RequestContext<any>; mastra?: Mastra },
): Promise<T> | T {
  if (typeof value !== 'function') {
    return value;
  }
  const callback = value as (args: {
    requestContext: RequestContext<any>;
    mastra?: Mastra;
    user?: MastraUser;
  }) => Promise<T> | T;
  return callback({ requestContext, mastra, user: getRequestUser(requestContext) });
}
