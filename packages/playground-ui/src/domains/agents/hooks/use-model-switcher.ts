import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { UpdateModelParams } from '@mastra/client-js';
import { Provider } from '@mastra/client-js';
import { useAgentsModelProviders } from './use-agents-model-providers';
import { cleanProviderId } from '../components/agent-metadata/utils';

export interface UseModelSwitcherProps {
  defaultProvider: string;
  defaultModel: string;
  updateModel: (newModel: UpdateModelParams) => Promise<{ message: string }>;
  resetModel?: () => Promise<{ message: string }>;
}

export interface UseModelSwitcherReturn {
  // State
  selectedProvider: string;
  selectedModel: string;
  currentModelProvider: string;
  providerSearch: string;
  modelSearch: string;
  isSearchingProvider: boolean;
  isSearchingModel: boolean;
  showProviderSuggestions: boolean;
  showModelSuggestions: boolean;
  loading: boolean;
  providersLoading: boolean;
  highlightedProviderIndex: number;
  highlightedModelIndex: number;

  // Data
  providers: Provider[];
  filteredProviders: Provider[];
  filteredModels: Array<{ provider: string; providerName: string; model: string }>;
  allModels: Array<{ provider: string; providerName: string; model: string }>;

  // Refs
  modelInputRef: React.RefObject<HTMLInputElement | null>;
  providerInputRef: React.RefObject<HTMLInputElement | null>;

  // Actions
  setProviderSearch: (value: string) => void;
  setModelSearch: (value: string) => void;
  setIsSearchingProvider: (value: boolean) => void;
  setIsSearchingModel: (value: boolean) => void;
  setShowProviderSuggestions: (value: boolean) => void;
  setShowModelSuggestions: (value: boolean) => void;
  setHighlightedProviderIndex: (value: number | ((prev: number) => number)) => void;
  setHighlightedModelIndex: (value: number | ((prev: number) => number)) => void;
  setSelectedModel: (value: string) => void;
  handleProviderSelect: (provider: Provider) => Promise<void>;
  handleModelSelect: (modelId: string) => Promise<void>;
  handleReset: () => Promise<void>;
}

