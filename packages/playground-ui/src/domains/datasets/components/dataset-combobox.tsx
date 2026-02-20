'use client';

import { useEffect } from 'react';
import { toast } from '@/lib/toast';
import { Combobox } from '@/ds/components/Combobox';
import { useDatasets } from '../hooks/use-datasets';
import { useLinkComponent } from '@/lib/framework';

export interface DatasetComboboxProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  variant?: 'default' | 'light' | 'outline' | 'ghost';
}

export function DatasetCombobox({
  value,
  onValueChange,
  placeholder = 'Select a dataset...',
  searchPlaceholder = 'Search datasets...',
  emptyText = 'No datasets found.',
  className,
  disabled = false,
  variant = 'default',
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
    />
  );
}
