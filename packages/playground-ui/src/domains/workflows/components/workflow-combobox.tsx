'use client';

import { useMemo } from 'react';
import { Combobox } from '@/components/ui/combobox';
import { useWorkflows } from '../hooks/use-workflows';
import { useLinkComponent } from '@/lib/framework';

export interface WorkflowComboboxProps {
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

export function WorkflowCombobox({
  value,
  onValueChange,
  placeholder = 'Select a workflow...',
  searchPlaceholder = 'Search workflows...',
  emptyText = 'No workflows found.',
  className,
  disabled = false,
  buttonClassName = 'h-8',
  contentClassName,
}: WorkflowComboboxProps) {
  const { data: workflows = {}, isLoading } = useWorkflows();
  const { navigate, paths } = useLinkComponent();

  const workflowOptions = useMemo(() => {
    return Object.keys(workflows).map(key => ({
      label: workflows[key]?.name || key,
      value: key,
    }));
  }, [workflows]);

  const handleValueChange = (newWorkflowId: string) => {
    if (onValueChange) {
      onValueChange(newWorkflowId);
    } else if (newWorkflowId && newWorkflowId !== value) {
      navigate(paths.workflowLink(newWorkflowId));
    }
  };

  return (
    <Combobox
      options={workflowOptions}
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
