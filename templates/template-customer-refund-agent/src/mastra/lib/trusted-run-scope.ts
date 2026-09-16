import { AsyncLocalStorage } from "node:async_hooks";

/** Provider reads receive authority only from a verified workflow turn. */
export interface TrustedCaseReadScope {
  caseId: string;
  ownerId: string;
  tenantId: string;
}

export type TrustedCommerceScope = TrustedCaseReadScope;

const commerceScope = new AsyncLocalStorage<TrustedCaseReadScope>();

export function withTrustedCommerceScope<T>(
  scope: TrustedCommerceScope,
  operation: () => Promise<T>,
) {
  return commerceScope.run(Object.freeze({ ...scope }), operation);
}

export function requireTrustedCommerceScope(): TrustedCommerceScope {
  const scope = commerceScope.getStore();
  if (!scope)
    throw new Error(
      "Commerce lookup requires a verified workflow turn scope; model-authored calls are not authorized.",
    );
  return scope;
}

/**
 * Read-only agent runs are allowed outside the operational workflow only after
 * the HTTP boundary has authenticated the caller and resolved a durable case.
 * The scope intentionally carries the case owner, never caller-controlled
 * tenant/account arguments, so every read tool can re-derive its binding.
 */
export function withTrustedCaseReadScope<T>(
  scope: TrustedCaseReadScope,
  operation: () => Promise<T>,
) {
  return commerceScope.run(Object.freeze({ ...scope }), operation);
}

/**
 * Server middleware uses this only to map the authenticated Studio request to
 * the durable case owner.  Tools still call requireTrustedCaseReadScope(), so
 * a model-authored request context can never manufacture this authority.
 */
export function currentTrustedCaseReadScope():
  TrustedCaseReadScope | undefined {
  return commerceScope.getStore();
}

export function requireTrustedCaseReadScope(): TrustedCaseReadScope {
  return requireTrustedCommerceScope();
}
