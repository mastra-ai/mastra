import { useMemo } from 'react';
import { Combobox, ComboboxOption } from '@/ds/components/Combobox';
import { Spinner } from '@/ds/components/Spinner';
import { useLLMProviders } from '../hooks/use-llm-providers';
import { useAllModels, useFilteredModels } from '../hooks/use-filtered-models';

export interface LLMModelsProps {
  value: string;
  onValueChange: (value: string) => void;
  llmId: string; // Provider ID to filter models
  variant?: 'default' | 'light';
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const LLMModels = ({
  value,
  onValueChange,
  llmId,
  variant = 'default',
  className,
  open,
  onOpenChange,
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
    return (
      <div className="flex items-center gap-2">
        <Spinner className="w-4 h-4" />
      </div>
    );
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
    />
  );
};
