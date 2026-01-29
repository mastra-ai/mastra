import { useState, useEffect, useCallback, useMemo } from 'react';
import { UpdateModelParams } from '@mastra/client-js';
import { Spinner } from '@/ds/components/Spinner';
import { useAgent } from '../hooks/use-agent';
import { useUpdateAgentModel } from '../hooks/use-agents';
import {
  LLMProviderPicker,
  LLMModelPicker,
  ProviderWarning,
  useLLMProviders,
  useAllModels,
  cleanProviderId,
  findProvider,
} from '@/domains/llm';

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
  const allModels = useAllModels(providers);

  // Update local state when agent data changes
  useEffect(() => {
    setSelectedModel(defaultModel);
    setSelectedProvider(defaultProvider);
  }, [defaultModel, defaultProvider]);

  const currentModelProvider = cleanProviderId(selectedProvider);
  const currentProvider = useMemo(
    () => findProvider(providers, selectedProvider),
    [providers, selectedProvider],
  );

  // Auto-save when model changes
  const handleModelSelect = useCallback(
    async (modelId: string) => {
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
    },
    [currentModelProvider, selectedProvider, updateModel],
  );

  // Handle provider selection
  const handleProviderSelect = useCallback(
    (providerId: string) => {
      const cleanedId = cleanProviderId(providerId);
      setSelectedProvider(cleanedId);

      // Only clear model selection and open model combobox when switching to a different provider
      if (cleanedId !== currentModelProvider) {
        setSelectedModel('');
        setModelOpen(true);
      }
    },
    [currentModelProvider],
  );

  if (providersLoading) {
    return (
      <div className="flex items-center gap-2">
        <Spinner className="w-4 h-4" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <LLMProviderPicker
          providers={providers}
          value={currentModelProvider}
          onValueChange={handleProviderSelect}
          placeholder="Provider..."
          searchPlaceholder="Search providers..."
          emptyText="No providers found"
          variant="light"
          logoSize={14}
        />

        <LLMModelPicker
          models={allModels}
          provider={currentModelProvider}
          value={selectedModel}
          onValueChange={handleModelSelect}
          placeholder="Model..."
          searchPlaceholder="Search models..."
          emptyText="No models found"
          variant="light"
          className="min-w-48"
          open={modelOpen}
          onOpenChange={setModelOpen}
        />
      </div>

      <ProviderWarning provider={currentProvider} variant="inline" />
    </div>
  );
};
