import { useState, useRef, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import Spinner from '@/components/ui/spinner';
import { Loader2 } from 'lucide-react';
import { ProviderLogo } from './provider-logo';
import { UpdateModelParams } from '@mastra/client-js';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertCircle, Info } from 'lucide-react';
import { useModelReset } from '../../context/model-reset-context';
import { cn } from '@/lib/utils';
import { cleanProviderId } from './utils';

export interface AgentMetadataModelSwitcherProps {
  defaultProvider: string;
  defaultModel: string;
  updateModel: (newModel: UpdateModelParams) => Promise<{ message: string }>;
  closeEditor?: () => void;
  modelProviders: string[];
  apiUrl?: string;
  autoSave?: boolean;
  selectProviderPlaceholder?: string;
}

interface Provider {
  id: string;
  name: string;
  envVar: string;
  connected: boolean;
  docUrl?: string;
  models: string[];
}

export const AgentMetadataModelSwitcher = ({
  defaultProvider,
  defaultModel,
  updateModel,
  apiUrl = '/api/agents/providers',
  autoSave = false,
  selectProviderPlaceholder = 'Select provider',
}: AgentMetadataModelSwitcherProps) => {
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [showModelSuggestions, setShowModelSuggestions] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(defaultProvider || '');
  const [providerSearch, setProviderSearch] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showProviderSuggestions, setShowProviderSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [highlightedProviderIndex, setHighlightedProviderIndex] = useState(-1);
  const [highlightedModelIndex, setHighlightedModelIndex] = useState(-1);

  // Ref for the model input to focus it
  const modelInputRef = useRef<HTMLInputElement>(null);
  const providerInputRef = useRef<HTMLInputElement>(null);

  // Fetch providers from the server or use mock data for now
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setProvidersLoading(true);

        // Fetch from API
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch providers: ${response.status}`);
        }
        const data = await response.json();
        if (data.providers && Array.isArray(data.providers)) {
          setProviders(data.providers);
        } else {
          console.error('Invalid providers response format');
          setProviders([]);
        }
      } catch (error) {
        console.error('Error setting up providers:', error);
        setProviders([]);
      } finally {
        setProvidersLoading(false);
      }
    };

    fetchProviders();
  }, [apiUrl]);

  const currentModelProvider = selectedProvider;

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
    const searchTerm = isSearching ? providerSearch : '';

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
      const cleanId = providerId.toLowerCase().split('.')[0]; // Handle IDs like "openai.chat"
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
  }, [providers, providerSearch, isSearching]);

  // Filter models - this is computed inline in the original, but we'll keep it as a useMemo
  const filteredModels = useMemo(() => {
    let filtered = allModels;

    // Filter by selected provider first
    if (currentModelProvider) {
      filtered = filtered.filter(m => m.provider === currentModelProvider);
    }

    // Then filter by search term when searching
    if (isSearching && modelSearch) {
      filtered = filtered.filter(m => m.model.toLowerCase().includes(modelSearch.toLowerCase()));
    }

    // Sort alphabetically
    filtered.sort((a, b) => a.model.localeCompare(b.model));

    return filtered;
  }, [allModels, modelSearch, currentModelProvider, isSearching]);

  const [infoMsg, setInfoMsg] = useState('');

  // Auto-save when model changes
  const handleModelSelect = async (modelId: string) => {
    setSelectedModel(modelId);
    setShowModelSuggestions(false);

    // Only search within the current provider's models
    // This ensures custom model IDs stay with the selected provider
    const modelInfo = allModels.find(m => m.model === modelId && m.provider === currentModelProvider);

    // Always use the current provider, even for custom model IDs
    const providerToUse = currentModelProvider || selectedProvider;

    console.log('DEBUG: handleModelSelect called with:', { modelId, providerToUse, modelInfo, currentModelProvider });

    if (modelId && providerToUse) {
      setLoading(true);
      try {
        const result = await updateModel({
          provider: providerToUse as UpdateModelParams['provider'],
          modelId,
        });
        console.log('Model updated:', result);
      } catch (error) {
        console.error('Failed to update model:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle provider selection
  const handleProviderSelect = async (provider: Provider) => {
    setSelectedProvider(provider.id);
    setProviderSearch('');
    setIsSearching(false);
    setShowProviderSuggestions(false);
    setHighlightedProviderIndex(-1);

    // Only clear model selection when switching to a different provider
    if (provider.id !== currentModelProvider) {
      setSelectedModel('');
      setHighlightedModelIndex(0);
    }

    // Only auto-focus model input if provider is connected
    if (provider.connected) {
      setTimeout(() => {
        modelInputRef.current?.focus();
        modelInputRef.current?.click();
      }, 100);
    }
  };

  // Get the model reset context
  const { registerResetFn } = useModelReset();

  // Register reset callback with context
  useEffect(() => {
    const resetIfIncomplete = () => {
      // Check if provider changed but no model selected
      const providerChanged = currentModelProvider && currentModelProvider !== defaultProvider;
      const modelEmpty = !selectedModel || selectedModel === '';

      if (providerChanged && modelEmpty) {
        console.log('Incomplete model selection detected, reverting to defaults');

        // Reset to defaults
        setSelectedProvider(defaultProvider);
        setSelectedModel(defaultModel);

        // Update back to default configuration
        if (defaultProvider && defaultModel) {
          updateModel({
            provider: defaultProvider as UpdateModelParams['provider'],
            modelId: defaultModel,
          }).catch(error => {
            console.error('Failed to reset model:', error);
          });
        }
      }
    };

    registerResetFn(resetIfIncomplete);

    // Cleanup on unmount
    return () => {
      registerResetFn(null);
    };
  }, [registerResetFn, currentModelProvider, selectedModel, defaultProvider, defaultModel, updateModel]);

  if (providersLoading) {
    return (
      <div className="flex items-center gap-2">
        <Spinner />
        <span className="text-sm text-gray-500">Loading providers...</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Popover
          open={showProviderSuggestions}
          onOpenChange={open => {
            setShowProviderSuggestions(open);
            if (!open) {
              setProviderSearch('');
              setIsSearching(false);
            }
          }}
        >
          <PopoverTrigger asChild>
            <div className="relative w-[180px]">
              {!isSearching && currentModelProvider && (
                <>
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                    <div className="relative">
                      <ProviderLogo providerId={currentModelProvider} size={16} />
                      {(() => {
                        const provider = providers.find(p => p.id === cleanProviderId(currentModelProvider));
                        if (provider) {
                          return (
                            <div
                              className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                                provider.connected ? 'bg-green-500' : 'bg-red-500'
                              }`}
                              title={provider.connected ? 'Connected' : 'Not connected'}
                            />
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                  {(() => {
                    const provider = providers.find(p => p.id === cleanProviderId(currentModelProvider));
                    if (provider?.docUrl) {
                      return (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
                          <Info
                            className="w-3.5 h-3.5 text-gray-500 hover:text-gray-700 cursor-pointer"
                            onClick={e => {
                              e.stopPropagation();
                              window.open(provider.docUrl, '_blank');
                            }}
                          />
                        </div>
                      );
                    }
                    return null;
                  })()}
                </>
              )}
              <Input
                spellCheck="false"
                ref={providerInputRef}
                className={`w-full ${!isSearching && currentModelProvider ? 'pl-8 pr-8' : ''}`}
                type="text"
                value={
                  isSearching
                    ? providerSearch
                    : providers.find(p => p.id === cleanProviderId(currentModelProvider))?.name ||
                      currentModelProvider ||
                      ''
                }
                onKeyDown={e => {
                  const filteredProviders = providers.filter(
                    provider =>
                      provider.name.toLowerCase().includes(providerSearch.toLowerCase()) ||
                      provider.id.toLowerCase().includes(providerSearch.toLowerCase()),
                  );

                  if (!isSearching && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                    // Only clear search when actually typing, not when tabbing
                    setIsSearching(true);
                    setProviderSearch('');
                    setHighlightedProviderIndex(0);
                  } else if (showProviderSuggestions) {
                    switch (e.key) {
                      case 'ArrowDown':
                        e.preventDefault();
                        setHighlightedProviderIndex(prev => (prev < filteredProviders.length - 1 ? prev + 1 : 0));
                        // Auto-scroll to keep highlighted item visible
                        setTimeout(() => {
                          const highlightedElement = document.querySelector('[data-provider-highlighted="true"]');
                          highlightedElement?.scrollIntoView({ block: 'nearest' });
                        }, 0);
                        break;
                      case 'ArrowUp':
                        e.preventDefault();
                        setHighlightedProviderIndex(prev => (prev > 0 ? prev - 1 : filteredProviders.length - 1));
                        // Auto-scroll to keep highlighted item visible
                        setTimeout(() => {
                          const highlightedElement = document.querySelector('[data-provider-highlighted="true"]');
                          highlightedElement?.scrollIntoView({ block: 'nearest' });
                        }, 0);
                        break;
                      case 'Enter':
                        e.preventDefault();
                        if (highlightedProviderIndex >= 0 && highlightedProviderIndex < filteredProviders.length) {
                          const provider = filteredProviders[highlightedProviderIndex];
                          handleProviderSelect(provider);
                        }
                        break;
                      case 'Tab':
                        // Only prevent default and handle Tab if NOT shift+tab
                        if (!e.shiftKey) {
                          e.preventDefault();
                          if (highlightedProviderIndex >= 0 && highlightedProviderIndex < filteredProviders.length) {
                            const provider = filteredProviders[highlightedProviderIndex];
                            handleProviderSelect(provider);
                          } else {
                            // If no provider is highlighted, just close dropdown and let tab proceed
                            setShowProviderSuggestions(false);
                            setIsSearching(false);
                            setProviderSearch('');
                            setHighlightedProviderIndex(-1);
                          }
                        }
                        // If shift+tab, let it proceed normally
                        break;
                      case 'Escape':
                        e.preventDefault();
                        setIsSearching(false);
                        setProviderSearch('');
                        setHighlightedProviderIndex(-1);
                        setShowProviderSuggestions(false);
                        break;
                    }
                  } else if (e.key === 'Tab') {
                    // Handle Tab when dropdown is closed - just let it proceed normally
                    return;
                  }
                }}
                onFocus={() => {
                  // Auto-open dropdown when focused
                  if (!showProviderSuggestions) {
                    setShowProviderSuggestions(true);
                    // Find the index of the currently selected provider
                    const currentIndex = filteredProviders.findIndex(p => p.id === currentModelProvider);
                    setHighlightedProviderIndex(currentIndex >= 0 ? currentIndex : 0);

                    // Scroll to the selected provider after dropdown opens
                    setTimeout(() => {
                      const highlightedElement = document.querySelector('[data-provider-highlighted="true"]');
                      highlightedElement?.scrollIntoView({ block: 'nearest' });
                    }, 50);
                  }
                }}
                onChange={e => {
                  setIsSearching(true);
                  setProviderSearch(e.target.value);
                  setHighlightedProviderIndex(0);
                }}
                onClick={e => {
                  e.preventDefault(); // Prevent default click behavior
                  // Only open if not already open (prevents flashing)
                  if (!showProviderSuggestions) {
                    setShowProviderSuggestions(true);
                    // Find the index of the currently selected provider
                    const currentIndex = filteredProviders.findIndex(p => p.id === currentModelProvider);
                    setHighlightedProviderIndex(currentIndex >= 0 ? currentIndex : 0);
                  }
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
              filteredProviders.map((provider, index) => {
                const isSelected = provider.id === currentModelProvider;
                const isHighlighted = index === highlightedProviderIndex;

                return (
                  <div
                    key={provider.id}
                    data-provider-highlighted={isHighlighted}
                    className={`flex items-center gap-2 cursor-pointer hover:bg-surface5 p-2 rounded ${
                      isHighlighted ? 'outline outline-2 outline-blue-500' : ''
                    } ${isSelected ? 'bg-surface5' : ''}`}
                    onClick={() => handleProviderSelect(provider)}
                  >
                    <div className="relative">
                      <ProviderLogo providerId={provider.id} size={20} />
                      <div
                        className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                          provider.connected ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        title={provider.connected ? 'Connected' : 'Not connected'}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{provider.name}</div>
                      <div className="text-xs text-gray-500">{provider.id}</div>
                    </div>
                    <Info
                      className="w-4 h-4 text-gray-500 hover:text-gray-700 cursor-pointer"
                      onClick={e => {
                        e.stopPropagation();
                        window.open(provider.docUrl || '#', '_blank');
                      }}
                    />
                  </div>
                );
              })
            )}
          </PopoverContent>
        </Popover>

        <Popover
          open={showModelSuggestions}
          onOpenChange={open => {
            setShowModelSuggestions(open);
            if (!open) {
              setModelSearch('');
              setIsSearching(false);
            }
          }}
        >
          <PopoverTrigger asChild>
            <Input
              spellCheck="false"
              ref={modelInputRef}
              className="flex-1"
              type="text"
              value={modelSearch || selectedModel}
              onChange={e => {
                setSelectedModel(e.target.value);
                setModelSearch(e.target.value);
                setIsSearching(true);
                setHighlightedModelIndex(0);
              }}
              onClick={e => {
                e.preventDefault();
                if (!showModelSuggestions) {
                  setShowModelSuggestions(true);
                }
              }}
              onFocus={() => {
                // Open dropdown but don't interfere with keyboard navigation
                if (!showModelSuggestions) {
                  setShowModelSuggestions(true);
                }

                // Find and highlight the currently selected model
                const currentIndex = filteredModels.findIndex(m => m.model === selectedModel);
                setHighlightedModelIndex(currentIndex >= 0 ? currentIndex : 0);

                // Scroll to the selected model after dropdown opens
                setTimeout(() => {
                  const highlightedElement = document.querySelector('[data-model-highlighted="true"]');
                  highlightedElement?.scrollIntoView({ block: 'nearest' });
                }, 50);
              }}
              onKeyDown={e => {
                // Handle Shift+Tab to go back to provider input
                if (e.key === 'Tab' && e.shiftKey) {
                  e.preventDefault();
                  providerInputRef.current?.focus();
                  return;
                }

                switch (e.key) {
                  case 'ArrowDown':
                    e.preventDefault();
                    setHighlightedModelIndex(prev => (prev < filteredModels.length - 1 ? prev + 1 : prev));
                    // Auto-scroll to keep highlighted item visible
                    setTimeout(() => {
                      const highlightedElement = document.querySelector('[data-model-highlighted="true"]');
                      highlightedElement?.scrollIntoView({ block: 'nearest' });
                    }, 0);
                    break;
                  case 'ArrowUp':
                    e.preventDefault();
                    setHighlightedModelIndex(prev => (prev > 0 ? prev - 1 : filteredModels.length - 1));
                    // Auto-scroll to keep highlighted item visible
                    setTimeout(() => {
                      const highlightedElement = document.querySelector('[data-model-highlighted="true"]');
                      highlightedElement?.scrollIntoView({ block: 'nearest' });
                    }, 0);
                    break;
                  case 'Enter':
                  case 'Tab':
                    e.preventDefault();
                    if (highlightedModelIndex >= 0 && highlightedModelIndex < filteredModels.length) {
                      // User selected a model from the list
                      const model = filteredModels[highlightedModelIndex];
                      setModelSearch('');
                      setIsSearching(false);
                      setShowModelSuggestions(false);
                      handleModelSelect(model.model);
                      // After selecting a model, focus the chat input
                      setTimeout(() => {
                        const chatInput = document.querySelector('textarea[data-chat-input]') as HTMLElement;
                        if (!chatInput) {
                          // Fallback to any textarea if specific selector not found
                          const textarea = document.querySelector('textarea');
                          textarea?.focus();
                        } else {
                          chatInput?.focus();
                        }
                      }, 100);
                    } else if (selectedModel && selectedModel.trim()) {
                      // User entered a custom model ID - use it as-is with the current provider
                      setModelSearch('');
                      setIsSearching(false);
                      setShowModelSuggestions(false);
                      handleModelSelect(selectedModel.trim());
                      // After selecting a model, focus the chat input
                      setTimeout(() => {
                        const chatInput = document.querySelector('textarea[data-chat-input]') as HTMLElement;
                        if (!chatInput) {
                          // Fallback to any textarea if specific selector not found
                          const textarea = document.querySelector('textarea');
                          textarea?.focus();
                        } else {
                          chatInput?.focus();
                        }
                      }, 100);
                    } else {
                      // No model selected and no custom input, just close dropdown
                      setShowModelSuggestions(false);
                    }
                    break;
                  case 'Escape':
                    e.preventDefault();
                    setShowModelSuggestions(false);
                    setHighlightedModelIndex(-1);
                    break;
                }
              }}
              // onClick={() => {
              //   // Only open if not already open (prevents flashing)
              //   setShowModelSuggestions(true);
              // }}
              placeholder="Enter model name or select from suggestions..."
            />
          </PopoverTrigger>

          {allModels.length > 0 && (
            <PopoverContent
              className="flex flex-col gap-2 w-[var(--radix-popover-trigger-width)] max-h-[calc(var(--radix-popover-content-available-height)-50px)] overflow-y-auto"
              onOpenAutoFocus={e => e.preventDefault()}
            >
              {loading ? (
                <div className="p-4 text-center">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                </div>
              ) : filteredModels.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">No models found</div>
              ) : (
                filteredModels.map((model, index) => {
                  const isHighlighted = index === highlightedModelIndex;
                  const isSelected = model.model === selectedModel;
                  return (
                    <div
                      key={`${model.provider}-${model.model}`}
                      data-model-highlighted={isHighlighted}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-surface5 rounded ${
                        isHighlighted ? 'outline outline-2 outline-blue-500' : ''
                      } ${isSelected ? 'bg-surface5' : ''}`}
                      onMouseDown={e => {
                        e.preventDefault();
                        setModelSearch('');
                        setIsSearching(false);
                        handleModelSelect(model.model);
                        modelInputRef.current?.blur();

                        // Focus chat input after selection
                        setTimeout(() => {
                          const chatInput = document.querySelector('textarea[data-chat-input]') as HTMLTextAreaElement;
                          if (chatInput) {
                            chatInput.focus();
                          } else {
                            // Fallback to any textarea if data-chat-input not found
                            const anyTextarea = document.querySelector('textarea') as HTMLTextAreaElement;
                            if (anyTextarea) {
                              anyTextarea.focus();
                            }
                          }
                        }, 0);
                      }}
                    >
                      {model.model}
                    </div>
                  );
                })
              )}
            </PopoverContent>
          )}
        </Popover>
      </div>

      {/* Show warning if selected provider is not connected */}
      {(() => {
        const currentProvider = providers.find(p => p.id === currentModelProvider);
        if (currentProvider && !currentProvider.connected) {
          return (
            <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div className="text-sm text-yellow-800 dark:text-yellow-200">
                    <div className="font-medium">Provider not connected</div>
                    <div className="text-xs mt-1">
                      Set the{' '}
                      <code className="px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900/50 rounded">
                        {Array.isArray(currentProvider.envVar) 
                          ? currentProvider.envVar.join(', ') 
                          : currentProvider.envVar}
                      </code>{' '}
                      environment {Array.isArray(currentProvider.envVar) && currentProvider.envVar.length > 1 ? 'variables' : 'variable'} to use this provider.
                    </div>
                  </div>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {infoMsg && (
        <div
          className={cn(
            'text-[0.75rem] text-icon3 flex gap-[.5rem] mt-[0.5rem] ml-[.5rem]',
            '[&>svg]:w-[1.1em] [&>svg]:h-[1.1em] [&>svg]:opacity-7 [&>svg]:flex-shrink-0 [&>svg]:mt-[0.1rem]',
          )}
        >
          <Info /> {infoMsg}
        </div>
      )}
    </>
  );
};
