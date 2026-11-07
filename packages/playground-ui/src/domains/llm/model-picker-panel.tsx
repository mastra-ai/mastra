import { Check, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ModelPickerAddProvider, ModelPickerProvider, ModelPickerValue } from './model-picker-types';
import { Button } from '@/ds/components/Button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/ds/components/Command';
import { cn } from '@/utils/cn';

export interface ModelPickerPanelProps {
  providers: ModelPickerProvider[];
  value?: ModelPickerValue;
  onSelect: (value: ModelPickerValue) => void;
  query: string;
  onQueryChange: (query: string) => void;
  providerFilter?: string;
  onProviderFilterChange: (providerId: string | undefined) => void;
  renderProviderIcon: (providerId: string) => ReactNode;
  header?: ReactNode;
  settings?: ReactNode;
  footer?: ReactNode;
  addProvider?: ModelPickerAddProvider;
  actions?: ReactNode;
  onAddProvider: () => void;
  searchPlaceholder: string;
  emptyText: string;
  /** Bottom-sheet layout: 44px touch targets and a taller list. */
  sheet: boolean;
}

/** Search, provider filters, the model list and the selected model's settings. */
export function ModelPickerPanel({
  providers,
  value,
  onSelect,
  query,
  onQueryChange,
  providerFilter,
  onProviderFilterChange,
  renderProviderIcon,
  header,
  settings,
  footer,
  addProvider,
  actions,
  onAddProvider,
  searchPlaceholder,
  emptyText,
  sheet,
}: ModelPickerPanelProps) {
  const filtering = providers.length > 1;
  const shownProviders =
    query || !providerFilter ? providers : providers.filter(provider => provider.id === providerFilter);

  return (
    <>
      <Command
        loop
        shouldFilter
        className={cn(sheet && 'bg-transparent **:[[cmdk-input]]:h-11 **:[[cmdk-item]]:min-h-11')}
      >
        {header}
        <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={onQueryChange} />
        {filtering || addProvider ? (
          <div
            role="group"
            aria-label="Filter by provider"
            className="flex [scrollbar-width:thin] items-center gap-1 overflow-x-auto border-b border-border px-2 py-1.5"
          >
            {filtering ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn('shrink-0 aria-pressed:bg-fill aria-pressed:text-foreground', sheet && 'h-11 px-4')}
                  aria-pressed={!providerFilter}
                  onClick={() => onProviderFilterChange(undefined)}
                >
                  All
                </Button>
                {providers.map(provider => (
                  <Button
                    key={provider.id}
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className={cn('relative shrink-0 aria-pressed:bg-fill', sheet && 'size-11')}
                    aria-pressed={providerFilter === provider.id}
                    aria-label={provider.connected === false ? `${provider.name}, not connected` : provider.name}
                    tooltip={provider.connected === false ? `${provider.name} (not connected)` : provider.name}
                    onClick={() => onProviderFilterChange(providerFilter === provider.id ? undefined : provider.id)}
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
              </>
            ) : null}
            {addProvider ? (
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn('ml-auto shrink-0', sheet && 'size-11')}
                aria-label={addProvider.label}
                tooltip={addProvider.label}
                render={addProvider.render}
                onClick={onAddProvider}
              >
                <Plus aria-hidden />
              </Button>
            ) : null}
          </div>
        ) : null}
        <CommandList className={sheet ? 'max-h-[45dvh]' : 'max-h-80'}>
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
                    onSelect={() => onSelect({ provider: provider.id, model: model.id })}
                  >
                    <span className="truncate">{model.name}</span>
                    {model.badge}
                    {selected ? <Check aria-hidden className="ml-auto shrink-0" /> : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
          {actions}
        </CommandList>
      </Command>
      {settings ? <div className="border-t border-border p-3">{settings}</div> : null}
      {footer}
    </>
  );
}
