import { Plus, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ModelPickerOption } from './model-picker-option';
import { ModelPickerProviderFilter } from './model-picker-provider-filter';
import type {
  ModelPickerAddProvider,
  ModelPickerModel,
  ModelPickerProvider,
  ModelPickerValue,
} from './model-picker-types';
import { Button } from '@/ds/components/Button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/ds/components/Command';
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
  /** Provider the list opens filtered to; "All" when unset. */
  initialProviderFilter?: string;
  renderProviderIcon: (providerId: string) => ReactNode;
  header?: ReactNode;
  settings?: ReactNode;
  addProvider?: ModelPickerAddProvider;
  /** Labels an action that picks `defaultModel`, shown while another model is picked. */
  resetLabel?: string;
  onAddProvider: () => void;
  /** Bottom-sheet layout: 44px touch targets and a taller list. */
  sheet: boolean;
}

/** Search, provider filters, the model list and the selected model's settings. */
export function ModelPickerPanel({
  providers,
  value,
  defaultModel,
  onSelect,
  initialProviderFilter,
  renderProviderIcon,
  header,
  settings,
  addProvider,
  resetLabel,
  onAddProvider,
  sheet,
}: ModelPickerPanelProps) {
  // The popover and sheet unmount when closed, so each open starts with a fresh search and filter.
  const [query, setQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState(initialProviderFilter);
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
              placeholder="Search models"
              value={query}
              onValueChange={setQuery}
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
              <ModelPickerProviderFilter
                providers={providers}
                value={providerFilter}
                onChange={setProviderFilter}
                renderProviderIcon={renderProviderIcon}
                sheet={sheet}
              />
            ) : null}
          </div>
          <CommandList className="max-h-none overflow-visible">
            <CommandEmpty>No matching model.</CommandEmpty>
            {shownProviders.map(provider => (
              <CommandGroup key={provider.id} heading={mixedProviders ? provider.name : undefined}>
                {provider.models.toSorted(byReleaseDate).map(model => (
                  <ModelPickerOption
                    key={model.id}
                    provider={provider}
                    model={model}
                    selected={isSameModel(value, provider.id, model.id)}
                    isDefault={isSameModel(defaultModel, provider.id, model.id)}
                    onSelect={() => onSelect({ provider: provider.id, model: model.id })}
                    renderProviderIcon={renderProviderIcon}
                  />
                ))}
              </CommandGroup>
            ))}
            {resetLabel && defaultModel && !isSameModel(value, defaultModel.provider, defaultModel.model) ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="action:reset"
                    keywords={['reset', 'default', 'model']}
                    onSelect={() => onSelect(defaultModel)}
                  >
                    <RotateCcw aria-hidden />
                    <span>{resetLabel}</span>
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </div>
      </Command>
      {settings ? <div className={cn('p-3', sheet && 'px-4')}>{settings}</div> : null}
    </>
  );
}
