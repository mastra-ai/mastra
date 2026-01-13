import { useState, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Info } from 'lucide-react';
import { ProviderLogo } from '../agent-metadata/provider-logo';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cleanProviderId } from '../agent-metadata/utils';
import { Provider } from '@mastra/client-js';
import { useFilteredProviders } from './use-model-picker';

export interface ProviderSelectProps {
  providers: Provider[];
  selectedProvider: string;
  onSelect: (provider: Provider) => void;
  className?: string;
}

export const ProviderSelect = ({
  providers,
  selectedProvider,
  onSelect,
  className = 'w-full @xs:w-2/5',
}: ProviderSelectProps) => {
  const [search, setSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentProvider = cleanProviderId(selectedProvider);
  const filteredProviders = useFilteredProviders(providers, search, isSearching);
  const selectedProviderData = providers.find(p => p.id === currentProvider);

  const handleSelect = useCallback(
    (provider: Provider) => {
      setSearch('');
      setIsSearching(false);
      setShowSuggestions(false);
      setHighlightedIndex(-1);
      onSelect(provider);
    },
    [onSelect],
  );

  const scrollToHighlighted = useCallback(() => {
    setTimeout(() => {
      const element = document.querySelector('[data-provider-highlighted="true"]');
      element?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isSearching && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        setIsSearching(true);
        setSearch('');
        setHighlightedIndex(0);
        return;
      }

      if (!showSuggestions) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => (prev < filteredProviders.length - 1 ? prev + 1 : 0));
          scrollToHighlighted();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredProviders.length - 1));
          scrollToHighlighted();
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < filteredProviders.length) {
            handleSelect(filteredProviders[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsSearching(false);
          setSearch('');
          setHighlightedIndex(-1);
          setShowSuggestions(false);
          break;
      }
    },
    [isSearching, showSuggestions, filteredProviders, highlightedIndex, handleSelect, scrollToHighlighted],
  );

  const handleFocus = useCallback(() => {
    if (!showSuggestions) {
      setShowSuggestions(true);
      const currentIndex = filteredProviders.findIndex(p => p.id === currentProvider);
      setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
      scrollToHighlighted();
    }
  }, [showSuggestions, filteredProviders, currentProvider, scrollToHighlighted]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!showSuggestions) {
        setShowSuggestions(true);
        const currentIndex = filteredProviders.findIndex(p => p.id === currentProvider);
        setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
      }
    },
    [showSuggestions, filteredProviders, currentProvider],
  );

  return (
    <Popover
      open={showSuggestions}
      onOpenChange={open => {
        setShowSuggestions(open);
        if (!open) {
          setSearch('');
          setIsSearching(false);
        }
      }}
    >
      <PopoverTrigger asChild>
        <div className={`relative ${className}`}>
          {!isSearching && currentProvider && (
            <>
              <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                <div className="relative">
                  <ProviderLogo providerId={currentProvider} size={16} />
                  {selectedProviderData && (
                    <div
                      className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                        selectedProviderData.connected ? 'bg-accent1' : 'bg-accent2'
                      }`}
                      title={selectedProviderData.connected ? 'Connected' : 'Not connected'}
                    />
                  )}
                </div>
              </div>
              {selectedProviderData?.docUrl && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
                  <Info
                    className="w-3.5 h-3.5 text-gray-500 hover:text-gray-700 cursor-pointer"
                    onClick={e => {
                      e.stopPropagation();
                      window.open(selectedProviderData.docUrl, '_blank');
                    }}
                  />
                </div>
              )}
            </>
          )}
          <Input
            aria-label="Search providers"
            spellCheck="false"
            ref={inputRef}
            className={`w-full ${!isSearching && currentProvider ? 'pl-8 pr-8' : ''}`}
            type="text"
            value={isSearching ? search : selectedProviderData?.name || currentProvider || ''}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onChange={e => {
              setIsSearching(true);
              setSearch(e.target.value);
              setHighlightedIndex(0);
            }}
            onClick={handleClick}
            placeholder="Search providers..."
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        onOpenAutoFocus={e => e.preventDefault()}
        className="flex flex-col gap-0.5 w-[var(--radix-popover-trigger-width)] max-h-[300px] overflow-y-auto p-2"
      >
        {filteredProviders.length === 0 ? (
          <div className="text-sm text-gray-500 p-2">No providers found</div>
        ) : (
          filteredProviders.map((provider, index) => {
            const isSelected = provider.id === currentProvider;
            const isHighlighted = index === highlightedIndex;

            return (
              <div
                key={provider.id}
                data-provider-highlighted={isHighlighted}
                className={`flex items-center gap-2 cursor-pointer hover:bg-surface5 px-3 py-4 rounded ${
                  isHighlighted ? 'outline outline-2 outline-blue-500' : ''
                } ${isSelected ? 'bg-surface5' : ''}`}
                onClick={() => handleSelect(provider)}
              >
                <div className="relative">
                  <ProviderLogo providerId={provider.id} size={20} />
                  <div
                    className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                      provider.connected ? 'bg-accent1' : 'bg-accent2'
                    }`}
                    title={provider.connected ? 'Connected' : 'Not connected'}
                  />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{provider.name}</div>
                </div>
                <Info
                  className="w-4 h-4 text-gray-500 hover:text-gray-700 cursor-pointer"
                  onClick={e => {
                    e.stopPropagation();
                    window.open(provider.docUrl || '#', '_blank');
                  }}
                />
              </div>
            );
          })
        )}
      </PopoverContent>
    </Popover>
  );
};
