import { InputGroup, InputGroupAddon, InputGroupInput } from '@mastra/playground-ui/components/InputGroup';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { LockIcon, SearchIcon, TriangleAlertIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import { AgentSelectableCard } from '../agent-selectable-card';
import { FilterableList } from './filterable-list';
import { TwoPanePickerSkeleton } from './two-pane-picker-skeleton';
import { useBuilderModelPolicy } from '@/domains/agent-builder';
import { useAgentBuilderAllowedModels } from '@/domains/agent-builder/hooks/use-agent-builder-allowed-models';
import { ProviderLogo, cleanProviderId } from '@/domains/llm';
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

    return (
      <div className="px-6 py-6">
        <LockedModelChip provider={policyProvider} modelId={policyModelId} />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-hidden" data-testid="model-detail-picker">
      <ModelPicker disabled={!editable} />
    </div>
  );
};

interface ModelPickerProps {
  disabled?: boolean;
}

interface ProviderEntry {
  providerId: string;
  providerName: string;
}

const ModelPicker = ({ disabled = false }: ModelPickerProps) => {
  const { setValue, control } = useFormContext<AgentBuilderEditFormValues>();
  const model = useWatch({ control, name: 'model' });
  const policy = useBuilderModelPolicy();
  const { models: policyAllowedModels, isLoading } = useAgentBuilderAllowedModels();

  const [search, setSearch] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<Set<string> | null>(null);

  const providerOptions = useMemo<ProviderEntry[]>(() => {
    const seen = new Map<string, string>();
    for (const m of policyAllowedModels) {
      const id = cleanProviderId(m.provider);
      if (!seen.has(id)) {
        seen.set(id, m.providerName);
      }
    }
    return Array.from(seen.entries())
      .map(([providerId, providerName]) => ({ providerId, providerName }))
      .sort((a, b) => a.providerName.localeCompare(b.providerName));
  }, [policyAllowedModels]);

  const isProviderChecked = (providerId: string) => selectedProviders === null || selectedProviders.has(providerId);

  const handleToggleProvider = (providerId: string) => {
    setSelectedProviders(prev => {
      const base = prev ?? new Set(providerOptions.map(p => p.providerId));
      const next = new Set(base);
      if (next.has(providerId)) {
        next.delete(providerId);
      } else {
        next.add(providerId);
      }
      return next;
    });
  };

  const handleSelectAllProviders = () => {
    setSelectedProviders(new Set(providerOptions.map(p => p.providerId)));
  };

  const handleClearAllProviders = () => {
    setSelectedProviders(new Set());
  };

  const providerFilterItems = useMemo(
    () =>
      providerOptions.map(({ providerId, providerName }) => ({
        id: providerId,
        label: providerName,
        icon: <ProviderLogo providerId={providerId} size={18} />,
      })),
    [providerOptions],
  );

  if (isLoading) {
    return <TwoPanePickerSkeleton testId="model-card-picker-loading" />;
  }

  const provider = cleanProviderId(model?.provider ?? '');
  const modelId = model?.name ?? '';

  const isSet = Boolean(provider && modelId);
  const isAllowed = policyAllowedModels.some(m => cleanProviderId(m.provider) === provider && m.model === modelId);
  const isStale = isSet && policy.active && !isAllowed;

  const groups = groupModelsByProvider(policyAllowedModels, selectedProviders, search, provider);
  const allProvidersUnchecked = selectedProviders !== null && selectedProviders.size === 0;

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <div
        className="grid h-full min-h-0 grid-cols-[280px_minmax(0,1fr)] overflow-hidden"
        data-testid="model-card-picker"
      >
        {providerOptions.length > 0 && (
          <FilterableList
            title="Providers"
            items={providerFilterItems}
            isChecked={isProviderChecked}
            onToggle={handleToggleProvider}
            onSelectAll={handleSelectAllProviders}
            onClearAll={handleClearAllProviders}
            disabled={disabled}
            testIdPrefix="models-provider"
          />
        )}

        <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-6 px-6 py-6">
          <div data-testid="model-card-picker-search" className="shrink-0 max-w-[30ch] rounded-full bg-surface3">
            <InputGroup variant="outline" size="lg">
              <InputGroupAddon align="inline-start">
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                aria-label="Search models"
                placeholder="Search models or providers..."
                onChange={event => setSearch(event.target.value)}
              />
            </InputGroup>
          </div>

          {groups.length === 0 ? (
            <div className="flex min-h-0 items-center justify-center">
              <Txt variant="ui-md" className="text-neutral3">
                {search.trim()
                  ? `No models match "${search.trim()}"`
                  : allProvidersUnchecked
                    ? 'Select at least one provider to see models'
                    : 'No models available'}
              </Txt>
            </div>
          ) : (
            <ModelGroups
              groups={groups}
              selectedProvider={provider}
              selectedModel={modelId}
              disabled={disabled}
              onChange={(provider, model) => setValue('model', { provider, name: model }, { shouldDirty: true })}
            />
          )}
        </div>
      </div>

      {isStale && <StaleWarning provider={provider} modelId={modelId} />}
    </div>
  );
};

