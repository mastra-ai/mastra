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
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [triggerWidth, setTriggerWidth] = React.useState<number | undefined>(undefined);

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

  React.useEffect(() => {
    if (triggerRef.current) {
      setTriggerWidth(triggerRef.current.offsetWidth);
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between', buttonClassName, className)}
          disabled={disabled}
        >
          <span className="truncate text-ui-lg">{selectedOption ? selectedOption.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn('p-1', contentClassName)}
        align="start"
        style={{ width: triggerWidth ? `${triggerWidth}px` : undefined, padding: '0px' }}
      >
        <div className="flex flex-col">
          <div className="px-2 pt-2">
            <div className="flex items-center border-sm border-border1 rounded-lg px-3 h-8 focus-within:outline focus-within:outline-accent1 -outline-offset-2">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                className="flex w-full bg-transparent text-[calc(13_/_16_*_1rem)] text-icon6 outline-none placeholder:text-icon3 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder={searchPlaceholder}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <ScrollArea className="max-h-[300px]">
            <div className="p-1">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-ui-sm">{emptyText}</div>
              ) : (
                filteredOptions.map(option => (
                  <div
                    key={option.value}
                    className={cn(
                      'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-ui-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                      value === option.value && 'bg-accent',
                    )}
                    onClick={() => handleSelect(option.value)}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === option.value ? 'opacity-100' : 'opacity-0')} />
                    {option.label}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
