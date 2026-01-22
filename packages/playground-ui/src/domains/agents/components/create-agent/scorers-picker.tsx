'use client';

import * as React from 'react';
import { useId } from 'react';
import { ChevronsUpDown, Search, X, Trash2 } from 'lucide-react';

import { Button } from '@/ds/components/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { Checkbox } from '@/ds/components/Checkbox';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Label } from '@/ds/components/Label';
import { Input } from '@/ds/components/Input';
import { RadioGroup, RadioGroupItem } from '@/ds/components/RadioGroup';
import { cn } from '@/lib/utils';

export interface ScoringSamplingConfig {
  type: 'ratio' | 'count';
  rate?: number;
  count?: number;
}

export interface ScorerConfig {
  sampling?: ScoringSamplingConfig;
}

export interface ScorersPickerProps {
  selected: Record<string, ScorerConfig>;
  onChange: (value: Record<string, ScorerConfig>) => void;
  options: Array<{ id: string; name: string; description?: string }>;
  disabled?: boolean;
  error?: string;
}

export function ScorersPicker({ selected, onChange, options, disabled = false, error }: ScorersPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const uid = useId();

  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    return options.filter(option => {
      const labelMatch = option.name.toLowerCase().includes(search.toLowerCase());
      const descriptionMatch = option.description?.toLowerCase().includes(search.toLowerCase());
      return labelMatch || descriptionMatch;
    });
  }, [options, search]);

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

  const handleSelect = (scorerId: string) => {
    const isSelected = scorerId in selected;
    if (isSelected) {
      const newSelected = { ...selected };
      delete newSelected[scorerId];
      onChange(newSelected);
    } else {
      onChange({
        ...selected,
        [scorerId]: {}, // Default: no sampling config
      });
    }
  };

  const handleRemove = (scorerId: string) => {
    const newSelected = { ...selected };
    delete newSelected[scorerId];
    onChange(newSelected);
  };

  const handleSamplingChange = (scorerId: string, samplingConfig: ScoringSamplingConfig | undefined) => {
    onChange({
      ...selected,
      [scorerId]: {
        sampling: samplingConfig,
      },
    });
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
          handleSelect(filteredOptions[highlightedIndex].id);
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
            handleSelect(filteredOptions[highlightedIndex].id);
          }
        }
        break;
    }
  };

  const selectedScorers = Object.keys(selected);
  const selectedScorerObjects = options.filter(option => selectedScorers.includes(option.id));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label className="text-xs text-icon5">Scorers</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              role="combobox"
              aria-expanded={open}
              aria-haspopup="listbox"
              variant="default"
              className={cn(
                'w-full justify-between min-h-[32px]',
                error && 'border-accent2',
                disabled && 'cursor-not-allowed opacity-50',
              )}
              disabled={disabled}
            >
              <span className="text-icon3">
                {selectedScorers.length === 0
                  ? 'Select scorers...'
                  : `${selectedScorers.length} scorer${selectedScorers.length === 1 ? '' : 's'} selected`}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
            <div className="flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground">
              <div className="flex items-center border-b border-border1 px-3 py-2">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <input
                  ref={inputRef}
                  className="flex h-8 w-full rounded-md bg-transparent py-1 text-sm placeholder:text-icon3 disabled:cursor-not-allowed disabled:opacity-50 outline-none"
                  placeholder="Search scorers..."
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
                <div ref={listRef} id={`${uid}-options`} role="listbox" aria-multiselectable className="p-1">
                  {filteredOptions.length === 0 ? (
                    <div className="py-6 text-center text-sm text-icon3">No scorers available</div>
                  ) : (
                    filteredOptions.map((option, index) => {
                      const isSelected = selectedScorers.includes(option.id);
                      const isHighlighted = index === highlightedIndex;

                      return (
                        <div
                          key={option.id}
                          role="option"
                          aria-selected={isSelected}
                          className={cn(
                            'relative flex cursor-pointer select-none items-start gap-3 rounded-sm px-2 py-2 transition-colors',
                            'hover:bg-surface3',
                            isHighlighted && 'bg-surface3',
                          )}
                          onClick={() => handleSelect(option.id)}
                          onMouseEnter={() => setHighlightedIndex(index)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleSelect(option.id)}
                            id={`checkbox-${option.id}`}
                            className="mt-0.5"
                          />
                          <div className="flex flex-col gap-0.5">
                            <label htmlFor={`checkbox-${option.id}`} className="text-sm text-icon6 cursor-pointer">
                              {option.name}
                            </label>
                            {option.description && <span className="text-xs text-icon3">{option.description}</span>}
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

      {/* Selected scorers with sampling config */}
      {selectedScorerObjects.length > 0 && (
        <div className="flex flex-col gap-2 pl-3 border-l-2 border-border1">
          {selectedScorerObjects.map(scorer => (
            <ScorerSamplingConfig
              key={scorer.id}
              scorerId={scorer.id}
              scorerName={scorer.name}
              samplingConfig={selected[scorer.id]?.sampling}
              onSamplingChange={config => handleSamplingChange(scorer.id, config)}
              onRemove={() => handleRemove(scorer.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ScorerSamplingConfigProps {
  scorerId: string;
  scorerName: string;
  samplingConfig?: ScoringSamplingConfig;
  onSamplingChange: (config: ScoringSamplingConfig | undefined) => void;
  onRemove: () => void;
}

function ScorerSamplingConfig({
  scorerId,
  scorerName,
  samplingConfig,
  onSamplingChange,
  onRemove,
}: ScorerSamplingConfigProps) {
  const samplingType = samplingConfig?.type || 'none';

  const handleTypeChange = (type: string) => {
    if (type === 'none') {
      onSamplingChange(undefined);
    } else if (type === 'ratio') {
      onSamplingChange({ type: 'ratio', rate: 0.1 }); // Default 10%
    } else if (type === 'count') {
      onSamplingChange({ type: 'count', count: 10 }); // Default 10 samples
    }
  };

  const handleRateChange = (rate: number) => {
    if (samplingConfig?.type === 'ratio') {
      onSamplingChange({ type: 'ratio', rate });
    }
  };

  const handleCountChange = (count: number) => {
    if (samplingConfig?.type === 'count') {
      onSamplingChange({ type: 'count', count });
    }
  };

  return (
    <div className="flex flex-col gap-2 p-2 bg-surface2 rounded-md border border-border1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-icon6">{scorerName}</span>
        <Button
          type="button"
          variant="ghost"
          onClick={onRemove}
          className="h-6 w-6 p-0 text-icon3 hover:text-accent2"
          aria-label={`Remove ${scorerName}`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`sampling-type-${scorerId}`} className="text-xs text-icon4">
          Sampling
        </Label>
        <RadioGroup
          id={`sampling-type-${scorerId}`}
          value={samplingType}
          onValueChange={handleTypeChange}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="none" id={`${scorerId}-none`} />
            <Label htmlFor={`${scorerId}-none`} className="text-sm text-icon5 cursor-pointer">
              None (evaluate all)
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="ratio" id={`${scorerId}-ratio`} />
            <Label htmlFor={`${scorerId}-ratio`} className="text-sm text-icon5 cursor-pointer">
              Ratio (percentage)
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="count" id={`${scorerId}-count`} />
            <Label htmlFor={`${scorerId}-count`} className="text-sm text-icon5 cursor-pointer">
              Count (fixed number)
            </Label>
          </div>
        </RadioGroup>

        {samplingType === 'ratio' && (
          <div className="flex flex-col gap-1.5 mt-1">
            <Label htmlFor={`rate-${scorerId}`} className="text-xs text-icon4">
              Sample Rate (0-1)
            </Label>
            <Input
              id={`rate-${scorerId}`}
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={samplingConfig?.rate ?? 0.1}
              onChange={e => handleRateChange(parseFloat(e.target.value))}
              className="h-8"
            />
          </div>
        )}

        {samplingType === 'count' && (
          <div className="flex flex-col gap-1.5 mt-1">
            <Label htmlFor={`count-${scorerId}`} className="text-xs text-icon4">
              Sample Count
            </Label>
            <Input
              id={`count-${scorerId}`}
              type="number"
              min="1"
              step="1"
              value={samplingConfig?.count ?? 10}
              onChange={e => handleCountChange(parseInt(e.target.value, 10))}
              className="h-8"
            />
          </div>
        )}
      </div>
    </div>
  );
}
