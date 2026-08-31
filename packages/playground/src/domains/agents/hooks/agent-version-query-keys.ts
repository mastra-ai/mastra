import type { ListAgentVersionsParams } from '@mastra/client-js';
import type { QueryClient } from '@tanstack/react-query';

import { mastraPackagesQueryKey } from '@/domains/configuration/hooks/use-mastra-packages';

export const agentVersionQueryKeys = {
  versionLists: (agentId: string) => ['agent-versions', agentId] as const,
  versionList: (agentId: string, params: ListAgentVersionsParams | undefined, requestContext: unknown) =>
    [...agentVersionQueryKeys.versionLists(agentId), params, requestContext] as const,
  completeVersionList: (
    agentId: string,
    params: Omit<ListAgentVersionsParams, 'page' | 'perPage'> | undefined,
    requestContext: unknown,
  ) => [...agentVersionQueryKeys.versionLists(agentId), 'complete', params, requestContext] as const,
  versionDetails: (agentId: string) => ['agent-version', agentId] as const,
  versionDetail: (agentId: string, versionId: string, requestContext: unknown) =>
    [...agentVersionQueryKeys.versionDetails(agentId), versionId, requestContext] as const,
  labelsRoot: (agentId: string) => ['agent-version-labels', agentId] as const,
  labels: (agentId: string, requestContext: unknown) =>
    [...agentVersionQueryKeys.labelsRoot(agentId), requestContext] as const,
  active: (agentId: string) => ['stored-agent', agentId] as const,
  resolved: (agentId: string) => ['agent', agentId] as const,
  selector: (agentId: string) => ['agent-version-selector', agentId] as const,
  storedCollection: ['stored-agents'] as const,
  resolvedCollection: ['agents'] as const,
  capability: mastraPackagesQueryKey,
  authorization: ['auth', 'capabilities'] as const,
};

/** Every cache prefix whose value can change when a version pointer moves. */
export const getAgentVersionEntityInvalidationKeys = (agentId: string) =>
  [
    agentVersionQueryKeys.versionLists(agentId),
    agentVersionQueryKeys.versionDetails(agentId),
    agentVersionQueryKeys.active(agentId),
    agentVersionQueryKeys.resolved(agentId),
    agentVersionQueryKeys.selector(agentId),
    agentVersionQueryKeys.storedCollection,
    agentVersionQueryKeys.resolvedCollection,
  ] as const;

const getAgentVersionMissingInvalidationKeys = (agentId: string) =>
  [
    agentVersionQueryKeys.versionLists(agentId),
    agentVersionQueryKeys.versionDetails(agentId),
    agentVersionQueryKeys.selector(agentId),
    agentVersionQueryKeys.storedCollection,
    agentVersionQueryKeys.resolvedCollection,
  ] as const;

const getAgentVersionEntityDetailKeys = (agentId: string) =>
  [agentVersionQueryKeys.active(agentId), agentVersionQueryKeys.resolved(agentId)] as const;

export const getAgentVersionInvalidationKeys = (agentId: string) =>
  [agentVersionQueryKeys.labelsRoot(agentId), ...getAgentVersionEntityInvalidationKeys(agentId)] as const;

/**
 * Refreshes all server-authoritative consumers of agent version pointers.
 * Mutations deliberately do not write pointer state optimistically.
 */
export const invalidateAgentVersionState = async (queryClient: QueryClient, agentId: string): Promise<void> => {
  await Promise.all(
    getAgentVersionInvalidationKeys(agentId).map(queryKey => queryClient.invalidateQueries({ queryKey })),
  );
};

/**
 * Immediately moves singular entity consumers to their existing missing state,
 * then refreshes dependent collections without re-triggering the failing label
 * request or restoring stale detail data from an in-flight request.
 */
export const markAgentVersionEntityMissing = (queryClient: QueryClient, agentId: string): Promise<void> => {
  const entityDetailKeys = getAgentVersionEntityDetailKeys(agentId);
  const cancellations = entityDetailKeys.map(queryKey => queryClient.cancelQueries({ queryKey }));

  for (const queryKey of entityDetailKeys) {
    queryClient.setQueriesData({ queryKey }, null);
  }

  const invalidations = getAgentVersionMissingInvalidationKeys(agentId).map(queryKey =>
    queryClient.invalidateQueries({ queryKey }),
  );
  return Promise.all([...cancellations, ...invalidations]).then(() => undefined);
};
