import { Check, Plus } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { modelDisplayName } from './model-display-name';
import type {
  ModelPickerAddProvider,
  ModelPickerModel,
  ModelPickerProvider,
  ModelPickerValue,
} from './model-picker-types';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/ds/components/Command';
import { useMeasuredAutoHeight } from '@/hooks/use-measured-auto-height';
import { cn } from '@/utils/cn';
import { compareModelReleaseDates } from '@/utils/model';

const byReleaseDate = (a: ModelPickerModel, b: ModelPickerModel) =>
  compareModelReleaseDates(a.releaseDate, b.releaseDate) || a.id.localeCompare(b.id);

const isSameModel = (a: ModelPickerValue | undefined, provider: string, model: string) =>
  a?.provider === provider && a.model === model;

export interface ModelPickerPanelProps {
  providers: ModelPickerProvider[];
  value?: ModelPickerValue;
  defaultModel?: ModelPickerValue;
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
  defaultModel,
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
  const searchBar = useMeasuredAutoHeight();
  const [scrolled, setScrolled] = useState(false);
  const filtering = providers.length > 1;
  const shownProviders =
    query || !providerFilter ? providers : providers.filter(provider => provider.id === providerFilter);
  // A lone group's provider is already on screen (the trigger, or the pressed filter), so it needs no heading.
  const mixedProviders = shownProviders.length > 1;

  return (
    <>
      {header}
      <Command
        loop
        shouldFilter
        // Search and the list sit on an inset card; the header and settings sit on the frame around it.
        className={cn(
          'bg-background',
          sheet && 'mx-2 w-auto rounded-2xl **:[[cmdk-input]]:h-11 **:[[cmdk-item]]:min-h-11',
        )}
      >
        {/* Search floats over the list, which scrolls up beneath it. */}
        <div
          className={cn(
            'min-h-0 overflow-y-auto overscroll-contain',
            sheet ? 'max-h-[calc(45dvh+6.5rem)]' : 'max-h-96',
            'scroll-pb-1',
          )}
          // Keeps a row scrolled into view by the arrow keys clear of the search, and inset like the rest.
          style={{ scrollPaddingTop: (searchBar.height ?? 0) + 4 }}
          onScroll={event => setScrolled(event.currentTarget.scrollTop > 0)}
        >
          <div
            ref={searchBar.ref}
            data-scrolled={scrolled || undefined}
            className={cn(
              'sticky top-0 z-10 bg-background',
              'after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-3 after:bg-linear-to-b after:from-background after:to-transparent after:opacity-0 after:transition-opacity after:duration-fast',
              'data-scrolled:after:opacity-100',
            )}
          >
            <CommandInput
              placeholder={searchPlaceholder}
              value={query}
              onValueChange={onQueryChange}
              wrapperClassName={cn('border-b-0', addProvider && 'pr-1')}
              rightSlot={
                addProvider ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={cn('shrink-0', sheet && 'size-11')}
                    aria-label={addProvider.label}
                    tooltip={addProvider.label}
                    render={addProvider.render}
                    onClick={onAddProvider}
                  >
                    <Plus aria-hidden />
                  </Button>
                ) : undefined
              }
            />
            {filtering ? (
              <div
                role="group"
                aria-label="Filter by provider"
                className="flex [scrollbar-width:thin] items-center gap-1 overflow-x-auto px-2 py-1.5"
              >
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
              </div>
            ) : null}
          </div>
          <CommandList className="max-h-none overflow-visible">
            <CommandEmpty>{emptyText}</CommandEmpty>
            {shownProviders.map(provider => (
              <CommandGroup key={provider.id} heading={mixedProviders ? provider.name : undefined}>
                {[...provider.models].sort(byReleaseDate).map(model => {
                  const name = modelDisplayName(model);
                  return (
                    <CommandItem
                      key={model.id}
                      value={`${provider.id}/${model.id}`}
                      keywords={[provider.name, name, ...(model.keywords ?? [])]}
                      title={model.id}
                      onSelect={() => onSelect({ provider: provider.id, model: model.id })}
                    >
                      <span aria-hidden className="flex shrink-0">
                        {renderProviderIcon(provider.id)}
                      </span>
                      <span className="truncate">{name}</span>
                      {isSameModel(defaultModel, provider.id, model.id) ? (
                        <Badge variant="blue" size="xs">
                          Default
                        </Badge>
                      ) : null}
                      {isSameModel(value, provider.id, model.id) ? (
                        <Check aria-hidden className="ml-auto shrink-0" />
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
            {actions}
          </CommandList>
        </div>
      </Command>
      {settings ? <div className={cn('p-3', sheet && 'px-4')}>{settings}</div> : null}
      {footer}
    </>
  );
}
