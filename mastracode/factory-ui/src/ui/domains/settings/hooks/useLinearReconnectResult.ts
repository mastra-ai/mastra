import type { UseQueryResult } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';

import type { LinearStatus, LinearWorkspaceConnection } from '../../factory/services/linear';

export interface LinearReconnectResult {
  error?: string;
  unverified: boolean;
}

/** Reads the outcome the server appends when a targeted reconnect returns to this page. */
export function useLinearReconnectResult(statusQuery: UseQueryResult<LinearStatus>) {
  const [params, setParams] = useSearchParams();
  const retry = async () => {
    const result = await statusQuery.refetch();
    if (!result.data || result.data.reason === 'unavailable') return;
    setParams(
      current => {
        current.delete('linear_reconnect');
        current.delete('linear_workspace_id');
        return current;
      },
      { replace: true },
    );
  };
  const resultFor = (workspace: LinearWorkspaceConnection): LinearReconnectResult => {
    const outcome = params.get('linear_workspace_id') === workspace.id ? params.get('linear_reconnect') : null;
    if (outcome === 'not_connected') {
      return {
        error: `This workspace is still disconnected. Choose ${workspace.name} when authorizing in Linear.`,
        unverified: false,
      };
    }
    if (outcome === 'unavailable') {
      return { error: "Couldn't verify this connection. Retry to check its status.", unverified: true };
    }
    return { unverified: false };
  };
  return { resultFor, retry };
}
