import type { RequestContext } from '@mastra/core/request-context';

/** The read-only view of a request context that credential and account lookups need. */
export type RequestContextReader = { get(key: string): unknown };

const ACCOUNT_ROUTING_SELECTIONS_KEY = 'mastracodeAccountRoutingSelections';

type AccountRoutingSelections = Record<string, string>;

function getSelections(requestContext?: RequestContextReader): AccountRoutingSelections | undefined {
  const value = requestContext?.get(ACCOUNT_ROUTING_SELECTIONS_KEY);
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AccountRoutingSelections) : undefined;
}

export function getRequestAccountSelection(requestContext: RequestContextReader | undefined, providerId: string) {
  return getSelections(requestContext)?.[providerId];
}

export function setRequestAccountSelection(
  requestContext: RequestContext | undefined,
  providerId: string,
  accountInstanceId: string,
): void {
  if (!requestContext || typeof requestContext.set !== 'function') return;
  requestContext.set(ACCOUNT_ROUTING_SELECTIONS_KEY, {
    ...getSelections(requestContext),
    [providerId]: accountInstanceId,
  });
}

const ACCOUNT_ROUTING_EXHAUSTED_KEY = 'mastracodeAccountRoutingExhaustedProviders';

function getExhaustedProviders(requestContext?: RequestContextReader): string[] {
  const value = requestContext?.get(ACCOUNT_ROUTING_EXHAUSTED_KEY);
  return Array.isArray(value) ? (value as string[]) : [];
}

/**
 * Record that routing found no usable account for this provider on this
 * request. Kept separate from the account selection: a sentinel *id* would be
 * handed to credential lookup, where an unknown id makes `get()` fall back to
 * the provider's active account — the very account routing just rejected.
 */
export function markRequestAccountRoutingExhausted(
  requestContext: RequestContext | undefined,
  providerId: string,
): void {
  if (!requestContext || typeof requestContext.set !== 'function') return;
  const exhausted = getExhaustedProviders(requestContext);
  if (exhausted.includes(providerId)) return;
  requestContext.set(ACCOUNT_ROUTING_EXHAUSTED_KEY, [...exhausted, providerId]);
}

/** Whether routing already rejected every account for this provider on this request. */
export function isRequestAccountRoutingExhausted(
  requestContext: RequestContextReader | undefined,
  providerId: string,
): boolean {
  return getExhaustedProviders(requestContext).includes(providerId);
}
