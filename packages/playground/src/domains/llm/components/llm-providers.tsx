import type { ComboboxOption, ComboboxProps } from '@mastra/playground-ui/components/Combobox';
import { ModelPickerCombobox, ModelProviderIcon } from '@mastra/playground-ui/components/ModelPicker';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Info } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useMemo } from 'react';
import { useFilteredProviders } from '../hooks/use-filtered-providers';
import { useLLMProviders } from '../hooks/use-llm-providers';
import { cleanProviderId, findProviderById } from '../utils';
import { ProviderLogo } from './provider-logo';
import { useBuilderFilteredProviders, useBuilderModelPolicy } from '@/domains/agent-builder';

export interface LLMProvidersProps {
  value: string;
  onValueChange: (value: string) => void;
  variant?: ComboboxProps['variant'];
  size?: ComboboxProps['size'];
  className?: string;
  segment?: 'provider';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  container?: HTMLElement | ShadowRoot | null | React.RefObject<HTMLElement | ShadowRoot | null>;
  disabled?: boolean;
}

export const LLMProviders = ({
  value,
  onValueChange,
  variant,
  size = 'md',
  className,
  segment,
  open,
  onOpenChange,
  container,
  disabled,
}: LLMProvidersProps) => {
  const { data: dataProviders, isLoading: providersLoading } = useLLMProviders();
  const allProviders = dataProviders?.providers || [];

  const policy = useBuilderModelPolicy();
  const providers = useBuilderFilteredProviders(allProviders, policy);
  const sortedProviders = useFilteredProviders(providers, '', false);

  const providerOptions: ComboboxOption[] = useMemo(() => {
    return sortedProviders.map(provider => ({
      label: provider.name,
      value: provider.id,
      start: (
        <ModelProviderIcon connected={provider.connected}>
          <ProviderLogo providerId={provider.id} size={16} />
        </ModelProviderIcon>
      ),
      end: provider.docUrl ? (
        <Info
          className={cn(
            'size-3.5 text-neutral2 opacity-0 transition-opacity duration-100 cursor-pointer',
            'hover:text-neutral4 hover:opacity-100',
            'group-data-[highlighted]/item:opacity-100',
          )}
          onClick={(e: MouseEvent<SVGSVGElement>) => {
            e.stopPropagation();
            window.open(provider.docUrl, '_blank', 'noopener,noreferrer');
          }}
        />
      ) : null,
    }));
  }, [sortedProviders]);

  const handleValueChange = (providerId: string) => {
    const cleanedId = cleanProviderId(providerId);
    onValueChange(cleanedId);
  };

  if (providersLoading) {
    return <Skeleton className="h-8 w-full" />;
  }

  const matchedProvider = findProviderById(providers, value);
  const currentModelProvider = matchedProvider?.id || cleanProviderId(value);

  return (
    <ModelPickerCombobox
      segment={segment}
      options={providerOptions}
      value={currentModelProvider}
      onValueChange={handleValueChange}
      placeholder="Select provider..."
      searchPlaceholder="Search providers..."
      emptyText="No providers found"
      variant={variant}
      size={size}
      className={className}
      open={open}
      onOpenChange={onOpenChange}
      container={container}
      disabled={disabled}
    />
  );
};
