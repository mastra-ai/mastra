import { useEffect } from 'react';
import { useWorkflows } from '../hooks/use-workflows';
import { Combobox } from '@/ds/components/Combobox';
import type { ComboboxProps } from '@/ds/components/Combobox';
import { useLinkComponent } from '@/lib/framework';
import { toast } from '@/utils/toast';

export interface WorkflowComboboxProps {
  requestContext?: Record<string, any>;
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
}

export function WorkflowCombobox({
  value,
  onValueChange,
  placeholder = 'Select a workflow...',
  searchPlaceholder = 'Search workflows...',
  emptyText = 'No workflows found.',
  className,
  disabled = false,
  variant,
  size,
  'aria-label': ariaLabel,
  align,
  requestContext,
}: WorkflowComboboxProps) {
  const { data: workflows = {}, isLoading, isError, error } = useWorkflows({ requestContext });
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
      variant={variant}
      size={size}
      aria-label={ariaLabel}
      align={align}
    />
  );
}
