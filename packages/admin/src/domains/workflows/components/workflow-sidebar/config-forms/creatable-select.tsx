'use client';

import type { ActionVariables } from '@mastra/core';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Icon } from '@/components/icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandInput, CommandGroup, CommandList, CommandItem } from '@/components/ui/command';
import IconButton from '@/components/ui/icon-button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { lodashTitleCase } from '@/lib/string';
import { cn } from '@/lib/utils';

import useVariables from '@/domains/workflows/hooks/use-manage-variables';

import VariableBadgeList from '../../utils/variable-badge-list';

interface CreatableSelect {
  options: { label: string; value: string }[];
  field: any;
  onSelect: ({ key, value, variables }: { key: any; value: any; variables?: ActionVariables }) => void;
  selected?: string[];
  canUseVariables?: boolean;
  initialVariables?: ActionVariables;
  withoutClearSelection?: boolean;
}

const CreatableSelect = ({
  options,
  field,
  onSelect,
  selected,
  canUseVariables,
  initialVariables,
  withoutClearSelection,
}: CreatableSelect) => {
  const [selectedValues, setSelectedValues] = useState(selected || []);
  const [itemValue, setItemValue] = useState('');
  const [openPopover, setOpenPopover] = useState(false);
  const [fieldIndex, setFieldIndex] = useState<number | null>(null);

  const cb = useCallback(
    ({ variablePayload }: { variablePayload: ActionVariables }) =>
      onSelect({ key: field.name, value: selectedValues, variables: variablePayload }),
    [field.name, selectedValues],
  );

  const { variables, variablePayload, handleUpdateVariablePayload, updateVariables } = useVariables({
    initialVariables,
    fieldValue: field.value,
    cb,
  });

  const removeItem = (index: number) => {
    const newValues = [...selectedValues]?.filter((a, i) => i !== index);
    setSelectedValues(newValues);
    onSelect({ key: field.name, value: newValues });
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
    onSelect({ key: field.name, value: newValues });
    setFieldIndex(null);
    setItemValue('');
  };

  const allOptions = options?.length ? options?.filter(({ value }) => !selectedValues?.includes(value)) : [];

  const variableSelections = useMemo(() => {
    return selectedValues?.filter(value => value?.includes('{{') && value?.includes('}}'));
  }, [selectedValues]);

  const totalVariablesSelection = variableSelections.length;

  useEffect(() => {
    updateVariables(variableSelections.map(value => value));
  }, [variableSelections]);

  return (
    <div className="flex flex-col gap-2">
      <TooltipProvider delayDuration={0}>
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
      </TooltipProvider>
      <Popover open={openPopover} onOpenChange={setOpenPopover}>
        <PopoverTrigger asChild>
          <div className="flex cursor-pointer items-center gap-2">
            <Icon name="plus-icon" className="text-accent-2 text-xs" />
            <p className="text-accent-2 flex items-center text-xs">{`Add ${lodashTitleCase(field.name)}`}</p>
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
            'border-1 border-neutral-750 bg-neutral-750/50 w-[var(--radix-popover-trigger-width)] p-0 backdrop-blur-md',
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
              placeholder={`Search or enter new ${lodashTitleCase(field?.name)}`}
              className="h-9 placeholder:text-neutral-500"
              value={itemValue}
              onValueChange={search => setItemValue(search)}
            />
            <CommandGroup
              className={cn('max-h-[50vh] overflow-auto', {
                'h-0 !p-0': !allOptions?.length && !selectedValues?.length,
              })}
            >
              {!withoutClearSelection && selectedValues?.length ? (
                <CommandList>
                  <CommandItem
                    key={`clear-selection`}
                    value="vvv"
                    className="group mt-0.5 flex w-full !cursor-pointer justify-between gap-2 first:mt-0"
                    onSelect={e => {
                      setOpenPopover(false);
                      setSelectedValues([]);
                      onSelect({ key: field?.name, value: [] });
                    }}
                  >
                    <span>Clear selection</span>
                    <Icon className="text-mastra-el-3 group-hover:text-mastra-el-6 transition-colors" name="cancel" />
                  </CommandItem>
                </CommandList>
              ) : null}
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

      <div className="flex w-max max-w-full flex-col gap-2" onClick={e => e.stopPropagation()}>
        {canUseVariables && (
          <VariableBadgeList
            className="mt-0"
            handleUpdateVariablePayload={handleUpdateVariablePayload}
            variablePayload={variablePayload}
            variables={variables}
          />
        )}
        {canUseVariables && (
          <Button
            type="button"
            onClick={e => {
              e.stopPropagation();
              const newValues = [...selectedValues, `{{${field.name}${totalVariablesSelection}}}`];
              setSelectedValues(newValues);
              onSelect({ key: field.name, value: newValues });
            }}
            className="group flex w-max items-center gap-1 rounded bg-white/[0.025] p-1"
            variant={'secondary'}
          >
            <span className="text-white/70 transition-colors duration-150 ease-in-out group-hover:text-white/80">{`{{}}`}</span>
            <span className="text-[0.75rem] text-white/30 transition-colors duration-150 ease-in-out group-hover:text-white/80">
              use variables
            </span>
          </Button>
        )}
      </div>
    </div>
  );
};

export default CreatableSelect;
