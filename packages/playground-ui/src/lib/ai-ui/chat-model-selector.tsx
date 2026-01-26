import { useState, useRef, useMemo } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { UpdateModelParams } from '@mastra/client-js';
import { useAgentsModelProviders } from '@/domains/agents/hooks/use-agents-model-providers';
import { useAgent } from '@/domains/agents/hooks/use-agent';
import { useUpdateAgentModel, useResetAgentModel } from '@/domains/agents/hooks/use-agents';
import { ProviderLogo } from '@/domains/agents/components/agent-metadata/provider-logo';
import { cleanProviderId } from '@/domains/agents/components/agent-metadata/utils';
import { cn } from '@/lib/utils';

export interface ChatModelSelectorProps {
  agentId?: string;
}

export const ChatModelSelector = ({ agentId }: ChatModelSelectorProps) => {
  const { data: agent } = useAgent(agentId);
  const { data: dataProviders, isLoading: providersLoading } = useAgentsModelProviders();
  const { mutateAsync: updateModel } = useUpdateAgentModel(agentId!);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const providers = dataProviders?.providers || [];

  const currentProvider = cleanProviderId(agent?.provider || '');
  const currentModel = agent?.modelId || '';

  // Get all models with their provider info, sorted with connected providers first
  const allModels = useMemo(() => {
    // Sort providers: connected first, then by popularity
    const popularProviders = ['openai', 'anthropic', 'google', 'openrouter', 'netlify'];
    const sortedProviders = [...providers].sort((a, b) => {
      // Connected providers first
      if (a.connected && !b.connected) return -1;
      if (!a.connected && b.connected) return 1;
      // Then by popularity
      const aIndex = popularProviders.indexOf(a.id.toLowerCase().split('.')[0]);
      const bIndex = popularProviders.indexOf(b.id.toLowerCase().split('.')[0]);
      const aPopularity = aIndex === -1 ? popularProviders.length : aIndex;
      const bPopularity = bIndex === -1 ? popularProviders.length : bIndex;
      if (aPopularity !== bPopularity) return aPopularity - bPopularity;
      return a.name.localeCompare(b.name);
    });

    return sortedProviders.flatMap(provider =>
      provider.models.map(model => ({
        provider: provider.id,
        providerName: provider.name,
        model: model,
        connected: provider.connected,
      })),
    );
  }, [providers]);

  const handleModelSelect = async (providerId: string, modelId: string) => {
    setLoading(true);
    setOpen(false);
    try {
      await updateModel({
        provider: providerId as UpdateModelParams['provider'],
        modelId,
      });
    } catch (error) {
      console.error('Failed to update model:', error);
    } finally {
      setLoading(false);
      // Focus back on the chat input
      setTimeout(() => {
        const chatInput = document.querySelector('textarea') as HTMLTextAreaElement;
        chatInput?.focus();
      }, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev < allModels.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : allModels.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < allModels.length) {
          const model = allModels[highlightedIndex];
          handleModelSelect(model.provider, model.model);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  if (!agentId || agent?.modelList) {
    // Don't show for agents with modelList (multi-model agents)
    return null;
  }

  if (providersLoading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-neutral3">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </div>
    );
  }

  const currentProviderData = providers.find(p => cleanProviderId(p.id) === currentProvider);

  return (
    <Popover
      open={open}
      onOpenChange={isOpen => {
        setOpen(isOpen);
        if (isOpen) {
          // Find and highlight current model
          const currentIndex = allModels.findIndex(
            m => m.model === currentModel && cleanProviderId(m.provider) === currentProvider,
          );
          setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
        } else {
          setHighlightedIndex(-1);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          onKeyDown={handleKeyDown}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs',
            'text-neutral3 hover:text-neutral6 hover:bg-surface4',
            'transition-colors focus:outline-none focus:ring-1 focus:ring-accent1',
            loading && 'opacity-50 pointer-events-none',
          )}
          data-testid="chat-model-selector"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <ProviderLogo providerId={currentProvider} size={14} />
              <span className="max-w-[120px] truncate">{currentModel}</span>
              {currentProviderData && !currentProviderData.connected && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" title="Provider not connected" />
              )}
              <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[280px] max-h-[300px] overflow-y-auto p-1"
        align="start"
        onOpenAutoFocus={e => e.preventDefault()}
      >
        {allModels.length === 0 ? (
          <div className="text-sm text-neutral3 p-2">No models available</div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {allModels.map((model, index) => {
              const isHighlighted = index === highlightedIndex;
              const isSelected = model.model === currentModel && cleanProviderId(model.provider) === currentProvider;
              const modelProvider = providers.find(p => p.id === model.provider);

              return (
                <button
                  key={`${model.provider}-${model.model}`}
                  type="button"
                  data-highlighted={isHighlighted}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs w-full',
                    'hover:bg-surface5 transition-colors',
                    isHighlighted && 'outline outline-1 outline-accent1',
                    isSelected && 'bg-surface5',
                    !model.connected && 'opacity-60',
                  )}
                  onClick={() => handleModelSelect(model.provider, model.model)}
                >
                  <div className="relative flex-shrink-0">
                    <ProviderLogo providerId={model.provider} size={16} />
                    <div
                      className={cn(
                        'absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full',
                        model.connected ? 'bg-green-500' : 'bg-red-500',
                      )}
                      title={model.connected ? 'Connected' : 'Not connected'}
                    />
                  </div>
                  <span className="truncate flex-1 text-neutral6">{model.model}</span>
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
