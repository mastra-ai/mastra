import { useMemo } from 'react';
import { Combobox, ComboboxOption } from '@/ds/components/Combobox';
import { useLLMProviders } from '../hooks/use-llm-providers';
import { useAllModels, useFilteredModels } from '../hooks/use-filtered-models';
import { Skeleton } from '@/ds/components/Skeleton';

export interface LLMModelsProps {
  value: string;
  onValueChange: (value: string) => void;
  llmId: string; // Provider ID to filter models
  variant?: 'default' | 'light';
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  container?: HTMLElement | ShadowRoot | null | React.RefObject<HTMLElement | ShadowRoot | null>;
}

export const LLMModels = ({
  value,
  onValueChange,
  llmId,
  variant = 'default',
  className,
  open,
  onOpenChange,
  container,
}: LLMModelsProps) => {
  const { data: dataProviders, isLoading: providersLoading } = useLLMProviders();
  const providers = dataProviders?.providers || [];

  // Get all models flattened
  const allModels = useAllModels(providers);

  // Filter models by provider
  const filteredModels = useFilteredModels(allModels, llmId, '', false);

  // Create model options
  const modelOptions: ComboboxOption[] = useMemo(() => {
    return filteredModels.map(m => ({
      label: m.model,
      value: m.model,
    }));
  }, [filteredModels]);

  if (providersLoading) {
    return <Skeleton className="w-full h-8" />;
  }

  return (
    <Combobox
      options={modelOptions}
      value={value}
      onValueChange={onValueChange}
      placeholder="Select model..."
      searchPlaceholder="Search models..."
      emptyText="No models found"
      variant={variant}
      className={className}
      open={open}
      onOpenChange={onOpenChange}
      container={container}
    />
  );
};
