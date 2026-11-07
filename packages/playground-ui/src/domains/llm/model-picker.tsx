import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ProviderLogo } from './provider-logo';
import { Button } from '@/ds/components/Button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/ds/components/Command';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { cn } from '@/utils/cn';

export interface ModelPickerModel {
  /** Unique within its provider; reported back through `onValueChange` with the provider id. */
  id: string;
  name: string;
  /** Extra search terms. */
  keywords?: string[];
  /** Shown after the name, e.g. a "Default" badge. */
  badge?: ReactNode;
}

export interface ModelPickerProvider {
  id: string;
  name: string;
  /** `false` marks the provider as missing credentials. */
  connected?: boolean;
  models: ModelPickerModel[];
}

export interface ModelPickerValue {
  provider: string;
  model: string;
}

export interface ModelPickerProps {
  /** Providers in display order, each with its models in display order. */
  providers: ModelPickerProvider[];
  value?: ModelPickerValue;
  onValueChange: (value: ModelPickerValue) => void;
  /** Trigger content. Defaults to the selected provider's icon and the selected model's name. */
  children?: ReactNode;
  renderProviderIcon?: (providerId: string) => ReactNode;
  /** Above the search field, e.g. the credential the selected model runs on. */
  header?: ReactNode;
  /** Below the list. */
  footer?: ReactNode;
  /** Extra command groups after the models; call `close` after acting. */
  actions?: (close: () => void) => ReactNode;
  /** Open filtered to the selected model's provider instead of "All". Suits large catalogs. */
  openOnSelectedProvider?: boolean;
  disabled?: boolean;
  busy?: boolean;
  side?: 'top' | 'bottom';
  align?: 'start' | 'end';
  triggerClassName?: string;
  'aria-label'?: string;
  title?: string;
  searchPlaceholder?: string;
  emptyText?: string;
}

const defaultProviderIcon = (providerId: string) => <ProviderLogo providerId={providerId} size={14} />;

// On small screens the popover pins to the bottom edge as a sheet; from `sm` up it stays anchored to the trigger.
// Base UI positions the popup with inline styles, so the sheet overrides need `!`.
const sheetPositionerClass =
  'max-sm:fixed! max-sm:inset-x-0! max-sm:top-auto! max-sm:bottom-0! max-sm:left-0! max-sm:transform-none!';
const sheetPopupClass =
  'max-sm:w-full max-sm:rounded-b-none max-sm:pb-[env(safe-area-inset-bottom)] max-sm:data-[open]:zoom-in-100 max-sm:data-[open]:slide-in-from-bottom-8 max-sm:data-[closed]:zoom-out-100 max-sm:data-[closed]:slide-out-to-bottom-8';

/**
 * One trigger for provider and model: a ghost button with the provider's icon and the model's name. It
 * opens a searchable list filtered by provider, a popover beside the trigger on larger screens and a
 * bottom sheet on small ones. Searching looks across every provider.
 */
export function ModelPicker({
  providers,
  value,
  onValueChange,
  children,
  renderProviderIcon = defaultProviderIcon,
  header,
  footer,
  actions,
  openOnSelectedProvider = false,
  disabled,
  busy,
  side = 'top',
  align = 'end',
  triggerClassName,
  'aria-label': ariaLabel,
  title,
  searchPlaceholder = 'Search models',
  emptyText = 'No matching model.',
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>();

  const selectedProvider = providers.find(provider => provider.id === value?.provider);
  const selectedModel = selectedProvider?.models.find(model => model.id === value?.model);
  const filtering = providers.length > 1;
  const shownProviders =
    query || !providerFilter ? providers : providers.filter(provider => provider.id === providerFilter);

  const changeOpen = (next: boolean) => {
    setOpen(next);
    setQuery('');
    setProviderFilter(
      next && openOnSelectedProvider && filtering && selectedProvider ? selectedProvider.id : undefined,
    );
  };
  const close = () => changeOpen(false);

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger
        variant="ghost"
        size="sm"
        type="button"
        className={cn('max-w-full min-w-0 gap-1.5', triggerClassName)}
        disabled={disabled || busy}
        aria-label={ariaLabel}
        aria-busy={busy}
        title={title ?? (value ? `${value.provider}/${value.model}` : undefined)}
      >
        {children ?? (
          <>
            <span className="sr-only">Model: </span>
            {value?.provider ? <span className="flex shrink-0">{renderProviderIcon(value.provider)}</span> : null}
            <span className="truncate max-sm:max-w-28">{selectedModel?.name ?? value?.model ?? 'Select model'}</span>
          </>
        )}
        <ChevronDown aria-hidden className="shrink-0" size={12} />
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        positionerClassName={sheetPositionerClass}
        className={cn('w-80 p-0', sheetPopupClass)}
        // A touch open would raise the keyboard over the sheet; search stays one tap away.
        initialFocus={openType => openType !== 'touch'}
      >
        <div aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-border sm:hidden" />
        <Command loop shouldFilter>
          {header}
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          {filtering ? (
            <div
              role="group"
              aria-label="Filter by provider"
              className="flex [scrollbar-width:thin] items-center gap-1 overflow-x-auto border-b border-border px-2 py-1.5"
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 aria-pressed:bg-fill aria-pressed:text-foreground"
                aria-pressed={!providerFilter}
                onClick={() => setProviderFilter(undefined)}
              >
                All
              </Button>
              {providers.map(provider => (
                <Button
                  key={provider.id}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="relative shrink-0 aria-pressed:bg-fill"
                  aria-pressed={providerFilter === provider.id}
                  aria-label={provider.connected === false ? `${provider.name}, not connected` : provider.name}
                  tooltip={provider.connected === false ? `${provider.name} (not connected)` : provider.name}
                  onClick={() => setProviderFilter(current => (current === provider.id ? undefined : provider.id))}
                >
                  {renderProviderIcon(provider.id)}
                  {provider.connected === false ? (
                    <span
                      aria-hidden
                      className="absolute top-1 right-1 size-1.5 rounded-full bg-destructive-indicator"
                    />
                  ) : null}
                </Button>
              ))}
            </div>
          ) : null}
          <CommandList className="max-h-80 max-sm:max-h-[50dvh]">
            <CommandEmpty>{emptyText}</CommandEmpty>
            {shownProviders.map(provider => (
              <CommandGroup
                key={provider.id}
                heading={
                  <span className="flex items-center gap-1.5 tracking-normal normal-case">
                    {renderProviderIcon(provider.id)}
                    {provider.name}
                  </span>
                }
              >
                {provider.models.map(model => {
                  const selected = provider.id === value?.provider && model.id === value?.model;
                  return (
                    <CommandItem
                      key={model.id}
                      value={`${provider.id}/${model.id}`}
                      keywords={[provider.name, model.name, ...(model.keywords ?? [])]}
                      title={model.id}
                      onSelect={() => {
                        close();
                        if (!selected) onValueChange({ provider: provider.id, model: model.id });
                      }}
                    >
                      <span className="truncate">{model.name}</span>
                      {model.badge}
                      {selected ? <Check aria-hidden className="ml-auto shrink-0" /> : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
            {actions?.(close)}
          </CommandList>
          {footer}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
