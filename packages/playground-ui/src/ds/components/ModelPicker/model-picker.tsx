import { Check, ChevronDown, RotateCcw, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/ds/components/Badge';
import { buttonVariants } from '@/ds/components/Button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/ds/components/Command';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { Skeleton } from '@/ds/components/Skeleton';
import { cn } from '@/lib/utils';

export interface ModelPickerOption {
  id: string;
  provider: string;
  modelName: string;
  keywords?: string[];
}

export interface ModelPickerPack {
  id: string;
  name: string;
  summary: string;
  detail: string;
  keywords: string[];
}

export interface ModelPickerPacks {
  options: ModelPickerPack[];
  selectedId?: string;
  defaultId?: string;
  onSelect: (id: string) => void;
  onReset?: () => void;
  onManage?: () => void;
}

export interface ModelPickerProps {
  value?: string;
  label: string;
  title?: string;
  models: ModelPickerOption[];
  onValueChange: (id: string) => void;
  packs?: ModelPickerPacks;
  loading?: boolean;
  error?: string;
  readOnly?: boolean;
  busy?: boolean;
  notConfigured?: boolean;
  footer?: string;
}

export function ModelPicker({
  value,
  label,
  title,
  models,
  onValueChange,
  packs,
  loading,
  error,
  readOnly,
  busy,
  notConfigured,
  footer,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const providerGroups = new Map<string, ModelPickerOption[]>();
  for (const model of models) {
    const group = providerGroups.get(model.provider);
    if (group) group.push(model);
    else providerGroups.set(model.provider, [model]);
  }
  if (loading) return <Skeleton aria-label="Loading model" className="h-3.5 w-24" />;
  if (error !== undefined)
    return (
      <span className="text-accent2" aria-label="Model unavailable" title={error}>
        Model unavailable
      </span>
    );
  if (readOnly)
    return (
      <span
        className={notConfigured ? 'text-accent2' : 'text-neutral3'}
        aria-label={notConfigured ? `${label} is not configured` : undefined}
        title={value}
      >
        {label}
        {notConfigured ? ' · not configured' : null}
      </span>
    );

  function selectModel(id: string) {
    if (busy) return;
    setOpen(false);
    onValueChange(id);
  }

  function selectPack(id: string) {
    if (busy) return;
    setOpen(false);
    packs?.onSelect(id);
  }

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
        title={title}
      >
        <span className="max-w-48 truncate">
          {label}
          {notConfigured ? ' · not configured' : null}
        </span>
        <ChevronDown aria-hidden size={12} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <Command loop>
          <CommandInput placeholder={packs ? 'Search models and packs…' : 'Search models…'} />
          <CommandList className="max-h-80">
            <CommandEmpty>No matching model.</CommandEmpty>
            {packs && (
              <CommandGroup heading="Model packs">
                {packs.options.map(pack => (
                  <CommandItem
                    key={pack.id}
                    value={`pack:${pack.id}`}
                    keywords={pack.keywords}
                    aria-label={`Model pack ${pack.name}`}
                    title={pack.detail}
                    onSelect={() => selectPack(pack.id)}
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="truncate">{pack.name}</span>
                        {pack.id === packs.defaultId && (
                          <Badge variant="blue" size="xs">
                            Default
                          </Badge>
                        )}
                      </span>
                      <span className="text-ui-xs text-neutral3 truncate">{pack.summary}</span>
                    </div>
                    {pack.id === packs.selectedId && <Check aria-hidden className="ml-auto shrink-0" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {[...providerGroups.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([provider, options]) => (
                <CommandGroup
                  key={provider}
                  heading={provider}
                  className="**:[[cmdk-group-heading]]:text-neutral2 **:[[cmdk-group-heading]]:font-normal **:[[cmdk-group-heading]]:tracking-normal **:[[cmdk-group-heading]]:normal-case"
                >
                  {options.map(model => (
                    <CommandItem
                      key={model.id}
                      value={model.id}
                      keywords={model.keywords ?? [model.provider, model.modelName]}
                      title={model.id}
                      onSelect={() => selectModel(model.id)}
                    >
                      <span className="truncate">{model.modelName}</span>
                      {model.id === value && <Check aria-hidden className="ml-auto shrink-0" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            {packs && <CommandSeparator />}
            {packs?.onReset && (
              <CommandGroup>
                <CommandItem
                  value="action:reset"
                  keywords={['reset', 'default', 'pack']}
                  onSelect={() => {
                    if (busy) return;
                    setOpen(false);
                    packs.onReset?.();
                  }}
                >
                  <RotateCcw aria-hidden />
                  <span>Reset to default pack</span>
                </CommandItem>
              </CommandGroup>
            )}
            {packs?.onManage && (
              <CommandGroup>
                <CommandItem
                  value="action:manage"
                  keywords={['manage', 'model', 'packs', 'settings']}
                  onSelect={() => {
                    setOpen(false);
                    packs.onManage?.();
                  }}
                >
                  <Settings2 aria-hidden />
                  <span>Manage model packs</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
          {footer && <p className="border-border1 text-ui-xs text-neutral3 border-t px-3 py-2">{footer}</p>}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
