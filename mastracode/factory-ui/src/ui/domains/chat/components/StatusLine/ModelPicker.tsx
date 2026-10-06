import { Badge } from '@mastra/playground-ui/components/Badge';
import { buttonVariants } from '@mastra/playground-ui/components/Button';
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
import { cn } from '@mastra/playground-ui/utils/cn';
import { Check, ChevronDown, RotateCcw } from 'lucide-react';
import { useState } from 'react';

import type { AvailableModelOption } from '../../../../../hooks/useAvailableModels';
import { useAvailableModelsQuery } from '../../../../../hooks/useAvailableModels';
import { useChatConnection } from '../../context/useChatConnection';
import { useChatModels } from '../../context/useChatModels';
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
 * Model control for the session status line. The searchable menu groups models
 * by provider and lets user chats reset a per-session choice to the personal
 * default model.
 */
export function ModelPicker() {
  const { kind, sessionEnabled, draftSessionId } = useChatSessionContext();
  const { status } = useChatConnection();
  const { activeModelId, defaultModelId, setModel, isLoading, error } = useChatModels();
  const modelsQuery = useAvailableModelsQuery();
  const [open, setOpen] = useState(false);
  const [pendingModelId, setPendingModelId] = useState<string>();

  const selectedModelId = pendingModelId ?? activeModelId;
  const busy = Boolean(pendingModelId);
  const providerGroups = groupByProvider(modelsQuery.data ?? []);

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

  const label = selectedModelId ? formatModelName(selectedModelId) : 'No model';
  const notConfigured =
    Boolean(selectedModelId) && modelsQuery.isSuccess && !modelsQuery.data.some(model => model.id === selectedModelId);
  const switchable = kind === 'user' ? Boolean(draftSessionId) || sessionEnabled : kind === 'factory' && sessionEnabled;
  const canReset =
    kind === 'user' &&
    Boolean(defaultModelId) &&
    selectedModelId !== defaultModelId &&
    modelsQuery.data?.some(model => model.id === defaultModelId);

  if (!switchable || !modelsQuery.data?.length) {
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

  const runAction = (action: Promise<void>, failure: string) => {
    void action.then(
      () => setPendingModelId(undefined),
      (cause: unknown) => {
        setPendingModelId(undefined);
        toast.error(cause instanceof Error ? cause.message : failure);
      },
    );
  };

  const pickModel = (modelId: string) => {
    if (busy) return;
    setOpen(false);
    if (modelId === activeModelId) return;
    setPendingModelId(modelId);
    runAction(setModel(modelId), 'Failed to switch model');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={busy}
        aria-label={notConfigured ? `Session model, ${label} is not configured` : 'Session model'}
        aria-busy={busy}
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'sm' }),
          notConfigured ? 'text-destructive-foreground' : 'text-muted-foreground',
        )}
        title={selectedModelId}
      >
        <span className="max-w-48 truncate">
          {label}
          {notConfigured ? ' · not configured' : null}
        </span>
        <ChevronDown aria-hidden size={12} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <Command loop>
          <CommandInput placeholder="Search models…" />
          <CommandList className="max-h-80">
            <CommandEmpty>No matching model.</CommandEmpty>
            {providerGroups.map(([provider, models]) => (
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
                    onSelect={() => pickModel(model.id)}
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
                  onSelect={() => pickModel(defaultModelId)}
                >
                  <RotateCcw aria-hidden />
                  <span>Reset to your default</span>
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
