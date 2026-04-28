import type { ServerContext, ServerRoute } from '../server-adapter/routes';

import { seedBuilderModelPolicy } from './seed-builder-model-policy';

/**
 * Brand stamped on wrapped handlers so the drift-guard test can assert every
 * agent execution route ships with builder policy seeding.
 */
export const BUILDER_POLICY_SEEDING_BRAND = Symbol.for('mastra.builderPolicySeeding');

/**
 * Higher-order wrapper for a `ServerRoute` handler. Resolves the Agent Builder model policy
 * via the configured editor (if any) and seeds it onto the route's `RequestContext` BEFORE
 * the handler body runs — guaranteeing the seed wins the in-handler "set first; client cannot
 * overwrite" merge of any client-supplied request-context entries.
 *
 * Inactive / missing policy is a strict pass-through (no behavior change for non-builder agents).
 */
export function withBuilderPolicySeeding<THandler extends ServerRoute['handler']>(handler: THandler): THandler {
  const wrapped = (async (params: ServerContext) => {
    await seedBuilderModelPolicy(params.mastra.getEditor(), params.requestContext);
    return handler(params as Parameters<THandler>[0]);
  }) as unknown as THandler;

  Object.defineProperty(wrapped, BUILDER_POLICY_SEEDING_BRAND, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return wrapped;
}

/**
 * Returns true if `handler` was wrapped via {@link withBuilderPolicySeeding}.
 * Used by the drift-guard test to enumerate agent routes and assert coverage.
 */
export function isWrappedWithBuilderPolicySeeding(handler: ServerRoute['handler']): boolean {
  return (handler as unknown as { [k: symbol]: unknown })[BUILDER_POLICY_SEEDING_BRAND] === true;
}

/**
 * Mutate a `ServerRoute` so its `handler` is wrapped with {@link withBuilderPolicySeeding}.
 * Idempotent — re-applying on an already-wrapped route is a no-op.
 *
 * Use at the point where agent routes are aggregated; safer than wrapping each `handler:`
 * inline at every `createRoute({...})` call site.
 */
export function applyBuilderPolicySeeding<R extends ServerRoute>(route: R): R {
  if (isWrappedWithBuilderPolicySeeding(route.handler)) return route;
  (route as { handler: ServerRoute['handler'] }).handler = withBuilderPolicySeeding(route.handler);
  return route;
}
