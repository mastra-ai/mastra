import { skipToken, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { PreviewBase } from '../api/types';

/**
 * Load the preview base for a session — used by the runner (and any other UI
 * that surfaces sandbox-local URLs) to know whether preview subdomain
 * routing is enabled, and to build canonical preview URLs.
 *
 * The result is stable per session: same slug on every call, same parent
 * host until the Factory reboots. Cache for the whole session, since we
 * don't expect the answer to change.
 */
export function useSessionPreviewBase(
  workspacePath: string | undefined,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { client } = useApiConfig();
  const url = workspacePath
    ? `/web/workspace/preview-base?${new URLSearchParams({ workspacePath })}`
    : undefined;
  return useQuery<PreviewBase>({
    queryKey: queryKeys.previewBase(workspacePath),
    enabled,
    staleTime: Infinity,
    queryFn: url ? () => client.get<PreviewBase>(url) : skipToken,
  });
}
