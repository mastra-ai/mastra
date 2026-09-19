import type { ComboboxOption, ComboboxProps } from '@mastra/playground-ui/components/Combobox';
import { ModelPickerCombobox } from '@mastra/playground-ui/components/ModelPicker';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { useMemo } from 'react';
import { useAllModels, useFilteredModels } from '../hooks/use-filtered-models';
import { useLLMProviders } from '../hooks/use-llm-providers';
import { useBuilderFilteredModels, useBuilderModelPolicy } from '@/domains/agent-builder';

export interface LLMModelsProps {
  value: string;
  onValueChange: (value: string) => void;
  llmId: string; // Provider ID to filter models
  variant?: ComboboxProps['variant'];
  size?: ComboboxProps['size'];
  className?: string;
  segment?: 'model';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  container?: HTMLElement | ShadowRoot | null | React.RefObject<HTMLElement | ShadowRoot | null>;
  disabled?: boolean;
}

export const LLMModels = ({
  value,
  onValueChange,
  llmId,
  variant,
  size = 'md',
  className,
  segment,
  open,
  onOpenChange,
  container,
  disabled,
}: LLMModelsProps) => {
  const { data: dataProviders, isLoading: providersLoading } = useLLMProviders();
  const providers = dataProviders?.providers || [];

  const policy = useBuilderModelPolicy();
  const allModels = useAllModels(providers);
  const policyAllowedModels = useBuilderFilteredModels(allModels, policy);

  const filteredModels = useFilteredModels(policyAllowedModels, llmId, '', false);

  const modelOptions: ComboboxOption[] = useMemo(() => {
    return filteredModels.map(m => ({
      label: m.model,
      value: m.model,
    }));
  }, [filteredModels]);

  if (providersLoading) {
    return <Skeleton className="h-8 w-full" />;
  }

  return (
    <ModelPickerCombobox
      segment={segment}
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
      size={size}
      disabled={disabled}
    />
  );
};
