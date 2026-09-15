import { Badge } from '@mastra/playground-ui/components/Badge';
import { buttonVariants } from '@mastra/playground-ui/components/Button';
import { cn } from '@mastra/playground-ui/utils/cn';
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
import { Check, ChevronDown, RotateCcw, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { useAvailableModelsQuery } from '../../../../../hooks/useAvailableModels';
import type { AvailableModelOption } from '../../../../../hooks/useAvailableModels';
import type { ModelPackInfo } from '../../../../../api/types';
import { settingsSectionPath } from '../../../settings/settingsSections';

import { useChatConnection } from '../../context/useChatConnection';
import { useChatModels } from '../../context/useChatModels';
import { useChatModes } from '../../context/useChatModes';
import { useChatSessionContext } from '../../context/useChatSessionContext';

function titleCase(value: string): string {
  return value ? `${value[0]?.toUpperCase()}${value.slice(1).toLowerCase()}` : value;
}

function lastSegment(id: string): string {
  const parts = id.trim().split('/');
  return parts[parts.length - 1] || id;
}

export function formatModelName(id: string): string {
  const slug = lastSegment(id);
  const claudeMatch = slug.match(/^claude-(opus|sonnet|haiku)-(\d+)-(\d+)$/i);
  const claudeFamily = claudeMatch?.[1];
  const claudeMajor = claudeMatch?.[2];
  const claudeMinor = claudeMatch?.[3];
  if (claudeFamily && claudeMajor && claudeMinor) {
    return `Claude ${titleCase(claudeFamily)} ${claudeMajor}.${claudeMinor}`;
  }

  const gptDetails = slug.match(/^gpt-(.+)$/i)?.[1];
  if (gptDetails) {
    const [version, ...qualifiers] = gptDetails.split('-');
    return [`GPT-${version}`, ...qualifiers.map(titleCase)].join(' ');
  }

  return slug.split(/[-_]+/).filter(Boolean).map(titleCase).join(' ');
}

type PackModeKey = 'build' | 'plan' | 'fast';

function packModeKey(modeId: string | undefined): PackModeKey | undefined {
  return modeId === 'build' || modeId === 'plan' || modeId === 'fast' ? modeId : undefined;
}

function packSummary(pack: ModelPackInfo): string {
  return `${formatModelName(pack.models.build)} · ${formatModelName(pack.models.plan)} · ${formatModelName(pack.models.fast)}`;
}

function packDetail(pack: ModelPackInfo): string {
  return `Build ${pack.models.build} · Plan ${pack.models.plan} · Fast ${pack.models.fast}`;
}

/** Models grouped by provider, providers sorted alphabetically. */
function groupByProvider(models: AvailableModelOption[]): [string, AvailableModelOption[]][] {
  const groups = new Map<string, AvailableModelOption[]>();
  for (const model of models) {
    const group = groups.get(model.provider);
    if (group) group.push(model);
    else groups.set(model.provider, [model]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/**
 * Combined model control for the session status line. One trigger shows the
 * effective model for the current mode; the searchable menu offers packs
 * (presets of Build/Plan/Fast models), per-provider model overrides for the
 * current mode, reset to the personal default pack, and a link to pack
 * management in settings.
 */
export function ModelPicker() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const navigate = useNavigate();
  const { kind, sessionEnabled, draftSessionId } = useChatSessionContext();
  const { status } = useChatConnection();
  const { activeModeId } = useChatModes();
  const { activeModelId, activeModelPackId, defaultModelPackId, modelPacks, setModel, setModelPack, isLoading, error } =
    useChatModels();
  const modelsQuery = useAvailableModelsQuery();
  const [open, setOpen] = useState(false);
  const [pendingModelId, setPendingModelId] = useState<string>();
  const [pendingPackId, setPendingPackId] = useState<string>();

  const modeKey = packModeKey(activeModeId);
  const pendingPack = modelPacks.find(pack => pack.id === pendingPackId);
  const selectedModelId =
    pendingModelId ?? (pendingPack && modeKey ? pendingPack.models[modeKey] : undefined) ?? activeModelId;
  const selectedPackId = pendingPackId ?? activeModelPackId;
  const selectedPack = modelPacks.find(pack => pack.id === selectedPackId);
  const busy = Boolean(pendingModelId || pendingPackId);
  const providerGroups = groupByProvider(modelsQuery.data ?? []);

  if (!selectedModelId && (isLoading || status === 'connecting')) {
    return <Skeleton aria-label="Loading model" className="h-3.5 w-24" />;
  }
  if (!selectedModelId && error) {
    return (
      <span className="text-accent2" aria-label="Model unavailable" title={error.message}>
        Model unavailable
      </span>
    );
  }

  const label = selectedModelId ? formatModelName(selectedModelId) : 'No model';
  const notConfigured =
    Boolean(selectedModelId) && modelsQuery.isSuccess && !modelsQuery.data.some(model => model.id === selectedModelId);
  // User chats can pick models and packs in drafts and once the sandbox is
  // ready; factory sessions can pick models only.
  const switchable = kind === 'user' ? Boolean(draftSessionId) || sessionEnabled : kind === 'factory' && sessionEnabled;
  const showPacks = kind === 'user' && modelPacks.length > 0;
  // The current selection deviates from the personal default when another pack
  // is applied, or when the mode's model no longer matches the applied pack.
  const packModelDeviates = Boolean(
    selectedPack && modeKey && selectedModelId && selectedPack.models[modeKey] !== selectedModelId,
  );
  const canReset =
    showPacks && Boolean(defaultModelPackId) && (selectedPackId !== defaultModelPackId || packModelDeviates);

  // Packs remain selectable even when no credentialed models are listed, so
  // only fall back to the plain label when there is nothing to pick at all.
  if (!switchable || (!showPacks && !modelsQuery.data?.length)) {
    return (
      <span
        className={notConfigured ? 'text-accent2' : 'text-neutral3'}
        aria-label={notConfigured ? `${label} is not configured` : undefined}
        title={selectedModelId}
      >
        {label}
        {notConfigured ? ' · not configured' : null}
      </span>
    );
  }

  const runAction = (action: Promise<void>, clear: () => void, failure: string) => {
    void action.then(clear, (cause: unknown) => {
      clear();
      toast.error(cause instanceof Error ? cause.message : failure);
    });
  };

  const pickModel = (modelId: string) => {
    if (busy) return;
    setOpen(false);
    if (modelId === activeModelId) return;
    setPendingModelId(modelId);
    runAction(setModel(modelId), () => setPendingModelId(undefined), 'Failed to switch model');
  };

  const pickPack = (packId: string) => {
    if (busy) return;
    setOpen(false);
    if (packId === activeModelPackId && !packModelDeviates) return;
    setPendingPackId(packId);
    runAction(setModelPack(packId), () => setPendingPackId(undefined), 'Failed to apply model pack');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={busy}
        aria-label={notConfigured ? `Session model, ${label} is not configured` : 'Session model'}
        aria-busy={busy}
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'xs' }),
          notConfigured ? 'text-accent2' : 'text-neutral3',
        )}
        title={[selectedModelId, selectedPack?.name].filter(Boolean).join(' · ') || undefined}
      >
        <span className="max-w-48 truncate">
          {label}
          {notConfigured ? ' · not configured' : null}
        </span>
        <ChevronDown aria-hidden size={12} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <Command loop>
          <CommandInput placeholder={showPacks ? 'Search models and packs…' : 'Search models…'} />
          <CommandList className="max-h-80">
            <CommandEmpty>No matching model.</CommandEmpty>
            {showPacks ? (
              <CommandGroup heading="Model packs">
                {modelPacks.map(pack => (
                  <CommandItem
                    key={pack.id}
                    value={`pack:${pack.id}`}
                    keywords={[pack.name, pack.models.build, pack.models.plan, pack.models.fast]}
                    aria-label={`Model pack ${pack.name}`}
                    title={packDetail(pack)}
                    onSelect={() => pickPack(pack.id)}
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="truncate">{pack.name}</span>
                        {pack.id === defaultModelPackId ? (
                          <Badge variant="blue" size="xs">
                            Default
                          </Badge>
                        ) : null}
                      </span>
                      <span className="text-ui-xs text-neutral3 truncate">{packSummary(pack)}</span>
                    </div>
                    {pack.id === selectedPackId && !packModelDeviates ? (
                      <Check aria-hidden className="ml-auto shrink-0" />
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {providerGroups.map(([provider, models]) => (
              <CommandGroup
                key={provider}
                heading={provider}
                // Providers are a soft grouping inside the models list, not a
                // top-level section: mute the loud uppercase heading styling.
                className="**:[[cmdk-group-heading]]:text-neutral2 **:[[cmdk-group-heading]]:font-normal **:[[cmdk-group-heading]]:tracking-normal **:[[cmdk-group-heading]]:normal-case"
              >
                {models.map(model => (
                  <CommandItem
                    key={model.id}
                    value={model.id}
                    keywords={[model.provider, model.modelName, formatModelName(model.id)]}
                    title={model.id}
                    onSelect={() => pickModel(model.id)}
                  >
                    <span className="truncate">{model.modelName}</span>
                    {model.id === selectedModelId ? <Check aria-hidden className="ml-auto shrink-0" /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            {canReset || showPacks ? <CommandSeparator /> : null}
            {canReset && defaultModelPackId ? (
              <CommandGroup>
                <CommandItem
                  value="action:reset"
                  keywords={['reset', 'default', 'pack']}
                  onSelect={() => pickPack(defaultModelPackId)}
                >
                  <RotateCcw aria-hidden />
                  <span>Reset to default pack</span>
                </CommandItem>
              </CommandGroup>
            ) : null}
            {showPacks && factoryId ? (
              <CommandGroup>
                <CommandItem
                  value="action:manage"
                  keywords={['manage', 'model', 'packs', 'settings']}
                  onSelect={() => {
                    setOpen(false);
                    navigate(`${settingsSectionPath(factoryId, 'models')}#model-packs`);
                  }}
                >
                  <Settings2 aria-hidden />
                  <span>Manage model packs</span>
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
          {modeKey ? (
            <p className="text-ui-xs text-neutral3 border-border1 border-t px-3 py-2">
              Model choices apply to {titleCase(modeKey)} mode only.
              {showPacks ? ' Packs set all three modes.' : ''}
            </p>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
