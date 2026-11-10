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
import { Txt } from '@/ds/components/Txt';
import { useMeasuredAutoHeight } from '@/hooks/use-measured-auto-height';
import { cn } from '@/utils/cn';
import { compareModelReleaseDates, formatModelName } from '@/utils/model';

// Catalogs run to thousands of models; rendering them all freezes the list.
const MAX_SEARCH_RESULTS = 50;

const byReleaseDate = (a: ModelPickerModel, b: ModelPickerModel) =>
  compareModelReleaseDates(a.releaseDate, b.releaseDate) || a.id.localeCompare(b.id);

const isSameModel = (a: ModelPickerValue | undefined, provider: string, model: string) =>
  a?.provider === provider && a.model === model;

/** Every word of the query appears in the provider or model name or id. */
function searchModels(providers: ModelPickerProvider[], query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches: { provider: ModelPickerProvider; model: ModelPickerModel }[] = [];
  for (const provider of providers) {
    for (const model of provider.models.toSorted(byReleaseDate)) {
      const text = `${provider.name} ${provider.id} ${model.id} ${formatModelName(model.id)}`.toLowerCase();
      if (words.every(word => text.includes(word))) matches.push({ provider, model });
    }
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
  // Providers without credentials stay out of the way until a search asks for them.
  const usable = providers.filter(provider => provider.connected !== false || provider.id === value?.provider);
  const filtering = usable.length > 1;
  const shownProviders = providerFilter ? usable.filter(provider => provider.id === providerFilter) : usable;
  const matches = query ? searchModels(providers, query) : [];
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
                providers={usable}
                value={providerFilter}
                onChange={setProviderFilter}
                renderProviderIcon={renderProviderIcon}
                sheet={sheet}
              />
            ) : null}
          </div>
          <CommandList className="max-h-none overflow-visible">
            <CommandEmpty>No matching model.</CommandEmpty>
            {query ? (
              <CommandGroup>
                {matches.slice(0, MAX_SEARCH_RESULTS).map(({ provider, model }) => renderOption(provider, model))}
                {matches.length > MAX_SEARCH_RESULTS ? (
                  <Txt as="p" variant="caption" tone="muted" className="px-2 py-1.5">
                    Refine the search to see more.
                  </Txt>
                ) : null}
              </CommandGroup>
            ) : (
              shownProviders.map(provider => (
                <CommandGroup key={provider.id} heading={mixedProviders ? provider.name : undefined}>
                  {provider.models.toSorted(byReleaseDate).map(model => renderOption(provider, model))}
                </CommandGroup>
              ))
            )}
            {!query && resetLabel && defaultModel && !isSameModel(value, defaultModel.provider, defaultModel.model) ? (
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
