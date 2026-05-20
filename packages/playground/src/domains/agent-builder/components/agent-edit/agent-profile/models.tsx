import { isModelAllowed } from '@mastra/core/agent-builder/ee';
import { Skeleton, Txt } from '@mastra/playground-ui';
import { LockIcon, TriangleAlertIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import { AgentSearchbar } from '../agent-searchbar';
import { AgentSelectableCard } from '../agent-selectable-card';
import type { ListProvider } from '@/domains/agent-builder/services/to-providers';
import { toProviders } from '@/domains/agent-builder/services/to-providers';
import { useBuilderFilteredModels, useBuilderFilteredProviders, useBuilderModelPolicy } from '@/domains/builder';
import { ProviderLogo, cleanProviderId, useAllModels, useLLMProviders } from '@/domains/llm';
import type { ModelInfo } from '@/domains/llm/hooks/use-filtered-models';

export interface Modelprops {
  editable?: boolean;
}

export const Models = ({ editable = true }: Modelprops) => {
  const policy = useBuilderModelPolicy();
  const locked = policy.active && policy.pickerVisible === false;

  if (locked) {
    const policyProvider = policy.default?.provider;
    const policyModelId = policy.default?.modelId;

    return <LockedModelChip provider={policyProvider} modelId={policyModelId} />;
  }

  return (
    <div
      className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-y-auto"
      data-testid="model-detail-picker"
    >
      <ModelPicker disabled={!editable} />
    </div>
  );
};

interface ModelPickerProps {
  disabled?: boolean;
}

const ModelPicker = ({ disabled = false }: ModelPickerProps) => {
  const { setValue, control } = useFormContext<AgentBuilderEditFormValues>();
  const model = useWatch({ control, name: 'model' });
  const { data, isLoading } = useLLMProviders();
  const policy = useBuilderModelPolicy();

  const allProviders = useMemo(() => toProviders((data?.providers as ListProvider[]) || []), [data]);
  const filteredProviders = useBuilderFilteredProviders(allProviders, policy);
  const allModels = useAllModels(filteredProviders);

  const policyAllowedModels = useBuilderFilteredModels(allModels, policy);
  const [search, setSearch] = useState('');

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  const provider = cleanProviderId(model?.provider ?? '');
  const modelId = model?.name ?? '';

  const isSet = Boolean(provider && modelId);
  const isStale = isSet && policy.active && !isModelAllowed(policy.allowed, { provider, modelId });

  const visibleEntries = filterProvidersModel(policyAllowedModels, provider, search);

  return (
    <div className="h-full overflow-y-auto">
      <div
        className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-6 px-6 overflow-y-auto"
        data-testid="model-card-picker"
      >
        <div data-testid="model-card-picker-search" className="shrink-0 max-w-[30ch]">
          <AgentSearchbar
            onSearch={setSearch}
            label="Search models"
            placeholder="Search models or providers..."
            size="lg"
            debounceMs={0}
          />
        </div>

        {visibleEntries.length === 0 ? (
          <div className="flex min-h-0 items-center justify-center">
            <Txt variant="ui-md" className="text-neutral3">
              {search.trim() ? `No models match "${search.trim()}"` : 'No models available'}
            </Txt>
          </div>
        ) : (
          <ModelList
            visibleEntries={visibleEntries}
            selectedProvider={provider}
            selectedModel={modelId}
            disabled={disabled}
            onChange={(provider, model) => setValue('model', { provider, name: model }, { shouldDirty: true })}
          />
        )}
      </div>

      {isStale && <StaleWarning provider={provider} modelId={modelId} />}
    </div>
  );
};

interface ModelListProps {
  visibleEntries: ModelInfo[];
  selectedProvider: string;
  selectedModel: string;
  disabled: boolean;
  onChange: (provider: string, model: string) => void;
}

const ModelList = ({ visibleEntries, selectedProvider, selectedModel, disabled, onChange }: ModelListProps) => {
  return (
    <div className="grid min-h-0 grid-cols-1 content-start gap-2 lg:gap-6 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
      {visibleEntries.map(entry => {
        const cleanedProvider = cleanProviderId(entry.provider);
        const isSelected = cleanedProvider === selectedProvider && entry.model === selectedModel;

        return (
          <AgentSelectableCard
            key={`${entry.provider}__${entry.model}`}
            icon={<ProviderLogo providerId={entry.provider} size={32} />}
            title={entry.model}
            subtitle={entry.providerName}
            isSelected={isSelected}
            disabled={disabled}
            onClick={() => onChange(entry.provider, entry.model)}
            testId={`model-card-${entry.provider}-${entry.model}`}
            checkTestId={`model-card-check-${entry.provider}-${entry.model}`}
          />
        );
      })}
    </div>
  );
};

interface StaleWarningProps {
  provider: string;
  modelId: string;
}

const StaleWarning = ({ provider, modelId }: StaleWarningProps) => {
  return (
    <div
      className="flex items-start gap-2 rounded-md border border-accent6 bg-accent6Dark/40 px-3 py-2 text-accent6"
      data-testid="model-detail-stale-warning"
      role="alert"
    >
      <TriangleAlertIcon className="h-4 w-4 shrink-0 mt-0.5" />
      <Txt variant="ui-xs">
        <span className="font-medium">
          {provider}/{modelId}
        </span>{' '}
        is no longer allowed by the admin policy. Pick a different model to save changes.
      </Txt>
    </div>
  );
};

interface LockedModelChipProps {
  provider?: string;
  modelId?: string;
}

const LockedModelChip = ({ provider, modelId }: LockedModelChipProps) => (
  <div
    className="flex items-center gap-2 rounded-md border border-border1 bg-surface3 px-3 py-2"
    data-testid="model-detail-locked-chip"
  >
    <LockIcon className="h-4 w-4 shrink-0 text-neutral3" />
    <Txt variant="ui-sm" className="font-medium text-neutral6 truncate">
      {provider && modelId ? `${provider}/${modelId}` : 'Locked by admin'}
    </Txt>
    <Txt variant="ui-xs" className="ml-auto shrink-0 text-neutral3">
      Set by admin
    </Txt>
  </div>
);

function filterProvidersModel(modelInfo: ModelInfo[], selectedProvider: string, search: string) {
  return modelInfo
    .filter(m => {
      if (m.provider.toLowerCase().includes(search.toLowerCase())) return true;
      if (m.model.toLowerCase().includes(search.toLowerCase())) return true;
      return false;
    })
    .sort((a, b) => {
      const aSelectedProvider = cleanProviderId(a.provider) === selectedProvider ? 0 : 1;
      const bSelectedProvider = cleanProviderId(b.provider) === selectedProvider ? 0 : 1;
      if (aSelectedProvider !== bSelectedProvider) return aSelectedProvider - bSelectedProvider;

      const providerCompare = a.providerName.localeCompare(b.providerName);
      if (providerCompare !== 0) return providerCompare;

      return a.model.localeCompare(b.model);
    });
}
