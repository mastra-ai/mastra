import { useMemo } from 'react';
import { Combobox, ComboboxOption } from '@/ds/components/Combobox';
import { ProviderLogo } from './provider-logo';
import { ModelInfo, ComboboxVariant, PickerSize } from '../types';
import { filterModelsByProvider, sortModels } from '../utils/provider-utils';
import { FormElementSize } from '@/ds/primitives/form-element';

export interface LLMModelPickerProps {
  /** List of all available models */
  models: ModelInfo[];
  /** Current provider ID to filter models by */
  provider: string;
  /** Currently selected model ID */
  value: string;
  /** Callback when model selection changes */
  onValueChange: (modelId: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Text shown when no models found */
  emptyText?: string;
  /** Visual variant */
  variant?: ComboboxVariant;
  /** Size variant */
  size?: PickerSize;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Whether to show provider logo next to model name */
  showProviderLogo?: boolean;
  /** Logo size in pixels (when showProviderLogo is true) */
  logoSize?: number;
}

/**
 * LLM Model Picker component using the Combobox design system.
 * Displays models filtered by the selected provider.
 */
export const LLMModelPicker = ({
  models,
  provider,
  value,
  onValueChange,
  placeholder = 'Select model...',
  searchPlaceholder = 'Search models...',
  emptyText = 'No models found',
  variant = 'default',
  size = 'md',
  disabled = false,
  className,
  open,
  onOpenChange,
  showProviderLogo = false,
  logoSize = 14,
}: LLMModelPickerProps) => {
  // Filter and sort models by provider
  const filteredModels = useMemo(() => {
    const filtered = filterModelsByProvider(models, provider);
    return sortModels(filtered);
  }, [models, provider]);

  // Create combobox options
  const modelOptions: ComboboxOption[] = useMemo(() => {
    return filteredModels.map(model => ({
      label: model.model,
      value: model.model,
      start: showProviderLogo ? <ProviderLogo providerId={model.provider} size={logoSize} /> : undefined,
    }));
  }, [filteredModels, showProviderLogo, logoSize]);

  return (
    <Combobox
      options={modelOptions}
      value={value}
      onValueChange={onValueChange}
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

export interface LLMConnectedModelPickerProps {
  /** List of connected models only */
  connectedModels: ModelInfo[];
  /** Currently selected model */
  value: { provider: string; modelId: string } | null;
  /** Callback when model selection changes */
  onValueChange: (model: { provider: string; modelId: string } | null) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Text shown when no models found */
  emptyText?: string;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
  /** Whether to show "Default (agent model)" option */
  showDefaultOption?: boolean;
  /** Label for the default option */
  defaultOptionLabel?: string;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Logo size in pixels */
  logoSize?: number;
}

/**
 * Model picker for connected providers only.
 * Used in contexts like the instructions enhancer where only connected providers are relevant.
 */
export const LLMConnectedModelPicker = ({
  connectedModels,
  value,
  onValueChange,
  placeholder = 'Select a model',
  searchPlaceholder = 'Search models...',
  emptyText = 'No models found',
  disabled = false,
  className,
  showDefaultOption = false,
  defaultOptionLabel = 'Default (agent model)',
  open,
  onOpenChange,
  logoSize = 14,
}: LLMConnectedModelPickerProps) => {
  // Create combobox options
  const modelOptions: ComboboxOption[] = useMemo(() => {
    const options: ComboboxOption[] = [];

    // Add default option if enabled
    if (showDefaultOption) {
      options.push({
        label: defaultOptionLabel,
        value: '__default__',
      });
    }

    // Add model options
    connectedModels.forEach(model => {
      options.push({
        label: model.model,
        value: `${model.provider}::${model.model}`,
        start: <ProviderLogo providerId={model.provider} size={logoSize} />,
      });
    });

    return options;
  }, [connectedModels, showDefaultOption, defaultOptionLabel, logoSize]);

  // Convert value to combobox format
  const comboboxValue = value ? `${value.provider}::${value.modelId}` : showDefaultOption ? '__default__' : '';

  const handleValueChange = (selectedValue: string) => {
    if (selectedValue === '__default__') {
      onValueChange(null);
    } else {
      const [provider, modelId] = selectedValue.split('::');
      onValueChange({ provider, modelId });
    }
  };

  return (
    <Combobox
      options={modelOptions}
      value={comboboxValue}
      onValueChange={handleValueChange}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      disabled={disabled}
      className={className}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
};
