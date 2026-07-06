import type { Provider } from '@mastra/client-js';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxOption, ComboboxProps } from '@mastra/playground-ui/components/Combobox';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { useMemo } from 'react';
import { useAllModels, useFilteredModels } from '../hooks/use-filtered-models';
import { useLLMProviders } from '../hooks/use-llm-providers';

export interface LLMModelsProps {
  value: string;
  onValueChange: (value: string) => void;
  llmId: string; // Provider ID to filter models
  variant?: ComboboxProps['variant'];
  size?: ComboboxProps['size'];
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  container?: HTMLElement | ShadowRoot | null | React.RefObject<HTMLElement | ShadowRoot | null>;
  disabled?: boolean;
}

export interface LLMModelSelectProps extends LLMModelsProps {
  providers: Provider[];
  isLoading?: boolean;
}

export const LLMModelSelect = ({
  providers,
  isLoading,
  value,
  onValueChange,
  llmId,
  variant,
  size = 'md',
  className,
  open,
  onOpenChange,
  container,
  disabled,
}: LLMModelSelectProps) => {
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

  if (isLoading) {
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
      size={size}
      disabled={disabled}
    />
  );
};

export const LLMModels = (props: LLMModelsProps) => {
  const { data: dataProviders, isLoading } = useLLMProviders();
  return <LLMModelSelect {...props} providers={dataProviders?.providers ?? []} isLoading={isLoading} />;
};
