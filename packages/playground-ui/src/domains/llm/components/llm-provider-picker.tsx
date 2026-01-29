import { useMemo } from 'react';
import { Provider } from '@mastra/client-js';
import { Info } from 'lucide-react';
import { Combobox, ComboboxOption } from '@/ds/components/Combobox';
import { ProviderLogo } from './provider-logo';
import { ComboboxVariant, PickerSize } from '../types';
import { sortProviders, cleanProviderId } from '../utils/provider-utils';
import { FormElementSize } from '@/ds/primitives/form-element';

export interface LLMProviderPickerProps {
  /** List of available providers */
  providers: Provider[];
  /** Currently selected provider ID */
  value: string;
  /** Callback when provider selection changes */
  onValueChange: (providerId: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Text shown when no providers found */
  emptyText?: string;
  /** Visual variant */
  variant?: ComboboxVariant;
  /** Size variant */
  size?: PickerSize;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
  /** Whether to show the documentation link icon */
  showDocLink?: boolean;
  /** Whether to show the connection status indicator */
  showStatusIndicator?: boolean;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Logo size in pixels */
  logoSize?: number;
}

/**
 * Connection status indicator dot
 */
const ConnectionIndicator = ({ connected }: { connected: boolean }) => (
  <div
    className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
      connected ? 'bg-accent1' : 'bg-accent2'
    }`}
    title={connected ? 'Connected' : 'Not connected'}
  />
);

/**
 * Documentation link icon
 */
const DocLinkIcon = ({ docUrl }: { docUrl?: string }) => {
  if (!docUrl) return null;

  return (
    <Info
      className="w-4 h-4 text-gray-500 hover:text-gray-700 cursor-pointer"
      onClick={e => {
        e.stopPropagation();
        window.open(docUrl, '_blank', 'noopener,noreferrer');
      }}
    />
  );
};

/**
 * LLM Provider Picker component using the Combobox design system.
 * Displays providers with logo, connection status, and optional documentation link.
 */
export const LLMProviderPicker = ({
  providers,
  value,
  onValueChange,
  placeholder = 'Select provider...',
  searchPlaceholder = 'Search providers...',
  emptyText = 'No providers found',
  variant = 'default',
  size = 'md',
  disabled = false,
  className,
  showDocLink = true,
  showStatusIndicator = true,
  open,
  onOpenChange,
  logoSize = 16,
}: LLMProviderPickerProps) => {
  // Sort providers by connection status and popularity
  const sortedProviders = useMemo(() => sortProviders(providers), [providers]);

  // Create combobox options with icons
  const providerOptions: ComboboxOption[] = useMemo(() => {
    return sortedProviders.map(provider => ({
      label: provider.name,
      value: provider.id,
      start: (
        <div className="relative">
          <ProviderLogo providerId={provider.id} size={logoSize} />
          {showStatusIndicator && <ConnectionIndicator connected={provider.connected} />}
        </div>
      ),
      end: showDocLink ? <DocLinkIcon docUrl={provider.docUrl} /> : null,
    }));
  }, [sortedProviders, showDocLink, showStatusIndicator, logoSize]);

  const handleValueChange = (providerId: string) => {
    // Clean the provider ID before passing to callback
    const cleanedId = cleanProviderId(providerId);
    onValueChange(cleanedId);
  };

  // Clean the current value for comparison
  const cleanedValue = cleanProviderId(value);

  return (
    <Combobox
      options={providerOptions}
      value={cleanedValue}
      onValueChange={handleValueChange}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      variant={variant}
      size={size as FormElementSize}
      disabled={disabled}
      className={className}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
};
