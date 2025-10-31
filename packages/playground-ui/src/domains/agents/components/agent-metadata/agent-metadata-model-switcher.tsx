import { useState, useRef, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import Spinner from '@/components/ui/spinner';
import { Loader2, RotateCcw } from 'lucide-react';
import { ProviderLogo } from './provider-logo';
import { UpdateModelParams } from '@mastra/client-js';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Info } from 'lucide-react';
import { useModelReset } from '../../context/model-reset-context';
import { cn } from '@/lib/utils';
import { cleanProviderId } from './utils';
import { Alert, AlertDescription, AlertTitle } from '@/ds/components/Alert';
import { Button } from '@/ds/components/Button';
import { useAgentsModelProviders } from '../../hooks/use-agents-model-providers';
import { Provider } from '@mastra/client-js';

export interface AgentMetadataModelSwitcherProps {
  defaultProvider: string;
  defaultModel: string;
  updateModel: (newModel: UpdateModelParams) => Promise<{ message: string }>;
  resetModel?: () => Promise<{ message: string }>;
  closeEditor?: () => void;
  autoSave?: boolean;
  selectProviderPlaceholder?: string;
}

export const AgentMetadataModelSwitcher = ({
  defaultProvider,
  defaultModel,
  updateModel,
  resetModel,
}: AgentMetadataModelSwitcherProps) => {
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

  // Ref for the model input to focus it
  const modelInputRef = useRef<HTMLInputElement>(null);
  const providerInputRef = useRef<HTMLInputElement>(null);
  const providers = dataProviders?.providers || [];

  // Fetch providers from the server or use mock data for now

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
  }, [providers, providerSearch, isSearchingProvider]);

  // Filter models - this is computed inline in the original, but we'll keep it as a useMemo
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
  };

  // Get the model reset context
  const { registerResetFn } = useModelReset();

  // Register reset callback with context
  useEffect(() => {
    const resetIfIncomplete = () => {
      // Don't reset if either picker is currently focused or their popovers are open
      if (
        modelInputRef.current === document.activeElement ||
        providerInputRef.current === document.activeElement ||
        showProviderSuggestions ||
        showModelSuggestions
      ) {
        return;
      }

      // Check if provider changed but no model selected
      const providerChanged = currentModelProvider && currentModelProvider !== originalProvider;
      const modelEmpty = !selectedModel || selectedModel === '';

      if (providerChanged && modelEmpty) {
        // Reset to original values
        setSelectedProvider(cleanProviderId(originalProvider));
        setSelectedModel(originalModel);

        // Update back to original configuration
        if (originalProvider && originalModel) {
          updateModel({
            provider: originalProvider as UpdateModelParams['provider'],
            modelId: originalModel,
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
  }, [
    registerResetFn,
    currentModelProvider,
    selectedModel,
    originalProvider,
    originalModel,
    updateModel,
    showProviderSuggestions,
    showModelSuggestions,
  ]);

  if (providersLoading) {
    return (
      <div className="flex items-center gap-2">
        <Spinner />
        <span className="text-sm text-gray-500">Loading providers...</span>
      </div>
    );
  }

  // Handle reset button click - resets to the ORIGINAL model
  const handleReset = async () => {
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
      // After reset, the agent will be re-fetched with the original model
      // which will update the defaultProvider and defaultModel props
    } catch (error) {
      console.error('Failed to reset model:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-2 w-full">
        <Popover
          open={showProviderSuggestions}
          onOpenChange={open => {
            setShowProviderSuggestions(open);
            if (!open) {
              setProviderSearch('');
              setIsSearchingProvider(false);
            }
          }}
        >
          <PopoverTrigger asChild>
            <div className="relative w-full xl:w-2/5">
              {!isSearchingProvider && currentModelProvider && (
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
                aria-label="Search providers"
                spellCheck="false"
                ref={providerInputRef}
                className={`w-full ${!isSearchingProvider && currentModelProvider ? 'pl-8 pr-8' : ''}`}
                type="text"
                value={
                  isSearchingProvider
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

                  if (!isSearchingProvider && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                    // Only clear search when actually typing, not when tabbing
                    setIsSearchingProvider(true);
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
                      case 'Escape':
                        e.preventDefault();
                        setIsSearchingProvider(false);
                        setProviderSearch('');
                        setHighlightedProviderIndex(-1);
                        setShowProviderSuggestions(false);
                        break;
                    }
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
                  setIsSearchingProvider(true);
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
            className="flex flex-col gap-0.5 w-[var(--radix-popover-trigger-width)] max-h-[300px] overflow-y-auto p-2"
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
                    className={`flex items-center gap-2 cursor-pointer hover:bg-surface5 px-3 py-4 rounded ${
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
              setIsSearchingModel(false);
            }
          }}
        >
          <PopoverTrigger asChild>
            <Input
              aria-label="Search models"
              spellCheck="false"
              ref={modelInputRef}
              className="w-full xl:w-3/5"
              type="text"
              value={modelSearch || selectedModel}
              onChange={e => {
                setSelectedModel(e.target.value);
                setModelSearch(e.target.value);
                setIsSearchingModel(true);
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
                    e.preventDefault();
                    if (highlightedModelIndex >= 0 && highlightedModelIndex < filteredModels.length) {
                      // User selected a model from the list
                      const model = filteredModels[highlightedModelIndex];
                      setModelSearch('');
                      setIsSearchingModel(false);
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
                      setIsSearchingModel(false);
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
              placeholder="Enter model name or select from suggestions..."
            />
          </PopoverTrigger>

          {allModels.length > 0 && (
            <PopoverContent
              className="flex flex-col gap-0 w-[var(--radix-popover-trigger-width)] max-h-[calc(var(--radix-popover-content-available-height)-50px)] overflow-y-auto p-2"
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
                      className={`flex items-center gap-2 px-4 py-3 cursor-pointer rounded hover:bg-surface5 ${
                        isHighlighted ? 'outline outline-2 outline-blue-500' : ''
                      } ${isSelected ? 'bg-surface5' : ''}`}
                      onMouseDown={e => {
                        e.preventDefault();
                        setModelSearch('');
                        setIsSearchingModel(false);
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
        <Button
          variant="light"
          size="md"
          onClick={handleReset}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs whitespace-nowrap !border-0"
          title="Reset to original model"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Show warning if selected provider is not connected */}
      {(() => {
        const currentProvider = providers.find(p => p.id === currentModelProvider);
        if (currentProvider && !currentProvider.connected) {
          return (
            <div className="pt-2 p-2">
              <Alert variant="warning">
                <AlertTitle as="h5">Provider not connected</AlertTitle>
                <AlertDescription as="p">
                  Set the{' '}
                  <code className="px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900/50 rounded">
                    {Array.isArray(currentProvider.envVar) ? currentProvider.envVar.join(', ') : currentProvider.envVar}
                  </code>{' '}
                  environment{' '}
                  {Array.isArray(currentProvider.envVar) && currentProvider.envVar.length > 1
                    ? 'variables'
                    : 'variable'}{' '}
                  to use this provider.
                </AlertDescription>
              </Alert>
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
