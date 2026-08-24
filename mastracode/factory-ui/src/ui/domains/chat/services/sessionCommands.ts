import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../../../../api/keys';
import type {
  SessionCommandDiscoveryResponse,
  SessionCommandPrepareRequest,
  SessionCommandPrepareResponse,
} from '@mastra/factory/routes/session-command-contract';

/**
 * Browser transport for Factory session-command discovery/preparation. Only
 * protocol types are imported from `@mastra/factory` — never server code.
 */

const SESSION_COMMANDS_PATH = (baseUrl: string, controllerId: string, action: 'discover' | 'prepare') =>
  `${baseUrl}/api/agent-controller/${encodeURIComponent(controllerId)}/commands/${action}`;

async function postJson<TSuccess>(url: string, body: unknown): Promise<TSuccess> {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    let detail = 'The request failed.';
    if (
      payload &&
      typeof payload === 'object' &&
      'message' in payload &&
      typeof (payload as { message?: unknown }).message === 'string'
    ) {
      detail = (payload as { message: string }).message;
    }
    throw new Error(detail);
  }
  return payload as TSuccess;
}

export interface SessionCommandAddress {
  agentControllerId: string;
  resourceId: string;
  projectRepositoryId?: string;
  scope?: string;
  /** Same-origin by default; tests inject an absolute origin. */
  baseUrl?: string;
}

export async function discoverSessionCommandsViaFetch(
  address: SessionCommandAddress,
): Promise<SessionCommandDiscoveryResponse> {
  return postJson<SessionCommandDiscoveryResponse>(
    SESSION_COMMANDS_PATH(address.baseUrl ?? '', address.agentControllerId, 'discover'),
    {
      resourceId: address.resourceId,
      ...(address.projectRepositoryId ? { projectRepositoryId: address.projectRepositoryId } : {}),
      ...(address.scope ? { scope: address.scope } : {}),
    },
  );
}

export async function prepareSessionCommandViaFetch(
  address: SessionCommandAddress,
  request: Pick<SessionCommandPrepareRequest, 'command' | 'arguments'>,
): Promise<SessionCommandPrepareResponse> {
  return postJson<SessionCommandPrepareResponse>(
    SESSION_COMMANDS_PATH(address.baseUrl ?? '', address.agentControllerId, 'prepare'),
    {
      resourceId: address.resourceId,
      ...(address.projectRepositoryId ? { projectRepositoryId: address.projectRepositoryId } : {}),
      ...(address.scope ? { scope: address.scope } : {}),
      command: request.command,
      ...(request.arguments !== undefined ? { arguments: request.arguments } : {}),
    },
  );
}

export type UseSessionCommandsArgs = SessionCommandAddress;

/** Discovery is driven manually (`enabled: false`) so the composer controls refetch timing. */
export function useSessionCommandsQuery({
  agentControllerId,
  resourceId,
  projectRepositoryId,
  scope,
  baseUrl,
}: UseSessionCommandsArgs) {
  return useQuery({
    queryKey: queryKeys.sessionCommands(agentControllerId, resourceId, projectRepositoryId, scope),
    enabled: false,
    queryFn: () =>
      discoverSessionCommandsViaFetch({ agentControllerId, resourceId, projectRepositoryId, scope, baseUrl }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}
