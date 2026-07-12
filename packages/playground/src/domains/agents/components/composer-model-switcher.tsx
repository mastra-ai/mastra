import type { UpdateModelParams } from '@mastra/client-js';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Lock, TriangleAlert } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAgent } from '../hooks/use-agent';
import { useUpdateAgentModel } from '../hooks/use-agents';
import { useBuilderModelPolicy } from '@/domains/agent-builder';
import { useAgentBuilderAllowedModels } from '@/domains/agent-builder/hooks/use-agent-builder-allowed-models';
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
        <Lock className="size-3.5 shrink-0 text-neutral3" />
        <span className="truncate">{lockedLabel}</span>
      </div>
    );
  }

  return (
    <div className="inline-flex max-w-full items-stretch">
      <LLMProviders
        value={currentModelProvider}
        onValueChange={handleProviderSelect}
        size="md"
        className={cn(
          COMPOSER_TRIGGER_CLASS,
          'shrink-0',
          'rounded-none! rounded-l-full',
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
        className={cn(COMPOSER_TRIGGER_CLASS, 'rounded-none! rounded-r-full', 'max-w-40')}
      />
    </div>
  );
};

export const ComposerModelWarning = ({ agentId }: ComposerModelSwitcherProps) => {
  const { data: agent } = useAgent(agentId);
  const { data: dataProviders, isLoading: providersLoading } = useLLMProviders();
  const policy = useBuilderModelPolicy();
  const { models: allowedModels } = useAgentBuilderAllowedModels();

  if (providersLoading || !agent) return null;

  const providers = dataProviders?.providers || [];
  const currentModelProvider = cleanProviderId(agent.provider || '');
  const currentProvider = findProviderById(providers, currentModelProvider);
  const selectedModel = agent.modelId || '';

  const stale =
    Boolean(currentModelProvider && selectedModel) &&
    policy.active &&
    policy.allowed !== undefined &&
    !allowedModels.some(m => cleanProviderId(m.provider) === currentModelProvider && m.model === selectedModel);

  const showProviderWarning = currentProvider && !currentProvider.connected;

  if (!stale && !showProviderWarning) return null;

  const envVar =
    currentProvider && Array.isArray(currentProvider.envVar)
      ? currentProvider.envVar.join(', ')
      : currentProvider?.envVar;

  return (
    <div className="flex flex-col gap-1 px-3 pb-1.5">
      {stale && (
        <div
          className="flex max-w-full min-w-0 items-start gap-1 text-xs text-accent6"
          data-testid="composer-model-stale-warning"
          role="alert"
        >
          <TriangleAlert className="mt-0.5 size-3 shrink-0" />
          <span className="min-w-0 break-words">
            <code className="rounded bg-accent6Dark px-1 py-0.5 break-all text-accent6">
              {agent.provider}/{selectedModel}
            </code>{' '}
            is no longer allowed by admin policy. Pick a different model.
          </span>
        </div>
      )}
      {showProviderWarning && (
        <div className="flex max-w-full min-w-0 items-start gap-1 text-xs text-accent6">
          <TriangleAlert className="mt-0.5 size-3 shrink-0" />
          <span className="min-w-0 break-words">
            Set <code className="rounded bg-accent6Dark px-1 py-0.5 break-all text-accent6">{envVar}</code> to use this
            provider
          </span>
        </div>
      )}
    </div>
  );
};
