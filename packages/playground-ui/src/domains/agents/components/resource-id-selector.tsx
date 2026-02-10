import * as React from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/ds/components/Popover';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/ds/components/Button/Button';
import { ChevronsUpDown, Check, Plus } from 'lucide-react';

export interface ResourceIdSelectorProps {
  value: string;
  onChange: (resourceId: string) => void;
  agentId: string;
  availableResourceIds: string[];
  disabled?: boolean;
}

export function ResourceIdSelector({
  value,
  onChange,
  agentId,
  availableResourceIds,
  disabled = false,
}: ResourceIdSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const options = React.useMemo(() => {
    // Always include the current value so it stays visible/selectable
    // even if the backend cannot enumerate resourceIds.
    const uniqueIds = new Set([agentId, value, ...availableResourceIds]);
    return Array.from(uniqueIds);
  }, [agentId, value, availableResourceIds]);

  const filteredOptions = React.useMemo(() => {
    if (!inputValue.trim()) return options;
    const search = inputValue.toLowerCase();
    return options.filter(id => id.toLowerCase().includes(search));
  }, [options, inputValue]);

  const isNewValue = React.useMemo(() => {
    if (!inputValue.trim()) return false;
    return !options.some(id => id.toLowerCase() === inputValue.toLowerCase());
  }, [inputValue, options]);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setInputValue('');
    setOpen(false);
  };

  const handleCreateNew = () => {
    if (inputValue.trim()) {
      onChange(inputValue.trim());
      setInputValue('');
      setOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isNewValue && inputValue.trim()) {
        handleCreateNew();
      } else if (filteredOptions.length === 1) {
        handleSelect(filteredOptions[0]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setInputValue('');
    }
  };

  React.useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(buttonVariants({ variant: 'outline', size: 'md' }), 'justify-between min-w-[180px] font-normal')}
        disabled={disabled}
      >
        <span className="truncate">{value}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[240px] p-1">
        <div className="px-2 pb-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search or create new..."
            className="w-full rounded-md border border-border1 bg-transparent px-2 py-1.5 text-ui-sm text-neutral6 placeholder:text-neutral2 focus:border-accent1 focus:outline-none focus:ring-1 focus:ring-accent1"
          />
        </div>

        <div className="max-h-[200px] overflow-y-auto">
          {filteredOptions.map(id => (
            <button
              key={id}
              type="button"
              onClick={() => handleSelect(id)}
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-ui-sm text-neutral6',
                'hover:bg-surface3 focus:bg-surface3 focus:outline-none',
                id === value && 'bg-surface2',
              )}
            >
              <span className="flex h-4 w-4 items-center justify-center">
                {id === value && <Check className="h-3 w-3" />}
              </span>
              <span className="truncate">{id}</span>
              {id === agentId && <span className="ml-auto text-xs text-neutral3">(default)</span>}
            </button>
          ))}

          {filteredOptions.length === 0 && !isNewValue && (
            <div className="px-2 py-4 text-center text-ui-sm text-neutral3">No resource IDs found.</div>
          )}

          {isNewValue && (
            <button
              type="button"
              onClick={handleCreateNew}
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-ui-sm',
                'text-accent1 hover:bg-surface3 focus:bg-surface3 focus:outline-none',
                'border-t border-border1 mt-1 pt-2',
              )}
            >
              <Plus className="h-4 w-4" />
              <span>Create "{inputValue.trim()}"</span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
