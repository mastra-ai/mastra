import type { Provider } from '@mastra/client-js';
import { Searchbar, Skeleton, Txt, cn } from '@mastra/playground-ui';
import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useBuilderFilteredModels, useBuilderFilteredProviders, useBuilderModelPolicy } from '@/domains/builder';
import { ProviderLogo, cleanProviderId, useAllModels, useLLMProviders } from '@/domains/llm';

export interface ModelCardPickerProps {
  value: { provider: string; name: string } | undefined;
  onChange: (next: { provider: string; name: string }) => void;
  disabled?: boolean;
}

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

export const ModelCardPicker = ({ value, onChange, disabled = false }: ModelCardPickerProps) => {
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
                  'flex h-full items-center gap-3 rounded-md border bg-surface3 px-3 py-2.5 text-left transition-colors',
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
