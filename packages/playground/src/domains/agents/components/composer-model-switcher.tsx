import { Badge } from '@mastra/playground-ui/components/Badge';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { MissingProviderKeyNotice, ModelNotice, ModelPicker, cleanProviderId } from '@mastra/playground-ui/domains/llm';
import type { ModelPickerProvider } from '@mastra/playground-ui/domains/llm';
import { IconLock } from '@mastra/playground-ui/icons/central/IconLock';
import { useLLMProviders } from '@mastra/react/hooks/llm';
import { usePlaygroundModelOptional } from '../context/playground-model-context';
import { useBuilderFilteredModels, useBuilderFilteredProviders, useBuilderModelPolicy } from '@/domains/agent-builder';
import { useAgentBuilderAllowedModels } from '@/domains/agent-builder/hooks/use-agent-builder-allowed-models';
import { findProviderById } from '@/domains/llm';
import { useAllModels } from '@/domains/llm/hooks/use-filtered-models';
import { useFilteredProviders } from '@/domains/llm/hooks/use-filtered-providers';

export const ComposerModelSwitcher = () => {
  const selection = usePlaygroundModelOptional();
  const { data: dataProviders, isLoading: providersLoading } = useLLMProviders();
  const policy = useBuilderModelPolicy();
  const allProviders = dataProviders?.providers || [];
  const sortedProviders = useFilteredProviders(useBuilderFilteredProviders(allProviders, policy), '', false);
  const allowedModels = useBuilderFilteredModels(useAllModels(allProviders), policy);
  const pickerProviders: ModelPickerProvider[] = sortedProviders.map(provider => ({
    id: provider.id,
    name: provider.name,
    connected: provider.connected,
    models: allowedModels
      .filter(model => model.provider === provider.id)
      .map(model => ({ id: model.model, releaseDate: model.releaseDate })),
  }));

  if (!selection) return null;
  const resolveProviderId = (providerId: string) => {
    const cleaned = cleanProviderId(providerId);
    return findProviderById(allProviders, cleaned)?.id || cleaned;
  };
  // Reserve the picker footprint so the action row doesn't collapse then pop in.
  if (providersLoading) {
    // Lighter than the default `bg-muted`: the composer surface is already light, so the
    // skeleton would otherwise read as a dark pill instead of a placeholder.
    return (
      <Skeleton
        className="h-control-sm w-32 rounded-full bg-fill-subtle before:via-fill"
        data-testid="composer-model-switcher-skeleton"
      />
    );
  }

  const { provider: selectedProvider, model: selectedModel, agentModel, resetModel, setModel } = selection;

  // Admin locked the picker — surface a non-interactive chip instead.
  if (policy.active && policy.pickerVisible === false) {
    const lockedLabel = selectedProvider && selectedModel ? `${selectedProvider}/${selectedModel}` : 'Locked by admin';
    return (
      <Badge icon={<IconLock />} data-testid="composer-model-locked">
        {lockedLabel}
      </Badge>
    );
  }

  // Resolve the full provider ID (handles gateway prefix, e.g., 'custom' -> 'acme/custom')
  const fullProviderId = resolveProviderId(selectedProvider);

  return (
    <ModelPicker
      providers={pickerProviders}
      value={fullProviderId ? { provider: fullProviderId, model: selectedModel } : undefined}
      onValueChange={({ provider, model }) => setModel(provider, model)}
      defaultModel={agentModel && { provider: resolveProviderId(agentModel.provider), model: agentModel.model }}
      reset={resetModel && { label: "Reset to the agent's model", onClick: resetModel }}
      openOnSelectedProvider
      triggerClassName="max-w-48"
    />
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

  return (
    <div className="flex flex-col gap-1 px-3 pb-1.5">
      {(modelWarning || stale) && (
        <ModelNotice data-testid="composer-model-stale-warning" role="alert">
          {modelWarning || (
            <>
              <code>
                {provider}/{selectedModel}
              </code>{' '}
              is no longer allowed by admin policy. Pick a different model.
            </>
          )}
        </ModelNotice>
      )}
      {showProviderWarning && <MissingProviderKeyNotice envVar={currentProvider.envVar} />}
    </div>
  );
};
