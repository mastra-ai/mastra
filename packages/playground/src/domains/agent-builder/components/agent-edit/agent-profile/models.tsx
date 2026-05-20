import { isModelAllowed } from '@mastra/core/agent-builder/ee';
import { Searchbar, Skeleton, Txt, cn } from '@mastra/playground-ui';
import { Check, LockIcon, TriangleAlertIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useAgentColor } from '../../../contexts/agent-color-context';
import type { AgentBuilderEditFormValues } from '../../../schemas';
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
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4" data-testid="model-detail-picker">
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
    <div className="h-full pb-4">
      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 px-3" data-testid="model-card-picker">
        <div data-testid="model-card-picker-search" className="shrink-0">
          <Searchbar
            onSearch={setSearch}
            label="Search models"
            placeholder="Search models or providers..."
            size="sm"
            debounceMs={0}
          />
        </div>

        {visibleEntries.length === 0 ? (
          <div className="flex min-h-0 items-center justify-center">
            <Txt variant="ui-sm" className="text-neutral3">
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
    <div className="grid min-h-0 grid-cols-1 gap-1.5 lg:gap-4 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
      {visibleEntries.map(entry => {
        const cleanedProvider = cleanProviderId(entry.provider);
        const isSelected = cleanedProvider === selectedProvider && entry.model === selectedModel;

        return <ModelListEntry entry={entry} isSelected={isSelected} disabled={disabled} onChange={onChange} />;
      })}
    </div>
  );
};

interface ModelListEntryProps {
  entry: ModelInfo;
  isSelected: boolean;
  disabled: boolean;
  onChange: (provider: string, model: string) => void;
}

const ModelListEntry = ({ entry, isSelected, disabled, onChange }: ModelListEntryProps) => {
  const agentColor = useAgentColor();
  const hasAgentColor = agentColor !== null;
  const useAgentColors = isSelected && hasAgentColor;

  const containerStyle: CSSProperties | undefined = hasAgentColor
    ? {
        ['--agent-color-bg' as string]: agentColor.background,
        ...(isSelected ? { borderColor: agentColor.background } : null),
      }
    : undefined;

  const checkStyle: CSSProperties | undefined = useAgentColors
    ? {
        borderColor: agentColor.background,
        backgroundColor: agentColor.background,
        color: agentColor.foreground,
      }
    : undefined;

  return (
    <button
      key={`${entry.provider}__${entry.model}`}
      type="button"
      onClick={() => onChange(entry.provider, entry.model)}
      disabled={disabled}
      aria-pressed={isSelected}
      data-testid={`model-card-${entry.provider}-${entry.model}`}
      style={containerStyle}
      className={cn(
        'flex items-center gap-3 rounded-md border bg-surface3 px-3 py-2.5 text-left transition-colors',
        hasAgentColor
          ? 'focus-visible:!border-[var(--agent-color-bg)] focus-visible:outline-none'
          : 'hover:bg-surface4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent1',
        hasAgentColor && 'hover:bg-surface4',
        isSelected
          ? useAgentColors
            ? 'bg-surface4'
            : 'border-accent1 bg-surface4 ring-1 ring-accent1'
          : 'border-border1',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <ProviderLogo providerId={entry.provider} size={20} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Txt variant="ui-sm" className="truncate font-medium text-neutral6">
          {entry.model}
        </Txt>
        <Txt variant="ui-xs" className="truncate text-neutral3">
          {entry.providerName}
        </Txt>
      </div>
      <span
        aria-hidden="true"
        data-testid={`model-card-check-${entry.provider}-${entry.model}`}
        style={checkStyle}
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
          isSelected
            ? useAgentColors
              ? ''
              : 'border-accent1 bg-accent1 text-surface1'
            : 'border-border1 bg-transparent',
        )}
      >
        {isSelected && <Check className="h-3 w-3" />}
      </span>
    </button>
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
