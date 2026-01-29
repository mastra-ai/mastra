import { useState, useEffect, useMemo, useCallback } from 'react';
import { Provider } from '@mastra/client-js';
import { ModelInfo, SelectedModel } from '../types';
import { useLLMProviders } from './use-llm-providers';
import { useAllModels, useConnectedModels } from './use-llm-models';
import {
  cleanProviderId,
  sortProviders,
  filterModelsByProvider,
  sortModels,
  findProvider,
} from '../utils/provider-utils';

export interface UseLLMPickerStateOptions {
  /** Initial provider ID */
  defaultProvider?: string;
  /** Initial model ID */
  defaultModel?: string;
  /** Callback when provider changes */
  onProviderChange?: (providerId: string) => void;
  /** Callback when model changes */
  onModelChange?: (model: SelectedModel) => void;
  /** Whether to auto-open model picker after provider selection */
  autoOpenModelOnProviderChange?: boolean;
}

export interface UseLLMPickerStateReturn {
  // Data
  providers: Provider[];
  sortedProviders: Provider[];
  allModels: ModelInfo[];
  connectedModels: ModelInfo[];
  filteredModels: ModelInfo[];
  currentProvider: Provider | undefined;
  isLoading: boolean;

  // State
  selectedProvider: string;
  selectedModel: string;
  providerOpen: boolean;
  modelOpen: boolean;

  // Handlers
  setSelectedProvider: (providerId: string) => void;
  setSelectedModel: (modelId: string) => void;
  setProviderOpen: (open: boolean) => void;
  setModelOpen: (open: boolean) => void;
  handleProviderSelect: (providerId: string) => void;
  handleModelSelect: (modelId: string) => void;
  resetToDefaults: () => void;
}

/**
 * Combined state management hook for LLM provider/model pickers
 */
export const useLLMPickerState = ({
  defaultProvider = '',
  defaultModel = '',
  onProviderChange,
  onModelChange,
  autoOpenModelOnProviderChange = true,
}: UseLLMPickerStateOptions = {}): UseLLMPickerStateReturn => {
  // Fetch providers
  const { data: dataProviders, isLoading } = useLLMProviders();
  const providers = dataProviders?.providers || [];

  // Local state
  const [selectedProvider, setSelectedProvider] = useState(defaultProvider);
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [providerOpen, setProviderOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  // Update local state when defaults change
  useEffect(() => {
    setSelectedProvider(defaultProvider);
    setSelectedModel(defaultModel);
  }, [defaultProvider, defaultModel]);

  // Derived state
  const cleanedProvider = cleanProviderId(selectedProvider);
  const sortedProviders = useMemo(() => sortProviders(providers), [providers]);
  const allModels = useAllModels(providers);
  const connectedModels = useConnectedModels(providers, allModels);

  const filteredModels = useMemo(() => {
    const filtered = filterModelsByProvider(allModels, cleanedProvider);
    return sortModels(filtered);
  }, [allModels, cleanedProvider]);

  const currentProvider = useMemo(
    () => findProvider(providers, selectedProvider),
    [providers, selectedProvider],
  );

  // Handlers
  const handleProviderSelect = useCallback(
    (providerId: string) => {
      const cleanedId = cleanProviderId(providerId);
      const providerChanged = cleanedId !== cleanedProvider;

      setSelectedProvider(cleanedId);
      onProviderChange?.(cleanedId);

      // Clear model and open model picker when switching providers
      if (providerChanged) {
        setSelectedModel('');
        if (autoOpenModelOnProviderChange) {
          setModelOpen(true);
        }
      }
    },
    [cleanedProvider, onProviderChange, autoOpenModelOnProviderChange],
  );

  const handleModelSelect = useCallback(
    (modelId: string) => {
      setSelectedModel(modelId);

      const providerToUse = cleanedProvider || selectedProvider;
      if (modelId && providerToUse) {
        onModelChange?.({
          provider: providerToUse,
          modelId,
        });
      }
    },
    [cleanedProvider, selectedProvider, onModelChange],
  );

  const resetToDefaults = useCallback(() => {
    setSelectedProvider(defaultProvider);
    setSelectedModel(defaultModel);
  }, [defaultProvider, defaultModel]);

  return {
    // Data
    providers,
    sortedProviders,
    allModels,
    connectedModels,
    filteredModels,
    currentProvider,
    isLoading,

    // State
    selectedProvider: cleanedProvider,
    selectedModel,
    providerOpen,
    modelOpen,

    // Handlers
    setSelectedProvider,
    setSelectedModel,
    setProviderOpen,
    setModelOpen,
    handleProviderSelect,
    handleModelSelect,
    resetToDefaults,
  };
};
