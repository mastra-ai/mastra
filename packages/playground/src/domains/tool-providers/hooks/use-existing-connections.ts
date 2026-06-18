import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';

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
export const useExistingConnections = (
  providerId: string | null | undefined,
  toolkit: string | null | undefined,
  options?: UseExistingConnectionsOptions,
) => {
  const client = useMastraClient();
  const scopeToSelf = options?.scopeToSelf ?? false;
  const currentUserQuery = useCurrentUser();
  const callerAuthorId = currentUserQuery.data?.id;

  // When self-scoping, wait until the current-user query has settled before
  // firing so admins get the explicit `authorId` filter. If auth is disabled
  // the query still settles (with no user); we then omit the filter and let
  // the server scope by request context — otherwise the query would never run
  // and the connection control would hang on its loading skeleton.
  const callerReady = !scopeToSelf || !currentUserQuery.isPending;

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
  });
};
