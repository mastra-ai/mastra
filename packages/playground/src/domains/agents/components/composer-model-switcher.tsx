import { Badge } from '@mastra/playground-ui/components/Badge';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Lock, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { usePlaygroundModelOptional } from '../context/playground-model-context';
import { useBuilderModelPolicy } from '@/domains/agent-builder';
import { useAgentBuilderAllowedModels } from '@/domains/agent-builder/hooks/use-agent-builder-allowed-models';
import { LLMProviders, LLMModels, useLLMProviders, cleanProviderId, findProviderById } from '@/domains/llm';

export const ComposerModelSwitcher = () => {
  const selection = usePlaygroundModelOptional();
  const { data: dataProviders, isLoading: providersLoading } = useLLMProviders();
  const policy = useBuilderModelPolicy();

  const [modelOpen, setModelOpen] = useState(false);

  if (providersLoading || !selection) return null;

  const { provider: selectedProvider, model: selectedModel, setProvider, setModel } = selection;
  const providers = dataProviders?.providers || [];

  const currentModelProvider = cleanProviderId(selectedProvider);

  // Resolve the full provider ID (handles gateway prefix, e.g., 'custom' -> 'acme/custom')
  const resolvedProvider = findProviderById(providers, currentModelProvider);
  const fullProviderId = resolvedProvider?.id || currentModelProvider;

  const handleModelSelect = (modelId: string) => {
    if (modelId && fullProviderId) setModel(fullProviderId, modelId);
  };

  // Handle provider selection
  const handleProviderSelect = (providerId: string) => {
    const cleanedId = cleanProviderId(providerId);
    // Only clear model selection and open model combobox when switching to a different provider
    if (cleanedId !== currentModelProvider) {
      setProvider(cleanedId);
      setModelOpen(true);
    }
  };

  // Admin locked the picker — surface a non-interactive chip instead.
  if (policy.active && policy.pickerVisible === false) {
    const lockedLabel = selectedProvider && selectedModel ? `${selectedProvider}/${selectedModel}` : 'Locked by admin';
    return (
      <Badge icon={<Lock />} data-testid="composer-model-locked">
        {lockedLabel}
      </Badge>
    );
  }

  return (
    <ButtonsGroup className="max-w-full">
      <LLMProviders
        value={currentModelProvider}
        onValueChange={handleProviderSelect}
        size="md"
        className={cn(
          'w-auto min-w-0 shrink-0 gap-1 px-3',
          // Collapse provider to icon-only in narrow containers.
          '@max-md:px-2 @max-md:[&>span>span]:hidden @max-md:[&>svg]:hidden',
        )}
      />
      <LLMModels
        llmId={currentModelProvider}
        value={selectedModel}
        onValueChange={handleModelSelect}
        open={modelOpen}
        onOpenChange={setModelOpen}
        size="md"
        className="w-auto max-w-[10rem] min-w-0 gap-1 px-3"
      />
    </ButtonsGroup>
  );
};

export const ComposerModelWarning = () => {
  const selection = usePlaygroundModelOptional();
  const { data: dataProviders, isLoading: providersLoading } = useLLMProviders();
  const policy = useBuilderModelPolicy();
  const {
    models: allowedModels,
    isLoading: allowedModelsLoading,
    isError: allowedModelsError,
  } = useAgentBuilderAllowedModels();

  if (providersLoading || !selection) return null;

  const providers = dataProviders?.providers || [];
  const { provider, model, modelWarning } = selection;
  const currentModelProvider = cleanProviderId(provider);
  const currentProvider = findProviderById(providers, currentModelProvider);
  const selectedModel = model;

  const stale =
    Boolean(currentModelProvider && selectedModel) &&
    policy.active &&
    policy.allowed !== undefined &&
    !allowedModelsLoading &&
    !allowedModelsError &&
    !allowedModels.some(m => cleanProviderId(m.provider) === currentModelProvider && m.model === selectedModel);

  const showProviderWarning = currentProvider && !currentProvider.connected;

  if (!modelWarning && !stale && !showProviderWarning) return null;

  const envVar =
    currentProvider && Array.isArray(currentProvider.envVar)
      ? currentProvider.envVar.join(', ')
      : currentProvider?.envVar;

  return (
    <div className="flex flex-col gap-1 px-3 pb-1.5">
      {(modelWarning || stale) && (
        <div
          className="text-accent6 text-caption flex max-w-full min-w-0 items-start gap-1"
          data-testid="composer-model-stale-warning"
          role="alert"
        >
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="min-w-0 break-words">
            {modelWarning || (
              <>
                <code className="bg-accent6Dark text-accent6 rounded px-1 py-0.5 break-all">
                  {provider}/{selectedModel}
                </code>{' '}
                is no longer allowed by admin policy. Pick a different model.
              </>
            )}
          </span>
        </div>
      )}
      {showProviderWarning && (
        <div className="text-accent6 text-caption flex max-w-full min-w-0 items-start gap-1">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="min-w-0 break-words">
            Set <code className="bg-accent6Dark text-accent6 rounded px-1 py-0.5 break-all">{envVar}</code> to use this
            provider
          </span>
        </div>
      )}
    </div>
  );
};
