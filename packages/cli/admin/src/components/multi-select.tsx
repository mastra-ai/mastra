'use client';

import { useState } from 'react';

import { Icon } from '@/components/icon';
import { Badge } from '@/components/ui/badge';
import { Command, CommandInput, CommandGroup, CommandList, CommandItem } from '@/components/ui/command';
import IconButton from '@/components/ui/icon-button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { lodashTitleCase } from '@/lib/string';
import { cn } from '@/lib/utils';

interface MultiSelectProps {
  options: { label: string; value: string }[];
  fieldName: string;
  onSelect: ({ key, value }: { key: any; value: any }) => void;
  selected?: string[];
}

const MultiSelect = ({ options, fieldName, onSelect, selected }: MultiSelectProps) => {
  const [selectedValues, setSelectedValues] = useState(selected || []);
  const [itemValue, setItemValue] = useState('');
  const [openPopover, setOpenPopover] = useState(false);
  const [fieldIndex, setFieldIndex] = useState<number | null>(null);

  const removeItem = (index: number) => {
    const newValues = [...selectedValues]?.filter((a, i) => i !== index);
    setSelectedValues(newValues);
    onSelect({ key: fieldName, value: newValues });
  };

  const onSelectItemToEdit = (item: string, itemIndex: number) => {
    setFieldIndex(itemIndex);
    setItemValue(item);
    setOpenPopover(true);
  };

  const onSaveEnteredItem = (value: string) => {
    let newValues = [...selectedValues];
    if (typeof fieldIndex === 'number') {
      newValues = newValues.map((item, i) => {
        if (fieldIndex === i) return value;

        return item;
      });
    } else {
      newValues = [...newValues, value];
    }
    setSelectedValues(newValues);
    onSelect({ key: fieldName, value: newValues });
    setFieldIndex(null);
    setItemValue('');
  };

  const allOptions = options?.length ? options?.filter(({ value }) => !selectedValues?.includes(value)) : [];

  return (
    <div className="flex flex-col gap-2">
      <TooltipProvider delayDuration={0}>
        {selectedValues?.length ? (
          <div className="flex flex-wrap gap-2">
            {selectedValues?.map((val, index) => (
              <Tooltip key={val}>
                <TooltipTrigger onClick={e => e.stopPropagation()}>
                  <Badge
                    key={val}
                    variant="secondary"
                    onClick={() => onSelectItemToEdit(val, index)}
                    className="flex h-7 max-w-[120px] cursor-pointer items-center justify-between overflow-hidden rounded-sm border-[#3e3e3e] bg-transparent p-0 pr-1 text-xs"
                  >
                    <p className="relative truncate px-2 text-xs font-normal">{val}</p>

                    <IconButton
                      icon="cancel"
                      aria-label={`remove ${val?.toLocaleLowerCase()}`}
                      className="h-2 px-0 py-0"
                      iconClassname="h-3 w-3 text-text-dim"
                      onClick={e => {
                        e.stopPropagation();
                        removeItem(index);
                      }}
                    />
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="bg-dialog-bg rounded-md p-1 px-3">{val}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        ) : (
          <></>
        )}
      </TooltipProvider>
      <Popover open={openPopover} onOpenChange={setOpenPopover}>
        <PopoverTrigger asChild>
          <div className="flex cursor-pointer items-center gap-2">
            <Icon name="plus-icon" className="text-accent-2 text-xs" />
            <p className="text-accent-2 flex items-center text-xs">{`Add ${lodashTitleCase(fieldName)}`}</p>
          </div>
        </PopoverTrigger>
        <PopoverContent
          onKeyDown={e => {
            if (e.key == 'Escape') {
              e.stopPropagation();
              setOpenPopover(false);
              setItemValue('');
              setFieldIndex(null);
            }
            if (e.key == 'Enter' && !(e.ctrlKey || e.metaKey)) {
              e.stopPropagation();
              if (itemValue) {
                onSaveEnteredItem(itemValue);
              }
            }
          }}
          className={cn(
            'border-1 border-neutral-750 bg-mastra-bg-2 w-[var(--radix-popover-trigger-width)] min-w-56 p-0 backdrop-blur-md',
          )}
          align="start"
        >
          <Command
            filter={(value, search) => {
              const label = allOptions
                ?.find(opt => opt.value?.toLocaleLowerCase() === value?.toLocaleLowerCase())
                ?.label?.toLowerCase();
              if (label?.includes(search.toLowerCase())) return 1;
              return 0;
            }}
          >
            <CommandInput
              placeholder={`Search or enter new ${lodashTitleCase(fieldName)}`}
              className="h-9 px-2 placeholder:text-neutral-500"
              value={itemValue}
              onValueChange={search => setItemValue(search)}
            />
            <CommandGroup
              className={cn('max-h-[50vh] overflow-auto', {
                'h-0 !p-0': !allOptions?.length && !selectedValues?.length,
              })}
            >
              <CommandList>
                <CommandItem
                  key={`clear-selection`}
                  value="vvv"
                  className="group mt-0.5 flex w-full !cursor-pointer justify-between gap-2 first:mt-0"
                  onSelect={e => {
                    setOpenPopover(false);
                    setSelectedValues([]);
                    onSelect({ key: fieldName, value: [] });
                  }}
                >
                  <span>Clear selection</span>
                  <Icon className="text-mastra-el-3 group-hover:text-mastra-el-6 transition-colors" name="cancel" />
                </CommandItem>
              </CommandList>

              <CommandList>
                {(allOptions || [])?.map(opt => {
                  return (
                    <CommandItem
                      value={opt.value}
                      key={opt.value}
                      className="group mt-0.5 flex w-full !cursor-pointer gap-2 first:mt-0"
                      onSelect={e => {
                        onSaveEnteredItem(opt.value);
                      }}
                    >
                      <span>{opt.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandList>
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default MultiSelect;
