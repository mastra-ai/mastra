import {
  ModelPickerDivider,
  ModelPickerLocked,
  ModelPickerWarning,
  ModelPickerWarnings,
} from '@mastra/playground-ui/components/ModelPicker';
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

  const resolvedProvider = findProviderById(providers, currentModelProvider);
  const fullProviderId = resolvedProvider?.id || currentModelProvider;

  const handleModelSelect = (modelId: string) => {
    if (modelId && fullProviderId) setModel(fullProviderId, modelId);
  };

  const handleProviderSelect = (providerId: string) => {
    const cleanedId = cleanProviderId(providerId);
    if (cleanedId !== currentModelProvider) {
      setProvider(cleanedId);
      setModelOpen(true);
    }
  };

  const modelLabel = selectedProvider && selectedModel ? `${selectedProvider}/${selectedModel}` : 'Locked by admin';
  if (policy.active && policy.pickerVisible === false) return <ModelPickerLocked label={modelLabel} />;

  return (
    <div className="inline-flex max-w-full items-stretch">
      <LLMProviders value={currentModelProvider} onValueChange={handleProviderSelect} size="md" segment="provider" />
      <ModelPickerDivider />
      <LLMModels
        llmId={currentModelProvider}
        value={selectedModel}
        onValueChange={handleModelSelect}
        open={modelOpen}
        onOpenChange={setModelOpen}
        size="md"
        segment="model"
      />
    </div>
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

  const providerEnvironmentVariables = currentProvider?.envVar;
  const environmentVariable = Array.isArray(providerEnvironmentVariables)
    ? providerEnvironmentVariables.join(', ')
    : providerEnvironmentVariables;

  return (
    <ComposerModelWarnings
      warning={modelWarning}
      staleModel={stale ? `${provider}/${selectedModel}` : undefined}
      environmentVariable={showProviderWarning ? environmentVariable : undefined}
    />
  );
};

function ComposerModelWarnings({
  warning,
  staleModel,
  environmentVariable,
}: {
  warning?: string | string[];
  staleModel?: string;
  environmentVariable?: string;
}) {
  const warningText = Array.isArray(warning) ? warning.filter(Boolean).join(' ') : warning;
  if (!warningText && !staleModel && !environmentVariable) return null;
  return (
    <ModelPickerWarnings>
      {(warningText || staleModel) && (
        <ModelPickerWarning role="alert" data-testid="composer-model-stale-warning">
          {warningText || (
            <>
              <code className="bg-accent6Dark text-accent6 rounded px-1 py-0.5 break-all">{staleModel}</code> is no
              longer allowed by admin policy. Pick a different model.
            </>
          )}
        </ModelPickerWarning>
      )}
      {environmentVariable && (
        <ModelPickerWarning>
          Set <code className="bg-accent6Dark text-accent6 rounded px-1 py-0.5 break-all">{environmentVariable}</code>{' '}
          to use this provider
        </ModelPickerWarning>
      )}
    </ModelPickerWarnings>
  );
}
