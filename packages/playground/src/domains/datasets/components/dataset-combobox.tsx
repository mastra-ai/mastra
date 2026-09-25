'use client';

import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxProps } from '@mastra/playground-ui/components/Combobox';
import { useDatasets } from '@mastra/playground-ui/domains/datasets';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useEffect } from 'react';

export interface DatasetComboboxProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  variant?: ComboboxProps['variant'];
  size?: ComboboxProps['size'];
  'aria-label'?: string;
  align?: ComboboxProps['align'];
  container?: ComboboxProps['container'];
}

export function DatasetCombobox({
  value,
  onValueChange,
  placeholder = 'Select a dataset...',
  searchPlaceholder = 'Search datasets...',
  emptyText = 'No datasets found.',
  className,
  disabled = false,
  variant,
  size,
  'aria-label': ariaLabel,
  align,
  container,
}: DatasetComboboxProps) {
  const { data, isLoading, isError, error } = useDatasets();
  const { navigate, paths } = useLinkComponent();

  useEffect(() => {
    if (isError) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load datasets';
      toast.error(`Error loading datasets: ${errorMessage}`);
    }
  }, [isError, error]);

  const datasets = data?.datasets ?? [];
  const datasetOptions = datasets.map(d => ({
    label: d.name,
    value: d.id,
  }));

  const handleValueChange = (newDatasetId: string) => {
    if (onValueChange) {
      onValueChange(newDatasetId);
    } else if (newDatasetId && newDatasetId !== value) {
      navigate(paths.datasetLink(newDatasetId));
    }
  };

  return (
    <Combobox
      options={datasetOptions}
      value={value}
      onValueChange={handleValueChange}
      placeholder={isLoading ? 'Loading datasets...' : placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      className={className}
      disabled={disabled || isLoading || isError}
      variant={variant}
      size={size}
      aria-label={ariaLabel}
      align={align}
      container={container}
    />
  );
}
