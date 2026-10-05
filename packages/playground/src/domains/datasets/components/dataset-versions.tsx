'use client';

import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxProps } from '@mastra/playground-ui/components/Combobox';
import { useDatasetVersions } from '@mastra/react/hooks';
import { useEffect } from 'react';

export interface DatasetVersionsProps {
  datasetId: string;
  value: number | null;
  onValueChange: (version: number | null) => void;
  currentVersion?: number;
  className?: string;
  container?: ComboboxProps['container'];
}

export function DatasetVersions({
  datasetId,
  value,
  onValueChange,
  currentVersion,
  className,
  container,
}: DatasetVersionsProps) {
  const {
    data: versions = [],
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useDatasetVersions({ datasetId: datasetId, queryOptions: { enabled: Boolean(datasetId) } });

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const latestVersion = versions.find(version => version.isCurrent)?.version ?? currentVersion;
  const options = versions.map(version => ({
    label: version.isCurrent ? `Latest (v${version.version})` : `v${version.version}`,
    value: String(version.version),
  }));

  if (versions.length === 0 && latestVersion != null) {
    options.push({ label: `Latest (v${latestVersion})`, value: String(latestVersion) });
  }

  return (
    <Combobox
      options={options}
      value={String(value ?? latestVersion ?? '')}
      onValueChange={nextValue => {
        const nextVersion = Number(nextValue);
        onValueChange(nextVersion === latestVersion ? null : nextVersion);
      }}
      placeholder={isLoading ? 'Loading versions...' : 'Select version'}
      searchPlaceholder="Search versions..."
      emptyText="No versions found."
      className={className}
      disabled={isLoading || options.length === 0}
      size="md"
      container={container}
    />
  );
}
