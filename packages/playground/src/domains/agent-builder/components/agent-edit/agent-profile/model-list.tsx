import type { Provider } from '@mastra/client-js';
import { isModelAllowed } from '@mastra/core/agent-builder/ee';
import { Searchbar, Skeleton, Txt, cn } from '@mastra/playground-ui';
import { Check, LockIcon, TriangleAlertIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import { useBuilderFilteredModels, useBuilderFilteredProviders, useBuilderModelPolicy } from '@/domains/builder';
import { ProviderLogo, cleanProviderId, useAllModels, useLLMProviders } from '@/domains/llm';

interface CardEntry {
  providerId: string;
  providerName: string;
  modelId: string;
}

function isProvider(provider: unknown): provider is Provider {
  return (
    typeof provider === 'object' &&
    provider !== null &&
    'id' in provider &&
    'name' in provider &&
    'models' in provider &&
    Array.isArray(provider.models)
  );
}

export interface ModelListProps {
  /** Whether the user can change the selected model. */
  editable?: boolean;
}

/**
 * Form-bound model picker. Reads/writes `model` from the AgentBuilder edit form
 * and respects the active model policy (locked + stale states).
 */
export const ModelList = ({ editable = true }: ModelListProps) => {
  const { setValue, control } = useFormContext<AgentBuilderEditFormValues>();
  const policy = useBuilderModelPolicy();

  const model = useWatch({ control, name: 'model' });
  const provider = model?.provider ?? '';
  const modelId = model?.name ?? '';

  const locked = policy.active && policy.pickerVisible === false;
  const stale =
    Boolean(provider && modelId) &&
    policy.active &&
    policy.allowed !== undefined &&
    !isModelAllowed(policy.allowed, { provider: cleanProviderId(provider), modelId });

  if (locked) {
    return (
      <div className="p-4">
        <LockedModelChip provider={policy.default?.provider ?? provider} modelId={policy.default?.modelId ?? modelId} />
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4" data-testid="model-detail-picker">
      <ModelPicker
        value={provider && modelId ? { provider, name: modelId } : undefined}
        onChange={next => setValue('model', next, { shouldDirty: true })}
        disabled={!editable}
      />

      {stale && (
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
      )}
    </div>
  );
};

interface LockedModelChipProps {
  provider: string;
  modelId: string;
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

interface ModelPickerProps {
  value: { provider: string; name: string } | undefined;
  onChange: (next: { provider: string; name: string }) => void;
  disabled?: boolean;
}

const ModelPicker = ({ value, onChange, disabled = false }: ModelPickerProps) => {
  const { data, isLoading } = useLLMProviders();
  const policy = useBuilderModelPolicy();
  const allProviders = (data?.providers || []).filter(isProvider);
  const filteredProviders = useBuilderFilteredProviders(allProviders, policy);
  const allModels = useAllModels(filteredProviders);
  const policyAllowedModels = useBuilderFilteredModels(allModels, policy);

  const [search, setSearch] = useState('');

  const selectedProvider = value ? cleanProviderId(value.provider) : '';
  const selectedModel = value?.name ?? '';

  const entries: CardEntry[] = useMemo(() => {
    const base: CardEntry[] = policyAllowedModels.map(m => ({
      providerId: m.provider,
      providerName: m.providerName,
      modelId: m.model,
    }));

    return [...base].sort((a, b) => {
      const aSelectedProvider = cleanProviderId(a.providerId) === selectedProvider ? 0 : 1;
      const bSelectedProvider = cleanProviderId(b.providerId) === selectedProvider ? 0 : 1;
      if (aSelectedProvider !== bSelectedProvider) return aSelectedProvider - bSelectedProvider;

      const providerCompare = a.providerName.localeCompare(b.providerName);
      if (providerCompare !== 0) return providerCompare;

      return a.modelId.localeCompare(b.modelId);
    });
  }, [policyAllowedModels, selectedProvider]);

  const visibleEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter(e => e.modelId.toLowerCase().includes(term) || e.providerName.toLowerCase().includes(term));
  }, [entries, search]);

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4" data-testid="model-card-picker">
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
        <div className="flex min-h-0 items-center justify-center px-3 py-6">
          <Txt variant="ui-sm" className="text-neutral3">
            {search.trim() ? `No models match "${search.trim()}"` : 'No models available'}
          </Txt>
        </div>
      ) : (
        <div className="grid min-h-0 grid-cols-1 gap-1.5 lg:gap-4 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {visibleEntries.map(entry => {
            const cleanedProvider = cleanProviderId(entry.providerId);
            const isSelected = cleanedProvider === selectedProvider && entry.modelId === selectedModel;

            return (
              <button
                key={`${entry.providerId}__${entry.modelId}`}
                type="button"
                onClick={() => onChange({ provider: cleanedProvider, name: entry.modelId })}
                disabled={disabled}
                aria-pressed={isSelected}
                data-testid={`model-card-${cleanedProvider}-${entry.modelId}`}
                className={cn(
                  'flex items-center gap-3 rounded-md border bg-surface3 px-3 py-2.5 text-left transition-colors',
                  'hover:bg-surface4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent1',
                  isSelected ? 'border-accent1 bg-surface4 ring-1 ring-accent1' : 'border-border1',
                  disabled && 'cursor-not-allowed opacity-60',
                )}
              >
                <ProviderLogo providerId={entry.providerId} size={20} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Txt variant="ui-sm" className="truncate font-medium text-neutral6">
                    {entry.modelId}
                  </Txt>
                  <Txt variant="ui-xs" className="truncate text-neutral3">
                    {entry.providerName}
                  </Txt>
                </div>
                <span
                  aria-hidden="true"
                  data-testid={`model-card-check-${cleanedProvider}-${entry.modelId}`}
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                    isSelected ? 'border-accent1 bg-accent1 text-surface1' : 'border-border1 bg-transparent',
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
