import { useState, useRef, forwardRef } from 'react';
import { ChevronDown, RotateCcw, Info, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { Input } from '@/ds/components/Input';
import { Button } from '@/ds/components/Button';
import { Spinner } from '@/ds/components/Spinner';
import { ProviderLogo } from '@/lib/shared/provider-logo';
import { useModelSwitcher, UseModelSwitcherProps } from '@/domains/agents/hooks/use-model-switcher';
import { useAgent } from '@/domains/agents/hooks/use-agent';
import { useUpdateAgentModel, useResetAgentModel } from '@/domains/agents/hooks/use-agents';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/ds/components/Alert';
import { Provider } from '@mastra/client-js';

interface ComposerModelSwitcherProps {
  agentId: string;
}

type TabType = 'provider' | 'model';

export const ComposerModelSwitcher = ({ agentId }: ComposerModelSwitcherProps) => {
  const { data: agent, isLoading: agentLoading } = useAgent(agentId);
  const { mutateAsync: updateModel } = useUpdateAgentModel(agentId);
  const { mutateAsync: resetModel } = useResetAgentModel(agentId);

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('provider');

  if (agentLoading || !agent) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 text-sm text-neutral3">
        <Spinner className="h-4 w-4" />
      </div>
    );
  }

  // Don't show for agents with modelList (multi-model)
  if (agent.modelList) {
    return null;
  }

  return (
    <ComposerModelSwitcherContent
      key={`${agent.provider}-${agent.modelId}`}
      defaultProvider={agent.provider}
      defaultModel={agent.modelId}
      updateModel={updateModel}
      resetModel={resetModel}
      open={open}
      setOpen={setOpen}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
    />
  );
};

interface ComposerModelSwitcherContentProps extends UseModelSwitcherProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

