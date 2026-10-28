'use client';

import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxProps } from '@mastra/playground-ui/components/Combobox';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { useDatasetVersions } from '@mastra/react/hooks/datasets';
import { useEffect } from 'react';

export interface DatasetVersionsProps {
  datasetId: string;
  value: number | null;
  onValueChange: (version: number | null) => void;
  currentVersion?: number;
  /** Creation date of the dataset, shown for the latest version when the dataset has no version records yet (v0). */
  datasetCreatedAt?: string | Date;
  className?: string;
  container?: ComboboxProps['container'];
  variant?: ComboboxProps['variant'];
  size?: ComboboxProps['size'];
  align?: ComboboxProps['align'];
  'aria-label'?: string;
}

export function DatasetVersions({
  datasetId,
  value,
  onValueChange,
  currentVersion,
  datasetCreatedAt,
  className,
  container,
  variant,
  size = 'md',
  align,
  'aria-label': ariaLabel,
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
    description: describeCreatedAt(version.createdAt),
  }));

  if (versions.length === 0 && latestVersion != null) {
    options.push({
      label: `Latest (v${latestVersion})`,
      value: String(latestVersion),
      description: describeCreatedAt(datasetCreatedAt),
    });
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
      variant={variant}
      size={size}
      align={align}
      container={container}
      aria-label={ariaLabel}
    />
  );
}

function describeCreatedAt(createdAt: string | Date | undefined) {
  const formatted = createdAt ? formatDate(createdAt, 'date-time') : undefined;
  return formatted ? `Created ${formatted}` : undefined;
}
