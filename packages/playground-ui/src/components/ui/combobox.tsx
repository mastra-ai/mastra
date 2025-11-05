'use client';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import * as React from 'react';

export type ComboboxOption = {
  label: string;
  value: string;
};

export type ComboboxProps = {
  options: ComboboxOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  buttonClassName?: string;
  contentClassName?: string;
};

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  emptyText = 'No option found.',
  className,
  disabled = false,
  buttonClassName,
  contentClassName,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState<number>(-1);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [triggerWidth, setTriggerWidth] = React.useState<number | undefined>(undefined);

  // Generate stable IDs for ARIA attributes
  const listboxId = React.useId();
  const getOptionId = React.useCallback((index: number) => `${listboxId}-option-${index}`, [listboxId]);

  const selectedOption = options.find(option => option.value === value);

  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    const searchLower = search.toLowerCase();
    return options.filter(
      option => option.label.toLowerCase().includes(searchLower) || option.value.toLowerCase().includes(searchLower),
    );
  }, [options, search]);

  const handleSelect = (optionValue: string) => {
    onValueChange?.(optionValue);
    setOpen(false);
    setSearch('');
  };

  // Set activeIndex when opening, reset when closing
  React.useEffect(() => {
    if (open) {
      const selectedIndex = filteredOptions.findIndex(opt => opt.value === value);
      const initialIndex = selectedIndex >= 0 ? selectedIndex : 0;
      setActiveIndex(initialIndex);
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setActiveIndex(-1);
    }
  }, [open]);

  // Keep activeIndex in bounds when filtering
  React.useEffect(() => {
    if (open && activeIndex >= filteredOptions.length && filteredOptions.length > 0) {
      setActiveIndex(filteredOptions.length - 1);
    }
  }, [filteredOptions.length, open, activeIndex]);

  React.useEffect(() => {
    if (triggerRef.current) {
      setTriggerWidth(triggerRef.current.offsetWidth);
    }
  }, [open]);

  // Keyboard navigation handlers
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => {
          if (filteredOptions.length === 0) return -1;
          const next = prev < filteredOptions.length - 1 ? prev + 1 : 0;
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => {
          if (filteredOptions.length === 0) return -1;
          const next = prev > 0 ? prev - 1 : filteredOptions.length - 1;
          return next;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
          handleSelect(filteredOptions[activeIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setSearch('');
        setActiveIndex(-1);
        triggerRef.current?.focus();
        break;
      case 'Home':
        e.preventDefault();
        if (filteredOptions.length > 0) {
          setActiveIndex(0);
        }
        break;
      case 'End':
        e.preventDefault();
        if (filteredOptions.length > 0) {
          const last = filteredOptions.length - 1;
          setActiveIndex(last);
        }
        break;
    }
  };

  const activeDescendantId =
    activeIndex >= 0 && activeIndex < filteredOptions.length ? getOptionId(activeIndex) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          className={cn('w-full justify-between', buttonClassName, className)}
          disabled={disabled}
          onKeyDown={handleKeyDown}
        >
          <span className="truncate text-ui-lg">{selectedOption ? selectedOption.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn('p-1', contentClassName)}
        align="start"
        style={{ width: triggerWidth ? `${triggerWidth}px` : undefined, padding: '0px' }}
        role="listbox"
        id={listboxId}
        aria-activedescendant={activeDescendantId}
      >
        <div className="flex flex-col">
          <div className="px-2 pt-2">
            <div className="flex items-center border-sm border-border1 rounded-lg px-3 h-8 focus-within:outline focus-within:outline-accent1 -outline-offset-2">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                ref={inputRef}
                className="flex w-full bg-transparent text-[calc(13_/_16_*_1rem)] text-icon6 outline-none placeholder:text-icon3 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder={searchPlaceholder}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-activedescendant={activeDescendantId}
              />
            </div>
          </div>
          <ScrollArea className="max-h-[300px]">
            <div className="p-1">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-ui-sm">{emptyText}</div>
              ) : (
                filteredOptions.map((option, index) => {
                  const isSelected = value == option.value;
                  const isActive = activeIndex == index;
                  return (
                    <div
                      key={option.value}
                      id={getOptionId(index)}
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={-1}
                      className={cn(
                        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-ui-sm transition-colors',
                        isActive && 'bg-accent',
                        !isActive && 'hover:bg-accent/50',
                      )}
                      onClick={() => handleSelect(option.value)}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <Check className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                      {option.label}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
