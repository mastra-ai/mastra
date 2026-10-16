import { Badge } from '@mastra/playground-ui/components/Badge';
import { buttonVariants } from '@mastra/playground-ui/components/Button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@mastra/playground-ui/components/Command';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { cn } from '@mastra/playground-ui/utils/cn';
import { formatModelName } from '@mastra/playground-ui/utils/model';
import { Check, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

import type { AvailableModelOption } from '../../hooks/useAvailableModels';

function groupByProvider(models: AvailableModelOption[]): [string, AvailableModelOption[]][] {
  const groups = new Map<string, AvailableModelOption[]>();
  for (const model of models) {
    const group = groups.get(model.provider);
    if (group) group.push(model);
    else groups.set(model.provider, [model]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

interface ModelMenuProps {
  models: AvailableModelOption[];
  selectedModelId: string | undefined;
  placeholder: string;
  ariaLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (modelId: string) => void;
  locked: boolean;
  notConfigured?: boolean;
  defaultModelId?: string;
  footer?: ReactNode;
  extraCommandGroups?: ReactNode;
}

export function ModelMenu({
  models,
  selectedModelId,
  placeholder,
  ariaLabel,
  open,
  onOpenChange,
  onSelect,
  locked,
  notConfigured = false,
  defaultModelId,
  footer,
  extraCommandGroups,
}: ModelMenuProps) {
  const label = selectedModelId ? formatModelName(selectedModelId) : placeholder;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        type="button"
        disabled={locked}
        aria-label={notConfigured ? `${ariaLabel}, ${label} is not configured` : ariaLabel}
        aria-busy={locked}
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
            {groupByProvider(models).map(([provider, providerModels]) => (
              <CommandGroup
                key={provider}
                heading={provider}
                className="[&_[cmdk-group-heading]]:text-placeholder [&_[cmdk-group-heading]]:font-normal [&_[cmdk-group-heading]]:tracking-normal [&_[cmdk-group-heading]]:normal-case"
              >
                {providerModels.map(model => (
                  <CommandItem
                    key={model.id}
                    value={model.id}
                    keywords={[model.provider, model.modelName, formatModelName(model.id)]}
                    title={model.id}
                    onSelect={() => onSelect(model.id)}
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
            {extraCommandGroups}
          </CommandList>
          {footer}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
