import type { UseQueryResult } from '@tanstack/react-query';
import type { MastraClient } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';
import { isUnauthenticatedError, useCurrentUser } from '../auth';

export interface UseExistingConnectionsOptions {
  /**
   * When `true`, the hook forces the server-side `authorId` filter to the
   * caller's own userId. Builder edit view passes `scopeToSelf: true` so
   * admins see only their own connections, never other authors' rows.
   *
   * Non-admin callers see the same result either way — the server already
   * scopes to the caller's bucket — but the explicit filter keeps caches
   * consistent and prevents admin cross-author leakage in the picker.
   */
  scopeToSelf?: boolean;
}

type ConnectionsResponse = Awaited<ReturnType<ReturnType<MastraClient['getToolProvider']>['listConnections']>>;

/**
 * Lists existing provider connections for the caller, scoped to a tool
 * service. Powers the "use existing connection" path in the picker so
 * authors can pin previously-authorized accounts without re-running OAuth.
 *
 * The connection owner is resolved server-side from the request's auth
 * context. Admin callers receive cross-author rows by default; pass
 * `scopeToSelf: true` to narrow the response to the caller's own bucket
 * (used by the Builder edit view).
 */
export const useExistingConnections = <TData = ConnectionsResponse>({
  providerId,
  toolkit,
  scopeToSelf = false,
  queryOptions,
}: UseExistingConnectionsOptions & {
  providerId: string | null | undefined;
  toolkit: string | null | undefined;
  queryOptions?: MastraQueryOptions<ConnectionsResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();
  const currentUserQuery = useCurrentUser();
  const callerAuthorId = currentUserQuery.data?.id;

  const callerReady = !scopeToSelf || currentUserQuery.isSuccess || isUnauthenticatedError(currentUserQuery.error);

  const enabled = !!providerId && !!toolkit && callerReady;

  return useQuery({
    queryKey: scopeToSelf
      ? ['tool-integration-connections', providerId, toolkit, callerAuthorId]
      : ['tool-integration-connections', providerId, toolkit],
    queryFn: () =>
      client.getToolProvider(providerId!).listConnections({
        toolkit: toolkit!,
        ...(scopeToSelf && callerAuthorId ? { authorId: callerAuthorId } : {}),
      }),
    enabled,
    ...queryOptions,
  });
};
