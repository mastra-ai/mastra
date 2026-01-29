import { useState, useEffect, useMemo, useCallback } from 'react';
import { Provider } from '@mastra/client-js';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import { Spinner } from '@/ds/components/Spinner';
import { LLMProviderPicker } from './llm-provider-picker';
import { LLMModelPicker } from './llm-model-picker';
import { ProviderWarning } from './provider-warning';
import { ModelInfo, PickerLayout, WarningVariant, ComboboxVariant, PickerSize } from '../types';
import { useLLMProviders } from '../hooks/use-llm-providers';
import { useAllModels } from '../hooks/use-llm-models';
import { cleanProviderId, sortProviders, findProvider } from '../utils/provider-utils';
import { cn } from '@/lib/utils';

export interface LLMProviderModelPickerProps {
  /** Currently selected provider ID */
  provider: string;
  /** Currently selected model ID */
  model: string;
  /** Callback when provider selection changes */
  onProviderChange: (providerId: string) => void;
  /** Callback when model selection changes */
  onModelChange: (model: { provider: string; modelId: string }) => void;
  /** Layout variant for the picker */
  layout?: PickerLayout;
  /** Visual variant for comboboxes */
  variant?: ComboboxVariant;
  /** Size variant */
  size?: PickerSize;
  /** Warning display variant */
  warningVariant?: WarningVariant;
  /** Whether to show the reset button */
  showReset?: boolean;
  /** Callback when reset button is clicked */
  onReset?: () => void | Promise<void>;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Whether the reset action is loading */
  resetLoading?: boolean;
  /** Custom class name */
  className?: string;
  /** Placeholder for provider picker */
  providerPlaceholder?: string;
  /** Placeholder for model picker */
  modelPlaceholder?: string;
  /** Whether to show documentation link in provider picker */
  showDocLink?: boolean;
  /** Whether to show status indicator in provider picker */
  showStatusIndicator?: boolean;
  /** Logo size in pixels */
  logoSize?: number;
  /** Error message to display */
  error?: string;
}

/**
 * Layout configuration for different picker layouts
 */
const LAYOUT_CLASSES: Record<PickerLayout, { container: string; provider: string; model: string }> = {
  horizontal: {
    container: '@container flex flex-col @xs:flex-row items-stretch @xs:items-center gap-2 w-full',
    provider: 'w-full @xs:w-2/5',
    model: 'w-full @xs:w-3/5',
  },
  vertical: {
    container: 'flex flex-col gap-2 w-full',
    provider: 'w-full',
    model: 'w-full',
  },
  compact: {
    container: 'flex items-center gap-1.5',
    provider: '',
    model: 'min-w-48',
  },
};

/**
 * Combined LLM Provider and Model Picker component.
 * Provides a unified interface for selecting both provider and model.
 */
