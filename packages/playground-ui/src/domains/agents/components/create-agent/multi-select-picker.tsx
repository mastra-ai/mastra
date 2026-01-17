'use client';

import * as React from 'react';
import { useId } from 'react';
import { ChevronsUpDown, Search, X } from 'lucide-react';

import { Button } from '@/ds/components/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { Checkbox } from '@/ds/components/Checkbox';
import { RadioGroup, RadioGroupItem } from '@/ds/components/RadioGroup';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Label } from '@/ds/components/Label';
import { cn } from '@/lib/utils';

export interface MultiSelectPickerProps<T> {
  label: string;
  options: T[];
  selected: string[];
  onChange: (selected: string[]) => void;
  getOptionId: (option: T) => string;
  getOptionLabel: (option: T) => string;
  getOptionDescription?: (option: T) => string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  singleSelect?: boolean;
  error?: string;
}

export function MultiSelectPicker<T>({
  label,
  options,
  selected,
  onChange,
  getOptionId,
  getOptionLabel,
  getOptionDescription,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No options found.',
  disabled = false,
  singleSelect = false,
  error,
}: MultiSelectPickerProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const uid = useId();

  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    return options.filter(option => {
      const labelMatch = getOptionLabel(option).toLowerCase().includes(search.toLowerCase());
      const descriptionMatch = getOptionDescription?.(option)?.toLowerCase().includes(search.toLowerCase());
      return labelMatch || descriptionMatch;
    });
  }, [options, search, getOptionLabel, getOptionDescription]);

  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions]);

  React.useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  React.useEffect(() => {
    if (listRef.current && highlightedIndex >= 0) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = (optionId: string) => {
    if (singleSelect) {
      onChange([optionId]);
      setOpen(false);
      setSearch('');
    } else {
      if (selected.includes(optionId)) {
        onChange(selected.filter(id => id !== optionId));
      } else {
        onChange([...selected, optionId]);
      }
    }
  };

  const handleRemove = (optionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter(id => id !== optionId));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          handleSelect(getOptionId(filteredOptions[highlightedIndex]));
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setSearch('');
        break;
      case 'Home':
        e.preventDefault();
        setHighlightedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setHighlightedIndex(filteredOptions.length - 1);
        break;
      case ' ':
        if (!search) {
          e.preventDefault();
          if (filteredOptions[highlightedIndex]) {
            handleSelect(getOptionId(filteredOptions[highlightedIndex]));
          }
        }
        break;
    }
  };

  const selectedOptions = options.filter(option => selected.includes(getOptionId(option)));

  const MAX_VISIBLE_ITEMS = 3;

  const renderTriggerContent = () => {
    if (selectedOptions.length === 0) {
      return <span className="text-icon3">{placeholder}</span>;
    }

    const visibleOptions = selectedOptions.slice(0, MAX_VISIBLE_ITEMS);
    const remainingCount = selectedOptions.length - MAX_VISIBLE_ITEMS;

    return (
      <div className="flex flex-wrap gap-1 items-center max-w-full overflow-hidden">
        {visibleOptions.map(option => {
          const id = getOptionId(option);
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1 bg-surface4 text-icon5 text-ui-sm rounded-md px-1.5 h-badge-default shrink-0"
            >
              <span className="truncate max-w-truncate-sm">{getOptionLabel(option)}</span>
              <button
                type="button"
                onClick={e => handleRemove(id, e)}
                className="hover:text-icon6 focus:outline-none shrink-0"
                aria-label={`Remove ${getOptionLabel(option)}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        {remainingCount > 0 && (
          <span className="inline-flex items-center bg-surface3 text-icon4 text-ui-sm rounded-md px-1.5 h-badge-default shrink-0">
            +{remainingCount} more
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs text-icon5">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            variant="default"
            className={cn(
              'w-full justify-between min-h-form-sm h-auto py-1',
              error && 'border-accent2',
              disabled && 'cursor-not-allowed opacity-50',
            )}
            disabled={disabled}
          >
            {renderTriggerContent()}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-full" align="start" style={{ width: 'var(--radix-popover-trigger-width)' }}>
          <div className="flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground">
            <div className="flex items-center border-b border-border1 px-3 py-2">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                ref={inputRef}
                className="flex h-8 w-full rounded-md bg-transparent py-1 text-sm placeholder:text-icon3 disabled:cursor-not-allowed disabled:opacity-50 outline-none"
                placeholder={searchPlaceholder}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                role="combobox"
                aria-autocomplete="list"
                aria-controls={`${uid}-options`}
                aria-expanded={open}
              />
            </div>
            <ScrollArea maxHeight="240px">
              <div
                ref={listRef}
                id={`${uid}-options`}
                role="listbox"
                aria-multiselectable={!singleSelect}
                className="p-1"
              >
                {filteredOptions.length === 0 ? (
                  <div className="py-6 text-center text-sm text-icon3">{emptyMessage}</div>
                ) : singleSelect ? (
                  <RadioGroup value={selected[0] || ''} onValueChange={value => handleSelect(value)}>
                    {filteredOptions.map((option, index) => {
                      const id = getOptionId(option);
                      const optionLabel = getOptionLabel(option);
                      const description = getOptionDescription?.(option);
                      const isHighlighted = index === highlightedIndex;

                      return (
                        <div
                          key={id}
                          role="option"
                          aria-selected={selected.includes(id)}
                          className={cn(
                            'relative flex cursor-pointer select-none items-start gap-3 rounded-sm px-2 py-2 transition-colors',
                            'hover:bg-surface3',
                            isHighlighted && 'bg-surface3',
                          )}
                          onClick={() => handleSelect(id)}
                          onMouseEnter={() => setHighlightedIndex(index)}
                        >
                          <RadioGroupItem value={id} id={`radio-${id}`} className="mt-0.5" />
                          <div className="flex flex-col gap-0.5">
                            <label htmlFor={`radio-${id}`} className="text-sm text-icon6 cursor-pointer">
                              {optionLabel}
                            </label>
                            {description && <span className="text-xs text-icon3">{description}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </RadioGroup>
                ) : (
                  filteredOptions.map((option, index) => {
                    const id = getOptionId(option);
                    const optionLabel = getOptionLabel(option);
                    const description = getOptionDescription?.(option);
                    const isSelected = selected.includes(id);
                    const isHighlighted = index === highlightedIndex;

                    return (
                      <div
                        key={id}
                        role="option"
                        aria-selected={isSelected}
                        className={cn(
                          'relative flex cursor-pointer select-none items-start gap-3 rounded-sm px-2 py-2 transition-colors',
                          'hover:bg-surface3',
                          isHighlighted && 'bg-surface3',
                        )}
                        onClick={() => handleSelect(id)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                      >
                        <Checkbox checked={isSelected} id={`checkbox-${id}`} className="mt-0.5" />
                        <div className="flex flex-col gap-0.5">
                          <label htmlFor={`checkbox-${id}`} className="text-sm text-icon6 cursor-pointer">
                            {optionLabel}
                          </label>
                          {description && <span className="text-xs text-icon3">{description}</span>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>
      {error && <span className="text-xs text-accent2">{error}</span>}
    </div>
  );
}
