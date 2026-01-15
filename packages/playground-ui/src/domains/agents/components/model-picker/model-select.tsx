import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Input } from '@/ds/components/Input';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { useFilteredModels, ModelInfo } from './use-model-picker';

export interface ModelSelectProps {
  allModels: ModelInfo[];
  currentProvider: string;
  selectedModel: string;
  onSelect: (modelId: string) => void;
  onShiftTab?: () => void;
  className?: string;
}

export interface ModelSelectHandle {
  focus: () => void;
}

export const ModelSelect = forwardRef<ModelSelectHandle, ModelSelectProps>(
  ({ allModels, currentProvider, selectedModel, onSelect, onShiftTab, className = 'w-full @xs:w-3/5' }, ref) => {
    const [search, setSearch] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const justClosedRef = useRef(false);

    const filteredModels = useFilteredModels(allModels, currentProvider, search, isSearching);

    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus();
        inputRef.current?.click();
      },
    }));

    const handleSelect = useCallback(
      (modelId: string) => {
        justClosedRef.current = true;
        setShowSuggestions(false);
        setSearch('');
        setIsSearching(false);
        onSelect(modelId);
        // Reset the flag after a delay - needs to be long enough to prevent focus reopening
        setTimeout(() => {
          justClosedRef.current = false;
        }, 200);
      },
      [onSelect],
    );

    const scrollToHighlighted = useCallback(() => {
      setTimeout(() => {
        const element = document.querySelector('[data-model-highlighted="true"]');
        element?.scrollIntoView({ block: 'nearest' });
      }, 0);
    }, []);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Tab' && e.shiftKey) {
          e.preventDefault();
          onShiftTab?.();
          return;
        }

        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setHighlightedIndex(prev => (prev < filteredModels.length - 1 ? prev + 1 : prev));
            scrollToHighlighted();
            break;
          case 'ArrowUp':
            e.preventDefault();
            setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredModels.length - 1));
            scrollToHighlighted();
            break;
          case 'Enter':
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < filteredModels.length) {
              handleSelect(filteredModels[highlightedIndex].model);
            } else if (isSearching && search.trim()) {
              // Custom model ID support
              handleSelect(search.trim());
            }
            break;
          case 'Escape':
            e.preventDefault();
            justClosedRef.current = true;
            setShowSuggestions(false);
            setHighlightedIndex(-1);
            setIsSearching(false);
            setSearch('');
            setTimeout(() => {
              justClosedRef.current = false;
            }, 200);
            break;
        }
      },
      [filteredModels, highlightedIndex, isSearching, search, handleSelect, onShiftTab, scrollToHighlighted],
    );

    const handleFocus = useCallback(() => {
      // Don't reopen if we just closed after selection
      if (justClosedRef.current) {
        return;
      }

      if (!showSuggestions) {
        setShowSuggestions(true);
      }

      const currentIndex = filteredModels.findIndex(m => m.model === selectedModel);
      setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
      scrollToHighlighted();
    }, [showSuggestions, filteredModels, selectedModel, scrollToHighlighted]);

    return (
      <Popover
        modal={true}
        open={showSuggestions}
        onOpenChange={open => {
          if (!open) {
            justClosedRef.current = true;
            setTimeout(() => {
              justClosedRef.current = false;
            }, 200);
            setSearch('');
            setIsSearching(false);
          }
          setShowSuggestions(open);
        }}
      >
        <PopoverTrigger asChild>
          <Input
            aria-label="Search models"
            spellCheck="false"
            ref={inputRef}
            className={className}
            type="text"
            value={isSearching ? search : selectedModel}
            onChange={e => {
              setSearch(e.target.value);
              setIsSearching(true);
              setHighlightedIndex(0);
            }}
            onClick={e => {
              e.preventDefault();
              if (!showSuggestions) {
                setShowSuggestions(true);
              }
            }}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder="Enter model name or select from suggestions..."
          />
        </PopoverTrigger>

        {allModels.length > 0 && (
          <PopoverContent
            className="flex flex-col gap-0 w-[var(--radix-popover-trigger-width)] max-h-[calc(var(--radix-popover-content-available-height)-50px)] overflow-y-auto p-2"
            onOpenAutoFocus={e => e.preventDefault()}
          >
            {filteredModels.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">No models found</div>
            ) : (
              filteredModels.map((model, index) => {
                const isHighlighted = index === highlightedIndex;
                const isSelected = model.model === selectedModel;
                return (
                  <div
                    key={`${model.provider}-${model.model}`}
                    data-model-highlighted={isHighlighted}
                    className={`flex items-center gap-2 px-4 py-3 cursor-pointer rounded hover:bg-surface5 ${
                      isHighlighted ? 'outline outline-2 outline-accent5' : ''
                    } ${isSelected ? 'bg-surface5' : ''}`}
                    onMouseDown={e => {
                      e.preventDefault();
                      handleSelect(model.model);
                      inputRef.current?.blur();
                    }}
                  >
                    {model.model}
                  </div>
                );
              })
            )}
          </PopoverContent>
        )}
      </Popover>
    );
  },
);

ModelSelect.displayName = 'ModelSelect';