export const LLMProviderModelPicker = ({
  provider,
  model,
  onProviderChange,
  onModelChange,
  layout = 'horizontal',
  variant = 'default',
  size = 'md',
  warningVariant = 'alert',
  showReset = false,
  onReset,
  disabled = false,
  resetLoading = false,
  className,
  providerPlaceholder = 'Select provider...',
  modelPlaceholder = 'Select model...',
  showDocLink = true,
  showStatusIndicator = true,
  logoSize,
  error,
}: LLMProviderModelPickerProps) => {
  // Fetch providers data
  const { data: dataProviders, isLoading } = useLLMProviders();
  const providers = dataProviders?.providers || [];

  // Local state for controlled open/close of comboboxes
  const [providerOpen, setProviderOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  // Derive models and current provider
  const allModels = useAllModels(providers);
  const cleanedProvider = cleanProviderId(provider);
  const currentProvider = useMemo(
    () => findProvider(providers, provider),
    [providers, provider],
  );

  // Get layout classes
  const layoutClasses = LAYOUT_CLASSES[layout];
  const effectiveLogoSize = logoSize ?? (layout === 'compact' ? 14 : 16);

  // Handle provider selection
  const handleProviderSelect = useCallback(
    (providerId: string) => {
      const cleanedId = cleanProviderId(providerId);
      const providerChanged = cleanedId !== cleanedProvider;

      onProviderChange(cleanedId);

      // Open model picker when provider changes
      if (providerChanged) {
        setModelOpen(true);
      }
    },
    [cleanedProvider, onProviderChange],
  );

  // Handle model selection
  const handleModelSelect = useCallback(
    (modelId: string) => {
      const providerToUse = cleanedProvider || provider;
      if (modelId && providerToUse) {
        onModelChange({ provider: providerToUse, modelId });
      }
    },
    [cleanedProvider, provider, onModelChange],
  );

  // Handle reset
  const handleReset = useCallback(async () => {
    if (onReset) {
      await onReset();
    }
  }, [onReset]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Spinner className={layout === 'compact' ? 'w-4 h-4' : undefined} />
        {layout !== 'compact' && <span className="text-sm text-gray-500">Loading providers...</span>}
      </div>
    );
  }

  return (
    <div className={cn(layout === 'horizontal' ? '@container' : '', className)}>
      <div className={layoutClasses.container}>
        <div className={layoutClasses.provider}>
          <LLMProviderPicker
            providers={providers}
            value={cleanedProvider}
            onValueChange={handleProviderSelect}
            placeholder={providerPlaceholder}
            variant={variant}
            size={size}
            disabled={disabled}
            showDocLink={showDocLink}
            showStatusIndicator={showStatusIndicator}
            open={providerOpen}
            onOpenChange={setProviderOpen}
            logoSize={effectiveLogoSize}
          />
        </div>

        <div className={layoutClasses.model}>
          <LLMModelPicker
            models={allModels}
            provider={cleanedProvider}
            value={model}
            onValueChange={handleModelSelect}
            placeholder={modelPlaceholder}
            variant={variant}
            size={size}
            disabled={disabled}
            open={modelOpen}
            onOpenChange={setModelOpen}
          />
        </div>

        {showReset && onReset && (
          <Button
            variant="light"
            size={size}
            onClick={handleReset}
            disabled={disabled || resetLoading}
            className="flex items-center gap-1.5 text-xs whitespace-nowrap !border-0"
            title="Reset to original model"
          >
            {resetLoading ? <Spinner className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
          </Button>
        )}
      </div>

      <ProviderWarning
        provider={currentProvider}
        variant={warningVariant}
      />

      {error && (
        <div className="pt-2 p-2">
          <p className="text-xs text-accent2">{error}</p>
        </div>
      )}
    </div>
  );
};

export interface LLMProviderModelPickerControlledProps extends Omit<LLMProviderModelPickerProps, 'provider' | 'model' | 'onProviderChange' | 'onModelChange'> {
  /** Initial provider ID */
  defaultProvider?: string;
  /** Initial model ID */
  defaultModel?: string;
  /** Callback when the full model value changes */
  onChange?: (value: { provider: string; name: string }) => void;
}

/**
 * Fully controlled version of the LLM Provider Model Picker.
 * Manages its own state internally.
 */
export const LLMProviderModelPickerControlled = ({
  defaultProvider = '',
  defaultModel = '',
  onChange,
  ...props
}: LLMProviderModelPickerControlledProps) => {
  const [provider, setProvider] = useState(defaultProvider);
  const [model, setModel] = useState(defaultModel);

  // Update state when defaults change
  useEffect(() => {
    setProvider(defaultProvider);
    setModel(defaultModel);
  }, [defaultProvider, defaultModel]);

  const handleProviderChange = useCallback(
    (providerId: string) => {
      setProvider(providerId);
      // Clear model when provider changes
      if (providerId !== cleanProviderId(provider)) {
        setModel('');
      }
    },
    [provider],
  );

  const handleModelChange = useCallback(
    (selected: { provider: string; modelId: string }) => {
      setModel(selected.modelId);
      onChange?.({ provider: selected.provider, name: selected.modelId });
    },
    [onChange],
  );

  return (
    <LLMProviderModelPicker
      provider={provider}
      model={model}
      onProviderChange={handleProviderChange}
      onModelChange={handleModelChange}
      {...props}
    />
  );
};