const ComposerModelSwitcherContent = ({
  defaultProvider,
  defaultModel,
  updateModel,
  resetModel,
  open,
  setOpen,
  activeTab,
  setActiveTab,
}: ComposerModelSwitcherContentProps) => {
  const {
    selectedProvider,
    selectedModel,
    currentModelProvider,
    providerSearch,
    modelSearch,
    isSearchingProvider,
    isSearchingModel,
    loading,
    providersLoading,
    highlightedProviderIndex,
    highlightedModelIndex,
    providers,
    filteredProviders,
    filteredModels,
    setProviderSearch,
    setModelSearch,
    setIsSearchingProvider,
    setIsSearchingModel,
    setHighlightedProviderIndex,
    setHighlightedModelIndex,
    handleProviderSelect,
    handleModelSelect,
    handleReset,
  } = useModelSwitcher({
    defaultProvider,
    defaultModel,
    updateModel,
    resetModel,
  });

  const providerInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

  const currentProvider = providers.find(p => p.id === currentModelProvider);
  const displayProviderName = currentProvider?.name || currentModelProvider || 'Select provider';
  const displayModelName = selectedModel || 'Select model';

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setProviderSearch('');
      setModelSearch('');
      setIsSearchingProvider(false);
      setIsSearchingModel(false);
      setHighlightedProviderIndex(-1);
      setHighlightedModelIndex(-1);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setProviderSearch('');
    setModelSearch('');
    setIsSearchingProvider(false);
    setIsSearchingModel(false);

    // Focus the appropriate input after tab change
    setTimeout(() => {
      if (tab === 'provider') {
        providerInputRef.current?.focus();
      } else {
        modelInputRef.current?.focus();
      }
    }, 50);
  };

  const onProviderSelect = async (provider: (typeof providers)[0]) => {
    await handleProviderSelect(provider);
    if (provider.connected) {
      setActiveTab('model');
      setTimeout(() => {
        modelInputRef.current?.focus();
      }, 50);
    }
  };

  const onModelSelect = async (modelId: string) => {
    await handleModelSelect(modelId);
    setOpen(false);

    // Focus the chat input after selection
    setTimeout(() => {
      const chatInput = document.querySelector('textarea[data-chat-input]') as HTMLTextAreaElement;
      if (chatInput) {
        chatInput.focus();
      } else {
        const anyTextarea = document.querySelector('textarea') as HTMLTextAreaElement;
        anyTextarea?.focus();
      }
    }, 100);
  };

  if (providersLoading) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 text-sm text-neutral3">
        <Spinner className="h-4 w-4" />
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-md text-sm',
            'text-neutral3 hover:text-neutral6 hover:bg-surface5',
            'transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent1',
            loading && 'opacity-60',
          )}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ProviderLogo providerId={currentModelProvider} size={16} />
          )}
          <span className="max-w-[100px] truncate">{displayProviderName}</span>
          <span className="text-neutral2">/</span>
          <span className="max-w-[150px] truncate">{displayModelName}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[320px] p-0"
        onOpenAutoFocus={e => e.preventDefault()}
      >
        {/* Tabs */}
        <div className="flex border-b border-border1">
          <button
            type="button"
            onClick={() => handleTabChange('provider')}
            className={cn(
              'flex-1 px-4 py-2 text-sm font-medium transition-colors',
              activeTab === 'provider'
                ? 'text-neutral6 border-b-2 border-accent1 -mb-px'
                : 'text-neutral3 hover:text-neutral5',
            )}
          >
            Provider
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('model')}
            className={cn(
              'flex-1 px-4 py-2 text-sm font-medium transition-colors',
              activeTab === 'model'
                ? 'text-neutral6 border-b-2 border-accent1 -mb-px'
                : 'text-neutral3 hover:text-neutral5',
            )}
          >
            Model
          </button>
          <div className="flex items-center pr-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={loading}
              className="h-7 w-7 p-0"
              title="Reset to original model"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-2">
          {activeTab === 'provider' ? (
            <ProviderTab
              ref={providerInputRef}
              providers={filteredProviders}
              currentModelProvider={currentModelProvider}
              providerSearch={providerSearch}
              isSearchingProvider={isSearchingProvider}
              highlightedProviderIndex={highlightedProviderIndex}
              onProviderSelect={onProviderSelect}
              onSearchChange={value => {
                setProviderSearch(value);
                setIsSearchingProvider(true);
                setHighlightedProviderIndex(0);
              }}
              onHighlightChange={setHighlightedProviderIndex}
            />
          ) : (
            <ModelTab
              ref={modelInputRef}
              models={filteredModels}
              selectedModel={selectedModel}
              modelSearch={modelSearch}
              isSearchingModel={isSearchingModel}
              highlightedModelIndex={highlightedModelIndex}
              currentProvider={currentProvider}
              loading={loading}
              onModelSelect={onModelSelect}
              onSearchChange={(value: string) => {
                setModelSearch(value);
                setIsSearchingModel(true);
                setHighlightedModelIndex(0);
              }}
              onHighlightChange={setHighlightedModelIndex}
              onCustomModelSubmit={onModelSelect}
            />
          )}
        </div>

        {/* Provider warning */}
        {currentProvider && !currentProvider.connected && (
          <div className="p-2 border-t border-border1">
            <Alert variant="warning">
              <AlertTitle as="h5">Provider not connected</AlertTitle>
              <AlertDescription as="p">
                Set{' '}
                <code className="px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900/50 rounded text-xs">
                  {Array.isArray(currentProvider.envVar)
                    ? currentProvider.envVar.join(', ')
                    : currentProvider.envVar}
                </code>{' '}
                to use this provider.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

interface ProviderTabProps {
  providers: Provider[];
  currentModelProvider: string;
  providerSearch: string;
  isSearchingProvider: boolean;
  highlightedProviderIndex: number;
  onProviderSelect: (provider: Provider) => void;
  onSearchChange: (value: string) => void;
  onHighlightChange: (index: number | ((prev: number) => number)) => void;
}

const ProviderTab = forwardRef<HTMLInputElement, ProviderTabProps>(
  (
    {
      providers,
      currentModelProvider,
      providerSearch,
      isSearchingProvider,
      highlightedProviderIndex,
      onProviderSelect,
      onSearchChange,
      onHighlightChange,
    },
    ref,
  ) => {
    const handleKeyDown = (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          onHighlightChange(prev => (prev < providers.length - 1 ? prev + 1 : 0));
          setTimeout(() => {
            document.querySelector('[data-provider-highlighted="true"]')?.scrollIntoView({ block: 'nearest' });
          }, 0);
          break;
        case 'ArrowUp':
          e.preventDefault();
          onHighlightChange(prev => (prev > 0 ? prev - 1 : providers.length - 1));
          setTimeout(() => {
            document.querySelector('[data-provider-highlighted="true"]')?.scrollIntoView({ block: 'nearest' });
          }, 0);
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedProviderIndex >= 0 && highlightedProviderIndex < providers.length) {
            onProviderSelect(providers[highlightedProviderIndex]);
          }
          break;
      }
    };

    return (
      <div className="flex flex-col gap-2">
        <Input
          ref={ref}
          type="text"
          placeholder="Search providers..."
          value={providerSearch}
          onChange={e => onSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm"
          autoFocus
        />
        <div className="max-h-[200px] overflow-y-auto flex flex-col gap-0.5">
          {providers.length === 0 ? (
            <div className="text-sm text-neutral3 p-2">No providers found</div>
          ) : (
            providers.map((provider, index) => {
              const isSelected = provider.id === currentModelProvider;
              const isHighlighted = index === highlightedProviderIndex;

              return (
                <div
                  key={provider.id}
                  data-provider-highlighted={isHighlighted}
                  className={cn(
                    'flex items-center gap-2 cursor-pointer hover:bg-surface5 px-3 py-2 rounded-md',
                    isHighlighted && 'outline outline-2 outline-blue-500',
                    isSelected && 'bg-surface5',
                  )}
                  onClick={() => onProviderSelect(provider)}
                >
                  <div className="relative">
                    <ProviderLogo providerId={provider.id} size={20} />
                    <div
                      className={cn(
                        'absolute -top-1 -right-1 w-2 h-2 rounded-full',
                        provider.connected ? 'bg-green-500' : 'bg-red-500',
                      )}
                      title={provider.connected ? 'Connected' : 'Not connected'}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{provider.name}</div>
                  </div>
                  {provider.docUrl && (
                    <Info
                      className="w-4 h-4 text-neutral3 hover:text-neutral5 cursor-pointer"
                      onClick={e => {
                        e.stopPropagation();
                        window.open(provider.docUrl, '_blank');
                      }}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  },
);
ProviderTab.displayName = 'ProviderTab';

interface ModelTabProps {
  models: Array<{ provider: string; providerName: string; model: string }>;
  selectedModel: string;
  modelSearch: string;
  isSearchingModel: boolean;
  highlightedModelIndex: number;
  currentProvider?: Provider;
  loading: boolean;
  onModelSelect: (modelId: string) => void;
  onSearchChange: (value: string) => void;
  onHighlightChange: (index: number | ((prev: number) => number)) => void;
  onCustomModelSubmit: (modelId: string) => void;
}

const ModelTab = forwardRef<HTMLInputElement, ModelTabProps>(
  (
    {
      models,
      selectedModel,
      modelSearch,
      isSearchingModel,
      highlightedModelIndex,
      currentProvider,
      loading,
      onModelSelect,
      onSearchChange,
      onHighlightChange,
      onCustomModelSubmit,
    },
    ref,
  ) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          onHighlightChange(prev => (prev < models.length - 1 ? prev + 1 : prev));
          setTimeout(() => {
            document.querySelector('[data-model-highlighted="true"]')?.scrollIntoView({ block: 'nearest' });
          }, 0);
          break;
        case 'ArrowUp':
          e.preventDefault();
          onHighlightChange(prev => (prev > 0 ? prev - 1 : models.length - 1));
          setTimeout(() => {
            document.querySelector('[data-model-highlighted="true"]')?.scrollIntoView({ block: 'nearest' });
          }, 0);
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedModelIndex >= 0 && highlightedModelIndex < models.length) {
            onModelSelect(models[highlightedModelIndex].model);
          } else if (modelSearch.trim()) {
            onCustomModelSubmit(modelSearch.trim());
          }
          break;
      }
    };

    return (
      <div className="flex flex-col gap-2">
        <Input
          ref={ref}
          type="text"
          placeholder="Search or enter model name..."
          value={modelSearch || (isSearchingModel ? '' : selectedModel)}
          onChange={e => onSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm"
          autoFocus
        />
        <div className="max-h-[200px] overflow-y-auto flex flex-col gap-0.5">
          {loading ? (
            <div className="p-4 text-center">
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            </div>
          ) : models.length === 0 ? (
            <div className="text-sm text-neutral3 p-2">
              {modelSearch ? 'No models found. Press Enter to use as custom model.' : 'No models available'}
            </div>
          ) : (
            models.map((model, index) => {
              const isHighlighted = index === highlightedModelIndex;
              const isSelected = model.model === selectedModel;

              return (
                <div
                  key={`${model.provider}-${model.model}`}
                  data-model-highlighted={isHighlighted}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md hover:bg-surface5',
                    isHighlighted && 'outline outline-2 outline-blue-500',
                    isSelected && 'bg-surface5',
                  )}
                  onClick={() => onModelSelect(model.model)}
                >
                  <span className="text-sm truncate">{model.model}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  },
);
ModelTab.displayName = 'ModelTab';
