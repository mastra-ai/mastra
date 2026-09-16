import type { RequestContext } from '@mastra/core/request-context';

const ACCOUNT_ROUTING_SELECTIONS_KEY = 'mastracodeAccountRoutingSelections';

type AccountRoutingSelections = Record<string, string>;

function getSelections(requestContext?: RequestContext): AccountRoutingSelections | undefined {
  const value = requestContext?.get(ACCOUNT_ROUTING_SELECTIONS_KEY);
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AccountRoutingSelections) : undefined;
}

export function getRequestAccountSelection(requestContext: RequestContext | undefined, providerId: string) {
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
