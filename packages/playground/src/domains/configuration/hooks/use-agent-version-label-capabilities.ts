import type { GetSystemPackagesResponse } from '@mastra/client-js';

import { useMastraPackages } from './use-mastra-packages';

type StorageCapabilities = NonNullable<GetSystemPackagesResponse['storageCapabilities']>;
type VersionLabelCapabilities = NonNullable<StorageCapabilities['versionLabels']>;
export type AgentVersionLabelCapabilities = NonNullable<VersionLabelCapabilities['entityTypes']['agent']>;

export const useAgentVersionLabelCapabilities = () => {
  const packagesQuery = useMastraPackages();
  const capabilities = packagesQuery.data?.storageCapabilities?.versionLabels?.entityTypes.agent;
  const isLoading = packagesQuery.isLoading || packagesQuery.isFetching;
  const supportsRead = !isLoading && capabilities?.read === true;
  const supportsMutation =
    supportsRead && capabilities.write && capabilities.compareAndSwap && capabilities.retentionProtection;

  return {
    capabilities,
    supportsRead,
    supportsMutation,
    // Capability-gated controls must fail closed while a stale snapshot is
    // being replaced (for example after a VERSION_LABELS_UNSUPPORTED error).
    isLoading,
    isFetching: packagesQuery.isFetching,
    isError: packagesQuery.isError,
    error: packagesQuery.error,
    refetch: packagesQuery.refetch,
  };
};
