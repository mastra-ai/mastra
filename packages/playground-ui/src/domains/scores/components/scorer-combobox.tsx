'use client';

import { useEffect } from 'react';
import { toast } from '@/lib/toast';
import { Combobox } from '@/components/ui/combobox';
import { useScorers } from '../hooks/use-scorers';
import { useLinkComponent } from '@/lib/framework';

export interface ScorerComboboxProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  buttonClassName?: string;
  contentClassName?: string;
}

export function ScorerCombobox({
  value,
  onValueChange,
  placeholder = 'Select a scorer...',
  searchPlaceholder = 'Search scorers...',
  emptyText = 'No scorers found.',
  className,
  disabled = false,
  buttonClassName = 'h-8',
  contentClassName,
}: ScorerComboboxProps) {
  const { data: scorers = {}, isLoading, isError, error } = useScorers();
  const { navigate, paths } = useLinkComponent();

  useEffect(() => {
    if (isError) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load scorers';
      toast.error(`Error loading scorers: ${errorMessage}`);
    }
  }, [isError, error]);

  const scorerOptions = Object.keys(scorers).map(key => ({
    label: scorers[key]?.scorer.config.name || key,
    value: key,
  }));

  const handleValueChange = (newScorerId: string) => {
    if (onValueChange) {
      onValueChange(newScorerId);
    } else if (newScorerId && newScorerId !== value) {
      navigate(paths.scorerLink(newScorerId));
    }
  };

  return (
    <Combobox
      options={scorerOptions}
      value={value}
      onValueChange={handleValueChange}
      placeholder={isLoading ? 'Loading scorers...' : placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      className={className}
      disabled={disabled || isLoading || isError}
      buttonClassName={buttonClassName}
      contentClassName={contentClassName}
    />
  );
}
