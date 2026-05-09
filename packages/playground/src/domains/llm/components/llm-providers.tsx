import { Combobox, Skeleton } from '@mastra/playground-ui';
import type { ComboboxProps, ComboboxOption } from '@mastra/playground-ui';
import { Info } from 'lucide-react';
import { useMemo } from 'react';
import { useFilteredProviders } from '../hooks/use-filtered-providers';
import { useLLMProviders } from '../hooks/use-llm-providers';
import { cleanProviderId, findProviderById } from '../utils';
import { ProviderLogo } from './provider-logo';

export interface LLMProvidersProps {
  value: string;
  onValueChange: (value: string) => void;
  variant?: ComboboxProps['variant'];
  size?: ComboboxProps['size'];
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  container?: HTMLElement | ShadowRoot | null | React.RefObject<HTMLElement | ShadowRoot | null>;
}

export const LLMProviders = ({
  value,
  onValueChange,
  variant = 'default',
  size = 'default',
  className,
  open,
  onOpenChange,
  container,
}: LLMProvidersProps) => {
  const { data: dataProviders, isLoading: providersLoading } = useLLMProviders();
  const providers = dataProviders?.providers || [];

  // Sort providers: connected -> popular -> alphabetical
  const sortedProviders = useFilteredProviders(providers, '', false);

  // Create provider options with icons
  const providerOptions: ComboboxOption[] = useMemo(() => {
    return sortedProviders.map(provider => ({
      label: provider.name,
      value: provider.id,
      start: (
        <div className="relative shrink-0">
          <ProviderLogo providerId={provider.id} size={16} />
          <div
            className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
              provider.connected ? 'bg-accent1' : 'bg-accent2'
            }`}
            title={provider.connected ? 'Connected' : 'Not connected'}
          />
        </div>
      ),
      end: provider.docUrl ? (
        <Info
          className="w-4 h-4 text-neutral2 hover:text-neutral3 cursor-pointer"
          onClick={e => {
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
    return <Skeleton className="w-full h-8" />;
  }

  // Find the matching provider, handling gateway prefix fallback
  // (e.g., value='custom' should match provider with id='acme/custom')
  const matchedProvider = findProviderById(providers, value);
  const currentModelProvider = matchedProvider?.id || cleanProviderId(value);

  return (
    <Combobox
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
    />
  );
};
