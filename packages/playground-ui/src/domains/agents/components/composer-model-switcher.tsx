import { useState, useEffect, useMemo } from 'react';
import { Spinner } from '@/ds/components/Spinner';
import { ProviderLogo } from './agent-metadata/provider-logo';
import { UpdateModelParams } from '@mastra/client-js';
import { cleanProviderId } from './agent-metadata/utils';
import { useAgentsModelProviders } from '../hooks/use-agents-model-providers';
import { useAgent } from '../hooks/use-agent';
import { useUpdateAgentModel } from '../hooks/use-agents';
import { Combobox, ComboboxOption } from '@/ds/components/Combobox';
import { TriangleAlert } from 'lucide-react';

export interface ComposerModelSwitcherProps {
  agentId: string;
}

export const ComposerModelSwitcher = ({ agentId }: ComposerModelSwitcherProps) => {
  const { data: agent } = useAgent(agentId);
  const { mutateAsync: updateModel } = useUpdateAgentModel(agentId);
  const { data: dataProviders, isLoading: providersLoading } = useAgentsModelProviders();

  const defaultProvider = agent?.provider || '';
  const defaultModel = agent?.modelId || '';

  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [selectedProvider, setSelectedProvider] = useState(defaultProvider);

  const providers = dataProviders?.providers || [];

  // Update local state when agent data changes
  useEffect(() => {
    setSelectedModel(defaultModel);
    setSelectedProvider(defaultProvider);
  }, [defaultModel, defaultProvider]);

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

  // Filter and sort providers based on connection status and popularity
  const sortedProviders = useMemo(() => {
    const popularProviders = ['openai', 'anthropic', 'google', 'openrouter', 'netlify'];

    const getPopularityIndex = (providerId: string) => {
      const cleanId = providerId.toLowerCase().split('.')[0];
      const index = popularProviders.indexOf(cleanId);
      return index === -1 ? popularProviders.length : index;
    };

    return [...providers].sort((a, b) => {
      if (a.connected && !b.connected) return -1;
      if (!a.connected && b.connected) return 1;

      const aPopularity = getPopularityIndex(a.id);
      const bPopularity = getPopularityIndex(b.id);
      if (aPopularity !== bPopularity) {
        return aPopularity - bPopularity;
      }

      return a.name.localeCompare(b.name);
    });
  }, [providers]);

  // Create provider options with icons
  const providerOptions: ComboboxOption[] = useMemo(() => {
    return sortedProviders.map(provider => ({
      label: provider.name,
      value: provider.id,
      start: (
        <div className="relative">
          <ProviderLogo providerId={provider.id} size={14} />
          <div
            className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
              provider.connected ? 'bg-accent1' : 'bg-accent2'
            }`}
            title={provider.connected ? 'Connected' : 'Not connected'}
          />
        </div>
      ),
    }));
  }, [sortedProviders]);

  // Filter models based on selected provider
  const filteredModels = useMemo(() => {
    if (!currentModelProvider) return [];
    return allModels.filter(m => m.provider === currentModelProvider).sort((a, b) => a.model.localeCompare(b.model));
  }, [allModels, currentModelProvider]);

  // Create model options
  const modelOptions: ComboboxOption[] = useMemo(() => {
    return filteredModels.map(m => ({
      label: m.model,
      value: m.model,
    }));
  }, [filteredModels]);

  // Auto-save when model changes
  const handleModelSelect = async (modelId: string) => {
    setSelectedModel(modelId);

    const providerToUse = currentModelProvider || selectedProvider;

    if (modelId && providerToUse) {
      try {
        await updateModel({
          provider: providerToUse as UpdateModelParams['provider'],
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

    if (cleanedId !== currentModelProvider) {
      setSelectedModel('');
    }
  };

  const currentProvider = providers.find(p => p.id === currentModelProvider);

  if (providersLoading) {
    return (
      <div className="flex items-center gap-2">
        <Spinner className="w-4 h-4" />
      </div>
    );
  }

  const showWarning = currentProvider && !currentProvider.connected;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Combobox
          options={providerOptions}
          value={currentModelProvider}
          onValueChange={handleProviderSelect}
          placeholder="Provider..."
          searchPlaceholder="Search providers..."
          emptyText="No providers found"
          variant="light"
        />

        <Combobox
          options={modelOptions}
          value={selectedModel}
          onValueChange={handleModelSelect}
          placeholder="Model..."
          searchPlaceholder="Search models..."
          emptyText="No models found"
          variant="light"
        />
      </div>
      {showWarning && (
        <div className="flex items-center gap-1 text-accent6 text-xs">
          <TriangleAlert className="w-3 h-3 shrink-0" />
          <span>
            Set{' '}
            <code className="px-1 py-0.5 bg-accent6Dark rounded text-accent6">
              {Array.isArray(currentProvider.envVar) ? currentProvider.envVar.join(', ') : currentProvider.envVar}
            </code>{' '}
            to use this provider
          </span>
        </div>
      )}
    </div>
  );
};
