import { skipToken, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { BlameResult } from '../api/types';

/**
 * Git blame for a single file, cached long enough that scrubbing between tabs
 * doesn't hammer git. External library files skip the query — they aren't in
 * the checkout so blame is never available.
 */
export function useBlame(
  workspacePath: string | undefined,
  filePath: string | undefined,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { client } = useApiConfig();
  const isExternal = filePath?.startsWith('/') ?? false;
  const url =
    workspacePath && filePath && !isExternal
      ? `/web/workspace/blame?${new URLSearchParams({ workspacePath, path: filePath })}`
      : undefined;
  return useQuery<BlameResult>({
    queryKey: queryKeys.blame(workspacePath, filePath),
    enabled: enabled && !isExternal,
    staleTime: 30_000,
    queryFn: url ? () => client.get<BlameResult>(url) : skipToken,
  });
}
