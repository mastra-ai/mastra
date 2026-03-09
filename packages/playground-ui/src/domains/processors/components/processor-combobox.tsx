import { useEffect } from 'react';
import { toast } from '@/lib/toast';
import { Combobox } from '@/ds/components/Combobox';
import { useProcessors } from '../hooks/use-processors';
import { useLinkComponent } from '@/lib/framework';

export interface ProcessorComboboxProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  variant?: 'default' | 'light' | 'outline' | 'ghost';
}

export function ProcessorCombobox({
  value,
  onValueChange,
  placeholder = 'Select a processor...',
  searchPlaceholder = 'Search processors...',
  emptyText = 'No processors found.',
  className,
  disabled = false,
  variant = 'default',
}: ProcessorComboboxProps) {
  const { data: processors = {}, isLoading, isError, error } = useProcessors();
  const { navigate, paths } = useLinkComponent();

  useEffect(() => {
    if (isError) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load processors';
      toast.error(`Error loading processors: ${errorMessage}`);
    }
  }, [isError, error]);

  const processorOptions = Object.keys(processors)
    .filter(key => {
      const processor = processors[key];
      return processor?.phases && processor.phases.length > 0;
    })
    .map(key => ({
      label: processors[key]?.name || key,
      value: key,
    }));

  const handleValueChange = (newProcessorId: string) => {
    if (onValueChange) {
      onValueChange(newProcessorId);
    } else if (newProcessorId && newProcessorId !== value) {
      const processor = processors[newProcessorId];
      if (processor?.isWorkflow) {
        navigate(paths.workflowLink(newProcessorId) + '/graph');
      } else {
        navigate(paths.processorLink(newProcessorId));
      }
    }
  };

  return (
    <Combobox
      options={processorOptions}
      value={value}
      onValueChange={handleValueChange}
      placeholder={isLoading ? 'Loading processors...' : placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      className={className}
      disabled={disabled || isLoading || isError}
      variant={variant}
    />
  );
}
