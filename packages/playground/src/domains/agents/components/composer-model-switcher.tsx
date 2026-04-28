import type { UpdateModelParams } from '@mastra/client-js';
import { isModelAllowed } from '@mastra/core/agent-builder/ee';
import { Lock, TriangleAlert } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAgent } from '../hooks/use-agent';
import { useUpdateAgentModel } from '../hooks/use-agents';
import { useBuilderModelPolicy } from '@/domains/builder';
import { LLMProviders, LLMModels, useLLMProviders, cleanProviderId, findProviderById } from '@/domains/llm';

export interface ComposerModelSwitcherProps {
  agentId: string;
}

export const ComposerModelSwitcher = ({ agentId }: ComposerModelSwitcherProps) => {
  const { data: agent } = useAgent(agentId);
  const { mutateAsync: updateModel } = useUpdateAgentModel(agentId);
  const { data: dataProviders, isLoading: providersLoading } = useLLMProviders();
  const policy = useBuilderModelPolicy();

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

  const currentProvider = findProviderById(providers, currentModelProvider);

  if (providersLoading) {
    return null;
  }

  // Admin locked the picker — surface a non-interactive chip instead.
  if (policy.active && policy.pickerVisible === false) {
    const lockedLabel =
      policy.default && policy.default.provider && policy.default.modelId
        ? `${policy.default.provider}/${policy.default.modelId}`
        : selectedProvider && selectedModel
          ? `${selectedProvider}/${selectedModel}`
          : 'Locked by admin';
    return (
      <div
        className="flex items-center gap-1.5 rounded-md border border-border1 bg-surface3 px-2 py-1 text-ui-xs text-neutral6"
        data-testid="composer-model-locked"
      >
        <Lock className="h-3.5 w-3.5 shrink-0 text-neutral3" />
        <span className="truncate">{lockedLabel}</span>
      </div>
    );
  }

  const stale =
    Boolean(currentModelProvider && selectedModel) &&
    policy.active &&
    policy.allowed !== undefined &&
    !isModelAllowed(policy.allowed, { provider: currentModelProvider, modelId: selectedModel });

  const showWarning = currentProvider && !currentProvider.connected;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <LLMProviders value={currentModelProvider} onValueChange={handleProviderSelect} />

        <LLMModels
          llmId={currentModelProvider}
          value={selectedModel}
          onValueChange={handleModelSelect}
          open={modelOpen}
          onOpenChange={setModelOpen}
          className="min-w-48"
        />
      </div>
      {stale && (
        <div
          className="flex items-center gap-1 text-accent6 text-xs"
          data-testid="composer-model-stale-warning"
          role="alert"
        >
          <TriangleAlert className="w-3 h-3 shrink-0" />
          <span>
            <code className="px-1 py-0.5 bg-accent6Dark rounded text-accent6">
              {selectedProvider}/{selectedModel}
            </code>{' '}
            is no longer allowed by admin policy. Pick a different model.
          </span>
        </div>
      )}
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
