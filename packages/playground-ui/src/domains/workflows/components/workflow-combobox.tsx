'use client';

import { useEffect } from 'react';
import { toast } from '@/lib/toast';
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
  const { data: workflows = {}, isLoading, isError, error } = useWorkflows();
  const { navigate, paths } = useLinkComponent();

  useEffect(() => {
    if (isError) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load workflows';
      toast.error(`Error loading workflows: ${errorMessage}`);
    }
  }, [isError, error]);

  const workflowOptions = Object.keys(workflows).map(key => ({
    label: workflows[key]?.name || key,
    value: key,
  }));

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
      placeholder={isLoading ? 'Loading workflows...' : placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      className={className}
      disabled={disabled || isLoading || isError}
      buttonClassName={buttonClassName}
      contentClassName={contentClassName}
    />
  );
}
