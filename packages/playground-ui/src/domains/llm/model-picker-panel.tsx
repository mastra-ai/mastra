import { useDeferredValue, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { ModelPickerOption } from './model-picker-option';
import { ModelPickerProviderFilter } from './model-picker-provider-filter';
import { ModelPickerProviderOption } from './model-picker-provider-option';
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
import { Txt } from '@/ds/components/Txt';
import { IconArrowRotateCounterClockwise } from '@/ds/icons/central/IconArrowRotateCounterClockwise';
import { IconPlusLarge } from '@/ds/icons/central/IconPlusLarge';
import { useMeasuredAutoHeight } from '@/hooks/use-measured-auto-height';
import { cn } from '@/utils/cn';
import { compareModelReleaseDates } from '@/utils/model';

// Catalogs run to thousands of models; rendering them all freezes the list.
const MAX_SEARCH_RESULTS = 50;

const byReleaseDate = (a: ModelPickerModel, b: ModelPickerModel) =>
  compareModelReleaseDates(a.releaseDate, b.releaseDate) || a.id.localeCompare(b.id);

const isSameModel = (a: ModelPickerValue | undefined, provider: string, model: string) =>
  a?.provider === provider && a.model === model;

// "Opus 4.6" finds claude-opus-4-6: ids and queries compare as plain words.
const searchWords = (text: string) => text.toLowerCase().replace(/[-_./:]/g, ' ');

/**
 * Models whose provider name, provider id or model id hold every word of the query, in the order of
 * `providers`. Runs on each keystroke over catalogs of thousands, so it sorts only the matches and stops
 * once it has more than the list shows.
 */
function searchModels(providers: ModelPickerProvider[], query: string) {
  const words = searchWords(query).split(' ').filter(Boolean);
  const matches: { provider: ModelPickerProvider; model: ModelPickerModel }[] = [];
  for (const provider of providers) {
    const providerText = searchWords(`${provider.name} ${provider.id}`);
    const found = provider.models.filter(model => {
      const text = `${providerText} ${searchWords(model.id)}`;
      return words.every(word => text.includes(word));
    });
    for (const model of found.toSorted(byReleaseDate)) matches.push({ provider, model });
    if (matches.length > MAX_SEARCH_RESULTS) break;
  }
  return matches;
}

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
  reset?: { label: string; onClick: () => void };
  onAddProvider: () => void;
  /** Bottom-sheet layout: 44px touch targets and a taller list. */
  sheet: boolean;
}

/**
 * The filter pills and the "+" link sit inside the command root, which takes Enter and the arrow keys for the list.
 * Their keys stop here so Enter presses the focused control instead of picking the highlighted model. Escape and Tab
 * still reach the popover and its focus handling.
 */
const keepKeysFromList = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' && event.key !== 'Tab') event.stopPropagation();
};

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
  reset,
  onAddProvider,
  sheet,
}: ModelPickerPanelProps) {
  // The popover and sheet unmount when closed, so each open starts with a fresh search and filter.
  const [query, setQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState(initialProviderFilter);
  const [browsingMore, setBrowsingMore] = useState(false);
  // Typing stays ahead of the list, which catches up with the latest query.
  const deferredQuery = useDeferredValue(query);
  const searchBar = useMeasuredAutoHeight();
  const [scrolled, setScrolled] = useState(false);
  // Providers without credentials wait behind "+N" (or a search) unless picked or filtered to.
  const inRow = (provider: ModelPickerProvider) =>
    provider.connected !== false || provider.id === value?.provider || provider.id === providerFilter;
  const usable = providers.filter(inRow);
  const others = providers.filter(provider => !inRow(provider));
  const filtering = usable.length > 1 || others.length > 0;
  const shownProviders = providerFilter ? usable.filter(provider => provider.id === providerFilter) : usable;
  const matches = deferredQuery ? searchModels([...usable, ...others], deferredQuery) : [];
  const filterTo = (providerId: string | undefined) => {
    setProviderFilter(providerId);
    setBrowsingMore(false);
  };
  // A lone group's provider is already on screen (the trigger, or the pressed filter), so it needs no heading.
  const mixedProviders = shownProviders.length > 1;
  const renderOption = (provider: ModelPickerProvider, model: ModelPickerModel) => (
    <ModelPickerOption
      key={`${provider.id}/${model.id}`}
      provider={provider}
      model={model}
      selected={isSameModel(value, provider.id, model.id)}
      isDefault={isSameModel(defaultModel, provider.id, model.id)}
      onSelect={() => onSelect({ provider: provider.id, model: model.id })}
      renderProviderIcon={renderProviderIcon}
    />
  );

  return (
    <>
      {header}
      <Command
        loop
        shouldFilter={false}
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
                    onKeyDown={keepKeysFromList}
                    variant="ghost"
                    size="icon-sm"
                    className={cn('shrink-0', sheet && 'size-11')}
                    aria-label={addProvider.label}
                    tooltip={addProvider.label}
                    render={addProvider.render}
                    onClick={onAddProvider}
                  >
                    <IconPlusLarge aria-hidden />
                  </Button>
                ) : undefined
              }
            />
            {filtering ? (
              <div onKeyDown={keepKeysFromList}>
                <ModelPickerProviderFilter
                  providers={usable}
                  value={providerFilter}
                  onChange={filterTo}
                  moreCount={others.length}
                  browsingMore={browsingMore}
                  onBrowseMore={() => {
                    setProviderFilter(undefined);
                    setBrowsingMore(true);
                  }}
                  renderProviderIcon={renderProviderIcon}
                  sheet={sheet}
                />
              </div>
            ) : null}
          </div>
          <CommandList className="max-h-none overflow-visible">
            <CommandEmpty>No matching model.</CommandEmpty>
            {deferredQuery ? (
              <CommandGroup>
                {matches.slice(0, MAX_SEARCH_RESULTS).map(({ provider, model }) => renderOption(provider, model))}
                {matches.length > MAX_SEARCH_RESULTS ? (
                  <Txt as="p" variant="caption" tone="muted" className="px-2 py-1.5">
                    Refine the search to see more.
                  </Txt>
                ) : null}
              </CommandGroup>
            ) : browsingMore ? (
              <CommandGroup heading="Not connected">
                {others.map(provider => (
                  <ModelPickerProviderOption
                    key={provider.id}
                    provider={provider}
                    onSelect={() => filterTo(provider.id)}
                    renderProviderIcon={renderProviderIcon}
                  />
                ))}
              </CommandGroup>
            ) : (
              shownProviders.map(provider => (
                <CommandGroup key={provider.id} heading={mixedProviders ? provider.name : undefined}>
                  {provider.models.toSorted(byReleaseDate).map(model => renderOption(provider, model))}
                </CommandGroup>
              ))
            )}
            {reset && !deferredQuery && !browsingMore ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem value="action:reset" keywords={['reset', 'default', 'model']} onSelect={reset.onClick}>
                    <IconArrowRotateCounterClockwise aria-hidden />
                    <span>{reset.label}</span>
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