export const useModelSwitcher = ({
  defaultProvider,
  defaultModel,
  updateModel,
  resetModel,
}: UseModelSwitcherProps): UseModelSwitcherReturn => {
  const [originalProvider] = useState(defaultProvider);
  const [originalModel] = useState(defaultModel);

  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [showModelSuggestions, setShowModelSuggestions] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(defaultProvider || '');
  const [providerSearch, setProviderSearch] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [isSearchingProvider, setIsSearchingProvider] = useState(false);
  const [isSearchingModel, setIsSearchingModel] = useState(false);
  const [showProviderSuggestions, setShowProviderSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const { data: dataProviders, isLoading: providersLoading } = useAgentsModelProviders();
  const [highlightedProviderIndex, setHighlightedProviderIndex] = useState(-1);
  const [highlightedModelIndex, setHighlightedModelIndex] = useState(-1);

  // Update local state when default props change (e.g., after reset)
  useEffect(() => {
    setSelectedModel(defaultModel);
    setSelectedProvider(defaultProvider || '');
  }, [defaultModel, defaultProvider]);

  // Refs for the inputs
  const modelInputRef = useRef<HTMLInputElement>(null);
  const providerInputRef = useRef<HTMLInputElement>(null);
  const providers = dataProviders?.providers || [];

  const currentModelProvider = cleanProviderId(selectedProvider);

  // Get all models with their provider info
  const allModels = useMemo(() => {
    return providers.flatMap(provider =>
      provider.models.map(model => ({
        provider: provider.id,
        providerName: provider.name,
        model: model,
      })),
    );
  }, [providers]);

  // Filter and sort providers based on search and connection status
  const filteredProviders = useMemo(() => {
    const searchTerm = isSearchingProvider ? providerSearch : '';

    let filtered = providers;
    if (searchTerm) {
      filtered = providers.filter(
        p =>
          p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.name.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Define popular providers in order
    const popularProviders = ['openai', 'anthropic', 'google', 'openrouter', 'netlify'];

    const getPopularityIndex = (providerId: string) => {
      const cleanId = providerId.toLowerCase().split('.')[0];
      const index = popularProviders.indexOf(cleanId);
      return index === -1 ? popularProviders.length : index;
    };

    // Sort by: 1) connection status, 2) popularity, 3) alphabetically
    return filtered.sort((a, b) => {
      // First, sort by connection status - connected providers first
      if (a.connected && !b.connected) return -1;
      if (!a.connected && b.connected) return 1;

      // Then by popularity
      const aPopularity = getPopularityIndex(a.id);
      const bPopularity = getPopularityIndex(b.id);
      if (aPopularity !== bPopularity) {
        return aPopularity - bPopularity;
      }

      // Finally, alphabetically by name
      return a.name.localeCompare(b.name);
    });
  }, [providers, providerSearch, isSearchingProvider]);

  // Filter models
  const filteredModels = useMemo(() => {
    let filtered = allModels;

    // Always filter by selected provider if one is selected
    if (currentModelProvider) {
      filtered = filtered.filter(m => m.provider === currentModelProvider);
    }

    // Then filter by search term when searching
    if (isSearchingModel && modelSearch) {
      filtered = filtered.filter(m => m.model.toLowerCase().includes(modelSearch.toLowerCase()));
    }

    // Sort alphabetically
    filtered.sort((a, b) => a.model.localeCompare(b.model));

    return filtered;
  }, [allModels, modelSearch, currentModelProvider, isSearchingModel]);

  // Auto-save when model changes
  const handleModelSelect = useCallback(
    async (modelId: string) => {
      setSelectedModel(modelId);
      setShowModelSuggestions(false);

      // Always use the current provider, even for custom model IDs
      const providerToUse = currentModelProvider || selectedProvider;

      if (modelId && providerToUse) {
        setLoading(true);
        try {
          await updateModel({
            provider: providerToUse as UpdateModelParams['provider'],
            modelId,
          });
        } catch (error) {
          console.error('Failed to update model:', error);
        } finally {
          setLoading(false);
        }
      }
    },
    [currentModelProvider, selectedProvider, updateModel],
  );

  // Handle provider selection
  const handleProviderSelect = useCallback(
    async (provider: Provider) => {
      setSelectedProvider(cleanProviderId(provider.id));
      setProviderSearch('');
      setIsSearchingProvider(false);
      setShowProviderSuggestions(false);
      setHighlightedProviderIndex(-1);

      // Only clear model selection when switching to a different provider
      if (provider.id !== currentModelProvider) {
        setSelectedModel('');
        setHighlightedModelIndex(0);
      }

      // Auto-focus model input if provider is connected
      if (provider.connected) {
        setTimeout(() => {
          modelInputRef.current?.focus();
          modelInputRef.current?.click();
        }, 100);
      }
    },
    [currentModelProvider],
  );

  // Handle reset button click - resets to the ORIGINAL model
  const handleReset = useCallback(async () => {
    if (!resetModel) {
      console.warn('Reset model function not provided');
      return;
    }

    setProviderSearch('');
    setModelSearch('');
    setIsSearchingProvider(false);
    setIsSearchingModel(false);
    setShowProviderSuggestions(false);
    setShowModelSuggestions(false);

    // Call the reset endpoint to restore the original model
    try {
      setLoading(true);
      await resetModel();
    } catch (error) {
      console.error('Failed to reset model:', error);
    } finally {
      setLoading(false);
    }
  }, [resetModel]);

  return {
    // State
    selectedProvider,
    selectedModel,
    currentModelProvider,
    providerSearch,
    modelSearch,
    isSearchingProvider,
    isSearchingModel,
    showProviderSuggestions,
    showModelSuggestions,
    loading,
    providersLoading,
    highlightedProviderIndex,
    highlightedModelIndex,

    // Data
    providers,
    filteredProviders,
    filteredModels,
    allModels,

    // Refs
    modelInputRef,
    providerInputRef,

    // Actions
    setProviderSearch,
    setModelSearch,
    setIsSearchingProvider,
    setIsSearchingModel,
    setShowProviderSuggestions,
    setShowModelSuggestions,
    setHighlightedProviderIndex,
    setHighlightedModelIndex,
    setSelectedModel,
    handleProviderSelect,
    handleModelSelect,
    handleReset,
  };
};
