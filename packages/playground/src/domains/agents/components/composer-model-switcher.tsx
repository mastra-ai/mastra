import type { UpdateModelParams } from '@mastra/client-js';
import { cn } from '@mastra/playground-ui';
import { TriangleAlert } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAgent } from '../hooks/use-agent';
import { useUpdateAgentModel } from '../hooks/use-agents';
import { LLMProviders, LLMModels, useLLMProviders, cleanProviderId, findProviderById } from '@/domains/llm';

// Triggers stay transparent; the wrapper owns the shared pill border/background.
const COMPOSER_TRIGGER_CLASS = [
  'w-auto min-w-0 px-3 gap-1',
  'border-0 bg-transparent',
  'hover:bg-surface5 active:bg-surface6',
  'data-[popup-open]:bg-surface5',
  'transition-colors duration-normal',
].join(' ');

export interface ComposerModelSwitcherProps {
  agentId: string;
}

export const ComposerModelSwitcher = ({ agentId }: ComposerModelSwitcherProps) => {
  const { data: agent } = useAgent(agentId);
  const { mutateAsync: updateModel } = useUpdateAgentModel(agentId);
  const { data: dataProviders, isLoading: providersLoading } = useLLMProviders();

  const defaultProvider = agent?.provider || '';
  const defaultModel = agent?.modelId || '';

  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [selectedProvider, setSelectedProvider] = useState(defaultProvider);
  const [modelOpen, setModelOpen] = useState(false);

  const providers = dataProviders?.providers || [];

  // Update local state when agent data changes
  useEffect(() => {
    setSelectedModel(defaultModel);
    setSelectedProvider(defaultProvider);
  }, [defaultModel, defaultProvider]);

  const currentModelProvider = cleanProviderId(selectedProvider);

  // Resolve the full provider ID (handles gateway prefix, e.g., 'custom' -> 'acme/custom')
  const resolvedProvider = findProviderById(providers, currentModelProvider);
  const fullProviderId = resolvedProvider?.id || currentModelProvider;

  // Auto-save when model changes
  const handleModelSelect = async (modelId: string) => {
    setSelectedModel(modelId);

    if (modelId && fullProviderId) {
      try {
        await updateModel({
          provider: fullProviderId as UpdateModelParams['provider'],
          modelId,
        });
      } catch (error) {
        console.error('Failed to update model:', error);
      }
    }
  };

  // Handle provider selection
  const handleProviderSelect = (providerId: string) => {
    const cleanedId = cleanProviderId(providerId);
    setSelectedProvider(cleanedId);

    // Only clear model selection and open model combobox when switching to a different provider
    if (cleanedId !== currentModelProvider) {
      setSelectedModel('');
      setModelOpen(true);
    }
  };

  if (providersLoading) {
    return null;
  }

  return (
    <div className="inline-flex items-stretch max-w-full">
      <LLMProviders
        value={currentModelProvider}
        onValueChange={handleProviderSelect}
        size="md"
        className={cn(
          COMPOSER_TRIGGER_CLASS,
          'shrink-0',
          'rounded-none! rounded-tl-full! rounded-bl-full!',
          // Collapse provider to icon-only in narrow containers.
          '@max-md:px-2 @max-md:[&>span>span]:hidden @max-md:[&>svg]:hidden',
        )}
      />
      <div className="w-px self-stretch bg-border1" aria-hidden />
      <LLMModels
        llmId={currentModelProvider}
        value={selectedModel}
        onValueChange={handleModelSelect}
        open={modelOpen}
        onOpenChange={setModelOpen}
        size="md"
        className={cn(COMPOSER_TRIGGER_CLASS, 'rounded-none! rounded-tr-full! rounded-br-full!', 'max-w-[10rem]')}
      />
    </div>
  );
};

export const ComposerModelWarning = ({ agentId }: ComposerModelSwitcherProps) => {
  const { data: agent } = useAgent(agentId);
  const { data: dataProviders, isLoading: providersLoading } = useLLMProviders();

  if (providersLoading || !agent) return null;

  const providers = dataProviders?.providers || [];
  const currentModelProvider = cleanProviderId(agent.provider || '');
  const currentProvider = findProviderById(providers, currentModelProvider);

  if (!currentProvider || currentProvider.connected) return null;

  const envVar = Array.isArray(currentProvider.envVar) ? currentProvider.envVar.join(', ') : currentProvider.envVar;

  return (
    <div className="flex items-start gap-1 px-3 pb-1.5 text-accent6 text-xs min-w-0 max-w-full">
      <TriangleAlert className="w-3 h-3 shrink-0 mt-0.5" />
      <span className="min-w-0 break-words">
        Set <code className="px-1 py-0.5 bg-accent6Dark rounded text-accent6 break-all">{envVar}</code> to use this
        provider
      </span>
    </div>
  );
};
