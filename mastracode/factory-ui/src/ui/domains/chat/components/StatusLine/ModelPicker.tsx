import { Badge } from '@mastra/playground-ui/components/Badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@mastra/playground-ui/components/Command';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { compareModelReleaseDates, formatModelName } from '@mastra/playground-ui/utils/model';
import { Check, ChevronDown, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';

import type { AvailableModelOption } from '../../../../../hooks/useAvailableModels';
import { useAvailableModelsQuery } from '../../../../../hooks/useAvailableModels';
import { useChatConnection } from '../../context/useChatConnection';
import { useChatModelScope } from '../../context/useChatModelScope';
import type { ChatSessionContextApi } from '../../context/ChatSessionContext';
import { useChatModels } from '../../context/useChatModels';
import { useChatSessionContext } from '../../context/useChatSessionContext';
import { settingsSectionPath } from '../../../settings/settingsSections';
import { LockedModelButton } from './LockedModelButton';
import { ModelScopeFooter, useOrganizationScopedFactory } from './ModelScopeFooter';
import { ModelThinkingGroup } from './ModelThinkingGroup';

function groupByProvider(models: AvailableModelOption[]): [string, AvailableModelOption[]][] {
  const groups = new Map<string, AvailableModelOption[]>();
  for (const model of models) {
    const group = groups.get(model.provider);
    if (group) group.push(model);
    else groups.set(model.provider, [model]);
  }
  for (const group of groups.values()) {
    group.sort(
      (a, b) => compareModelReleaseDates(a.releaseDate, b.releaseDate) || a.modelName.localeCompare(b.modelName),
    );
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function canSwitchModel({
  kind,
  draftSessionId,
  sessionEnabled,
  modelLockedReason,
}: Pick<ChatSessionContextApi, 'kind' | 'draftSessionId' | 'sessionEnabled' | 'modelLockedReason'>): boolean {
  if (modelLockedReason) return false;
  if (kind === 'user' && draftSessionId) return true;
  return sessionEnabled;
}

function useModelSwitch() {
  const chatSession = useChatSessionContext();
  const { activeModelId, defaultModelId, pendingModelId, setModel } = useChatModels();
  const { catalogTarget, modelScope, scopeLoading } = useChatModelScope();
  const modelsQuery = useAvailableModelsQuery(catalogTarget);

  const selectedModelId = pendingModelId ?? activeModelId;
  const busy = Boolean(pendingModelId);

  const pickModel = (modelId: string) => {
    if (busy || modelId === activeModelId) return;
    void setModel(modelId).catch((cause: unknown) => {
      toast.error(cause instanceof Error ? cause.message : 'Failed to switch model');
    });
  };

  return {
    modelsQuery,
    activeModelId,
    selectedModelId,
    defaultModelId,
    scopeLoading,
    busy,
    switchable: canSwitchModel(chatSession),
    locked: busy || modelsQuery.isPending || scopeLoading,
    canReset:
      chatSession.kind === 'user' &&
      modelScope !== 'factory' &&
      Boolean(defaultModelId) &&
      selectedModelId !== defaultModelId &&
      Boolean(modelsQuery.data?.some(model => model.id === defaultModelId)),
    pickModel,
  };
}

type ModelSwitch = ReturnType<typeof useModelSwitch>;

interface ModelMenuProps {
  modelSwitch: ModelSwitch;
  triggerClassName?: string;
  triggerAriaLabel?: string;
  children: ReactNode;
}

function ModelMenu({ modelSwitch, triggerClassName, triggerAriaLabel, children }: ModelMenuProps) {
  const { modelsQuery, selectedModelId, defaultModelId, canReset, locked, pickModel } = modelSwitch;
  const { factoryId } = useParams<{ factoryId: string }>();
  const organizationScoped = useOrganizationScopedFactory();
  const [open, setOpen] = useState(false);

  const choose = (modelId: string) => {
    setOpen(false);
    pickModel(modelId);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        variant="ghost"
        size="sm"
        className={triggerClassName}
        type="button"
        disabled={locked}
        aria-label={triggerAriaLabel}
        aria-busy={locked}
        title={selectedModelId}
      >
        {children}
        <ChevronDown aria-hidden size={12} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <Command loop>
          <CommandInput placeholder="Search models…" />
          <CommandList className="max-h-80">
            <CommandEmpty>No matching model.</CommandEmpty>
            {groupByProvider(modelsQuery.data ?? []).map(([provider, models]) => (
              <CommandGroup
                key={provider}
                heading={provider}
                className="[&_[cmdk-group-heading]]:text-placeholder [&_[cmdk-group-heading]]:font-normal [&_[cmdk-group-heading]]:tracking-normal [&_[cmdk-group-heading]]:normal-case"
              >
                {models.map(model => (
                  <CommandItem
                    key={model.id}
                    value={model.id}
                    keywords={[model.provider, model.modelName, formatModelName(model.id)]}
                    title={model.id}
                    onSelect={() => choose(model.id)}
                  >
                    <span className="truncate">{model.modelName}</span>
                    {model.id === defaultModelId ? (
                      <Badge variant="blue" size="xs">
                        Default
                      </Badge>
                    ) : null}
                    {model.id === selectedModelId ? <Check aria-hidden className="ml-auto shrink-0" /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            {canReset ? <CommandSeparator /> : null}
            {canReset && defaultModelId ? (
              <CommandGroup>
                <CommandItem
                  value="action:reset"
                  keywords={['reset', 'default', 'model']}
                  onSelect={() => choose(defaultModelId)}
                >
                  <RotateCcw aria-hidden />
                  <span>Reset to your default</span>
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
          {organizationScoped && factoryId ? <ModelScopeFooter factoryId={factoryId} /> : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ModelPicker() {
  const modelSwitch = useModelSwitch();
  const { modelsQuery, activeModelId, selectedModelId, scopeLoading, switchable, busy } = modelSwitch;
  const { modelLockedReason } = useChatSessionContext();
  const { status } = useChatConnection();
  const { isLoading, error } = useChatModels();
  const { factoryId } = useParams<{ factoryId: string }>();
  const organizationScoped = useOrganizationScopedFactory();

  if (!selectedModelId && (isLoading || status === 'connecting')) {
    return <Skeleton aria-label="Loading model" className="h-3.5 w-24" />;
  }
  if (!selectedModelId && error) {
    return (
      <span className="text-destructive-foreground" aria-label="Model unavailable" title={error.message}>
        Model unavailable
      </span>
    );
  }

  if (modelLockedReason && activeModelId) {
    return (
      <ModelThinkingGroup modelId={activeModelId} switchingModel={false} lockedReason={modelLockedReason}>
        <LockedModelButton modelId={activeModelId} reason={modelLockedReason} />
      </ModelThinkingGroup>
    );
  }

  const label = selectedModelId ? formatModelName(selectedModelId) : 'No model';
  const notConfigured =
    !scopeLoading &&
    Boolean(selectedModelId) &&
    modelsQuery.isSuccess &&
    !modelsQuery.data.some(model => model.id === selectedModelId);

  const noModelsToOffer = !modelsQuery.isPending && !modelsQuery.data?.length;
  if (modelsQuery.isError && noModelsToOffer) {
    const unavailableLabel = `${label} · model list unavailable`;
    return (
      <span className="text-destructive-foreground" aria-label={unavailableLabel} title={modelsQuery.error.message}>
        {unavailableLabel}
      </span>
    );
  }
  if (!switchable || noModelsToOffer) {
    if (notConfigured && organizationScoped && factoryId) {
      return (
        <span className="text-destructive-foreground" title={selectedModelId}>
          {label} ·{' '}
          <Link to={settingsSectionPath(factoryId, 'models')} className="underline underline-offset-2">
            needs an organization credential
          </Link>
        </span>
      );
    }
    return (
      <span
        className={notConfigured ? 'text-destructive-foreground' : 'text-muted-foreground'}
        aria-label={notConfigured ? `${label} is not configured` : undefined}
        title={selectedModelId}
      >
        {label}
        {notConfigured ? ' · not configured' : null}
      </span>
    );
  }

  return (
    <ModelThinkingGroup modelId={activeModelId} switchingModel={busy}>
      <ModelMenu
        modelSwitch={modelSwitch}
        triggerAriaLabel={notConfigured ? `Session model, ${label} is not configured` : 'Session model'}
        triggerClassName={notConfigured ? 'text-destructive-foreground' : undefined}
      >
        <span className="max-w-48 truncate">
          {label}
          {notConfigured ? ' · not configured' : null}
        </span>
      </ModelMenu>
    </ModelThinkingGroup>
  );
}

export function ChangeModelAction() {
  const modelSwitch = useModelSwitch();
  if (!modelSwitch.switchable || !modelSwitch.modelsQuery.data?.length) return null;
  return <ModelMenu modelSwitch={modelSwitch}>Change model</ModelMenu>;
}
