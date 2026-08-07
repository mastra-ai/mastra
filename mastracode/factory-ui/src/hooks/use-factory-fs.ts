import { skipToken, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { FactoryFsFile, FactoryFsListing } from '../api/types';

function factoryFsListUrl(factoryProjectId: string | undefined) {
  if (!factoryProjectId) return '/web/factory/fs/list';
  return `/web/factory/fs/list?${new URLSearchParams({ projectId: factoryProjectId })}`;
}

function factoryFsFileUrl(path: string | undefined) {
  if (!path) return undefined;
  return `/web/factory/fs/file?${new URLSearchParams({ path })}`;
}

/**
 * Org-wide listing of the durable factory filesystem (`GET /web/factory/fs/list`).
 * Passing the current factory project id makes the response include
 * `projectDir` so the page can focus the project's directory by default.
 */
export function useFactoryFsListing(factoryProjectId: string | undefined) {
  const { client } = useApiConfig();
  const url = factoryFsListUrl(factoryProjectId);
  return useQuery<FactoryFsListing>({
    queryKey: queryKeys.factoryFsList(factoryProjectId),
    queryFn: () => client.get<FactoryFsListing>(url),
  });
}

/** A single durable-filesystem file preview (`GET /web/factory/fs/file`). */
export function useFactoryFsFile(path: string | undefined) {
  const { client } = useApiConfig();
  const url = factoryFsFileUrl(path);
  return useQuery<FactoryFsFile>({
    queryKey: queryKeys.factoryFsFile(path),
    queryFn: url ? () => client.get<FactoryFsFile>(url) : skipToken,
  });
}
