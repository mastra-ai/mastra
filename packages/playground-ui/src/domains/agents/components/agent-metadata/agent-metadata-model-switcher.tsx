import { Input } from '@/components/ui/input';
import { useState, useMemo, useRef } from 'react';
import Spinner from '@/components/ui/spinner';
import { ProviderLogo } from './provider-logo';
// TODO: Replace with proper import when @mastra/client-js is available
interface UpdateModelParams {
  provider: string;
  modelId: string;
}
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getAllProviders, getAllModelsWithProvider, getProviderInfo } from '@mastra/core/llm';

export interface AgentMetadataModelSwitcherProps {
  defaultProvider: string;
  defaultModel: string;
  updateModel: (newModel: UpdateModelParams) => Promise<{ message: string }>;
  modelProviders: string[];
}

export const AgentMetadataModelSwitcher = ({
  defaultProvider,
  defaultModel,
  updateModel,
  modelProviders,
}: AgentMetadataModelSwitcherProps) => {
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [showModelSuggestions, setShowModelSuggestions] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(() => {
    // Use the provided defaultProvider directly
    return defaultProvider || '';
  });
  const [providerSearch, setProviderSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showProviderSuggestions, setShowProviderSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);

  // Ref for the model input to focus it
  const modelInputRef = useRef<HTMLInputElement>(null);
  // Get all available providers from the registry - wrapped in useMemo to avoid initialization issues
  const allProviders = useMemo(() => {
    try {
      const providers = getAllProviders();
      return providers || [];
    } catch (error) {
      console.error('Error getting providers:', error);
      // Fallback to known providers if there's an error
      return ['openai', 'anthropic', 'google', 'xai', 'groq', 'deepseek', 'together', 'mistral'];
    }
  }, []);

  // For the model switcher, show all available providers to give users maximum flexibility
  // Only filter if modelProviders is explicitly provided and non-empty
  const availableProviders = allProviders;

  // Filter providers based on search
  const filteredProviders = useMemo(() => {
    // Use providerSearch when actively searching
    const searchTerm = isSearching ? providerSearch : '';
    if (!searchTerm) return availableProviders.slice(0, 20); // Show first 20 when no search
    return availableProviders.filter(
      p =>
        p.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getProviderInfo(p)?.name?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [availableProviders, providerSearch, isSearching]);
  // Get all models with their provider info - wrapped in useMemo to avoid initialization issues
  const allModels = useMemo(() => {
    try {
      const models = getAllModelsWithProvider();
      return models || [];
    } catch (error) {
      console.error('Error getting models:', error);
      return [];
    }
  }, []);

  // Use the explicitly selected provider, don't search by model name since multiple providers can have the same model
  const currentModelProvider = selectedProvider;

  // Filter models based on available providers and search input
  const filteredModels = allModels
    .filter(item => availableProviders.includes(item.provider))
    .filter(item => {
      // If a provider is selected, only show models from that provider
      if (currentModelProvider) {
        return item.provider === currentModelProvider;
      }
      return true;
    })
    .filter(item => {
      // Show all models if search is empty, otherwise filter
      if (!selectedModel || selectedModel.trim() === '') {
        return true;
      }
      return item.model.toLowerCase().includes(selectedModel.toLowerCase());
    });

  // Auto-save when model changes
  const handleModelSelect = async (modelId: string, provider?: string) => {
    setSelectedModel(modelId);
    setShowModelSuggestions(false);

    // Determine the provider to use
    const providerToUse = provider || currentModelProvider || selectedProvider;

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
  };

  return (
    <div className="flex items-center gap-2">
      <Popover
        open={showProviderSuggestions}
        onOpenChange={open => {
          setShowProviderSuggestions(open);
          if (!open) {
            // Reset search state when closing
            setProviderSearch('');
            setIsSearching(false);
          }
        }}
      >
        <PopoverTrigger asChild>
          <div className="relative w-[180px]">
            {/* Show logo in the input when a provider is selected and not searching */}
            {!isSearching && (currentModelProvider || selectedProvider) && (
              <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                <ProviderLogo providerId={currentModelProvider || selectedProvider} size={16} />
              </div>
            )}
            <Input
              className={`w-full ${!isSearching && (currentModelProvider || selectedProvider) ? 'pl-8' : ''}`}
              type="text"
              value={
                isSearching
                  ? providerSearch
                  : currentModelProvider
                    ? getProviderInfo(currentModelProvider)?.name || currentModelProvider
                    : selectedProvider
                      ? getProviderInfo(selectedProvider)?.name || selectedProvider
                      : ''
              }
              onKeyDown={e => {
                // If user starts typing (not navigation keys), start searching
                if (!isSearching && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                  setIsSearching(true);
                  setProviderSearch('');
                }
              }}
              onChange={e => {
                setIsSearching(true);
                setProviderSearch(e.target.value);
              }}
              onClick={() => {
                // Toggle suggestions when clicking
                setShowProviderSuggestions(!showProviderSuggestions);
              }}
              placeholder="Search providers..."
            />
          </div>
        </PopoverTrigger>
        <PopoverContent
          onOpenAutoFocus={e => e.preventDefault()}
          className="flex flex-col gap-1 w-[var(--radix-popover-trigger-width)] max-h-[300px] overflow-y-auto p-1"
        >
          {filteredProviders.length === 0 ? (
            <div className="text-sm text-gray-500 p-2">No providers found</div>
          ) : (
            filteredProviders.map(providerId => {
              const providerInfo = getProviderInfo(providerId);
              const providerName = providerInfo?.name || providerId;
              const isSelected = providerId === (currentModelProvider || selectedProvider);

              return (
                <div
                  key={providerId}
                  className={`flex items-center gap-2 cursor-pointer hover:bg-surface5 p-2 rounded ${
                    isSelected ? 'bg-surface5' : ''
                  }`}
                  onClick={() => {
                    setSelectedProvider(providerId);
                    setProviderSearch('');
                    setIsSearching(false);
                    setShowProviderSuggestions(false);
                    // Clear the model when switching providers
                    if (providerId !== currentModelProvider) {
                      setSelectedModel('');
                    }
                    // Focus the model input after selecting a provider
                    setTimeout(() => {
                      modelInputRef.current?.focus();
                      modelInputRef.current?.click(); // Also trigger click to open suggestions
                    }, 100);
                  }}
                >
                  <ProviderLogo providerId={providerId} size={20} />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{providerName}</div>
                    <div className="text-xs text-gray-500">{providerId}</div>
                  </div>
                </div>
              );
            })
          )}
        </PopoverContent>
      </Popover>

      <Popover open={showModelSuggestions} onOpenChange={setShowModelSuggestions}>
        <PopoverTrigger asChild>
          <Input
            ref={modelInputRef}
            id="model-input"
            className="flex-1"
            type="text"
            value={selectedModel}
            onChange={e => {
              setSelectedModel(e.target.value);
            }}
            onClick={() => {
              // Only show suggestions on click, not focus to avoid flashing
              setShowModelSuggestions(true);
            }}
            placeholder="Enter model name or select from suggestions..."
          />
        </PopoverTrigger>

        {filteredModels.length > 0 && (
          <PopoverContent
            onOpenAutoFocus={e => e.preventDefault()}
            className="flex flex-col gap-2 w-[var(--radix-popover-trigger-width)] max-h-[calc(var(--radix-popover-content-available-height)-50px)] overflow-y-auto"
          >
            {filteredModels.map(item => {
              return (
                <div
                  className="flex items-center gap-2 cursor-pointer hover:bg-surface5 p-2"
                  key={`${item.provider}/${item.model}`}
                  onClick={() => {
                    handleModelSelect(item.model, item.provider);
                  }}
                >
                  <ProviderLogo providerId={item.provider} size={16} />
                  <span className="flex-1">{item.model}</span>
                  <span className="text-xs text-gray-500">{item.providerName}</span>
                </div>
              );
            })}
          </PopoverContent>
        )}
      </Popover>

      {loading && (
        <div className="flex items-center">
          <Spinner />
        </div>
      )}
    </div>
  );
};