interface ModelGroup {
  providerId: string;
  providerName: string;
  models: ModelInfo[];
}

interface ModelGroupsProps {
  groups: ModelGroup[];
  selectedProvider: string;
  selectedModel: string;
  disabled: boolean;
  onChange: (provider: string, model: string) => void;
}

const ModelGroups = ({ groups, selectedProvider, selectedModel, disabled, onChange }: ModelGroupsProps) => {
  return (
    <div className="flex min-h-0 flex-col gap-6 overflow-y-auto">
      {groups.map(group => (
        <section
          key={group.providerId}
          data-testid={`model-provider-section-${group.providerId}`}
          className="flex flex-col gap-3"
        >
          <Txt
            variant="ui-sm"
            as="h3"
            className="text-neutral3 uppercase tracking-wide"
            data-testid={`model-provider-section-title-${group.providerId}`}
          >
            {group.providerName}
          </Txt>
          <div className="grid grid-cols-1 content-start gap-2 lg:gap-6 sm:grid-cols-2 2xl:grid-cols-3">
            {group.models.map(entry => {
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
        </section>
      ))}
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
      className="mx-6 mb-6 flex items-start gap-2 rounded-md border border-accent6 bg-accent6Dark/40 px-3 py-2 text-accent6"
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

function groupModelsByProvider(
  modelInfo: ModelInfo[],
  selectedProviders: Set<string> | null,
  search: string,
  selectedProvider: string,
): ModelGroup[] {
  const searchLower = search.toLowerCase();

  const filtered = modelInfo.filter(m => {
    const providerId = cleanProviderId(m.provider);
    if (selectedProviders !== null && !selectedProviders.has(providerId)) return false;

    if (!searchLower) return true;
    if (m.provider.toLowerCase().includes(searchLower)) return true;
    if (m.model.toLowerCase().includes(searchLower)) return true;
    return false;
  });

  const groupsById = new Map<string, ModelGroup>();
  for (const entry of filtered) {
    const providerId = cleanProviderId(entry.provider);
    let group = groupsById.get(providerId);
    if (!group) {
      group = { providerId, providerName: entry.providerName, models: [] };
      groupsById.set(providerId, group);
    }
    group.models.push(entry);
  }

  for (const group of groupsById.values()) {
    group.models.sort((a, b) => a.model.localeCompare(b.model));
  }

  return Array.from(groupsById.values()).sort((a, b) => {
    const aSelected = a.providerId === selectedProvider ? 0 : 1;
    const bSelected = b.providerId === selectedProvider ? 0 : 1;
    if (aSelected !== bSelected) return aSelected - bSelected;
    return a.providerName.localeCompare(b.providerName);
  });
}
