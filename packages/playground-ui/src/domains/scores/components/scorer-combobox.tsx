'use client';

import { useMemo } from 'react';
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
  const { data: scorers = {}, isLoading } = useScorers();
  const { navigate, paths } = useLinkComponent();

  const scorerOptions = useMemo(() => {
    return Object.keys(scorers).map(key => ({
      label: scorers[key]?.scorer.config.name || key,
      value: key,
    }));
  }, [scorers]);

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
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      className={className}
      disabled={disabled || isLoading}
      buttonClassName={buttonClassName}
      contentClassName={contentClassName}
    />
  );
}
