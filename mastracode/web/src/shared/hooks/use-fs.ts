import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { ArtifactListing, DirectoryListing } from '../api/types';

/**
 * Server-driven directory listing for the project picker (mirrors
 * `GET /web/fs/list`). The browser can't read absolute filesystem paths, so
 * the server enumerates directories confined to its configured root. An absent
 * `path` lists the root; the cache is keyed by `path` so navigating between
 * folders yields distinct entries and React Query dedupes revisits.
 */
export function useDirectoryListing(path: string | undefined) {
  const { client } = useApiConfig();
  return useQuery<DirectoryListing>({
    queryKey: queryKeys.fsList(path),
    queryFn: () => {
      const qs = path ? `?path=${encodeURIComponent(path)}` : '';
      return client.get<DirectoryListing>(`/web/fs/list${qs}`);
    },
  });
}

export function useArtifactListing(path: string | undefined) {
  const { client } = useApiConfig();
  return useQuery<ArtifactListing>({
    queryKey: queryKeys.artifactsList(path),
    enabled: Boolean(path),
    queryFn: () => client.get<ArtifactListing>(`/web/artifacts/list?path=${encodeURIComponent(path ?? '')}`),
  });
}
